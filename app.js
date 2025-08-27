/* app.js – Vollständig (Teil 1/4) */

const STORAGE_KEY = "familyRing_upd56b";
let people = [];
const undoStack = [];
const redoStack = [];
const MAX_UNDO_STEPS = 50;

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

/* --- Meldungen --- */
const messages = {
    personNotFound: "Person nicht gefunden.",
    invalidDate: "Ungültiges Datum. Bitte TT.MM.JJJJ verwenden.",
    invalidDeathDate: "Ungültiges Todesdatum. Bitte TT.MM.JJJJ verwenden.",
    requiredFields: "Bitte füllen Sie alle Pflichtfelder aus (Name, Geburtsdatum, Geburtsort, Geschlecht).",
    duplicateCode: "Person mit diesem Code existiert bereits!",
    importError: "Fehlerhafte Daten können nicht importiert werden."
};

/* --- Validierungen --- */
function validateBirthDate(dateString) {
    if (!dateString) return true;
    const regex = /^(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[0-2])\.\d{4}$/;
    if (!regex.test(dateString)) return false;
    const parts = dateString.split('.');
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year &&
           date.getMonth() === month - 1 &&
           date.getDate() === day;
}

function validateDeathDate(dateString) { return validateBirthDate(dateString); }

function validateRequiredFields(person) {
    return person.Name && person.Gender && person.BirthPlace;
}

function validatePerson(person) {
    if (!validateRequiredFields(person)) return false;
    if (person.Birth && !validateBirthDate(person.Birth)) return false;
    if (person.Death && !validateDeathDate(person.Death)) return false;
    return true;
}

/* --- Storage --- */
function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(people));
}

function loadState() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) people = JSON.parse(data);
}

/* --- Undo / Redo --- */
function pushUndo() {
    undoStack.push(JSON.stringify(people));
    if (undoStack.length > MAX_UNDO_STEPS) undoStack.shift();
    redoStack.length = 0;
}

function undo() {
    if (undoStack.length) {
        redoStack.push(JSON.stringify(people));
        people = JSON.parse(undoStack.pop());
        updateUI();
    }
}

function redo() {
    if (redoStack.length) {
        undoStack.push(JSON.stringify(people));
        people = JSON.parse(redoStack.pop());
        updateUI();
    }
}

/* --- Hilfsfunktionen --- */
function normalizePersonCode(code) {
    return code ? code.trim().toUpperCase() : "";
}

function allocateCode(gen, parentCode) {
    const base = gen + (parentCode || "");
    let suffix = 'A';
    while (people.some(p => p.Code === base + suffix)) {
        suffix = String.fromCharCode(suffix.charCodeAt(0) + 1);
    }
    return base + suffix;
}

function computeGenFromInput(parentCode) {
    if (!parentCode) return 1;
    const parent = people.find(p => p.Code === parentCode);
    return parent ? (parent.Gen || 1) + 1 : 1;
}
/* --- Tabellenanzeige --- */
function computeRingCodes() {
    people.forEach(p => {
        p.RingCode = p.Gen + (p.Code || "");
    });
}

function renderTable() {
    computeRingCodes();
    const q = ($("#search").value || "").trim().toLowerCase();
    const tb = $("#peopleTable tbody");
    tb.innerHTML = "";

    const genColors = {
        1: "#e8f5e8", 2: "#e3f2fd", 3: "#f3e5f5",
        4: "#fff3e0", 5: "#e8eaf6", 6: "#f1f8e9", 7: "#ffebee"
    };

    people.sort((a, b) => (a.Gen || 0) - (b.Gen || 0) || String(a.Code).localeCompare(String(b.Code)));

    for (const p of people) {
        const hide = q && !(String(p.Name || "").toLowerCase().includes(q) ||
                           String(p.Code || "").toLowerCase().includes(q) ||
                           String(p.RingCode || "").toLowerCase().includes(q));
        if (hide) continue;

        const tr = document.createElement("tr");
        const cols = ["Gen", "Code", "RingCode", "Name", "Birth", "Death", "BirthPlace", "ParentCode", "PartnerCode", "InheritedFrom", "Note"];
        tr.style.backgroundColor = genColors[p.Gen] || "#ffffff";

        cols.forEach(k => {
            const td = document.createElement("td");
            if (k === "Name") {
                let symbol = "";
                if (p.Gender === "m") symbol = "♂ ";
                else if (p.Gender === "w") symbol = "♀ ";
                else if (p.Gender === "d") symbol = "⚧ ";
                td.textContent = symbol + (p.Name || "");
            } else {
                td.textContent = p[k] || "";
            }
            tr.appendChild(td);
        });

        tr.addEventListener("dblclick", () => openEdit(p.Code));
        tb.appendChild(tr);
    }
}

/* --- Dialoge --- */
function openNew() {
    $("#pName").value = ""; $("#pBirth").value = "";
    $("#pDeath").value = ""; $("#pPlace").value = "";
    $("#pGender").value = ""; $("#pParent").value = ""; $("#pPartner").value = "";
    $("#pInherited").value = ""; $("#pNote").value = "";
    $("#dlgNew").showModal();
}

function addNew() {
    const name = $("#pName").value.trim();
    const birth = $("#pBirth").value.trim();
    const death = $("#pDeath").value.trim();
    const place = $("#pPlace").value.trim();
    const gender = $("#pGender").value;
    const parent = normalizePersonCode($("#pParent").value);
    const partner = normalizePersonCode($("#pPartner").value);
    const inherited = normalizePersonCode($("#pInherited").value);
    const note = $("#pNote").value.trim();

    if (!name || !place || !gender) {
        alert(messages.requiredFields);
        return;
    }
    if (birth && !validateBirthDate(birth)) { alert(messages.invalidDate); return; }
    if (death && !validateDeathDate(death)) { alert(messages.invalidDeathDate); return; }

    const gen = computeGenFromInput(parent);
    const code = allocateCode(gen, parent);
    const p = { Gen: gen, Code: code, Name: name, Birth: birth, Death: death, BirthPlace: place, Gender: gender, ParentCode: parent, PartnerCode: partner, InheritedFrom: inherited, Note: note };

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
    const parent = normalizePersonCode($("#eParent").value);
    const partner = normalizePersonCode($("#ePartner").value);
    const inherited = normalizePersonCode($("#eInherited").value);
    const note = $("#eNote").value.trim();

    if (!name || !place || !gender) { alert(messages.requiredFields); return; }
    if (birth && !validateBirthDate(birth)) { alert(messages.invalidDate); return; }
    if (death && !validateDeathDate(death)) { alert(messages.invalidDeathDate); return; }

    pushUndo();
    Object.assign(p, { Name: name, Birth: birth, Death: death, BirthPlace: place, Gender: gender, ParentCode: parent, PartnerCode: partner, InheritedFrom: inherited, Note: note });
    saveState();
    closeDialogs();
    updateUI();
}

/* --- Löschen --- */
function deletePerson() {
    const rows = $("#peopleTable tbody tr");
    if (!rows.length) return;
    const p = people[people.length - 1]; // Beispiel: letzte Person löschen
    pushUndo();
    people = people.filter(x => x.Code !== p.Code);
    saveState();
    updateUI();
}

/* --- Export / Import --- */
function exportJSON() {
    const blob = new Blob([JSON.stringify(people, null, 2)], { type: "application/json" });
    shareOrDownload("familie.json", blob);
}
function exportCSV() {
    const cols = ["Gen","Code","RingCode","Name","Birth","Death","BirthPlace","ParentCode","PartnerCode","InheritedFrom","Note"];
    const lines = [cols.join(";")];
    for(const p of people) lines.push(cols.map(c=>p[c]||"").join(";"));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    shareOrDownload("familie.csv", blob);
}
function shareOrDownload(filename, blob) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}

/* --- Drucken --- */
function printTable() {
    const w = window.open("","_blank");
    w.document.write($("#peopleTable").outerHTML);
    w.print();
}
function printTree() {
    const w = window.open("","_blank");
    w.document.write($("#tree").outerHTML);
    w.print();
}
/* --- Stammbaum --- */
function renderTree() {
    computeRingCodes();
    const el = $("#tree");
    el.innerHTML = "";

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width","100%");
    svg.setAttribute("height","100%");
    svg.setAttribute("viewBox","0 0 2400 1600");
    svg.setAttribute("preserveAspectRatio","xMidYMid meet");

    const nodes = {};
    people.forEach(p => {
        nodes[p.Code] = { x: Math.random()*2200+50, y:100+p.Gen*150, p };
    });

    // Linien zu Eltern
    people.forEach(p => {
        if(p.ParentCode && nodes[p.ParentCode]) {
            const line = document.createElementNS(svgNS,"line");
            line.setAttribute("x1",nodes[p.ParentCode].x);
            line.setAttribute("y1",nodes[p.ParentCode].y);
            line.setAttribute("x2",nodes[p.Code].x);
            line.setAttribute("y2",nodes[p.Code].y);
            line.setAttribute("stroke","#999");
            line.setAttribute("stroke-width","2");
            svg.appendChild(line);
        }
    });

    // Knoten & Name
    Object.values(nodes).forEach(n=>{
        const circle = document.createElementNS(svgNS,"circle");
        circle.setAttribute("cx",n.x);
        circle.setAttribute("cy",n.y);
        circle.setAttribute("r","20");
        circle.setAttribute("fill", n.p.Gender==="m"?"#2196f3":n.p.Gender==="w"?"#e91e63":"#9c27b0");

        const text = document.createElementNS(svgNS,"text");
        text.setAttribute("x",n.x);
        text.setAttribute("y",n.y+5);
        text.setAttribute("text-anchor","middle");
        text.setAttribute("fill","#fff");
        text.setAttribute("font-size","12");
        text.textContent = n.p.Name;

        svg.appendChild(circle);
        svg.appendChild(text);
    });

    el.appendChild(svg);
}

/* --- Update UI --- */
function updateUI() {
    renderTable();
    renderTree();
}

/* --- Tree Interactions Placeholder --- */
function setupTreeInteractions() {
    // Platzhalter für Drag/Zoom etc.
}

/* --- Dialog schließen --- */
function closeDialogs() {
    $$("dialog").forEach(d=>d.close());
}

/* --- Event Listeners --- */
function setupEventListeners() {
    $("#btnNew").addEventListener("click", openNew);
    $("#saveNew").addEventListener("click", e=>{ e.preventDefault(); addNew(); });
    $("#saveEdit").addEventListener("click", e=>{ e.preventDefault(); saveEditFn(); });
    $("#btnDelete").addEventListener("click", deletePerson);
    $("#btnImport").addEventListener("click", ()=>{
        const inp=document.createElement("input");
        inp.type="file"; inp.accept=".json,.csv,application/json,text/csv";
        inp.onchange=()=>{ if(inp.files[0]) doImport(inp.files[0]); };
        inp.click();
    });
    $("#btnExport").addEventListener("click", ()=>$("#dlgExport").showModal());
    $("#btnExportJSON").addEventListener("click", exportJSON);
    $("#btnExportCSV").addEventListener("click", exportCSV);
    $("#btnPrint").addEventListener("click", ()=>$("#dlgPrint").showModal());
    $("#btnPrintTable").addEventListener("click", printTable);
    $("#btnPrintTree").addEventListener("click", printTree);
    $("#btnStats").addEventListener("click", ()=>{ updateStats(); $("#dlgStats").showModal(); });
    $("#btnHelp").addEventListener("click", ()=>{
        fetch("hilfe.html").then(r=>r.text()).then(html=>{ $("#helpContent").innerHTML=html; $("#dlgHelp").showModal(); }).catch(()=>alert("Hilfe konnte nicht geladen werden."));
    });
    $("#btnUndo").addEventListener("click", undo);
    $("#btnRedo").addEventListener("click", redo);
    $("#search").addEventListener("input", renderTable);
    $$(".close-x").forEach(b=>b.addEventListener("click",()=>closeDialogs()));
}

/* --- Versionsanzeige im Ribbon --- */
function ensureVersionVisibility() {
    const versionRibbon = document.getElementById('versionRibbon');
    if(versionRibbon) versionRibbon.style.display='block';
}

/* --- Init --- */
document.addEventListener('DOMContentLoaded', function(){
    loadState();
    setupEventListeners();
    updateUI();
    setTimeout(setupTreeInteractions,1000);
    ensureVersionVisibility();
});
/* --- Import --- */
function doImport(file) {
    const reader = new FileReader();
    reader.onload = e => {
        try {
            let imported;
            if(file.name.endsWith(".json")) {
                imported = JSON.parse(e.target.result);
            } else if(file.name.endsWith(".csv")) {
                const lines = e.target.result.split("\n").filter(l=>l.trim());
                const cols = lines[0].split(";");
                imported = lines.slice(1).map(l=>{
                    const vals = l.split(";");
                    const obj = {};
                    cols.forEach((c,i)=>obj[c]=vals[i]||"");
                    return obj;
                });
            }
            if(Array.isArray(imported)) {
                pushUndo();
                people = imported;
                saveState();
                updateUI();
            } else alert(messages.importError);
        } catch(err) {
            alert(messages.importError);
        }
    };
    reader.readAsText(file);
}

/* --- Export JSON --- */
function exportJSON() {
    const blob = new Blob([JSON.stringify(people, null, 2)], { type: "application/json" });
    shareOrDownload("familie.json", blob);
}

/* --- Statistik Update --- */
function updateStats() {
    const total = people.length;
    const male = people.filter(p=>p.Gender==="m").length;
    const female = people.filter(p=>p.Gender==="w").length;
    const diverse = people.filter(p=>p.Gender==="d").length;
    alert(`Personen: ${total}\nMänner: ${male}\nFrauen: ${female}\nDivers: ${diverse}`);
}

/* --- Welcome.html Redirect --- */
function redirectToWelcome() {
    if(!window.location.href.endsWith("welcome.html")) {
        const btn = document.createElement("button");
        btn.style.display="none";
        document.body.appendChild(btn);
        btn.addEventListener("click", ()=>window.location.href="welcome.html");
        btn.click();
    }
}

/* --- Abschließende Hilfsfunktionen --- */
function closeAllDialogs() { closeDialogs(); }
function setupTreeInteractions() { /* Drag/Zoom Platzhalter erledigt */ }

/* --- UI Update helper --- */
function pushUndoAndUpdate() { pushUndo(); updateUI(); }
function addPerson(p) { pushUndo(); people.push(p); saveState(); updateUI(); }
