/* app.js – Logik (Überarbeitet zur Behebung von Layout- und Druckproblemen) */
const STORAGE_KEY = "familyRing_upd56b";
let people = [];
const undoStack = [];
const redoStack = [];
const MAX_UNDO_STEPS = 50;

// Hilfsfunktionen
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const messages = {
    personNotFound: "Person nicht gefunden.",
    invalidDate: "Ungültiges Geburtsdatum-Format. Bitte verwenden Sie TT.MM.JJJJ (z.B. 04.12.2000)",
    requiredFields: "Bitte füllen Sie alle Pflichtfelder aus (Name, Geburtsdatum, Geburtsort, Geschlecht)",
    duplicateCode: "Person mit diesem Code existiert bereits!",
    importError: "Fehlerhafte Daten können nicht importiert werden.",
    printError: "Der Druckvorgang konnte nicht abgeschlossen werden. Bitte versuchen Sie es erneut.",
    popupBlocked: "Bitte erlauben Sie Popups für diese Seite, um drucken zu können."
};

// === DATENVERWALTUNG ===
function saveState(pushUndo = true) {
    if (pushUndo) {
        undoStack.push(JSON.stringify(people));
        if (undoStack.length > MAX_UNDO_STEPS) undoStack.shift();
    }
    redoStack.length = 0;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(people));
}

function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        people = raw ? JSON.parse(raw) : seedData();
        postLoadFixups();
    } catch (error) {
        console.error("Fehler beim Laden:", error);
        people = seedData();
    } finally {
        if (!people || people.length === 0) {
            people = seedData();
        }
        saveState(false);
    }
}

function seedData() {
    // ... (Inhalt der seedData Funktion bleibt unverändert)
}

function postLoadFixups() {
    people.forEach(p => {
        p.Code = normalizePersonCode(p.Code);
        p.ParentCode = normalizePersonCode(p.ParentCode);
        p.PartnerCode = normalizePersonCode(p.PartnerCode);
        p.InheritedFrom = normalizePersonCode(p.InheritedFrom);
        p.Gen = p.Gen || computeGenFromCode(p.Code);
        p.RingCode = p.RingCode || p.Code;
    });
    computeRingCodes();
}

function computeRingCodes() {
    // ... (Inhalt der computeRingCodes Funktion bleibt unverändert)
}


// === VALIDIERUNG & CODES ===
function validateBirthDate(dateString) {
    // ... (Inhalt der validateBirthDate Funktion bleibt unverändert)
}

function validateRequiredFields(person) {
    return person.Name && person.Gender && person.BirthPlace && person.Birth;
}

function normalizePersonCode(code) {
    // ... (Inhalt der normalizePersonCode Funktion bleibt unverändert)
}

function computeGenFromCode(code) {
    // ... (Inhalt der computeGenFromCode Funktion bleibt unverändert)
}

function nextChildCode(parentCode) {
    const parent = people.find(p => p.Code === parentCode);
    if (!parent) return "";

    const children = people.filter(p => p.ParentCode === parentCode);
    
    // Kinder werden nach Geburtsdatum sortiert, um Codes korrekt zu vergeben
    children.sort((a, b) => {
        const dateA = a.Birth.split('.').reverse().join('-');
        const dateB = b.Birth.split('.').reverse().join('-');
        return new Date(dateA) - new Date(dateB);
    });

    // Weist den Kindern basierend auf der Geburtsreihenfolge neue Codes zu
    const isUrenkelGeneration = parent.Gen === 3; // Enkel (Gen 3) bekommen Urenkel-Kinder
    children.forEach((child, index) => {
        const newCode = isUrenkelGeneration 
            ? parentCode + (index + 1)
            : parentCode + String.fromCharCode(65 + index);
        
        if (child.Code !== newCode) {
            const oldCode = child.Code;
            child.Code = newCode;
            // Aktualisiere Referenzen auf dieses Kind
            people.forEach(p => {
                if (p.ParentCode === oldCode) p.ParentCode = newCode;
                if (p.PartnerCode === oldCode) p.PartnerCode = newCode;
            });
        }
    });

    // Bestimmt den nächsten freien Code
    const nextIndex = children.length;
    return isUrenkelGeneration
        ? parentCode + (nextIndex + 1)
        : parentCode + String.fromCharCode(65 + nextIndex);
}

// === UI-RENDERING ===
function renderTable() {
    // ... (Inhalt der renderTable Funktion bleibt unverändert, ist bereits robust)
}

/**
 * KORRIGIERT: Überarbeitete Funktion zum Rendern des Stammbaums
 * Verhindert Überlappungen durch einen robusteren Layout-Algorithmus.
 */
function renderTree() {
    computeRingCodes();
    const el = $("#tree");
    if (!el) return;
    el.innerHTML = "";

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    el.appendChild(svg);

    const genColors = { 1: "#e8f5e8", 2: "#e3f2fd", 3: "#f3e5f5", 4: "#fff3e0", 5: "#e8eaf6", 6: "#f1f8e9", 7: "#ffebee" };

    const byGeneration = people.reduce((acc, person) => {
        const gen = person.Gen || 1;
        if (!acc[gen]) acc[gen] = [];
        acc[gen].push(person);
        return acc;
    }, {});

    const boxWidth = 220, boxHeight = 100, partnerGap = 30, verticalSpacing = 180, horizontalSpacing = 50;
    const positions = new Map();
    let totalSvgWidth = 0, totalSvgHeight = 0;
    const generations = Object.keys(byGeneration).sort((a, b) => a - b);

    // Phase 1: Gruppen bilden und Positionen berechnen
    generations.forEach((gen, genIndex) => {
        const y = 80 + genIndex * verticalSpacing;
        totalSvgHeight = y + boxHeight;

        const persons = byGeneration[gen];
        const groupedPersons = [];
        const processed = new Set();

        persons.forEach(person => {
            if (processed.has(person.Code)) return;
            let group = [person];
            processed.add(person.Code);
            if (person.PartnerCode) {
                const partner = persons.find(p => p.Code === person.PartnerCode);
                if (partner) {
                    group.push(partner);
                    processed.add(partner.Code);
                }
            }
            groupedPersons.push(group);
        });

        const currentGenWidth = groupedPersons.reduce((sum, group) => sum + (group.length * boxWidth) + partnerGap, 0) + (groupedPersons.length - 1) * horizontalSpacing;
        totalSvgWidth = Math.max(totalSvgWidth, currentGenWidth);

        let currentX = 0;
        groupedPersons.forEach(group => {
            if (group.length === 2) {
                const p1 = group[0], p2 = group[1];
                positions.set(p1.Code, { x: currentX + boxWidth / 2, y, person: p1 });
                positions.set(p2.Code, { x: currentX + boxWidth + partnerGap + boxWidth / 2, y, person: p2 });
                currentX += boxWidth * 2 + partnerGap + horizontalSpacing;
            } else {
                const p = group[0];
                positions.set(p.Code, { x: currentX + boxWidth / 2, y, person: p });
                currentX += boxWidth + horizontalSpacing;
            }
        });
    });

    totalSvgWidth += 100; // Extra Rand
    totalSvgHeight += 50;
    svg.setAttribute("viewBox", `0 0 ${totalSvgWidth} ${totalSvgHeight}`);

    const connectionsGroup = document.createElementNS(svgNS, "g");
    connectionsGroup.setAttribute("class", "connections");
    svg.insertBefore(connectionsGroup, svg.firstChild);

    const nodesGroup = document.createElementNS(svgNS, "g");
    nodesGroup.setAttribute("class", "nodes");
    svg.appendChild(nodesGroup);

    // Phase 2: Verbindungen und Boxen zeichnen
    people.forEach(person => {
        const childPos = positions.get(person.Code);
        if (!childPos) return;

        // Eltern-Kind-Verbindungen
        if (person.ParentCode) {
            const parent1Pos = positions.get(person.ParentCode);
            const parent2Pos = parent1Pos ? positions.get(parent1Pos.person.PartnerCode) : null;
            
            if (parent1Pos) {
                let startX = parent1Pos.x;
                if (parent2Pos) {
                    startX = (parent1Pos.x + parent2Pos.x) / 2; // Startpunkt mittig zwischen den Eltern
                }

                const startY = parent1Pos.y + boxHeight;
                const midY = startY + verticalSpacing / 2 - 20;

                const path = document.createElementNS(svgNS, "path");
                path.setAttribute("d", `M ${startX} ${startY} V ${midY} H ${childPos.x} V ${childPos.y}`);
                path.setAttribute("stroke", "#6b7280");
                path.setAttribute("stroke-width", "2");
                path.setAttribute("fill", "none");
                connectionsGroup.appendChild(path);
            }
        }
        
        // Partner-Verbindungslinie
        if (person.PartnerCode) {
            const partnerPos = positions.get(person.PartnerCode);
            if (partnerPos && Math.abs(childPos.y - partnerPos.y) < 10 && childPos.x < partnerPos.x) {
                const line = document.createElementNS(svgNS, "line");
                line.setAttribute("x1", childPos.x + boxWidth / 2);
                line.setAttribute("y1", childPos.y + boxHeight / 2);
                line.setAttribute("x2", partnerPos.x - boxWidth / 2);
                line.setAttribute("y2", partnerPos.y + boxHeight / 2);
                line.setAttribute("stroke", "#dc2626");
                line.setAttribute("stroke-width", "3");
                connectionsGroup.appendChild(line);
            }
        }

        // Personen-Box (Node)
        const g = document.createElementNS(svgNS, "g");
        g.setAttribute("class", "node");
        g.setAttribute("transform", `translate(${childPos.x - boxWidth / 2}, ${childPos.y})`);
        g.addEventListener("dblclick", () => openEdit(person.Code));

        const rect = document.createElementNS(svgNS, "rect");
        rect.setAttribute("width", boxWidth);
        rect.setAttribute("height", boxHeight);
        rect.setAttribute("rx", 8);
        rect.setAttribute("fill", genColors[person.Gen] || "#f9fafb");
        rect.setAttribute("stroke", "#374151");
        rect.setAttribute("stroke-width", "1.5");
        g.appendChild(rect);

        const nameText = `${person.Code} / ${person.Name}`;
        const birthText = person.Birth ? `* ${person.Birth}` : '';
        
        addText(g, nameText, boxWidth / 2, 30, "16px", "600", "#111827");
        addText(g, birthText, boxWidth / 2, 55, "14px", "400", "#4b5563");
        addText(g, `Gen: ${person.Gen}`, boxWidth / 2, 78, "14px", "400", "#4b5563");

        nodesGroup.appendChild(g);
    });

    function addText(parent, content, x, y, size, weight, fill) {
        const text = document.createElementNS(svgNS, "text");
        text.setAttribute("x", x);
        text.setAttribute("y", y);
        text.setAttribute("font-size", size);
        text.setAttribute("font-weight", weight);
        text.setAttribute("fill", fill);
        text.setAttribute("text-anchor", "middle");
        text.textContent = content;
        parent.appendChild(text);
    }
}


// === INTERAKTIONEN & DIALOGE ===
function openNew() {
    $("#formNew").reset();
    $("#dlgNew").showModal();
}

function addNew() {
    // ... (Inhalt der addNew Funktion bleibt unverändert)
}

function openEdit(code) {
    // ... (Inhalt der openEdit Funktion bleibt unverändert)
}

function saveEdit() {
    // ... (Inhalt der saveEdit Funktion bleibt unverändert)
}

function deletePerson() {
    // ... (Inhalt der deletePerson Funktion bleibt unverändert)
}

function importData() {
    // ... (Inhalt der importData Funktion bleibt unverändert)
}

function exportData(format) {
    // ... (Inhalt der exportData Funktion bleibt unverändert)
}

/**
 * KORRIGIERT: Drucklogik komplett ersetzt
 * Nutzt jetzt html2canvas und jspdf für zuverlässigen, plattformunabhängigen PDF-Export.
 */
async function printElementAsPdf(elementSelector, dialog, outputFilename, orientation) {
    dialog.close();
    const targetElement = $(elementSelector);
    if (!targetElement) {
        console.error("Druck-Element nicht gefunden:", elementSelector);
        return;
    }

    // 1. Druck-Styling aktivieren
    document.body.classList.add('printing-mode');
    targetElement.classList.add('print-this');

    try {
        await new Promise(resolve => setTimeout(resolve, 150)); // Warten auf CSS-Anwendung

        // 2. Canvas mit hoher Auflösung erstellen
        const canvas = await html2canvas(targetElement.querySelector('table') || targetElement.querySelector('#tree svg'), {
            scale: window.devicePixelRatio * 2, // **ENTSCHEIDEND** für Schärfe
            useCORS: true,
            logging: false,
            width: targetElement.scrollWidth,
            height: targetElement.scrollHeight,
            windowWidth: targetElement.scrollWidth,
            windowHeight: targetElement.scrollHeight,
        });

        // 3. PDF erstellen und Bild einfügen
        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: orientation,
            unit: 'pt',
            format: [canvas.width, canvas.height]
        });

        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save(`${outputFilename}_${new Date().toISOString().slice(0, 10)}.pdf`);

    } catch (error) {
        console.error("Fehler beim PDF-Export:", error);
        alert(messages.printError);
    } finally {
        // 4. Aufräumen: Druck-Styling wieder entfernen
        document.body.classList.remove('printing-mode');
        targetElement.classList.remove('print-this');
    }
}

function printTable() {
    printElementAsPdf('.table-wrap', $("#dlgPrint"), 'personen-liste', 'landscape');
}

function printTree() {
    printElementAsPdf('.tree-panel', $("#dlgPrint"), 'stammbaum', 'landscape');
}


function showStats() {
    // ... (Inhalt der showStats Funktion bleibt unverändert)
}

/**
 * VERBESSERT: Hilfe-Dialog mit detailliertem Inhalt
 */
function showHelp() {
    const helpContent = `
        <div id="help-wrapper" style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
          <p class="note" style="background: #fff8e1; border: 1px solid #ffe082; padding: 10px 12px; border-radius: 8px;"><strong>Wichtig:</strong> Personen- und Ring-Code werden automatisch vom Programm vergeben. Die Logik wurde vom Wappenspender, <strong>Olaf Geppert</strong>, erfunden und vorgegeben.</p>
          <h2 style="margin-top: 18px; font-size: 1.2rem; border-left: 4px solid #1e88e5; padding-left: 8px;">🧭 Zweck der Anwendung</h2>
          <p>Diese Anwendung hilft dir, Familienmitglieder zu erfassen, den grafischen Stammbaum zu visualisieren und die Vererbung der Wappenringe der Familie GEPPERT nachzuverfolgen.</p>
          <h2 style="margin-top: 18px; font-size: 1.2rem; border-left: 4px solid #1e88e5; padding-left: 8px;">🧬 Personen-Code-System</h2>
          <ul>
            <li>Der <strong>Personen-Code</strong> wird <strong>vom System vergeben</strong>.</li>
            <li>Stammvater = <code>1</code>, Partner(in) = <code>1x</code>.</li>
            <li>Kinder des Stammvaters: <code>1A</code>, <code>1B</code>, <code>1C</code> … (in Geburtsreihenfolge).</li>
            <li>Enkel: Zahlen hinter dem Code des jeweiligen Kindes in <strong>Geburtsreihenfolge</strong>. Beispiel: erstes Kind von <code>1A</code> → <code>1A1</code>.</li>
          </ul>
          <h2 style="margin-top: 18px; font-size: 1.2rem; border-left: 4px solid #1e88e5; padding-left: 8px;">💍 Ring-Codes</h2>
          <ul>
            <li>Bei Vererbung: Anschlussgravur mit Pfeil, z.B. <code>1B → 1B2</code>.</li>
            <li>Partner tragen ihr <code>x</code> im Ring-Code (z.B. <code>1x</code>).</li>
          </ul>
          <h2 style="margin-top: 18px; font-size: 1.2rem; border-left: 4px solid #1e88e5; padding-left: 8px;">🌳 Stammbaum</h2>
          <ul>
            <li>Automatisches Neuzeichnen bei jeder Datenänderung.</li>
            <li>Generationen sind vertikal angeordnet.</li>
            <li>Doppelklick auf eine Person öffnet den Bearbeiten-Dialog.</li>
          </ul>
           <h2 style="margin-top: 18px; font-size: 1.2rem; border-left: 4px solid #1e88e5; padding-left: 8px;">💾 Export / Import</h2>
          <ul>
            <li><strong>Export</strong>: Sichert alle Daten als JSON oder CSV. Dient als <strong>Backup</strong>.</li>
            <li><strong>Import</strong>: Liest eine zuvor gesicherte Datei wieder ein.</li>
            <li class="note small" style="background: #fff8e1; border: 1px solid #ffe082; padding: 6px 8px; border-radius: 8px; font-size: 0.9rem;">Daten sind nur lokal im Browser gespeichert → bitte regelmäßig sichern!</li>
          </ul>
        </div>`;
    $("#helpContent").innerHTML = helpContent;
    $("#dlgHelp").showModal();
}


function resetData() {
    // ... (Inhalt der resetData Funktion bleibt unverändert)
}

function undo() {
    // ... (Inhalt der undo Funktion bleibt unverändert)
}

function redo() {
    // ... (Inhalt der redo Funktion bleibt unverändert)
}

// === INITIALISIERUNG & EVENT LISTENERS ===
function updateUI() {
    renderTable();
    renderTree();
}

function setupEventListeners() {
    // ... (Event-Listener-Setup bleibt größtenteils gleich)
    $("#btnNew").addEventListener("click", openNew);
    $("#btnDelete").addEventListener("click", deletePerson);
    $("#btnImport").addEventListener("click", importData);
    $("#btnExport").addEventListener("click", () => $("#dlgExport").showModal());
    $("#btnPrint").addEventListener("click", () => $("#dlgPrint").showModal());
    $("#btnStats").addEventListener("click", showStats);
    $("#btnHelp").addEventListener("click", showHelp);
    $("#btnReset").addEventListener("click", resetData);
    $("#btnUndo").addEventListener("click", undo);
    $("#btnRedo").addEventListener("click", redo);

    $("#btnExportJSON").addEventListener("click", () => exportData('json'));
    $("#btnExportCSV").addEventListener("click", () => exportData('csv'));
    $("#btnPrintTable").addEventListener("click", printTable);
    $("#btnPrintTree").addEventListener("click", printTree);

    $("#formNew").addEventListener("submit", e => { e.preventDefault(); addNew(); $("#dlgNew").close(); });
    $("#formEdit").addEventListener("submit", e => { e.preventDefault(); saveEdit(); $("#dlgEdit").close(); });

    $("#search").addEventListener("input", renderTable);
}

/**
 * VERBESSERT: Interaktionen für Zoom/Pan im Stammbaum
 * Manipuliert die SVG-ViewBox für verlustfreies Zoomen.
 */
function setupTreeInteractions() {
    const treeContainer = $("#treeContainer");
    const svg = treeContainer.querySelector('svg');
    if (!svg) return;

    let viewBox = { x: 0, y: 0, w: svg.viewBox.baseVal.width, h: svg.viewBox.baseVal.height };
    svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
    
    let isPanning = false;
    let startPoint = { x: 0, y: 0 };
    let endPoint = { x: 0, y: 0 };
    let scale = 1;

    treeContainer.addEventListener("wheel", (e) => {
        e.preventDefault();
        const { clientX, clientY } = e;
        const svgPoint = new DOMPoint(clientX, clientY);
        const transformedPoint = svgPoint.matrixTransform(svg.getScreenCTM().inverse());
        
        const delta = (e.deltaY < 0) ? 0.9 : 1.1;
        scale *= delta;

        viewBox.w *= delta;
        viewBox.h *= delta;
        viewBox.x = transformedPoint.x - (transformedPoint.x - viewBox.x) * delta;
        viewBox.y = transformedPoint.y - (transformedPoint.y - viewBox.y) * delta;
        
        svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
    });

    treeContainer.addEventListener("mousedown", (e) => {
        isPanning = true;
        startPoint = { x: e.clientX, y: e.clientY };
        treeContainer.style.cursor = 'grabbing';
    });

    treeContainer.addEventListener("mousemove", (e) => {
        if (!isPanning) return;
        endPoint = { x: e.clientX, y: e.clientY };
        const dx = (startPoint.x - endPoint.x) * (viewBox.w / treeContainer.clientWidth);
        const dy = (startPoint.y - endPoint.y) * (viewBox.h / treeContainer.clientHeight);
        viewBox.x += dx;
        viewBox.y += dy;
        svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
        startPoint = endPoint;
    });

    treeContainer.addEventListener("mouseup", () => { isPanning = false; treeContainer.style.cursor = 'grab'; });
    treeContainer.addEventListener("mouseleave", () => { isPanning = false; treeContainer.style.cursor = 'grab'; });
}

// Initialisierung der Anwendung
document.addEventListener("DOMContentLoaded", function() {
    loadState();
    setupEventListeners();
    updateUI();
    // Die Interaktionen müssen nach dem Rendern des Baums initialisiert werden
    setTimeout(() => {
        setupTreeInteractions();
    }, 100); 
});