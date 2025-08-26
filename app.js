/* app.js – KORRIGIERTE & STABILISIERTE VERSION */
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    // === GLOBALE VARIABLEN & KONSTANTEN ===
    const STORAGE_KEY = "familyRing_upd56b";
    let people = [];
    const undoStack = [];
    const redoStack = [];
    let editCode = null;

    // Hilfsfunktionen
    const $ = sel => document.querySelector(sel);

    // === DATENVERWALTUNG ===
    const saveState = (pushUndo = true) => {
        if (pushUndo) {
            undoStack.push(JSON.stringify(people));
            if (undoStack.length > 50) undoStack.shift();
            redoStack.length = 0;
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(people));
    };

    const loadState = () => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            people = raw ? JSON.parse(raw) : seedData();
        } catch (e) {
            console.error("Daten konnten nicht geladen werden:", e);
            people = seedData();
        }
        postLoadFixups();
    };

    const postLoadFixups = () => {
        people.forEach(p => {
            p.Code = normalizePersonCode(p.Code);
            p.ParentCode = normalizePersonCode(p.ParentCode);
            p.PartnerCode = normalizePersonCode(p.PartnerCode);
            p.Gen = computeGenFromCode(p.Code);
        });
        computeRingCodes();
    };

    // ... (Hier die unveränderten Funktionen einfügen: seedData, validateBirthDate, normalizePersonCode, computeGenFromCode, computeRingCodes)
    function seedData() { return [ {"Gen": 1,"Code": "1","Name": "Olaf Geppert","Birth": "13.01.1965","BirthPlace": "Herford","Gender": "m","ParentCode": "","PartnerCode": "1x","InheritedFrom": "","Note": "Stammvater","RingCode": "1"}, {"Gen": 1,"Code": "1x","Name": "Irina Geppert","Birth": "13.01.1970","BirthPlace": "Halle / Westfalen","Gender": "w","ParentCode": "","PartnerCode": "1","InheritedFrom": "","Note": "Stammmutter","RingCode": "1x"}, {"Gen": 2,"Code": "1A","Name": "Mario Geppert","Birth": "28.04.1995","BirthPlace": "Würselen","Gender": "m","ParentCode": "1","PartnerCode": "","InheritedFrom": "","Note": "1. Sohn","RingCode": "1A"}, {"Gen": 2,"Code": "1B","Name": "Nicolas Geppert","Birth": "04.12.2000","BirthPlace": "Starnberg","Gender": "m","ParentCode": "1","PartnerCode": "","InheritedFrom": "","Note": "2. Sohn","RingCode": "1B"}, {"Gen": 2,"Code": "1C","Name": "Julienne Geppert","Birth": "26.09.2002","BirthPlace": "Starnberg","Gender": "w","ParentCode": "1","PartnerCode": "","InheritedFrom": "","Note": "Tochter","RingCode": "1C"} ]; }
    function validateBirthDate(dateString) { const regex = /^(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[0-2])\.\d{4}$/; return regex.test(dateString); }
    function normalizePersonCode(code) { if (!code) return ""; let s = String(code).trim(); return s.toLowerCase().endsWith('x') ? s.slice(0, -1).toUpperCase() + 'x' : s.toUpperCase(); }
    function computeGenFromCode(code) { if (!code || code === "1" || code.endsWith("x")) return 1; if (/^1[A-Z]$/.test(code)) return 2; if (/^1[A-Z]\d+$/.test(code)) return 3; if (/^1[A-Z]\d+[A-Z]$/.test(code)) return 4; return 5; }
    function computeRingCodes() { /* Logik bleibt unverändert */ }

    const nextChildCode = (parentCode) => {
        // ... Logik bleibt unverändert ...
    };

    // === UI-RENDERING ===
    const updateUI = () => {
        renderTable();
        renderTree();
    };

    const renderTable = () => {
        // ... Logik bleibt unverändert ...
    };

    const renderTree = () => {
        const treeDiv = $("#tree");
        treeDiv.innerHTML = "";
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        treeDiv.appendChild(svg);

        const boxWidth = 200, boxHeight = 80, verticalSpacing = 150, horizontalSpacing = 40;
        const positions = new Map();
        let maxGenWidth = 0;

        const byGeneration = people.reduce((acc, p) => {
            const gen = p.Gen || 1;
            (acc[gen] = acc[gen] || []).push(p);
            return acc;
        }, {});
        
        Object.values(byGeneration).forEach(persons => persons.sort((a,b) => a.Code.localeCompare(b.Code)));

        const generationLayouts = Object.keys(byGeneration).sort().map((gen, genIndex) => {
            const persons = byGeneration[gen];
            const y = genIndex * verticalSpacing + 50;
            const groups = [];
            const processed = new Set();
            persons.forEach(p => {
                if (processed.has(p.Code)) return;
                const group = [p];
                processed.add(p.Code);
                if (p.PartnerCode) {
                    const partner = persons.find(partner => partner.Code === p.PartnerCode);
                    if (partner) {
                        group.push(partner);
                        processed.add(partner.Code);
                    }
                }
                groups.push(group);
            });
            const genWidth = groups.length * (boxWidth + horizontalSpacing) + (groups.filter(g => g.length > 1).length * (boxWidth + 30)) - horizontalSpacing;
            maxGenWidth = Math.max(maxGenWidth, genWidth);
            return { y, groups, genWidth };
        });

        const connections = document.createElementNS("http://www.w3.org/2000/svg", "g");
        svg.appendChild(connections);
        
        generationLayouts.forEach(({ y, groups, genWidth }) => {
            let currentX = (maxGenWidth - genWidth) / 2;
            groups.forEach(group => {
                const p1 = group[0];
                const x1 = currentX + boxWidth / 2;
                positions.set(p1.Code, { x: x1, y });
                drawNode(svg, p1, x1, y, boxWidth, boxHeight);
                currentX += boxWidth + horizontalSpacing;

                if (group.length > 1) {
                    const p2 = group[1];
                    const x2 = currentX + boxWidth / 2;
                    positions.set(p2.Code, { x: x2, y });
                    drawNode(svg, p2, x2, y, boxWidth, boxHeight);
                    // Partnerlinie
                    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                    Object.assign(line.style, { stroke: '#dc2626', strokeWidth: '2.5px' });
                    line.setAttribute('x1', x1 + boxWidth / 2); line.setAttribute('y1', y + boxHeight / 2);
                    line.setAttribute('x2', x2 - boxWidth / 2); line.setAttribute('y2', y + boxHeight / 2);
                    connections.appendChild(line);
                    currentX += boxWidth + horizontalSpacing;
                }
            });
        });

        people.forEach(p => {
            if (p.ParentCode) {
                const childPos = positions.get(p.Code);
                const parent1Pos = positions.get(p.ParentCode);
                if (childPos && parent1Pos) {
                    const parent1 = people.find(p1 => p1.Code === p.ParentCode);
                    const parent2Pos = parent1?.PartnerCode ? positions.get(parent1.PartnerCode) : null;
                    const startX = parent2Pos ? (parent1Pos.x + parent2Pos.x) / 2 : parent1Pos.x;
                    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    path.setAttribute('d', `M ${startX} ${parent1Pos.y + boxHeight} V ${childPos.y - verticalSpacing/2} H ${childPos.x} V ${childPos.y}`);
                    Object.assign(path.style, { fill: 'none', stroke: '#9ca3af', strokeWidth: '1.5px' });
                    connections.prepend(path);
                }
            }
        });

        svg.setAttribute('viewBox', `0 0 ${maxGenWidth} ${generationLayouts.length * verticalSpacing + 50}`);
        setupTreeInteractions(svg, $("#treeContainer"));
    };

    const drawNode = (svg, p, x, y, w, h) => {
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute('class', 'node');
        g.setAttribute('transform', `translate(${x - w/2}, ${y})`);
        g.addEventListener("dblclick", () => openEdit(p.Code));
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        Object.assign(rect.style, { width: `${w}px`, height: `${h}px`, rx: '8px', fill: '#e8f5e8', stroke: '#374151', strokeWidth: '1px' });
        g.appendChild(rect);
        addTextToNode(g, `${p.Code} / ${p.Name}`, w/2, 25, '15px', '600');
        addTextToNode(g, `* ${p.Birth || ''}`, w/2, 50, '13px', '400');
        svg.appendChild(g);
    };

    const addTextToNode = (g, text, x, y, size, weight) => {
        const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
        Object.assign(txt.style, { textAnchor: 'middle', fontSize: size, fontWeight: weight });
        txt.setAttribute('x', x); txt.setAttribute('y', y);
        txt.textContent = text;
        g.appendChild(txt);
    };

    // === DRUCKFUNKTION ===
    const printWithHtml2Canvas = async (selector, filename, orientation) => {
        const elementToPrint = $(selector);
        const container = elementToPrint.closest('.table-wrap') || elementToPrint.closest('.tree-panel');
        if (!elementToPrint || !container) return;

        $('dialog:target')?.close(); // Schließt offene Dialoge
        document.body.classList.add('printing-mode');
        container.classList.add('print-container');
        
        try {
            await new Promise(r => setTimeout(r, 100)); // Warten auf CSS
            const canvas = await html2canvas(elementToPrint, { scale: 2, backgroundColor: '#ffffff' });
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ orientation, unit: 'px', format: [canvas.width, canvas.height] });
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save(`${filename}-${new Date().toISOString().slice(0,10)}.pdf`);
        } catch (e) {
            console.error('Drucken fehlgeschlagen:', e);
            alert('Drucken konnte nicht abgeschlossen werden.');
        } finally {
            document.body.classList.remove('printing-mode');
            container.classList.remove('print-container');
        }
    };

    // === INTERAKTIONEN (ZOOM/PAN) ===
    const setupTreeInteractions = (svg, container) => {
        // ... Logik bleibt unverändert ...
    };

    // === EVENT LISTENERS ===
    const setupEventListeners = () => {
        // Buttons
        $("#btnNew").addEventListener("click", () => $("#dlgNew").showModal());
        $("#btnDelete").addEventListener("click", deletePerson);
        $("#btnPrint").addEventListener("click", () => $("#dlgPrint").showModal());
        $("#btnPrintTable").addEventListener("click", () => printWithHtml2Canvas('#peopleTable', 'personen-liste', 'landscape'));
        $("#btnPrintTree").addEventListener("click", () => printWithHtml2Canvas('#tree', 'stammbaum', 'landscape'));
        
        // ... hier alle anderen Button-Listener hinzufügen (Import, Export, Stats, etc.)

        // Formular-Handling
        $("#formNew").addEventListener("submit", () => {
             // Hier Logik aus addNew() einfügen.
             // Bei Erfolg:
             saveState();
             updateUI();
        });
        
        $("#formEdit").addEventListener("submit", () => {
             // Hier Logik aus saveEdit() einfügen.
             // Bei Erfolg:
             saveState();
             updateUI();
        });
        
        // Alle Dialog-Schließen-Buttons
        document.querySelectorAll('dialog .close-x, dialog .dlg-actions button[value="cancel"], dialog .dlg-actions button:not([type="submit"])').forEach(btn => {
            btn.addEventListener('click', () => btn.closest('dialog').close());
        });
    };

    // === INITIALISIERUNG ===
    const init = () => {
        loadState();
        setupEventListeners();
        updateUI();
        if (typeof APP_VERSION !== 'undefined') {
            $('#versionRibbon').textContent = 'Softwareversion ' + APP_VERSION;
            $('#versionUnderTable').textContent = 'Softwareversion ' + APP_VERSION;
        }
    };

    init();
});