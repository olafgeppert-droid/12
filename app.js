/* app.js – BASIEREND AUF DEM ORIGINAL, NUR DIE CODE-LOGIK WURDE KORRIGIERT */
const STORAGE_KEY = "familyRing_upd56b";
let people = [];
const undoStack = []; const redoStack = [];
const MAX_UNDO_STEPS = 50;

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const messages = {
    personNotFound: "Person nicht gefunden.",
    invalidDate: "Ungültiges Geburtsdatum-Format. Bitte verwenden Sie TT.MM.JJJJ (z.B. 04.12.2000)",
    requiredFields: "Bitte füllen Sie alle Pflichtfelder aus (Name, Geburtsdatum, Geburtsort, Geschlecht)",
    duplicateCode: "Person mit diesem Code existiert bereits!",
    importError: "Fehlerhafte Daten können nicht importiert werden."
};

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
        if (raw) {
            people = JSON.parse(raw);
        } else {
            people = seedData();
            saveState(false);
        }
        postLoadFixups();
    } catch (error) {
        console.error("Fehler beim Laden:", error);
        people = seedData();
        saveState(false);
    }
}

function seedData() {
    return [
        { "Gen": 1, "Code": "1", "Name": "Olaf Geppert", "Birth": "13.01.1965", "BirthPlace": "Herford", "Gender": "m", "ParentCode": "", "PartnerCode": "1x", "InheritedFrom": "", "Note": "Stammvater", "RingCode": "1" },
        { "Gen": 1, "Code": "1x", "Name": "Irina Geppert", "Birth": "13.01.1970", "BirthPlace": "Halle / Westfalen", "Gender": "w", "ParentCode": "", "PartnerCode": "1", "InheritedFrom": "", "Note": "Stammmutter", "RingCode": "1x" },
        { "Gen": 2, "Code": "1A", "Name": "Mario Geppert", "Birth": "28.04.1995", "BirthPlace": "Würselen", "Gender": "m", "ParentCode": "1", "PartnerCode": "", "InheritedFrom": "", "Note": "1. Sohn", "RingCode": "1A" },
        { "Gen": 2, "Code": "1B", "Name": "Nicolas Geppert", "Birth": "04.12.2000", "BirthPlace": "Starnberg", "Gender": "m", "ParentCode": "1", "PartnerCode": "", "InheritedFrom": "", "Note": "2. Sohn", "RingCode": "1B" },
        { "Gen": 2, "Code": "1C", "Name": "Julienne Geppert", "Birth": "26.09.2002", "BirthPlace": "Starnberg", "Gender": "w", "ParentCode": "1", "PartnerCode": "", "InheritedFrom": "", "Note": "Tochter", "RingCode": "1C" }
    ];
}

function validateBirthDate(dateString) {
    if (!dateString) return true;
    const regex = /^(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[0-2])\.\d{4}$/;
    if (!regex.test(dateString)) return false;
    const parts = dateString.split('.');
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function validateRequiredFields(person) {
    return person.Name && person.Gender && person.BirthPlace;
}

function postLoadFixups() {
    for (const p of people) {
        p.Code = normalizePersonCode(p.Code);
        p.ParentCode = normalizePersonCode(p.ParentCode);
        p.PartnerCode = normalizePersonCode(p.PartnerCode);
        p.InheritedFrom = normalizePersonCode(p.InheritedFrom);
        if (!p.Gen || p.Gen < 1) p.Gen = computeGenFromCode(p.Code);
        if (!p.RingCode) p.RingCode = p.Code;
    }
    computeRingCodes();
}

function computeRingCodes() { /* Ihre Original-Logik */ }

function normalizePersonCode(code) {
    if (!code || code === "0") return "";
    let s = String(code).trim();
    if (s.endsWith('x') || s.endsWith('X')) {
        s = s.slice(0, -1).toUpperCase() + 'x';
    } else {
        s = s.toUpperCase();
    }
    return s;
}

// HILFSFUNKTIONEN FÜR DIE KORRIGIERTE CODE-LOGIK
const parseDate = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return new Date(0);
    const parts = dateStr.split('.');
    if (parts.length !== 3) return new Date(0);
    return new Date(parts[2], parts[1] - 1, parts[0]);
};

const computeGenFromCode = (code) => {
    if (!code) return 0;
    const normalized = code.replace(/x$/, '');
    if (normalized === '1') return 1;
    if (/^1[A-Z]$/.test(normalized)) return 2;
    if (/^1[A-Z]\d+$/.test(normalized)) return 3;
    if (/^1[A-Z]\d+[A-Z]$/.test(normalized)) return 4;
    return 1;
};

const reassignSiblingCodes = (parentCode) => {
    const parent = people.find(p => p.Code === parentCode);
    if (!parent) return;
    const siblings = people.filter(p => p.ParentCode === parentCode);
    if (siblings.length === 0) return;
    siblings.sort((a, b) => parseDate(a.Birth) - parseDate(b.Birth));
    const isGrandchildGen = parent.Gen === 2;
    const updates = new Map();
    siblings.forEach((sibling, index) => {
        const suffix = isGrandchildGen ? (index + 1) : String.fromCharCode(65 + index);
        const newCode = parentCode + suffix;
        if (sibling.Code !== newCode) {
            updates.set(sibling.Code, newCode);
        }
    });
    if (updates.size > 0) {
        const updateChain = Array.from(updates.entries());
        const tempPrefix = `__TEMP_${Date.now()}__`;
        updateChain.forEach(([oldCode, newCode]) => {
            const p = people.find(person => person.Code === oldCode);
            if(p) p.Code = `${tempPrefix}${newCode}`;
        });
        people.forEach(p => {
            if (updates.has(p.ParentCode)) p.ParentCode = updates.get(p.ParentCode);
            if (updates.has(p.PartnerCode)) p.PartnerCode = updates.get(p.PartnerCode);
            if (updates.has(p.InheritedFrom)) p.InheritedFrom = updates.get(p.InheritedFrom);
        });
        updateChain.forEach(([_, newCode]) => {
            const p = people.find(person => person.Code === `${tempPrefix}${newCode}`);
            if(p) p.Code = newCode;
        });
    }
};

// IHR ORIGINAL-CODE FÜR DIE ANZEIGE
function renderTable() { /* Ihre Original-Logik */ }
function renderTree() { /* Ihre Original-Logik */ }

function openNew() {
    $("#pName").value = ""; $("#pBirth").value = ""; $("#pPlace").value = "";
    $("#pGender").value = ""; $("#pParent").value = ""; $("#pPartner").value = ""; $("#pInherited").value = ""; $("#pNote").value = "";
    $("#dlgNew").showModal();
}

// KORRIGIERTE FUNKTION FÜR DIE CODE-LOGIK
function addNew() {
    const name = $("#pName").value.trim();
    const birth = $("#pBirth").value.trim();
    const place = $("#pPlace").value.trim();
    const gender = $("#pGender").value;
    const parent = normalizePersonCode($("#pParent").value.trim());
    const partner = normalizePersonCode($("#pPartner").value.trim());
    const inherited = normalizePersonCode($("#pInherited").value.trim());
    const note = $("#pNote").value.trim();

    if (!name || !place || !gender || !birth) return alert(messages.requiredFields);
    if (!validateBirthDate(birth)) return alert(messages.invalidDate);

    const tempCode = `temp-${Date.now()}`;
    const newPerson = { Name: name, Birth: birth, BirthPlace: place, Gender: gender, ParentCode: parent, PartnerCode: partner, InheritedFrom: inherited, Note: note, Code: tempCode, Gen: 0 };

    if (parent) {
        const parentPerson = people.find(p => p.Code === parent);
        if (!parentPerson) return alert("Eltern-Code nicht gefunden.");
        newPerson.Gen = parentPerson.Gen + 1;
        people.push(newPerson);
        reassignSiblingCodes(parent);
    } else if (partner) {
        const partnerPerson = people.find(p => p.Code === partner);
        if (!partnerPerson) return alert("Partner-Code nicht gefunden.");
        const newCode = partnerPerson.Code + 'x';
        if (people.some(p => p.Code === newCode)) return alert(`Der Code ${newCode} ist bereits vergeben.`);
        newPerson.Code = newCode;
        newPerson.Gen = partnerPerson.Gen;
        people.push(newPerson);
    } else {
        if (people.some(p => p.Code === '1')) return alert("Der Stammvater mit Code '1' existiert bereits.");
        newPerson.Code = '1';
        newPerson.Gen = 1;
        people.push(newPerson);
    }
    
    postLoadFixups();
    saveState();
    updateUI();
    $("#dlgNew").close();
}

let editCode = null;
function openEdit(code) {
    const p = people.find(x => x.Code === code);
    if (!p) return;
    editCode = code;
    $("#eName").value = p.Name || ""; $("#eBirth").value = p.Birth || ""; $("#ePlace").value = p.BirthPlace || "";
    $("#eGender").value = p.Gender || ""; $("#eParent").value = p.ParentCode || ""; $("#ePartner").value = p.PartnerCode || "";
    $("#eInherited").value = p.InheritedFrom || ""; $("#eNote").value = p.Note || "";
    $("#dlgEdit").showModal();
}

// KORRIGIERTE FUNKTION FÜR DIE CODE-LOGIK
function saveEdit() {
    const p = people.find(x => x.Code === editCode);
    if (!p) return;

    const oldBirth = p.Birth;
    p.Name = $("#eName").value.trim();
    p.Birth = $("#eBirth").value.trim();
    p.BirthPlace = $("#ePlace").value.trim();
    p.Gender = $("#eGender").value;
    p.ParentCode = normalizePersonCode($("#eParent").value.trim());
    p.PartnerCode = normalizePersonCode($("#ePartner").value.trim());
    p.InheritedFrom = normalizePersonCode($("#eInherited").value.trim());
    p.Note = $("#eNote").value.trim();

    if (!validateBirthDate(p.Birth)) return alert(messages.invalidDate);

    if (p.ParentCode && oldBirth !== p.Birth) {
        reassignSiblingCodes(p.ParentCode);
    }

    postLoadFixups();
    saveState();
    updateUI();
    $("#dlgEdit").close();
}

// IHR ORIGINAL-CODE FÜR DIE RESTLICHEN FUNKTIONEN
function deletePerson() { /* Ihre Original-Logik */ }
function importData() { /* Ihre Original-Logik */ }
function parseCSV(csvText) { /* Ihre Original-Logik */ }
function exportData(format) { /* Ihre Original-Logik */ }
function printTable() { /* Ihre Original-Logik */ }
function printTree() { /* Ihre Original-Logik */ }
function showStats() { /* Ihre Original-Logik */ }
function showHelp() { /* Ihre Original-Logik */ }
function resetData() { /* Ihre Original-Logik */ }
function undo() { /* Ihre Original-Logik */ }
function redo() { /* Ihre Original-Logik */ }
function updateUI() { renderTable(); renderTree(); }
function setupEventListeners() { /* Ihre Original-Logik */ }
function setupTreeInteractions() { /* Ihre Original-Logik */ }

document.addEventListener("DOMContentLoaded", function() {
    loadState();
    setupEventListeners();
    updateUI();
});
