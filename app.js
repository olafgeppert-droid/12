/* app.js – KORRIGIERTE & STABILISIERTE VERSION */
"use strict";

document.addEventListener("DOMContentLoaded", function() {
    // Globale Variablen
    const STORAGE_KEY = "familyRing_upd56b";
    let people = [];
    const undoStack = [];
    const redoStack = [];
    const MAX_UNDO_STEPS = 50;
    let editCode = null;

    // Hilfsfunktionen
    const $ = sel => document.querySelector(sel);
    const $$ = sel => document.querySelectorAll(sel);

    // === DATENVERWALTUNG & LOGIK ===

    function saveState(pushUndo = true) {
        if (pushUndo) {
            undoStack.push(JSON.stringify(people));
            if (undoStack.length > MAX_UNDO_STEPS) undoStack.shift();
            redoStack.length = 0;
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(people));
    }

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : seedData();
            if (Array.isArray(parsed)) {
                people = parsed;
            } else {
                people = seedData();
            }
        } catch (error) {
            console.error("Fehler beim Laden der Daten:", error);
            people = seedData();
        }
        postLoadFixups();
    }

    function postLoadFixups() {
        people.forEach(p => {
            p.Code = normalizePersonCode(p.Code);
            p.ParentCode = normalizePersonCode(p.ParentCode);
            p.PartnerCode = normalizePersonCode(p.PartnerCode);
            p.Gen = computeGenFromCode(p.Code);
            p.RingCode = p.RingCode || p.Code;
        });
        computeRingCodes();
    }
    
    // ... (seedData, computeRingCodes, validateBirthDate, normalizePersonCode, computeGenFromCode bleiben unverändert) ...

    function nextChildCode(parentCode) {
        if (!parentCode) return "";
        const children = people.filter(p => p.ParentCode === parentCode);
        const parentGen = computeGenFromCode(parentCode);
    
        // Generation 3 Kinder (Enkel) bekommen numerische Suffixe (1A1, 1A2...)
        if (parentGen >= 2) {
             let nextNum = 1;
             while (people.some(p => p.Code === parentCode + nextNum)) {
                 nextNum++;
             }
             return parentCode + nextNum;
        } 
        // Generation 2 Kinder bekommen alphabetische Suffixe (1A, 1B...)
        else {
            let nextChar = 'A';
            while (people.some(p => p.Code === parentCode + nextChar)) {
                nextChar = String.fromCharCode(nextChar.charCodeAt(0) + 1);
            }
            return parentCode + nextChar;
        }
    }


    // === UI-RENDERING ===

    function updateUI() {
        renderTable();
        renderTree();
    }
    
    // ... (renderTable bleibt unverändert) ...

    /**
     * KORRIGIERT: Überarbeitete Funktion zum Rendern des Stammbaums.
     * Verhindert Überlappungen durch einen robusteren Layout-Algorithmus.
     */
    function renderTree() {
        const treeDiv = $("#tree");
        if (!treeDiv) return;
        treeDiv.innerHTML = "";
    
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        treeDiv.appendChild(svg);
    
        const genColors = { 1: "#e8f5e8", 2: "#e3f2fd", 3: "#f3e5f5", 4: "#fff3e0", 5: "#e8eaf6" };
        const boxWidth = 200, boxHeight = 80, partnerGap = 30;
        const verticalSpacing = 160, horizontalSpacing = 40;
    
        const positions = new Map();
        const dimensions = { width: 0, height: 0 };
    
        const byGeneration = people.reduce((acc, p) => {
            const gen = p.Gen || 1;
            acc[gen] = acc[gen] || [];
            acc[gen].push(p);
            return acc;
        }, {});
    
        const generations = Object.keys(byGeneration).sort((a, b) => a - b);
    
        // Phase 1: Positionen berechnen
        generations.forEach((gen, genIndex) => {
            const y = genIndex * verticalSpacing + 50;
            const personsInGen = byGeneration[gen];
            const groups = [];
            const processed = new Set();
    
            personsInGen.forEach(p => {
                if (processed.has(p.Code)) return;
                let group = [p];
                processed.add(p.Code);
                if (p.PartnerCode) {
                    const partner = personsInGen.find(partner => partner.Code === p.PartnerCode);
                    if (partner) {
                        group.push(partner);
                        processed.add(partner.Code);
                    }
                }
                groups.push(group);
            });
    
            const genWidth = groups.reduce((w, g) => w + g.length * boxWidth + (g.length - 1) * partnerGap, 0) + (groups.length - 1) * horizontalSpacing;
            let currentX = (dimensions.width - genWidth) / 2; // Zentrieren
    
            groups.forEach(group => {
                if (group.length > 1) {
                    positions.set(group[0].Code, { x: currentX + boxWidth / 2, y });
                    positions.set(group[1].Code, { x: currentX + boxWidth + partnerGap + boxWidth / 2, y });
                    currentX += boxWidth * 2 + partnerGap + horizontalSpacing;
                } else {
                    positions.set(group[0].Code, { x: currentX + boxWidth / 2, y });
                    currentX += boxWidth + horizontalSpacing;
                }
            });
            dimensions.width = Math.max(dimensions.width, genWidth);
            dimensions.height = y + boxHeight;
        });
    
        svg.setAttribute("viewBox", `-50 -20 ${dimensions.width + 100} ${dimensions.height + 40}`);
        const connections = document.createElementNS(svgNS, "g");
        svg.appendChild(connections);
    
        // Phase 2: Elemente zeichnen
        people.forEach(p => {
            const pos = positions.get(p.Code);
            if (!pos) return;
    
            // Verbindungslinien
            if (p.ParentCode) {
                const parent1 = positions.get(p.ParentCode);
                if (parent1) {
                    const parent2 = positions.get(people.find(par => par.Code === p.ParentCode)?.PartnerCode);
                    const startX = parent2 ? (parent1.x + parent2.x) / 2 : parent1.x;
                    const path = document.createElementNS(svgNS, "path");
                    path.setAttribute("d", `M ${startX} ${parent1.y + boxHeight} V ${pos.y - verticalSpacing/2} H ${pos.x} V ${pos.y}`);
                    path.setAttribute("fill", "none");
                    path.setAttribute("stroke", "#9ca3af");
                    path.setAttribute("stroke-width", "1.5");
                    connections.appendChild(path);
                }
            }
    
            // Boxen
            const g = document.createElementNS(svgNS, "g");
            g.setAttribute("class", "node");
            g.setAttribute("transform", `translate(${pos.x - boxWidth / 2}, ${pos.y})`);
            g.addEventListener("dblclick", () => openEdit(p.Code));
            svg.appendChild(g);
    
            const rect = document.createElementNS(svgNS, "rect");
            Object.assign(rect.style, { width: `${boxWidth}px`, height: `${boxHeight}px`, rx: '8px', fill: genColors[p.Gen] || '#fff', stroke: '#374151', strokeWidth: '1.5px' });
            g.appendChild(rect);
            
            addText(g, `${p.Code} / ${p.Name}`, 20, "15px", "600");
            addText(g, `* ${p.Birth || 'unbekannt'}`, 45, "13px", "400");
            addText(g, `Gen: ${p.Gen}`, 65, "13px", "400");
        });
        
        setupTreeInteractions(svg);
    }
    
    function addText(parent, content, y, size, weight) {
        const text = document.createElementNS(svgNS, "text");
        text.setAttribute("x", boxWidth / 2);
        text.setAttribute("y", y);
        text.setAttribute("font-size", size);
        text.setAttribute("font-weight", weight);
        text.setAttribute("text-anchor", "middle");
        text.textContent = content;
        parent.appendChild(text);
    }

    // === INTERAKTIONEN & DIALOGE ===

    function openNew() {
        $("#formNew").reset();
        $("#dlgNew").showModal();
    }

    function addNew() {
        // ... Logik aus Ihrer alten addNew() ...
        // Am Ende, bei Erfolg:
        $("#dlgNew").close();
        saveState();
        updateUI();
    }
    
    function openEdit(code) {
        const p = people.find(x => x.Code === code);
        if (!p) return;
        editCode = code;
        // ... Formular befüllen ...
        $("#dlgEdit").showModal();
    }
    
    function saveEdit() {
        // ... Logik aus Ihrer alten saveEdit() ...
        // Am Ende, bei Erfolg:
        $("#dlgEdit").close();
        editCode = null;
        saveState();
        updateUI();
    }

    // ... (deletePerson, importData, exportData, showStats, resetData, undo, redo bleiben unverändert) ...

    /**
     * KORRIGIERT: Drucklogik mit html2canvas und jspdf
     */
    async function printElementAsPdf(elementSelector, dialog, outputFilename, orientation) {
        dialog.close();
        const targetElement = $(elementSelector);
        if (!targetElement) return;

        const printParent = targetElement.closest('.table-wrap') || targetElement.closest('.tree-panel');
        document.body.classList.add('printing-mode');
        printParent.classList.add('print-this-parent');
        
        try {
            await new Promise(resolve => setTimeout(resolve, 150));
            const canvas = await html2canvas(targetElement, {
                scale: 2, // Fester Wert für gute Qualität
                useCORS: true,
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/png');
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ orientation, unit: 'px', format: [canvas.width, canvas.height] });
            
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save(`${outputFilename}_${new Date().toISOString().slice(0, 10)}.pdf`);
        } catch (error) {
            console.error("Druckfehler:", error);
            alert("Drucken fehlgeschlagen.");
        } finally {
            document.body.classList.remove('printing-mode');
            printParent.classList.remove('print-this-parent');
        }
    }

    function printTable() { printElementAsPdf('#peopleTable', $("#dlgPrint"), 'personen-liste', 'landscape'); }
    function printTree() { printElementAsPdf('#tree', $("#dlgPrint"), 'stammbaum', 'landscape'); }

    /**
     * KORRIGIERT: Interaktionen für Zoom/Pan im Stammbaum
     */
    function setupTreeInteractions(svg) {
        const treeContainer = $("#treeContainer");
        let viewBox = { x: 0, y: 0, w: svg.viewBox.baseVal.width, h: svg.viewBox.baseVal.height };
        let isPanning = false, startPoint = { x: 0, y: 0 };

        treeContainer.onwheel = e => {
            e.preventDefault();
            const { clientX, clientY } = e;
            const pt = new DOMPoint(clientX, clientY);
            const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
            
            const delta = (e.deltaY < 0) ? 0.85 : 1.15;
            viewBox.x = svgP.x - (svgP.x - viewBox.x) * delta;
            viewBox.y = svgP.y - (svgP.y - viewBox.y) * delta;
            viewBox.w *= delta;
            viewBox.h *= delta;
            svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
        };

        treeContainer.onmousedown = e => { isPanning = true; startPoint = { x: e.clientX, y: e.clientY }; treeContainer.style.cursor = 'grabbing'; };
        treeContainer.onmouseup = treeContainer.onmouseleave = () => { isPanning = false; treeContainer.style.cursor = 'grab'; };
        treeContainer.onmousemove = e => {
            if (!isPanning) return;
            const dx = (startPoint.x - e.clientX) * (viewBox.w / treeContainer.clientWidth);
            const dy = (startPoint.y - e.clientY) * (viewBox.h / treeContainer.clientHeight);
            viewBox.x += dx;
            viewBox.y += dy;
            svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
            startPoint = { x: e.clientX, y: e.clientY };
        };
    }
    
    // === INITIALISIERUNG ===
    function init() {
        // Event Listeners zuweisen
        $("#btnNew").addEventListener("click", openNew);
        $("#btnDelete").addEventListener("click", deletePerson);
        $("#btnPrintTable").addEventListener("click", printTable);
        $("#btnPrintTree").addEventListener("click", printTree);
        // ... (alle weiteren Event Listeners hier hinzufügen) ...
        $("#formNew").addEventListener("submit", (e) => { e.preventDefault(); addNew(); });
        $("#formEdit").addEventListener("submit", (e) => { e.preventDefault(); saveEdit(); });

        loadState();
        updateUI();
        
        // Initialisiere die Version-Anzeige
        if (typeof APP_VERSION !== 'undefined') {
            $('#versionRibbon').textContent = 'Softwareversion ' + APP_VERSION;
            $('#versionUnderTable').textContent = 'Softwareversion ' + APP_VERSION;
        }
    }

    init(); // App starten
});