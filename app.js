/* app.js – komplette Logik für Wappenringe der Familie Geppert */

const STORAGE_KEY = "familyRing_upd56b";
let people = [];
const undoStack = [];
const redoStack = [];
const MAX_UNDO_STEPS = 50;

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const messages = {
    personNotFound: "Person nicht gefunden.",
    invalidDate: "Ungültiges Geburtsdatum-Format. Bitte verwenden Sie TT.MM.JJJJ (z.B. 04.12.2000)",
    invalidDeathDate: "Ungültiges Todesdatum-Format. Bitte verwenden Sie TT.MM.JJJJ (z.B. 04.12.2000)",
    requiredFields: "Bitte füllen Sie alle Pflichtfelder aus (Name, Geburtsdatum, Geburtsort, Geschlecht)",
    duplicateCode: "Person mit diesem Code existiert bereits!",
    importError: "Fehlerhafte Daten können nicht importiert werden."
};

/* --------------------- VALIDIERUNG --------------------- */
function validateBirthDate(dateString) {
    if (!dateString) return true;
    const regex = /^(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[0-2])\.\d{4}$/;
    if (!regex.test(dateString)) return false;
    const parts = dateString.split('.');
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function validateDeathDate(dateString) { return validateBirthDate(dateString); }
function validateRequiredFields(person) { return person.Name && person.Gender && person.BirthPlace; }
function validatePerson(person) {
    if (!validateRequiredFields(person)) return false;
    if (person.Birth && !validateBirthDate(person.Birth)) return false;
    if (person.Death && !validateDeathDate(person.Death)) return false;
    return true;
}

/* --------------------- TABELLE --------------------- */
function renderTable() {
    computeRingCodes();
    const q = ($("#search").value || "").trim().toLowerCase();
    const tb = $("#peopleTable tbody");
    tb.innerHTML = "";

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function safeMark(txt) {
        if (!q) return escapeHtml(String(txt || ""));
        const s = String(txt || "");
        const i = s.toLowerCase().indexOf(q);
        if (i < 0) return escapeHtml(s);
        return escapeHtml(s.slice(0, i)) + "<mark>" + escapeHtml(s.slice(i, i + q.length)) + "</mark>" + escapeHtml(s.slice(i + q.length));
    }

    const genColors = {
        1: "#e8f5e8", 2: "#e3f2fd", 3: "#f3e5f5",
        4: "#fff3e0", 5: "#e8eaf6", 6: "#f1f8e9", 7: "#ffebee"
    };

    people.sort((a, b) => (a.Gen || 0) - (b.Gen || 0) || String(a.Code).localeCompare(String(b.Code)));

    for (const p of people) {
        const hide = q && !(
            String(p.Name || "").toLowerCase().includes(q) ||
            String(p.Code || "").toLowerCase().includes(q) ||
            String(p.RingCode || "").toLowerCase().includes(q)
        );
        if (hide) continue;

        const tr = document.createElement("tr");
        const cols = ["Gen", "Code", "RingCode", "Name", "Birth", "Death", "BirthPlace", "ParentCode", "PartnerCode", "InheritedFrom", "Note"];
        const gen = p.Gen || 1;
        const bgColor = genColors[gen] || "#ffffff";
        tr.style.backgroundColor = bgColor;

        cols.forEach(k => {
            const td = document.createElement("td");
            if (k === "Name") {
                let symbol = "";
                if (p.Gender === "m") symbol = "♂ ";
                else if (p.Gender === "w") symbol = "♀ ";
                else if (p.Gender === "d") symbol = "⚧ ";
                td.innerHTML = symbol + safeMark(p.Name || "");
            } else {
                td.innerHTML = safeMark(p[k] ?? "");
            }
            tr.appendChild(td);
        });

        tr.addEventListener("dblclick", () => openEdit(p.Code));
        tb.appendChild(tr);
    }
}

/* --------------------- STAMMBAUM --------------------- */
function renderTree() {
    computeRingCodes();
    const el = $("#tree");
    el.innerHTML = "";

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("viewBox", "0 0 2400 1600");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    const nodeRadius = 20;
    const xStep = 120;
    const yStep = 100;
    const positions = {};

    people.forEach((p, i) => {
        const x = (i % 10) * xStep + 50;
        const y = Math.floor(i / 10) * yStep + 50;
        positions[p.Code] = {x, y};

        const circle = document.createElementNS(svgNS, "circle");
        circle.setAttribute("cx", x);
        circle.setAttribute("cy", y);
        circle.setAttribute("r", nodeRadius);
        circle.setAttribute("fill", "#4f46e5");
        circle.setAttribute("stroke", "#333");
        circle.setAttribute("stroke-width", 2);
        svg.appendChild(circle);

        const text = document.createElementNS(svgNS, "text");
        text.setAttribute("x", x);
        text.setAttribute("y", y + 5);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("font-size", "12");
        text.setAttribute("fill", "#fff");
        text.textContent = p.Name;
        svg.appendChild(text);
    });

    people.forEach(p => {
        if (p.ParentCode && positions[p.ParentCode]) {
            const parentPos = positions[p.ParentCode];
            const childPos = positions[p.Code];
            const line = document.createElementNS(svgNS, "line");
            line.setAttribute("x1", parentPos.x);
            line.setAttribute("y1", parentPos.y + nodeRadius);
            line.setAttribute("x2", childPos.x);
            line.setAttribute("y2", childPos.y - nodeRadius);
            line.setAttribute("stroke", "#666");
            line.setAttribute("stroke-width", 2);
            svg.appendChild(line);
        }
    });

    el.appendChild(svg);
}

/* --------------------- DIALOGE --------------------- */
function openNew() {
    $("#pName").value = ""; $("#pBirth").value = ""; $("#pDeath").value = "";
    $("#pPlace").value = ""; $("#pGender").value = ""; $("#pParent").value = "";
    $("#pPartner").value = ""; $("#pInherited").value = ""; $("#pNote").value = "";
    $("#dlgNew").showModal();
}

function addNew() {
    const name = $("#pName").value.trim();
    const birth = $("#pBirth").value.trim();
    const death = $("#pDeath").value.trim();
    const place = $("#pPlace").value.trim();
    const gender = $("#pGender").value;
    const parent = normalizePersonCode($("#pParent").value.trim());
    const partner = normalizePersonCode($("#pPartner").value.trim());
    const inherited = normalizePersonCode($("#pInherited").value.trim());
    const note = $("#pNote").value.trim();

    if (!name || !place || !gender) { alert(messages.requiredFields); return; }
    if (birth && !validateBirthDate(birth)) { alert(messages.invalidDate); return; }
    if (death && !validateDeathDate(death)) { alert(messages.invalidDeathDate); return; }

    const gen = computeGenFromInput(parent);
    const code = allocateCode(gen, parent);
    const p = { Gen: gen, Code: code, Name: name, Birth: birth, Death: death,
                BirthPlace: place, Gender: gender, ParentCode: parent,
                PartnerCode: partner, InheritedFrom: inherited, Note: note };

    pushUndo();
    people.push(p);
    saveState();
    closeDialogs();
    updateUI();
}

let editCode = null;
function openEdit(code) {
    const p = people.find(x => x.Code === code);
    if (!p) return;
    editCode = code;
    $("#eName").value = p.Name || ""; $("#eBirth").value = p.Birth || "";
    $("#eDeath").value = p.Death || ""; $("#ePlace").value = p.BirthPlace || "";
    $("#eGender").value = p.Gender || ""; $("#eParent").value = p.ParentCode || "";
    $("#ePartner").value = p.PartnerCode || ""; $("#eInherited").value = p.InheritedFrom || "";
    $("#eNote").value = p.Note || "";
    $("#dlgEdit").showModal();
}

function saveEditFn() {
    if (!editCode) return;
    const p = people.find(x => x.Code === editCode);
    if (!p) return;

    const name = $("#eName").value.trim();
    const birth = $("#eBirth").value.trim();
    const death = $("#eDeath").value.trim();
    const place = $("#ePlace").value.trim();
    const gender = $("#eGender").value;
    const parent = normalizePersonCode($("#eParent").value.trim());
    const partner = normalizePersonCode($("#ePartner").value.trim());
    const inherited = normalizePersonCode($("#eInherited").value.trim());
    const note = $("#eNote").value.trim();

    if (!name || !place || !gender) { alert(messages.requiredFields); return; }
    if (birth && !validateBirthDate(birth)) { alert(messages.invalidDate); return; }
    if (death && !validateDeathDate(death)) { alert(messages.invalidDeathDate); return; }

    pushUndo();
    p.Name = name;
    p.Birth = birth;
    p.Death = death;
    p.BirthPlace = place;
    p.Gender = gender;
    p.ParentCode = parent;
    p.PartnerCode = partner;
    p.InheritedFrom = inherited;
    p.Note = note;
    saveState();
    closeDialogs();
    updateUI();
}

/* --------------------- HILFSFUNKTIONEN --------------------- */
function updateUI() { renderTable(); renderTree(); }
function computeRingCodes() { people.forEach(p => { p.RingCode = p.Code + "-" + (p.Gen || 1); }); }
function computeGenFromInput(parentCode) { 
    if (!parentCode) return 1; 
    const parent = people.find(x => x.Code === parentCode); 
    return parent ? (parent.Gen + 1) : 1; 
}
function allocateCode(gen, parentCode) { 
    let base = parentCode || "1"; 
    let suffix = 1; 
    while (people.find(p => p.Code === base + (suffix > 1 ? suffix : ""))) suffix++; 
    return base + (suffix > 1 ? suffix : ""); 
}
function normalizePersonCode(code) { return code.trim().toUpperCase(); }
function pushUndo() { undoStack.push(JSON.stringify(people)); if (undoStack.length > MAX_UNDO_STEPS) undoStack.shift(); redoStack.length = 0; }
function undo() { if (undoStack.length) { redoStack.push(JSON.stringify(people)); people = JSON.parse(undoStack.pop()); updateUI(); saveState(); } }
function redo() { if (redoStack.length) { undoStack.push(JSON.stringify(people)); people = JSON.parse(redoStack.pop()); updateUI(); saveState(); } }
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(people)); }
function loadState() { const data = localStorage.getItem(STORAGE_KEY); if (data) people = JSON.parse(data); }
function deletePerson() { const sel = prompt("Code der zu löschenden Person:"); if (!sel) return; const idx = people.findIndex(p => p.Code === sel); if (idx >= 0) { pushUndo(); people.splice(idx, 1); saveState(); updateUI(); } else alert(messages.personNotFound); }
function doImport(file) { 
    const reader = new FileReader();
    reader.onload = e => { try { const data = JSON.parse(e.target.result); people = data; saveState(); updateUI(); } catch { alert(messages.importError); } };
    reader.readAsText(file);
}
function exportJSON() { const blob = new Blob([JSON.stringify(people, null, 2)], {type:"application/json"}); shareOrDownload("familie.json", blob); }
function exportCSV() { const cols = ["Gen", "Code", "RingCode", "Name", "Birth", "Death", "BirthPlace", "ParentCode", "PartnerCode", "InheritedFrom", "Note"]; const lines = [cols.join(";")]; for (const p of people) { lines.push(cols.map(c => String(p[c] ?? "").replace(/;/g, ",")).join(";")); } const blob = new Blob([lines.join("\n")], { type: "text/csv" }); shareOrDownload("familie.csv", blob); }
function shareOrDownload(filename, blob) { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); }
function printTable() { const w = window.open(); w.document.write($("#peopleTable").outerHTML); w.print(); w.close(); }
function printTree() { const w = window.open(); w.document.write($("#tree").outerHTML); w.print(); w.close(); }
function updateStats() { /* kann beliebige Statistiken anzeigen */ }
function setupTreeInteractions() { /* kann Drag/Zoom für Stammbaum enthalten */ }
function closeDialogs() { $$("dialog").forEach(d => d.close()); }

/* --------------------- EVENT LISTENERS --------------------- */
function setupEventListeners() {
    $("#btnNew").addEventListener("click", openNew);
    $("#saveNew").addEventListener("click", e => { e.preventDefault(); addNew(); });
    $("#saveEdit").addEventListener("click", e => { e.preventDefault(); saveEditFn(); });
    $("#btnDelete").addEventListener("click", deletePerson);
    $("#btnImport").addEventListener("click", () => { const inp = document.createElement("input"); inp.type="file"; inp.accept=".json,.csv"; inp.onchange=()=>{ if(inp.files[0]) doImport(inp.files[0]); }; inp.click(); });
    $("#btnExport").addEventListener("click", () => $("#dlgExport").showModal());
    $("#btnExportJSON").addEventListener("click", exportJSON);
    $("#btnExportCSV").addEventListener("click", exportCSV);
    $("#btnPrint").addEventListener("click", () => $("#dlgPrint").showModal());
    $("#btnPrintTable").addEventListener("click", printTable);
    $("#btnPrintTree").addEventListener("click", printTree);
    $("#btnStats").addEventListener("click", () => { updateStats(); $("#dlgStats").showModal(); });
    $("#btnHelp").addEventListener("click", () => { fetch("hilfe.html").then(r=>r.text()).then(html=>{$("#helpContent").innerHTML=html; $("#dlgHelp").showModal();}).catch(()=>alert("Hilfe konnte nicht geladen werden.")); });
    $("#btnUndo").addEventListener("click", undo);
    $("#btnRedo").addEventListener("click", redo);
    $("#search").addEventListener("input", renderTable);
    $$(".close-x").forEach(b=>b.addEventListener("click",closeDialogs));
}

function ensureVersionVisibility() {
    const versionRibbon = document.getElementById('versionRibbon');
    const versionUnderTable = document.getElementById('versionUnderTable');
    if (versionRibbon) versionRibbon.style.display='block';
    if (versionUnderTable) versionUnderTable.style.display='block';
}

/* --------------------- INIT --------------------- */
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    setupEventListeners();
    updateUI();
    setTimeout(setupTreeInteractions, 1000);
    ensureVersionVisibility();
});
