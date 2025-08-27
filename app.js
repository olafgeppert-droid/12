/* app.js – Teil 1 von 3 */
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

function validateDate(dateString) {
    if (!dateString) return true;
    const regex = /^(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[0-2])\.\d{4}$/;
    if (!regex.test(dateString)) return false;
    const [day, month, year] = dateString.split('.').map(x => parseInt(x,10));
    const date = new Date(year, month-1, day);
    return date.getFullYear() === year && date.getMonth() === month-1 && date.getDate() === day;
}

function validateRequiredFields(person) {
    return person.Name && person.Gender && person.BirthPlace;
}

function validatePerson(person) {
    if (!validateRequiredFields(person)) return false;
    if (person.Birth && !validateDate(person.Birth)) return false;
    if (person.Death && !validateDate(person.Death)) return false;
    return true;
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(people));
}

function loadState() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
        try {
            people = JSON.parse(data);
        } catch(e) {
            alert("Fehler beim Laden der Daten. Daten werden zurückgesetzt.");
            people = [];
        }
    }
}

function pushUndo() {
    undoStack.push(JSON.stringify(people));
    if (undoStack.length > MAX_UNDO_STEPS) undoStack.shift();
    redoStack.length = 0;
}

function undo() {
    if (!undoStack.length) return;
    redoStack.push(JSON.stringify(people));
    const prev = undoStack.pop();
    people = JSON.parse(prev);
    updateUI();
}

function redo() {
    if (!redoStack.length) return;
    undoStack.push(JSON.stringify(people));
    const next = redoStack.pop();
    people = JSON.parse(next);
    updateUI();
}

function normalizePersonCode(code) {
    return code ? code.trim().toUpperCase() : "";
}

function allocateCode(gen, parent) {
    const prefix = gen + (parent || "");
    let idx = 1;
    let code;
    do {
        code = prefix + (idx > 1 ? idx : "");
        idx++;
    } while (people.find(p => p.Code === code));
    return code;
}

function computeGenFromInput(parentCode) {
    const parent = people.find(p => p.Code === parentCode);
    return parent ? parent.Gen + 1 : 1;
}

/* Tabelle rendern */
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
        tr.style.backgroundColor = genColors[gen] || "#ffffff";

        cols.forEach(k=>{
            const td = document.createElement("td");
            if(k==="Name"){
                let symbol="";
                if(p.Gender==="m") symbol="♂ ";
                else if(p.Gender==="w") symbol="♀ ";
                else if(p.Gender==="d") symbol="⚧ ";
                td.innerHTML = symbol + safeMark(p.Name || "");
            } else td.innerHTML = safeMark(p[k] ?? "");
            tr.appendChild(td);
        });
        tr.addEventListener("dblclick", ()=>openEdit(p.Code));
        tb.appendChild(tr);
    }
}

/* Dialoge */
function openNew(){
    $("#pName").value = ""; $("#pBirth").value = "";
    $("#pDeath").value = ""; $("#pPlace").value = "";
    $("#pGender").value = ""; $("#pParent").value = ""; $("#pPartner").value = "";
    $("#pInherited").value = ""; $("#pNote").value = "";
    $("#dlgNew").showModal();
}

function addNew(){
    const name = $("#pName").value.trim();
    const birth = $("#pBirth").value.trim();
    const death = ($("#pDeath")?$("#pDeath").value.trim():"");
    const place = $("#pPlace").value.trim();
    const gender = $("#pGender").value;
    const parent = normalizePersonCode($("#pParent").value.trim());
    const partner = normalizePersonCode($("#pPartner").value.trim());
    const inherited = normalizePersonCode($("#pInherited").value.trim());
    const note = $("#pNote").value.trim();

    if (!name || !place || !gender) {
        alert(messages.requiredFields);
        return;
    }
    if (birth && !validateDate(birth)){
        alert(messages.invalidDate); return;
    }
    if (death && !validateDate(death)){
        alert(messages.invalidDeathDate); return;
    }

    const gen = computeGenFromInput(parent);
    const code = allocateCode(gen,parent);
    const p={Gen:gen,Code:code,Name:name,Birth:birth,Death:death,BirthPlace:place,Gender:gender,ParentCode:parent,PartnerCode:partner,InheritedFrom:inherited,Note:note};

    pushUndo();
    people.push(p);
    saveState();
    closeDialogs();
    updateUI();
}

/* … Fortsetzung in Teil 2 … */

/* app.js – Teil 2 von 3 */

/* Öffnen und Speichern von Bearbeitungen */
let editCode = null;

function openEdit(code){
    const p = people.find(x => x.Code === code);
    if(!p) return;
    editCode = code;
    $("#eName").value = p.Name || ""; $("#eBirth").value = p.Birth || "";
    $("#eDeath").value = p.Death || ""; $("#ePlace").value = p.BirthPlace || "";
    $("#eGender").value = p.Gender || ""; $("#eParent").value = p.ParentCode || "";
    $("#ePartner").value = p.PartnerCode || ""; $("#eInherited").value = p.InheritedFrom || "";
    $("#eNote").value = p.Note || "";
    $("#dlgEdit").showModal();
}

function saveEditFn(){
    if(!editCode) return;
    const p = people.find(x => x.Code === editCode);
    if(!p) return;

    const name = $("#eName").value.trim();
    const birth = $("#eBirth").value.trim();
    const death = ($("#eDeath")?$("#eDeath").value.trim():"");
    const place = $("#ePlace").value.trim();
    const gender = $("#eGender").value;
    const parent = normalizePersonCode($("#eParent").value.trim());
    const partner = normalizePersonCode($("#ePartner").value.trim());
    const inherited = normalizePersonCode($("#eInherited").value.trim());
    const note = $("#eNote").value.trim();

    if (!name || !place || !gender) { alert(messages.requiredFields); return; }
    if (birth && !validateDate(birth)){ alert(messages.invalidDate); return; }
    if (death && !validateDate(death)){ alert(messages.invalidDeathDate); return; }

    pushUndo();
    p.Name=name; p.Birth=birth; p.Death=death; p.BirthPlace=place; p.Gender=gender;
    p.ParentCode=parent; p.PartnerCode=partner; p.InheritedFrom=inherited; p.Note=note;

    saveState();
    closeDialogs();
    updateUI();
}

/* Löschen */
function deletePerson(){
    const sel = prompt("Bitte geben Sie den Code der zu löschenden Person ein:");
    if(!sel) return;
    const idx = people.findIndex(p=>p.Code===sel);
    if(idx<0){ alert(messages.personNotFound); return; }
    if(!confirm("Wirklich löschen?")) return;
    pushUndo();
    people.splice(idx,1);
    saveState();
    updateUI();
}

/* Export / Import */
function exportJSON(){
    const blob = new Blob([JSON.stringify(people, null,2)], {type:"application/json"});
    shareOrDownload("familie.json", blob);
}

function exportCSV(){
    const cols=["Gen","Code","RingCode","Name","Birth","Death","BirthPlace","ParentCode","PartnerCode","InheritedFrom","Note"];
    const lines=[cols.join(";")];
    for(const p of people) lines.push(cols.map(c=>String(p[c]??"").replace(/;/g,",")).join(";"));
    const blob=new Blob([lines.join("\n")],{type:"text/csv"});
    shareOrDownload("familie.csv",blob);
}

function doImport(file){
    const reader = new FileReader();
    reader.onload = function(e){
        try{
            let imported=[];
            if(file.name.endsWith(".json")) imported=JSON.parse(e.target.result);
            else if(file.name.endsWith(".csv")){
                const lines = e.target.result.split("\n");
                const headers = lines.shift().split(";");
                imported = lines.map(l=>{
                    const parts=l.split(";");
                    let obj={};
                    headers.forEach((h,i)=>obj[h]=parts[i]||"");
                    return obj;
                });
            }
            pushUndo();
            people = imported;
            saveState();
            updateUI();
        }catch(err){
            alert(messages.importError);
        }
    };
    reader.readAsText(file);
}

/* Hilfsfunktionen */
function shareOrDownload(filename, blob){
    if(navigator.canShare && navigator.canShare({files:[new File([blob],filename)]})){
        navigator.share({files:[new File([blob],filename)]});
    } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href=url; a.download=filename;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
    }
}

/* Stammbaum */
function renderTree(){
    computeRingCodes();
    const el = $("#tree");
    el.innerHTML="";

    const svgNS="http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS,"svg");
    svg.setAttribute("width","100%");
    svg.setAttribute("height","100%");
    svg.setAttribute("viewBox","0 0 2400 1600");
    svg.setAttribute("preserveAspectRatio","xMidYMid meet");

    const nodes = {}; // Code->SVG-Knoten

    const genXSpacing = 160;
    const genYSpacing = 120;
    const genStartX = 80;
    const genStartY = 80;

    // Positionen berechnen
    people.forEach(p=>{
        const x = genStartX + (p.Gen-1)*genXSpacing;
        const y = genStartY + Object.keys(nodes).length*genYSpacing;
        nodes[p.Code]={p:p,x:x,y:y};
    });

    // Linien (Eltern)
    Object.values(nodes).forEach(n=>{
        if(n.p.ParentCode && nodes[n.p.ParentCode]){
            const parentNode = nodes[n.p.ParentCode];
            const line = document.createElementNS(svgNS,"line");
            line.setAttribute("x1",parentNode.x+50);
            line.setAttribute("y1",parentNode.y+20);
            line.setAttribute("x2",n.x+50);
            line.setAttribute("y2",n.y+20);
            line.setAttribute("stroke","#555");
            svg.appendChild(line);
        }
    });

    // Knoten
    Object.values(nodes).forEach(n=>{
        const g = document.createElementNS(svgNS,"g");
        g.setAttribute("transform",`translate(${n.x},${n.y})`);
        const rect = document.createElementNS(svgNS,"rect");
        rect.setAttribute("width",100);
        rect.setAttribute("height",40);
        rect.setAttribute("fill","#e3f2fd");
        rect.setAttribute("stroke","#000");
        rect.setAttribute("rx",6);
        const text = document.createElementNS(svgNS,"text");
        text.setAttribute("x",50);
        text.setAttribute("y",25);
        text.setAttribute("text-anchor","middle");
        text.setAttribute("dominant-baseline","middle");
        text.setAttribute("font-size","12");
        text.textContent = n.p.Name;
        g.appendChild(rect);
        g.appendChild(text);
        svg.appendChild(g);
    });

    el.appendChild(svg);
}

/* … Fortsetzung in Teil 3 … */

/* app.js – Teil 3 von 3 */

/* UI-Update */
function updateUI(){
    renderTable();
    renderTree();
}

/* Dialoge schließen */
function closeDialogs(){
    $$("dialog").forEach(d=>d.close());
}

/* Event-Listener / Init */
function setupEventListeners(){
    $("#btnNew").addEventListener("click",openNew);
    $("#saveNew").addEventListener("click",e=>{e.preventDefault(); addNew();});
    $("#saveEdit").addEventListener("click",e=>{e.preventDefault(); saveEditFn();});
    $("#btnDelete").addEventListener("click",deletePerson);

    $("#btnImport").addEventListener("click",()=>{
        const inp = document.createElement("input");
        inp.type="file"; inp.accept=".json,.csv,application/json,text/csv";
        inp.onchange=()=>{ if(inp.files[0]) doImport(inp.files[0]); };
        inp.click();
    });

    $("#btnExport").addEventListener("click",()=>$("#dlgExport").showModal());
    $("#btnExportJSON").addEventListener("click",exportJSON);
    $("#btnExportCSV").addEventListener("click",exportCSV);

    $("#btnPrint").addEventListener("click",()=>$("#dlgPrint").showModal());
    $("#btnPrintTable").addEventListener("click",printTable);
    $("#btnPrintTree").addEventListener("click",printTree);

    $("#btnStats").addEventListener("click",()=>{$("#dlgStats").showModal();});
    $("#btnHelp").addEventListener("click",()=>{
        fetch("hilfe.html").then(r=>r.text()).then(html=>{
            $("#helpContent").innerHTML = html;
            $("#dlgHelp").showModal();
        }).catch(()=>alert("Hilfe konnte nicht geladen werden."));
    });

    $("#btnUndo").addEventListener("click",undo);
    $("#btnRedo").addEventListener("click",redo);
    $("#search").addEventListener("input",renderTable);

    $$(".close-x").forEach(b=>b.addEventListener("click",()=>closeDialogs()));
}

/* Versionsanzeige im Ribbon */
function showVersion(){
    const versionEl = document.createElement("div");
    versionEl.textContent = "Softwareversion " + (typeof APP_VERSION!=="undefined"?APP_VERSION:"");
    versionEl.style.fontSize="10px";
    versionEl.style.textAlign="right";
    versionEl.style.marginTop="4px";
    versionEl.style.color="#fff";
    $(".hint-row").appendChild(versionEl);
}

/* Stammbaum Drag & Zoom */
function setupTreeInteractions(){
    const treeEl = $("#tree svg");
    if(!treeEl) return;
    let isPanning=false, startX=0, startY=0, currentX=0, currentY=0, scale=1;

    treeEl.addEventListener("mousedown",e=>{
        isPanning=true;
        startX=e.clientX-currentX;
        startY=e.clientY-currentY;
    });

    treeEl.addEventListener("mousemove",e=>{
        if(!isPanning) return;
        currentX=e.clientX-startX;
        currentY=e.clientY-startY;
        treeEl.setAttribute("transform",`translate(${currentX},${currentY}) scale(${scale})`);
    });

    treeEl.addEventListener("mouseup",e=>{isPanning=false;});
    treeEl.addEventListener("mouseleave",e=>{isPanning=false;});

    treeEl.addEventListener("wheel",e=>{
        e.preventDefault();
        const delta = e.deltaY>0?0.9:1.1;
        scale*=delta;
        treeEl.setAttribute("transform",`translate(${currentX},${currentY}) scale(${scale})`);
    });
}

/* Druckfunktionen */
function printTable(){
    const printWindow = window.open("","_blank");
    printWindow.document.write("<html><head><title>Druck Tabelle</title></head><body>");
    printWindow.document.write($("#peopleTable").outerHTML);
    printWindow.document.write("</body></html>");
    printWindow.document.close();
    printWindow.print();
}

function printTree(){
    const printWindow = window.open("","_blank");
    printWindow.document.write("<html><head><title>Druck Stammbaum</title></head><body>");
    printWindow.document.write($("#tree").innerHTML);
    printWindow.document.write("</body></html>");
    printWindow.document.close();
    printWindow.print();
}

/* Export JSON */
function exportJSON(){
    const blob = new Blob([JSON.stringify(people,null,2)],{type:"application/json"});
    shareOrDownload("familie.json",blob);
}

/* Init */
document.addEventListener("DOMContentLoaded",()=>{
    loadState();
    setupEventListeners();
    updateUI();
    setupTreeInteractions();
    showVersion();
});
