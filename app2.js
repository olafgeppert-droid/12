/* app.js – Teil 1/3 */
const STORAGE_KEY = "familyRing_upd56b";
let people = [];
let undoStack = [];
let redoStack = [];
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

/* Validierung */
function validateBirthDate(dateString) {
    if (!dateString) return true;
    const regex = /^(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[0-2])\.\d{4}$/;
    if (!regex.test(dateString)) return false;
    const parts = dateString.split('.');
    const day = parseInt(parts[0],10);
    const month = parseInt(parts[1],10);
    const year = parseInt(parts[2],10);
    const date = new Date(year, month-1, day);
    return date.getFullYear() === year && date.getMonth() === month-1 && date.getDate() === day;
}

function validateDeathDate(dateString) { return validateBirthDate(dateString); }

function validateRequiredFields(person){
    return person.Name && person.Gender && person.BirthPlace;
}

function validatePerson(person){
    if(!validateRequiredFields(person)) return false;
    if(person.Birth && !validateBirthDate(person.Birth)) return false;
    if(person.Death && !validateDeathDate(person.Death)) return false;
    return true;
}

/* Storage */
function saveState(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(people));
}

function loadState(){
    const data = localStorage.getItem(STORAGE_KEY);
    if(data){
        try{ people = JSON.parse(data); } catch(e){ people=[]; }
    }
}

/* Undo/Redo */
function pushUndo(){
    undoStack.push(JSON.stringify(people));
    if(undoStack.length>MAX_UNDO_STEPS) undoStack.shift();
    redoStack=[];
}

function undo(){
    if(undoStack.length){
        redoStack.push(JSON.stringify(people));
        people = JSON.parse(undoStack.pop());
        updateUI();
        saveState();
    }
}

function redo(){
    if(redoStack.length){
        undoStack.push(JSON.stringify(people));
        people = JSON.parse(redoStack.pop());
        updateUI();
        saveState();
    }
}

/* Codevergabe */
function allocateCode(gen,parentCode){
    let base = parentCode?parentCode:""+gen;
    let suffix=1;
    while(people.some(p=>p.Code===base+suffix)) suffix++;
    return base+suffix;
}

function normalizePersonCode(code){ return code?code.trim():""; }

function computeGenFromInput(parentCode){
    if(!parentCode) return 1;
    const parent = people.find(p=>p.Code===parentCode);
    if(!parent) return 1;
    return (parent.Gen||1)+1;
}

/* computeRingCodes – einfache Reihenfolge für Anzeige */
function computeRingCodes(){
    people.forEach((p,i)=>{ p.RingCode = "R"+(i+1); });
}
/* app.js – Teil 2/3 */

/* Tabelle rendern */
function renderTable(){
    computeRingCodes();
    const q = ($("#search").value||"").trim().toLowerCase();
    const tb = $("#peopleTable tbody");
    tb.innerHTML="";

    function escapeHtml(text){
        const div=document.createElement('div'); div.textContent=text; return div.innerHTML;
    }

    function safeMark(txt){
        if(!q) return escapeHtml(String(txt||""));
        const s=String(txt||"");
        const i=s.toLowerCase().indexOf(q);
        if(i<0) return escapeHtml(s);
        return escapeHtml(s.slice(0,i)) + "<mark>" + escapeHtml(s.slice(i,i+q.length)) + "</mark>" + escapeHtml(s.slice(i+q.length));
    }

    const genColors = {
        1:"#e8f5e8",2:"#e3f2fd",3:"#f3e5f5",
        4:"#fff3e0",5:"#e8eaf6",6:"#f1f8e9",7:"#ffebee"
    };

    people.sort((a,b)=>(a.Gen||0)-(b.Gen||0) || String(a.Code).localeCompare(String(b.Code)));

    for(const p of people){
        const hide = q && !(
            String(p.Name||"").toLowerCase().includes(q) ||
            String(p.Code||"").toLowerCase().includes(q) ||
            String(p.RingCode||"").toLowerCase().includes(q)
        );
        if(hide) continue;

        const tr = document.createElement("tr");
        const cols = ["Gen","Code","RingCode","Name","Birth","Death","BirthPlace","ParentCode","PartnerCode","InheritedFrom","Note"];
        const bgColor = genColors[p.Gen]||"#ffffff";
        tr.style.backgroundColor = bgColor;

        cols.forEach(k=>{
            const td=document.createElement("td");
            if(k==="Name"){
                let symbol="";
                if(p.Gender==="m") symbol="♂ ";
                else if(p.Gender==="w") symbol="♀ ";
                else if(p.Gender==="d") symbol="⚧ ";
                td.innerHTML=symbol+safeMark(p.Name||"");
            }else td.innerHTML=safeMark(p[k]??"");
            tr.appendChild(td);
        });
        tr.addEventListener("dblclick",()=>openEdit(p.Code));
        tb.appendChild(tr);
    }
}

/* Stammbaum rendern (SVG + Interaktivität) */
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
    el.appendChild(svg);

    const nodes={};
    people.forEach(p=>{
        const x=100+(p.Gen-1)*200;
        const y=50+(Object.keys(nodes).length)*80;
        nodes[p.Code]={x,y,p};

        const circle=document.createElementNS(svgNS,"circle");
        circle.setAttribute("cx",x);
        circle.setAttribute("cy",y);
        circle.setAttribute("r",25);
        circle.setAttribute("fill",p.Gender==="m"?"#a0c4ff":p.Gender==="w"?"#ffadad":"#caffbf");
        circle.setAttribute("stroke","#333");
        svg.appendChild(circle);

        const text=document.createElementNS(svgNS,"text");
        text.setAttribute("x",x);
        text.setAttribute("y",y+5);
        text.setAttribute("text-anchor","middle");
        text.setAttribute("font-size","12");
        text.textContent=p.Name;
        svg.appendChild(text);

        if(p.ParentCode && nodes[p.ParentCode]){
            const parentNode=nodes[p.ParentCode];
            const line=document.createElementNS(svgNS,"line");
            line.setAttribute("x1",parentNode.x);
            line.setAttribute("y1",parentNode.y+25);
            line.setAttribute("x2",x);
            line.setAttribute("y2",y-25);
            line.setAttribute("stroke","#555");
            svg.appendChild(line);
        }
    });

    // Interaktivität: Drag & Zoom
    let scale=1, offsetX=0, offsetY=0, isDragging=false, startX=0, startY=0;
    svg.onmousedown=function(e){
        isDragging=true; startX=e.clientX; startY=e.clientY;
    };
    svg.onmouseup=function(){isDragging=false;};
    svg.onmousemove=function(e){
        if(isDragging){
            offsetX+=e.clientX-startX; offsetY+=e.clientY-startY;
            svg.setAttribute("viewBox", `${-offsetX/scale} ${-offsetY/scale} ${2400/scale} ${1600/scale}`);
            startX=e.clientX; startY=e.clientY;
        }
    };
    svg.onwheel=function(e){
        e.preventDefault();
        scale*=e.deltaY>0?0.9:1.1;
        svg.setAttribute("viewBox", `${-offsetX/scale} ${-offsetY/scale} ${2400/scale} ${1600/scale}`);
    };
}
/* app.js – Teil 3/3 */

/* Dialoge öffnen */
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
    const death=$("#pDeath")?$("#pDeath").value.trim():"";
    const place=$("#pPlace").value.trim();
    const gender=$("#pGender").value;
    const parent=normalizePersonCode($("#pParent").value);
    const partner=normalizePersonCode($("#pPartner").value);
    const inherited=normalizePersonCode($("#pInherited").value);
    const note=$("#pNote").value.trim();

    if(!name||!place||!gender){
        alert(messages.requiredFields);
        return;
    }
    if(birth && !validateBirthDate(birth)){alert(messages.invalidDate); return;}
    if(death && !validateDeathDate(death)){alert(messages.invalidDeathDate); return;}

    const gen=computeGenFromInput(parent);
    const code=allocateCode(gen,parent);
    const p={Gen:gen,Code:code,Name:name,Birth:birth,Death:death,BirthPlace:place,
        Gender:gender,ParentCode:parent,PartnerCode:partner,InheritedFrom:inherited,Note:note};
    pushUndo();
    people.push(p);
    saveState(); closeDialogs(); updateUI();
}

/* Bearbeiten */
let editCode=null;
function openEdit(code){
    const p=people.find(x=>x.Code===code); if(!p) return;
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
    const p=people.find(x=>x.Code===editCode); if(!p) return;

    const name=$("#eName").value.trim();
    const birth=$("#eBirth").value.trim();
    const death=$("#eDeath")?$("#eDeath").value.trim():"";
    const place=$("#ePlace").value.trim();
    const gender=$("#eGender").value;
    const parent=normalizePersonCode($("#eParent").value);
    const partner=normalizePersonCode($("#ePartner").value);
    const inherited=normalizePersonCode($("#eInherited").value);
    const note=$("#eNote").value.trim();

    if(!name||!place||!gender){alert(messages.requiredFields); return;}
    if(birth && !validateBirthDate(birth)){alert(messages.invalidDate); return;}
    if(death && !validateDeathDate(death)){alert(messages.invalidDeathDate); return;}

    pushUndo();
    p.Name=name; p.Birth=birth; p.Death=death; p.BirthPlace=place;
    p.Gender=gender; p.ParentCode=parent; p.PartnerCode=partner;
    p.InheritedFrom=inherited; p.Note=note;
    saveState(); closeDialogs(); updateUI();
}

/* Löschen */
function deletePerson(){
    const selCode=prompt("Code der zu löschenden Person:");
    const idx=people.findIndex(p=>p.Code===selCode);
    if(idx<0){alert(messages.personNotFound); return;}
    pushUndo(); people.splice(idx,1); saveState(); updateUI();
}

/* Export / Import */
function exportJSON(){
    const blob=new Blob([JSON.stringify(people,null,2)],{type:"application/json"});
    shareOrDownload("familie.json",blob);
}

function exportCSV(){
    const cols=["Gen","Code","RingCode","Name","Birth","Death","BirthPlace","ParentCode","PartnerCode","InheritedFrom","Note"];
    const lines=[cols.join(";")];
    for(const p of people){
        lines.push(cols.map(c=>String(p[c]??"").replace(/;/g,",")).join(";"));
    }
    const blob=new Blob([lines.join("\n")],{type:"text/csv"});
    shareOrDownload("familie.csv",blob);
}

function doImport(file){
    const reader=new FileReader();
    reader.onload=function(){
        try{
            const data=JSON.parse(reader.result);
            if(Array.isArray(data)){
                pushUndo();
                people=data;
                saveState(); updateUI();
            } else alert(messages.importError);
        }catch(e){alert(messages.importError);}
    };
    reader.readAsText(file);
}

/* Print Funktionen */
function printTable(){window.print();}
function printTree(){window.print();}

/* UI Update */
function updateUI(){
    renderTable(); renderTree();
}

/* Dialog schließen */
function closeDialogs(){
    $$("dialog").forEach(d=>d.close());
}

/* Datei Download/Share */
function shareOrDownload(filename,blob){
    if(navigator.canShare && navigator.canShare({files:[new File([blob],filename)]})){
        navigator.share({files:[new File([blob],filename)]});
    }else{
        const url=URL.createObjectURL(blob);
        const a=document.createElement("a");
        a.href=url; a.download=filename;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
    }
}

/* Setup */
function setupEventListeners(){
    $("#btnNew").addEventListener("click",openNew);
    $("#saveNew").addEventListener("click",e=>{e.preventDefault(); addNew();});
    $("#saveEdit").addEventListener("click",e=>{e.preventDefault(); saveEditFn();});
    $("#btnDelete").addEventListener("click",deletePerson);
    $("#btnImport").addEventListener("click",()=>{
        const inp=document.createElement("input"); inp.type="file";
        inp.accept=".json,.csv,application/json,text/csv";
        inp.onchange=()=>{ if(inp.files[0]) doImport(inp.files[0]); };
        inp.click();
    });
    $("#btnExport").addEventListener("click",()=>$("#dlgExport")?.showModal());
    $("#btnExportJSON")?.addEventListener("click",exportJSON);
    $("#btnExportCSV")?.addEventListener("click",exportCSV);
    $("#btnPrint")?.addEventListener("click",()=>$("#dlgPrint")?.showModal());
    $("#btnPrintTable")?.addEventListener("click",printTable);
    $("#btnPrintTree")?.addEventListener("click",printTree);
    $("#btnStats")?.addEventListener("click",()=>{$("#dlgStats")?.showModal();});
    $("#btnHelp")?.addEventListener("click",()=>{
        fetch("hilfe.html").then(r=>r.text()).then(html=>{$("#helpContent").innerHTML=html; $("#dlgHelp").showModal();}).catch(()=>alert("Hilfe konnte nicht geladen werden."));
    });
    $("#btnUndo").addEventListener("click",undo);
    $("#btnRedo").addEventListener("click",redo);
    $("#search").addEventListener("input",renderTable);
    $$(".close-x").forEach(b=>b.addEventListener("click",()=>closeDialogs()));
}

/* Init */
document.addEventListener("DOMContentLoaded",()=>{
    loadState();
    setupEventListeners();
    updateUI();
});
