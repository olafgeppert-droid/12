/* app.js – Teil 1: Grundstruktur, Validierung, Undo/Redo, Storage */
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

function validateDeathDate(dateString) {
    return validateBirthDate(dateString);
}

function validateRequiredFields(person) {
    return person.Name && person.Gender && person.BirthPlace;
}

function validatePerson(person) {
    if (!validateRequiredFields(person)) return false;
    if (person.Birth && !validateBirthDate(person.Birth)) return false;
    if (person.Death && !validateDeathDate(person.Death)) return false;
    return true;
}

function pushUndo() {
    undoStack.push(JSON.stringify(people));
    if (undoStack.length > MAX_UNDO_STEPS) undoStack.shift();
    redoStack.length = 0;
}

function undo() {
    if (!undoStack.length) return;
    redoStack.push(JSON.stringify(people));
    people = JSON.parse(undoStack.pop());
    updateUI();
    saveState();
}

function redo() {
    if (!redoStack.length) return;
    undoStack.push(JSON.stringify(people));
    people = JSON.parse(redoStack.pop());
    updateUI();
    saveState();
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(people));
}

function loadState() {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) people = JSON.parse(s);
}

/* app.js – Teil 2: Tabelle, Stammbaum, Dialoge, UI-Funktionen */

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
        const cols = ["Gen","Code","RingCode","Name","Birth","Death","BirthPlace","ParentCode","PartnerCode","InheritedFrom","Note"];
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
            } else td.innerHTML = safeMark(p[k] ?? "");
            tr.appendChild(td);
        });

        tr.addEventListener("dblclick", () => openEdit(p.Code));
        tb.appendChild(tr);
    }
}

function renderTree() {
    computeRingCodes();
    const el = $("#tree");
    el.innerHTML = "";

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("viewBox", "0 0 1200 800");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    // Gruppiere Personen nach Generation
    const gens = {};
    people.forEach(p => {
        const g = p.Gen || 1;
        if (!gens[g]) gens[g] = [];
        gens[g].push(p);
    });

    const genCount = Object.keys(gens).length;
    const xSpacing = 1200 / (Math.max(...Object.values(gens).map(arr => arr.length)) + 1);
    const ySpacing = 700 / (genCount + 1);

    const nodeMap = {}; // Code -> Position
    Object.keys(gens).forEach(g => {
        const arr = gens[g];
        arr.forEach((p, i) => {
            const x = (i + 1) * xSpacing;
            const y = g * ySpacing;
            nodeMap[p.Code] = { x, y, person: p };
        });
    });

    // Linien: Eltern -> Kind
    people.forEach(p => {
        if (p.ParentCode && nodeMap[p.ParentCode]) {
            const parentPos = nodeMap[p.ParentCode];
            const childPos = nodeMap[p.Code];
            const line = document.createElementNS(svgNS, "line");
            line.setAttribute("x1", parentPos.x);
            line.setAttribute("y1", parentPos.y + 15);
            line.setAttribute("x2", childPos.x);
            line.setAttribute("y2", childPos.y - 15);
            line.setAttribute("stroke", "#555");
            line.setAttribute("stroke-width", "1.5");
            svg.appendChild(line);
        }
    });

    // Linien: Partner
    people.forEach(p => {
        if (p.PartnerCode && nodeMap[p.PartnerCode]) {
            const p1 = nodeMap[p.Code];
            const p2 = nodeMap[p.PartnerCode];
            const line = document.createElementNS(svgNS, "line");
            line.setAttribute("x1", p1.x);
            line.setAttribute("y1", p1.y);
            line.setAttribute("x2", p2.x);
            line.setAttribute("y2", p2.y);
            line.setAttribute("stroke", "#e91e63");
            line.setAttribute("stroke-width", "1");
            line.setAttribute("stroke-dasharray", "4,2");
            svg.appendChild(line);
        }
    });

    // Knoten zeichnen
    Object.values(nodeMap).forEach(n => {
        const circle = document.createElementNS(svgNS, "circle");
        circle.setAttribute("cx", n.x);
        circle.setAttribute("cy", n.y);
        circle.setAttribute("r", "15");
        const genColor = `var(--gen${n.person.Gen || 1}-color)`;
        circle.setAttribute("fill", genColor);
        circle.setAttribute("stroke", "#333");
        circle.setAttribute("stroke-width", "1.5");
        svg.appendChild(circle);

        const text = document.createElementNS(svgNS, "text");
        text.setAttribute("x", n.x);
        text.setAttribute("y", n.y + 5);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("font-size", "10px");
        text.setAttribute("fill", "#111");
        text.textContent = n.person.Name || n.person.Code;
        svg.appendChild(text);
    });

    el.appendChild(svg);
}

/* Dialoge */
function openNew() {
    $("#pName").value=""; $("#pBirth").value="";
    $("#pDeath").value=""; $("#pPlace").value="";
    $("#pGender").value=""; $("#pParent").value=""; $("#pPartner").value="";
    $("#pInherited").value=""; $("#pNote").value="";
    $("#dlgNew").showModal();
}

function addNew() {
    const name=$("#pName").value.trim();
    const birth=$("#pBirth").value.trim();
    const death=($("#pDeath") ? $("#pDeath").value.trim() : "");
    const place=$("#pPlace").value.trim();
    const gender=$("#pGender").value;
    const parent=normalizePersonCode($("#pParent").value.trim());
    const partner=normalizePersonCode($("#pPartner").value.trim());
    const inherited=normalizePersonCode($("#pInherited").value.trim());
    const note=$("#pNote").value.trim();

    if(!name || !place || !gender) {
        alert(messages.requiredFields);
        return;
    }
    if(birth && !validateBirthDate(birth)) { alert(messages.invalidDate); return; }
    if(death && !validateDeathDate(death)) { alert(messages.invalidDeathDate); return; }

    const gen = computeGenFromInput(parent);
    const code = allocateCode(gen,parent);
    const p={Gen:gen,Code:code,Name:name,Birth:birth,Death:death,BirthPlace:place,Gender:gender,ParentCode:parent,PartnerCode:partner,InheritedFrom:inherited,Note:note};
    pushUndo();
    people.push(p);
    saveState();
    closeDialogs();
    updateUI();
}

let editCode = null;
function openEdit(code){
    const p=people.find(x=>x.Code===code);
    if(!p)return;
    editCode=code;
    $("#eName").value=p.Name||""; $("#eBirth").value=p.Birth||"";
    $("#eDeath").value=p.Death||""; $("#ePlace").value=p.BirthPlace||"";
    $("#eGender").value=p.Gender||""; $("#eParent").value=p.ParentCode||""; $("#ePartner").value=p.PartnerCode||"";
    $("#eInherited").value=p.InheritedFrom||""; $("#eNote").value=p.Note||"";
    $("#dlgEdit").showModal();
}

function saveEditFn(){
    if(!editCode)return;
    const p=people.find(x=>x.Code===editCode);
    if(!p)return;

    const name=$("#eName").value.trim();
    const birth=$("#eBirth").value.trim();
    const death=($("#eDeath") ? $("#eDeath").value.trim() : "");
    const place=$("#ePlace").value.trim();
    const gender=$("#eGender").value;
    const parent=normalizePersonCode($("#eParent").value.trim());
    const partner=normalizePersonCode($("#ePartner").value.trim());
    const inherited=normalizePersonCode($("#eInherited").value.trim());
    const note=$("#eNote").value.trim();

    if(!name || !place || !gender){ alert(messages.requiredFields); return; }
    if(birth && !validateBirthDate(birth)){ alert(messages.invalidDate); return; }
    if(death && !validateDeathDate(death)){ alert(messages.invalidDeathDate); return; }

    pushUndo();
    p.Name=name; p.Birth=birth; p.Death=death; p.BirthPlace=place; p.Gender=gender;
    p.ParentCode=parent; p.PartnerCode=partner; p.InheritedFrom=inherited; p.Note=note;
    saveState();
    closeDialogs();
    updateUI();
}
/* app.js – Teil 3: Export, Drucken, Stats, Help, Event-Bindings, Hilfsfunktionen */

function normalizePersonCode(code){
    return (code || "").toUpperCase().replace(/\s+/g,'');
}

function computeGenFromInput(parentCode){
    const parent = people.find(p=>p.Code===parentCode);
    return parent ? (parent.Gen||1)+1 : 1;
}

function allocateCode(gen,parentCode){
    const base = parentCode ? parentCode : gen.toString();
    let suffix = '';
    let counter=1;
    while(people.some(p=>p.Code===base+suffix)){
        suffix = counter>1 ? counter.toString() : 'A';
        counter++;
    }
    return base+suffix;
}

function computeRingCodes(){
    /* Berechnung der Ring-Codes hier einfügen */
}

function closeDialogs(){
    $$('dialog').forEach(d=>d.close());
    editCode=null;
}

function deletePerson(){
    const sel = prompt("Geben Sie den Code der zu löschenden Person ein:");
    if(!sel) return;
    const index = people.findIndex(p=>p.Code===sel.trim());
    if(index<0){ alert(messages.personNotFound); return; }
    pushUndo();
    people.splice(index,1);
    saveState();
    updateUI();
}

function exportJSON(){
    const blob = new Blob([JSON.stringify(people,null,2)], {type:"application/json"});
    shareOrDownload("familie.json",blob);
}

function exportCSV(){
    const cols=["Gen","Code","RingCode","Name","Birth","Death","BirthPlace","ParentCode","PartnerCode","InheritedFrom","Note"];
    const lines=[cols.join(";")];
    for(const p of people) lines.push(cols.map(c=>String(p[c]??"").replace(/;/g,",")).join(";"));
    const blob=new Blob([lines.join("\n")],{type:"text/csv"});
    shareOrDownload("familie.csv",blob);
}

function shareOrDownload(filename,blob){
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download=filename; document.body.appendChild(a);
    a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function printTable(){
    const printWin=window.open("","_blank");
    printWin.document.write("<html><head><title>Druck Tabelle</title></head><body>");
    printWin.document.write($("#peopleTable").outerHTML);
    printWin.document.write("</body></html>");
    printWin.document.close();
    printWin.print();
}

function printTree(){
    const printWin=window.open("","_blank");
    printWin.document.write("<html><head><title>Druck Stammbaum</title></head><body>");
    printWin.document.write($("#tree").outerHTML);
    printWin.document.write("</body></html>");
    printWin.document.close();
    printWin.print();
}

function updateStats(){
    alert("Statistik-Funktion noch implementieren");
}

function setupEventListeners(){
    $("#btnNew").addEventListener("click",openNew);
    $("#saveNew").addEventListener("click",e=>{e.preventDefault(); addNew();});
    $("#saveEdit").addEventListener("click",e=>{e.preventDefault(); saveEditFn();});
    $("#btnDelete").addEventListener("click",deletePerson);
    $("#btnImport").addEventListener("click",()=>{
        const inp=document.createElement("input");
        inp.type="file"; inp.accept=".json,.csv,application/json,text/csv";
        inp.onchange=()=>{ if(inp.files[0]) doImport(inp.files[0]); };
        inp.click();
    });
    $("#btnExport").addEventListener("click",()=>$("#dlgExport")?.showModal());
    $("#btnExportJSON").addEventListener("click",exportJSON);
    $("#btnExportCSV").addEventListener("click",exportCSV);
    $("#btnPrint").addEventListener("click",()=>$("#dlgPrint")?.showModal());
    $("#btnPrintTable").addEventListener("click",printTable);
    $("#btnPrintTree").addEventListener("click",printTree);
    $("#btnStats").addEventListener("click",()=>{ updateStats(); $("#dlgStats")?.showModal(); });
    $("#btnHelp").addEventListener("click",()=>{
        fetch("hilfe.html").then(r=>r.text()).then(html=>{$("#helpContent").innerHTML=html; $("#dlgHelp")?.showModal();})
        .catch(()=>alert("Hilfe konnte nicht geladen werden."));
    });
    $("#btnUndo").addEventListener("click",undo);
    $("#btnRedo").addEventListener("click",redo);
    $("#search").addEventListener("input",renderTable);
    $$(".close-x").forEach(b=>b.addEventListener("click",()=>closeDialogs()));
}

document.addEventListener('DOMContentLoaded',function(){
    loadState();
    setupEventListeners();
    updateUI();
});

