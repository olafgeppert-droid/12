/* app.js – KORRIGIERTE VERSION MIT KORREKTER PERSONEN-CODE-LOGIK */
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    // === GLOBALE VARIABLEN & KONSTANTEN ===
    const STORAGE_KEY = "familyRing_upd56b";
    let people = [];
    const undoStack = [];
    const redoStack = [];
    let editCode = null;

    const $ = sel => document.querySelector(sel);

    // === DATENVERWALTUNG & KERNLOGIK ===

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
            p.InheritedFrom = normalizePersonCode(p.InheritedFrom);
            p.Gen = computeGenFromCode(p.Code);
        });
        computeRingCodes();
    };

    const seedData = () => [
        { "Gen": 1, "Code": "1", "Name": "Olaf Geppert", "Birth": "13.01.1965", "BirthPlace": "Herford", "Gender": "m", "ParentCode": "", "PartnerCode": "1x", "InheritedFrom": "", "Note": "Stammvater", "RingCode": "1" },
        { "Gen": 1, "Code": "1x", "Name": "Irina Geppert", "Birth": "13.01.1970", "BirthPlace": "Halle / Westfalen", "Gender": "w", "ParentCode": "", "PartnerCode": "1", "InheritedFrom": "", "Note": "Stammmutter", "RingCode": "1x" },
        { "Gen": 2, "Code": "1A", "Name": "Mario Geppert", "Birth": "28.04.1995", "BirthPlace": "Würselen", "Gender": "m", "ParentCode": "1", "PartnerCode": "", "InheritedFrom": "", "Note": "1. Sohn", "RingCode": "1A" },
        { "Gen": 2, "Code": "1B", "Name": "Nicolas Geppert", "Birth": "04.12.2000", "BirthPlace": "Starnberg", "Gender": "m", "ParentCode": "1", "PartnerCode": "", "InheritedFrom": "", "Note": "2. Sohn", "RingCode": "1B" },
        { "Gen": 2, "Code": "1C", "Name": "Julienne Geppert", "Birth": "26.09.2002", "BirthPlace": "Starnberg", "Gender": "w", "ParentCode": "1", "PartnerCode": "", "InheritedFrom": "", "Note": "Tochter", "RingCode": "1C" }
    ];

    const validateBirthDate = (dateString) => {
        if (!dateString) return false;
        const regex = /^(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[0-2])\.\d{4}$/;
        if (!regex.test(dateString)) return false;
        const [day, month, year] = dateString.split('.').map(Number);
        const date = new Date(year, month - 1, day);
        return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
    };
    
    // Hilfsfunktion zum Parsen des Datums für Sortierungen
    const parseDate = (dateStr) => {
        const [day, month, year] = dateStr.split('.');
        return new Date(year, month - 1, day);
    };

    const normalizePersonCode = (code) => {
        if (!code) return "";
        let s = String(code).trim();
        return s.toLowerCase().endsWith('x') ? s.slice(0, -1).toUpperCase() + 'x' : s.toUpperCase();
    };

    /**
     * KORRIGIERT: Genaue Berechnung der Generation basierend auf den Code-Regeln.
     */
    const computeGenFromCode = (code) => {
        if (!code) return 0;
        const normalized = code.replace(/x$/, '');
        if (normalized === '1') return 1;
        if (/^1[A-Z]$/.test(normalized)) return 2;
        if (/^1[A-Z]\d+$/.test(normalized)) return 3;
        // Für zukünftige Generationen, falls benötigt
        if (/^1[A-Z]\d+[A-Z]$/.test(normalized)) return 4;
        return 1; // Standard-Fallback
    };

    const computeRingCodes = () => { /* Ihre bestehende Logik hier */ };
    
    /**
     * KORRIGIERT: Diese Funktion weist die Codes für eine Geschwistergruppe basierend auf dem Geburtsdatum neu zu.
     */
    const reassignSiblingCodes = (parentCode) => {
        const parent = people.find(p => p.Code === parentCode);
        if (!parent) return;

        const siblings = people.filter(p => p.ParentCode === parentCode);
        siblings.sort((a, b) => parseDate(a.Birth) - parseDate(b.Birth));

        const isGrandchildGen = parent.Gen === 2; // Kinder von Generation 2 sind Enkelkinder
        const updates = [];

        siblings.forEach((sibling, index) => {
            const suffix = isGrandchildGen ? (index + 1) : String.fromCharCode(65 + index);
            const newCode = parentCode + suffix;

            if (sibling.Code !== newCode) {
                updates.push({ oldCode: sibling.Code, newCode });
            }
        });

        // Updates durchführen, um referentielle Integrität zu wahren
        updates.forEach(({ oldCode, newCode }) => {
            people.forEach(p => {
                if (p.Code === oldCode) p.Code = newCode;
                if (p.ParentCode === oldCode) p.ParentCode = newCode;
                if (p.PartnerCode === oldCode) p.PartnerCode = newCode;
                if (p.InheritedFrom === oldCode) p.InheritedFrom = newCode;
            });
        });
    };
    
    // === UI-HANDLING & INTERAKTIONEN ===

    const updateUI = () => {
        renderTable();
        renderTree();
    };

    const renderTable = () => { /* Ihre bestehende Logik hier, sie ist robust */ };
    const renderTree = () => { /* Ihre bestehende Logik hier, sie ist robust */ };
    const drawNode = (svg, p, x, y, w, h) => { /* Ihre bestehende Logik hier */ };
    const addTextToNode = (g, text, x, y, size, weight) => { /* Ihre bestehende Logik hier */ };
    const printWithHtml2Canvas = async (selector, filename, orientation) => { /* Ihre bestehende Logik hier */ };
    const setupTreeInteractions = (svg, container) => { /* Ihre bestehende Logik hier */ };
    
    // === Aktionen (Hinzufügen, Löschen, etc.) ===

    /**
     * KORRIGIERT & NEU GESCHRIEBEN: Fügt eine Person hinzu und wendet die korrekte Code-Logik an.
     */
    const addNew = () => {
        const name = $("#pName").value.trim();
        const birth = $("#pBirth").value.trim();
        const place = $("#pPlace").value.trim();
        const gender = $("#pGender").value;
        const parent = normalizePersonCode($("#pParent").value.trim());
        const partner = normalizePersonCode($("#pPartner").value.trim());
        const inherited = normalizePersonCode($("#pInherited").value.trim());
        const note = $("#pNote").value.trim();

        if (!name || !place || !gender) {
            return alert("Bitte füllen Sie alle Pflichtfelder aus.");
        }
        if (!validateBirthDate(birth)) {
            return alert("Ungültiges Geburtsdatum. Bitte TT.MM.JJJJ verwenden.");
        }

        const newPerson = {
            Name: name, Birth: birth, BirthPlace: place, Gender: gender, ParentCode: parent,
            PartnerCode: partner, InheritedFrom: inherited, Note: note, Code: "", Gen: 0
        };

        if (parent) {
            // Logik für das Hinzufügen eines Kindes
            const parentPerson = people.find(p => p.Code === parent);
            if (!parentPerson) return alert("Eltern-Code nicht gefunden.");
            
            newPerson.Gen = parentPerson.Gen + 1;
            // Temporär hinzufügen, um die Neusortierung zu ermöglichen
            people.push(newPerson);
            reassignSiblingCodes(parent);

        } else if (partner) {
            // Logik für das Hinzufügen eines Partners
            const partnerPerson = people.find(p => p.Code === partner);
            if (!partnerPerson) return alert("Partner-Code nicht gefunden.");
            if (partnerPerson.Code.endsWith('x')) return alert("Ein Partner kann nicht selbst einen Partner haben.");

            const newCode = partnerPerson.Code + 'x';
            if (people.some(p => p.Code === newCode)) return alert(`Der Code ${newCode} für den Partner ist bereits vergeben.`);
            
            newPerson.Code = newCode;
            newPerson.Gen = partnerPerson.Gen;
            people.push(newPerson);

        } else {
            // Logik für das Hinzufügen des Stammvaters
            if (people.some(p => p.Code === '1')) return alert("Der Stammvater mit Code '1' existiert bereits.");
            newPerson.Code = '1';
            newPerson.Gen = 1;
            people.push(newPerson);
        }
        
        postLoadFixups();
        saveState();
        updateUI();
        $("#dlgNew").close();
    };
    
    // ... (Hier Ihre anderen Funktionen wie openEdit, saveEdit, deletePerson, etc. einfügen)

    // === EVENT LISTENERS ===
    const setupEventListeners = () => {
        $("#btnNew").addEventListener("click", () => $("#dlgNew").showModal());
        $("#formNew").addEventListener("submit", (e) => {
            e.preventDefault();
            addNew();
        });
        
        // ... (Alle Ihre anderen Event-Listener hier)
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