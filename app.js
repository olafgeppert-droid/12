/* app.js – Logik */
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
        {
            "Gen": 1,
            "Code": "1",
            "Name": "Olaf Geppert",
            "Birth": "13.01.1965",
            "BirthPlace": "Herford",
            "Gender": "m",
            "ParentCode": "",
            "PartnerCode": "1x",
            "InheritedFrom": "",
            "Note": "Stammvater",
            "RingCode": "1"
        },
        {
            "Gen": 1,
            "Code": "1x",
            "Name": "Irina Geppert",
            "Birth": "13.01.1970",
            "BirthPlace": "Halle / Westfalen",
            "Gender": "w",
            "ParentCode": "",
            "PartnerCode": "1",
            "InheritedFrom": "",
            "Note": "Stammmutter",
            "RingCode": "1x"
        },
        {
            "Gen": 2,
            "Code": "1A",
            "Name": "Mario Geppert",
            "Birth": "28.04.1995",
            "BirthPlace": "Würselen",
            "Gender": "m",
            "ParentCode": "1",
            "PartnerCode": "",
            "InheritedFrom": "",
            "Note": "1. Sohn",
            "RingCode": "1A"
        },
        {
            "Gen": 2,
            "Code": "1B",
            "Name": "Nicolas Geppert",
            "Birth": "04.12.2000",
            "BirthPlace": "Starnberg",
            "Gender": "m",
            "ParentCode": "1",
            "PartnerCode": "",
            "InheritedFrom": "",
            "Note": "2. Sohn",
            "RingCode": "1B"
        },
        {
            "Gen": 2,
            "Code": "1C",
            "Name": "Julienne Geppert",
            "Birth": "26.09.2002",
            "BirthPlace": "Starnberg",
            "Gender": "w",
            "ParentCode": "1",
            "PartnerCode": "",
            "InheritedFrom": "",
            "Note": "Tochter",
            "RingCode": "1C"
        }
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
    return date.getFullYear() === year &&
           date.getMonth() === month - 1 &&
           date.getDate() === day;
}

function validateRequiredFields(person) {
    return person.Name && person.Gender && person.BirthPlace;
}

function validatePerson(person) {
    if (!validateRequiredFields(person)) return false;
    if (person.Birth && !validateBirthDate(person.Birth)) return false;
    return true;
}

function computeGenFromCode(code) {
    if (!code) return 1;
    const base = code.replace(/x$/, '');

    if (base === "1") return 1;
    if (/^1[A-Z]$/.test(base)) return 2;
    if (/^1[A-Z]\d+$/.test(base)) return 3;
    if (/^1[A-Z]\d+[A-Z]$/.test(base)) return 4;

    let generation = 1;
    let current = base;

    if (current.startsWith("1")) {
        current = current.substring(1);
    }

    const segments = current.match(/[A-Z]|\d+/g) || [];
    generation += segments.length;

    return Math.max(1, generation);
}

function postLoadFixups() {
    for (const p of people) {
        p.Code = normalizePersonCode(p.Code);
        p.ParentCode = normalizePersonCode(p.ParentCode);
        p.PartnerCode = normalizePersonCode(p.PartnerCode);
        p.InheritedFrom = normalizePersonCode(p.InheritedFrom);

        if (!p.Gen || p.Gen < 1) {
            p.Gen = computeGenFromCode(p.Code);
        }

        if (!p.RingCode) {
            p.RingCode = p.Code;
        }
    }
    computeRingCodes();
}

function computeRingCodes() {
    const byCode = Object.fromEntries(people.map(p => [p.Code, p]));

    for (const p of people) {
        if (!p.RingCode) p.RingCode = p.Code;
    }

    const MAX_DEPTH = 20;
    let changed;
    let iterations = 0;

    do {
        changed = false;
        iterations++;

        for (const p of people) {
            if (p.InheritedFrom && p.InheritedFrom !== "") {
                const donor = byCode[p.InheritedFrom];
                if (donor && donor.RingCode && !donor.RingCode.includes(p.Code)) {
                    if (donor.RingCode.includes("→" + p.Code) || p.Code === donor.InheritedFrom) {
                        console.warn("Circular inheritance detected:", p.Code, "->", donor.Code);
                        continue;
                    }

                    const newRingCode = donor.RingCode + "→" + p.Code;
                    if (p.RingCode !== newRingCode) {
                        p.RingCode = newRingCode;
                        changed = true;
                    }
                }
            }
        }

        if (iterations >= MAX_DEPTH) {
            console.warn("Max inheritance depth reached");
            break;
        }
    } while (changed);
}

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

function nextChildCode(parent) {
    if (!parent) return "1";

    const kids = people.filter(p => p.ParentCode === parent && p.Code.startsWith(parent));
    const usedCodes = new Set(kids.map(k => k.Code));

    for (let i = 65; i <= 90; i++) {
        const nextCode = parent + String.fromCharCode(i);
        if (!usedCodes.has(nextCode)) return nextCode;
    }

    let nextNum = 1;
    while (usedCodes.has(parent + nextNum)) nextNum++;
    return parent + nextNum;
}

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
        1: "#e8f5e8", 2