/* app.js – Logik */
const STORAGE_KEY = "familyRing_upd56b";
let people = [];
const undoStack = [], redoStack = [];
const MAX_UNDO_STEPS = 50;

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const messages = {
    personNotFound: "Person nicht gefunden.",
    invalidDate: "Ungültiges Geburtsdatum-Format. Bitte verwenden Sie TT.MM.JJJJ",
    invalidDeathDate: "Ungültiges Todesdatum-Format. Bitte verwenden Sie TT.MM.JJJJ",
    requiredFields: "Bitte füllen Sie alle Pflichtfelder aus (Name, Geburtsdatum, Geburtsort, Geschlecht)",
    duplicateCode: "Person mit diesem Code existiert bereits!",
    importError: "Fehlerhafte Daten können nicht importiert werden."
};

/* --- Validierungen --- */
function validateBirthDate(dateString){
    if(!dateString) return true;
    const regex = /^(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[0-2])\.\d{4}$/;
    if(!regex.test(dateString)) return false;
    const parts = dateString.split('.');
    const day = parseInt(parts[0],10), month=parseInt(parts[1],10), year=parseInt(parts[2],10);
    const date = new Date(year, month-1, day);
    return date.getFullYear()===year && date.getMonth()===month-1 && date.getDate()===day;
}
function validateDeathDate(dateString){ return validateBirthDate(dateString); }
function validateRequiredFields(p){ return p.Name && p.Gender && p.BirthPlace; }
function validatePerson(p){
    if(!validateRequiredFields(p)) return false;
    if(p.Birth && !validateBirthDate(p.Birth)) return false;
    if(p.Death && !validateDeathDate(p.Death)) return false;
    return true;
}

/* --- Storage / Undo/Redo --- */
function saveState(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(people));
}
function loadState(){
    const data = localStorage.getItem(STORAGE_KEY);
    if(data) people = JSON.parse(data);
}
function pushUndo(){
    undoStack.push(JSON.stringify(people));
    if(undoStack.length>MAX_UNDO_STEPS) undoStack.shift();
    redoStack.length = 0;
}
function undo(){
    if(undoStack.length){
        redoStack.push(JSON.stringify(people));
        people = JSON.parse(undoStack.pop());
        updateUI();
    }
}
function redo(){
    if(redoStack.length){
        undoStack.push(JSON.stringify(people));
        people = JSON.parse(redoStack.pop());
        updateUI();
    }
}
/* --- Tabellenanzeige --- */
function computeRingCodes(){ /* Platzhalter, Logik wie vorher */ }

function renderTable(){
    computeRingCodes();
    const q = ($("#search").value || "").trim().toLowerCase();
    const tb = $("#peopleTable tbody");
    tb.innerHTML = "";

    const genColors = {
        1:"#e8f5e8",2:"#e3f2fd",3:"#f3e5f5",
        4:"#fff3e0",5:"#e8eaf6",6:"#f1f8e9",7:"#ffebee"
    };

    people.sort((a,b)=> (a.Gen||0)-(b.Gen||0) || String(a.Code).localeCompare(String(b.Code)));

    for(const p of people){
        const hide = q && !(String(p.Name||"").toLowerCase().includes(q) || String(p.Code||"").toLowerCase().includes(q) || String(p.RingCode||"").toLowerCase().includes(q));
        if(hide) continue;

        const tr = document.createElement("tr");
        const cols=["Gen","Code","RingCode","Name","Birth","Death","BirthPlace","ParentCode","PartnerCode","InheritedFrom","Note"];
        const gen=p.Gen||1;
        tr.style.backgroundColor = genColors[gen]||"#ffffff";

        cols.forEach(k=>{
            const td=document.createElement("td");
            if(k==="Name"){
                let symbol="";
                if(p.Gender==="m") symbol="♂ ";
                else if(p.Gender==="w") symbol="♀ ";
                else if(p.Gender==="d") symbol="⚧ ";
                td.textContent = symbol + (p.Name||"");
            }else td.textContent = p[k]||"";
            tr.appendChild(td);
        });
        tr.addEventListener("dblclick",()=>openEdit(p.Code));
        tb.appendChild(tr);
    }
}

/* --- Dialoge --- */
function openNew(){
    $("#pName").value=""; $("#pBirth").value="";
    $("#pDeath").value=""; $("#pPlace").value="";
    $("#pGender").value=""; $("#pParent").value=""; $("#pPartner").value="";
    $("#pInherited").value=""; $("#pNote").value="";
    $("#dlgNew").showModal();
}

function addNew(){
    const name=$("#pName").value.trim();
    const birth=$("#pBirth").value.trim();
    const death=$("#pDeath").value.trim();
    const place=$("#pPlace").value.trim();
    const gender=$("#pGender").value;
    const parent=$("#pParent").value.trim();
    const partner=$("#pPartner").value.trim();
    const inherited=$("#pInherited").value.trim();
    const note=$("#pNote").value.trim();

    // Pflichtfelder optional beim Abbrechen
    if(!name || !place || !gender){
        alert(messages.requiredFields);
        return;
    }

    if(birth && !validateBirthDate(birth)){ alert(messages.invalidDate); return; }
    if(death && !validateDeathDate(death)){ alert(messages.invalidDeathDate); return; }

    const gen=computeGenFromInput(parent);
    const code=allocateCode(gen,parent);
    const p={Gen:gen,Code:code,Name:name,Birth:birth,Death:death,BirthPlace:place,Gender:gender,ParentCode:parent,PartnerCode:partner,InheritedFrom:inherited,Note:note};

    pushUndo();
    people.push(p);
    saveState();
    closeDialogs();
    updateUI();
}

let editCode=null;
function openEdit(code){
    const p=people.find(x=>x.Code===code);
    if(!p) return;
    editCode=code;
    $("#eName").value=p.Name||""; $("#eBirth").value=p.Birth||"";
    $("#eDeath").value=p.Death||""; $("#ePlace").value=p.BirthPlace||"";
    $("#eGender").value=p.Gender||""; $("#eParent").value=p.ParentCode||"";
    $("#ePartner").value=p.PartnerCode||""; $("#eInherited").value=p.InheritedFrom||"";
    $("#eNote").value=p.Note||"";
    $("#dlgEdit").showModal();
}

function saveEditFn(){
    if(!editCode) return;
    const p=people.find(x=>x.Code===editCode);
    if(!p) return;

    const name=$("#eName").value.trim();
    const birth=$("#eBirth").value.trim();
    const death=$("#eDeath").value.trim();
    const place=$("#ePlace").value.trim();
    const gender=$("#eGender").value;
    const parent=$("#eParent").value.trim();
    const partner=$("#ePartner").value.trim();
    const inherited=$("#eInherited").value.trim();
    const note=$("#eNote").value.trim();

    if(!name || !place || !gender){ alert(messages.requiredFields); return; }
    if(birth && !validateBirthDate(birth)){ alert(messages.invalidDate); return; }
    if(death && !validateDeathDate(death)){ alert(messages.invalidDeathDate); return; }

    pushUndo();
    Object.assign(p,{Name:name,Birth:birth,Death:death,BirthPlace:place,Gender:gender,ParentCode:parent,PartnerCode:partner,InheritedFrom:inherited,Note:note});
    saveState();
    closeDialogs();
    updateUI();
}

/* --- Löschen --- */
function deletePerson(){
    const selected = $("#peopleTable tbody tr.selected");
    if(!selected) return;
    const code=selected.dataset.code;
    const idx=people.findIndex(p=>p.Code===code);
    if(idx>=0){
        pushUndo();
        people.splice(idx,1);
        saveState();
        updateUI();
    }
}

/* --- Export / Import --- */
function exportJSON(){
    const blob=new Blob([JSON.stringify(people,null,2)],{type:"application/json"});
    shareOrDownload("familie.json",blob);
}

function exportCSV(){
    const cols=["Gen","Code","RingCode","Name","Birth","Death","BirthPlace","ParentCode","PartnerCode","InheritedFrom","Note"];
    const lines=[cols.join(";")];
    for(const p of people) lines.push(cols.map(c=>String(p[c]||"")).join(";"));
    const blob=new Blob([lines.join("\n")],{type:"text/csv"});
    shareOrDownload("familie.csv",blob);
}

function shareOrDownload(filename,blob){
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download=filename;
    a.click();
    URL.revokeObjectURL(a.href);
}

/* --- Drucken --- */
function printTable(){
    const w=window.open("","_blank");
    w.document.write("<html><head><title>Druck</title></head><body>");
    w.document.write($("#peopleTable").outerHTML);
    w.document.write("</body></html>");
    w.print();
}
function printTree(){
    const w=window.open("","_blank");
    w.document.write("<html><head><title>Druck Stammbaum</title></head><body>");
    w.document.write($("#tree").outerHTML);
    w.document.write("</body></html>");
    w.print();
}
/* --- Stammbaum --- */
function renderTree(){
    computeRingCodes();
    const el=$("#tree");
    el.innerHTML="";

    const svgNS="http://www.w3.org/2000/svg";
    const svg=document.createElementNS(svgNS,"svg");
    svg.setAttribute("width","100%");
    svg.setAttribute("height","100%");
    svg.setAttribute("viewBox","0 0 2400 1600");
    svg.setAttribute("preserveAspectRatio","xMidYMid meet");

    // Beispielhafte Baum-Zeichnung, du kannst erweitern
    const nodes={};
    people.forEach(p=>{
        nodes[p.Code]={x:Math.random()*2200+50, y:100+p.Gen*150, p};
    });
    people.forEach(p=>{
        if(p.ParentCode && nodes[p.ParentCode]){
            const line=document.createElementNS(svgNS,"line");
            line.setAttribute("x1",nodes[p.ParentCode].x);
            line.setAttribute("y1",nodes[p.ParentCode].y);
            line.setAttribute("x2",nodes[p.Code].x);
            line.setAttribute("y2",nodes[p.Code].y);
            line.setAttribute("stroke","#999");
            line.setAttribute("stroke-width","2");
            svg.appendChild(line);
        }
    });
    Object.values(nodes).forEach(n=>{
        const circle=document.createElementNS(svgNS,"circle");
        circle.setAttribute("cx",n.x);
        circle.setAttribute("cy",n.y);
        circle.setAttribute("r","20");
        circle.setAttribute("fill",n.p.Gender==="m"?"#2196f3":n.p.Gender==="w"?"#e91e63":"#9c27b0");
        const text=document.createElementNS(svgNS,"text");
        text.setAttribute("x",n.x);
        text.setAttribute("y",n.y+5);
        text.setAttribute("text-anchor","middle");
        text.setAttribute("fill","#fff");
        text.setAttribute("font-size","12");
        text.textContent=n.p.Name;
        svg.appendChild(circle);
        svg.appendChild(text);
    });

    el.appendChild(svg);
}

/* --- Update UI --- */
function updateUI(){
    renderTable();
    renderTree();
}

/* --- Tree Interactions --- */
function setupTreeInteractions(){
    // Platzhalter, z.B. Drag/Zoom falls gewünscht
}

/* --- Dialog schließen --- */
function closeDialogs(){
    $$("dialog").forEach(d=>d.close());
}

/* --- Event Listeners / Init --- */
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
    $("#btnExport").addEventListener("click",()=>$("#dlgExport").showModal());
    $("#btnExportJSON").addEventListener("click",exportJSON);
    $("#btnExportCSV").addEventListener("click",exportCSV);
    $("#btnPrint").addEventListener("click",()=>$("#dlgPrint").showModal());
    $("#btnPrintTable").addEventListener("click",printTable);
    $("#btnPrintTree").addEventListener("click",printTree);
    $("#btnStats").addEventListener("click",()=>{updateStats(); $("#dlgStats").showModal();});
    $("#btnHelp").addEventListener("click",()=>{
        fetch("hilfe.html").then(r=>r.text()).then(html=>{$("#helpContent").innerHTML=html; $("#dlgHelp").showModal();}).catch(()=>alert("Hilfe konnte nicht geladen werden."));
    });
    $("#btnUndo").addEventListener("click",undo);
    $("#btnRedo").addEventListener("click",redo);
    $("#search").addEventListener("input",renderTable);
    $$(".close-x").forEach(b=>b.addEventListener("click",()=>closeDialogs()));
}

/* --- Init --- */
function ensureVersionVisibility(){
    const versionRibbon=document.getElementById('versionRibbon');
    if(versionRibbon){ versionRibbon.style.display='block'; }
}

document.addEventListener('DOMContentLoaded',function(){
    loadState();
    setupEventListeners();
    updateUI();
    setTimeout(setupTreeInteractions,1000);
    ensureVersionVisibility();
});
