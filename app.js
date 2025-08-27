/* app.js – KORRIGIERTE FINALE VERSION */
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    try {
        // === GLOBALE VARIABLEN & KONSTANTEN ===
        const STORAGE_KEY = "familyRing_upd56b";
        let people = [];
        const undoStack = [];
        const redoStack = [];
        const MAX_UNDO_STEPS = 50;
        let editCode = null;

        const $ = sel => document.querySelector(sel);
        
        const messages = {
            personNotFound: "Person nicht gefunden.",
            invalidDate: "Ungültiges Geburtsdatum-Format. Bitte TT.MM.JJJJ verwenden.",
            requiredFields: "Bitte alle Pflichtfelder (*) ausfüllen.",
            printError: "Der Druckvorgang konnte nicht abgeschlossen werden."
        };

        // === DATENVERWALTUNG & KERNLOGIK ===
        const saveState = (pushUndo = true) => {
            if (pushUndo) {
                undoStack.push(JSON.stringify(people));
                if (undoStack.length > MAX_UNDO_STEPS) undoStack.shift();
                redoStack.length = 0;
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(people));
            updateUndoRedoButtons();
        };

        const loadState = () => {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                people = raw ? JSON.parse(raw) : seedData();
            } catch (e) {
                console.error("Laden der Daten fehlgeschlagen:", e);
                people = seedData();
            }
            postLoadFixups();
        };

        const postLoadFixups = () => { /* Ihre Originalfunktion */ };
        const seedData = () => [ /* Ihre Beispieldaten */ ];
        const validateBirthDate = (dateString) => { /* Ihre Originalfunktion */ };
        const normalizePersonCode = (code) => { /* Ihre Originalfunktion */ };
        const computeGenFromCode = (code) => { /* Ihre Originalfunktion */ };
        const computeRingCodes = () => { /* Ihre Originalfunktion */ };

        // === UI-RENDERING ===
        const updateUI = () => {
            renderTable();
            renderTree();
        };

        const renderTable = () => {
            const q = ($("#search").value || "").trim().toLowerCase();
            const tb = $("#peopleTable tbody");
            tb.innerHTML = "";
            const sortedPeople = [...people].sort((a, b) => (a.Gen - b.Gen) || String(a.Code).localeCompare(String(b.Code)));
            for (const p of sortedPeople) {
                if (q && !(p.Name.toLowerCase().includes(q) || String(p.Code).toLowerCase().includes(q))) continue;
                const tr = document.createElement("tr");
                const bgColor = `var(--gen${p.Gen}-color, #fff)`;
                tr.style.backgroundColor = bgColor;
                tr.innerHTML = `<td>${p.Gen || ''}</td><td>${p.Code || ''}</td><td>${p.RingCode || ''}</td><td>${p.Name || ''}</td><td>${p.Birth || ''}</td><td>${p.BirthPlace || ''}</td><td>${p.Gender || ''}</td><td>${p.ParentCode || ''}</td><td>${p.PartnerCode || ''}</td><td>${p.InheritedFrom || ''}</td><td>${p.Note || ''}</td>`;
                tr.addEventListener("dblclick", () => openEdit(p.Code));
                tb.appendChild(tr);
            }
        };
        
        // KORRIGIERTE renderTree-Funktion gegen Überlappungen
        const renderTree = () => {
            const treeDiv = $("#tree");
            treeDiv.innerHTML = "";
            if (people.length === 0) return;

            const svgNS = "http://www.w3.org/2000/svg";
            const svg = document.createElementNS(svgNS, "svg");
            treeDiv.appendChild(svg);

            const boxWidth = 220, boxHeight = 90, verticalSpacing = 180, horizontalSpacing = 50, partnerGap = 40;
            const positions = new Map();
            let maxGenWidth = 0;

            const byGeneration = people.reduce((acc, p) => {
                const gen = p.Gen || 1;
                (acc[gen] = acc[gen] || []).push(p);
                return acc;
            }, {});
            
            Object.values(byGeneration).forEach(persons => persons.sort((a,b) => String(a.Code).localeCompare(String(b.Code))));

            const generationLayouts = Object.keys(byGeneration).sort((a,b) => a-b).map((gen, genIndex) => {
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
                const genWidth = groups.reduce((w, g) => w + (g.length * boxWidth) + ((g.length - 1) * partnerGap), 0) + ((groups.length - 1) * horizontalSpacing);
                maxGenWidth = Math.max(maxGenWidth, genWidth);
                return { y, groups, genWidth };
            });

            const connections = document.createElementNS(svgNS, "g");
            svg.appendChild(connections);
            const nodes = document.createElementNS(svgNS, "g");
            svg.appendChild(nodes);

            generationLayouts.forEach(({ y, groups, genWidth }) => {
                let currentX = (maxGenWidth - genWidth) / 2;
                groups.forEach(group => {
                    const p1 = group[0];
                    const x1 = currentX + boxWidth / 2;
                    positions.set(p1.Code, { x: x1, y });
                    drawNode(nodes, p1, x1, y, boxWidth, boxHeight);
                    currentX += boxWidth + horizontalSpacing;

                    if (group.length > 1) {
                        const p2 = group[1];
                        currentX -= horizontalSpacing;
                        currentX += partnerGap;
                        const x2 = currentX + boxWidth / 2;
                        positions.set(p2.Code, { x: x2, y });
                        drawNode(nodes, p2, x2, y, boxWidth, boxHeight);
                        const line = document.createElementNS(svgNS, "line");
                        line.setAttribute('x1', x1 + boxWidth / 2); line.setAttribute('y1', y + boxHeight / 2);
                        line.setAttribute('x2', x2 - boxWidth / 2); line.setAttribute('y2', y + boxHeight / 2);
                        line.setAttribute('stroke', '#dc2626'); line.setAttribute('stroke-width', '2.5');
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
                        const path = document.createElementNS(svgNS, "path");
                        path.setAttribute('d', `M ${startX} ${parent1Pos.y + boxHeight} V ${childPos.y - verticalSpacing/2} H ${childPos.x} V ${childPos.y}`);
                        path.setAttribute('fill', 'none'); path.setAttribute('stroke', '#9ca3af'); path.setAttribute('stroke-width', '2');
                        connections.prepend(path);
                    }
                }
            });

            const totalHeight = generationLayouts.length * verticalSpacing + 50;
            svg.setAttribute('viewBox', `-50 -20 ${maxGenWidth + 100} ${totalHeight + 40}`);
            setupTreeInteractions();
        };

        const drawNode = (parent, p, x, y, w, h) => {
            const g = document.createElementNS(svgNS, "g");
            g.setAttribute('class', 'node');
            g.setAttribute('transform', `translate(${x - w/2}, ${y})`);
            g.addEventListener("dblclick", () => openEdit(p.Code));
            const rect = document.createElementNS(svgNS, "rect");
            const bgColor = `var(--gen${p.Gen}-color, #fff)`;
            rect.setAttribute('width', w); rect.setAttribute('height', h); rect.setAttribute('rx', 8);
            rect.setAttribute('fill', bgColor); rect.setAttribute('stroke', '#374151'); rect.setAttribute('stroke-width', '1.5');
            g.appendChild(rect);
            addTextToNode(g, `${p.Code} / ${p.Name}`, w/2, 28, '15px', '600');
            addTextToNode(g, `* ${p.Birth || ''}`, w/2, 53, '13px', '400');
            addTextToNode(g, `Gen: ${p.Gen}`, w/2, 73, '13px', '400');
            parent.appendChild(g);
        };

        const addTextToNode = (g, text, x, y, size, weight) => {
            const txt = document.createElementNS(svgNS, "text");
            txt.setAttribute('x', x); txt.setAttribute('y', y);
            txt.setAttribute('font-size', size); txt.setAttribute('font-weight', weight);
            txt.setAttribute('text-anchor', 'middle');
            txt.textContent = text;
            g.appendChild(txt);
        };

        // === AKTIONEN ===
        const openNew = () => { /* Ihre Originalfunktion */ };
        const addNew = () => { /* Ihre Originalfunktion */ };
        const openEdit = (code) => { /* Ihre Originalfunktion */ };
        const saveEditFn = () => { /* Ihre Originalfunktion */ };
        const deletePerson = () => { /* Ihre Originalfunktion */ };
        const doImport = (file) => { /* Ihre Originalfunktion */ };
        const parseCSV = (csvText) => { /* Ihre Originalfunktion */ };
        const exportJSON = () => { /* Ihre Originalfunktion */ };
        const exportCSV = () => { /* Ihre Originalfunktion */ };
        const shareOrDownload = async (filename, blob) => { /* Ihre Originalfunktion */ };
        const updateStats = () => { /* Ihre Originalfunktion */ };
        const updateUndoRedoButtons = () => { $("#btnUndo").disabled = undoStack.length === 0; $("#btnRedo").disabled = redoStack.length === 0; };
        const undo = () => { /* Ihre Originalfunktion */ };
        const redo = () => { /* Ihre Originalfunktion */ };
        const resetData = () => { /* Ihre Originalfunktion */ };

        // KORRIGIERTE DRUCKFUNKTION
        const printWithHtml2Canvas = async (selector, filename, orientation) => {
            const finalSelector = selector === '#tree' ? '#tree svg' : selector;
            const element = $(finalSelector);
            const container = $(selector).closest('.table-wrap, .tree-panel');

            if (!element || !container) return alert("Druckelement nicht gefunden.");
            $("#dlgPrint").close();
            
            // Temporären Container für den Druck erstellen, um die originale Ansicht nicht zu verändern
            const printContainer = document.createElement('div');
            printContainer.classList.add('print-container');
            const clonedElement = element.cloneNode(true);
            printContainer.appendChild(clonedElement);
            document.body.appendChild(printContainer);
            
            document.body.classList.add('printing-mode');
            
            try {
                await new Promise(r => setTimeout(r, 150)); // Kurze Wartezeit für Rendering
                
                const canvas = await html2canvas(clonedElement, {
                    scale: 2, // Erhöht die Auflösung für schärfere PDFs
                    backgroundColor: '#ffffff',
                    useCORS: true,
                    // Wichtig: Sagt html2canvas, die volle Größe zu rendern, nicht nur den sichtbaren Teil
                    width: clonedElement.scrollWidth,
                    height: clonedElement.scrollHeight,
                    windowWidth: clonedElement.scrollWidth,
                    windowHeight: clonedElement.scrollHeight
                });

                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF({ orientation, unit: 'px', format: [canvas.width + 40, canvas.height + 40] }); // PDF mit Rand
                pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 20, 20, canvas.width, canvas.height); // Bild mit Rand einfügen
                pdf.save(`${filename}-${new Date().toISOString().slice(0,10)}.pdf`);
            } catch (e) {
                console.error(messages.printError, e);
                alert(messages.printError);
            } finally {
                // Aufräumen
                document.body.classList.remove('printing-mode');
                document.body.removeChild(printContainer);
            }
        };
        
        const setupTreeInteractions = () => { /* Ihre Originalfunktion */ };

        // === EVENT LISTENERS ===
        const setupEventListeners = () => {
            $("#btnNew").addEventListener("click", openNew);
            $("#btnDelete").addEventListener("click", deletePerson);
            $("#btnImport").addEventListener("click", () => { const i=document.createElement('input'); i.type='file'; i.accept='.json,.csv'; i.onchange=()=>doImport(i.files[0]); i.click(); });
            $("#btnExport").addEventListener("click", () => $("#dlgExport").showModal());
            $("#btnPrint").addEventListener("click", () => $("#dlgPrint").showModal());
            $("#btnStats").addEventListener("click", () => { updateStats(); $("#dlgStats").showModal(); });
            $("#btnHelp").addEventListener("click", () => $("#dlgHelp").showModal());
            $("#btnReset").addEventListener("click", resetData);
            $("#btnUndo").addEventListener("click", undo);
            $("#btnRedo").addEventListener("click", redo);
            $("#search").addEventListener("input", renderTable);
            $("#btnExportJSON").addEventListener("click", exportJSON);
            $("#btnExportCSV").addEventListener("click", exportCSV);
            $("#btnPrintTable").addEventListener("click", () => printWithHtml2Canvas('#peopleTable', 'personen-liste', 'landscape'));
            $("#btnPrintTree").addEventListener("click", () => printWithHtml2Canvas('#tree', 'stammbaum', 'landscape'));
            $("#formNew").addEventListener("submit", (e) => { if (e.submitter && e.submitter.value === 'default') { e.preventDefault(); addNew(); } });
            $("#formEdit").addEventListener("submit", (e) => { if (e.submitter && e.submitter.value === 'default') { e.preventDefault(); saveEditFn(); } });
            document.querySelectorAll('dialog .close-x, dialog .dlg-actions button:not([type="submit"])').forEach(btn => {
                btn.addEventListener('click', (e) => { e.preventDefault(); btn.closest('dialog').close(); });
            });
        };

        // === INITIALISIERUNG ===
        const init = () => {
            loadState();
            setupEventListeners();
            updateUI();
            setupTreeInteractions();
        };

        init();
    } catch (error) {
        console.error("Ein kritischer Fehler hat den Start der Anwendung verhindert:", error);
        document.body.innerHTML = `<div style="padding: 20px; font-family: sans-serif; text-align: center;"><h1>Anwendungsfehler</h1><p>Die Anwendung konnte nicht gestartet werden. Bitte die Browser-Konsole (F12) für Details prüfen.</p></div>`;
    }
});
