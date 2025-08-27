/* app.js – komplette Logik */

const STORAGE_KEY = "familyRing_appData";
let people = [];
const undoStack = [];
const redoStack = [];
const MAX_UNDO = 50;
let editCode = null;

// Shortcut-Funktionen
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

// Fehlermeldungen
const messages = {
  requiredFields: "Bitte füllen Sie alle Pflichtfelder aus (Name, Geburtsdatum, Geburtsort, Geschlecht)",
  invalidDateBirth: "Ungültiges Geburtsdatum-Format. Bitte TT.MM.JJJJ (z. B. 04.12.2000)",
  invalidDateDeath: "Ungültiges Todesdatum-Format. Bitte TT.MM.JJJJ (z. B. 04.12.2000)",
  duplicateCode: "Person mit diesem Code existiert bereits!",
  personNotFound: "Person nicht gefunden.",
  importError: "Fehler beim Import – JSON ungültig."
};

// Zustand sichern / laden
function saveState(pushUndo = true) {
  if (pushUndo) {
    undoStack.push(JSON.stringify(people));
    if (undoStack.length > MAX_UNDO) undoStack.shift();
  }
  redoStack.length = 0;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(people));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    people = JSON.parse(raw);
  } else {
    people = [];
    saveState(false);
  }
  computeRingCodes();
  renderTable();
}

// Validierung für Datum (Geburt und Tod)
function validateDate(dateString) {
  if (!dateString) return true;
  const regex = /^(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[0-2])\.\d{4}$/;
  if (!regex.test(dateString)) return false;
  const [d, m, y] = dateString.split(".").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

// Generationsnummer aus Code berechnen (z. B. für Editierung)
function computeGenFromCode(code) {
  const p = people.find(x => x.Code === code);
  if (!p || !p.ParentCode) return 1;
  const parent = people.find(x => x.Code === p.ParentCode);
  return parent ? (parent.Gen || 1) + 1 : 1;
}

// RingCode ggf. neu berechnen
function computeRingCodes() {
  people.forEach(p => p.RingCode = p.Code);
}

// Eingaben normalisieren (Leerzeichen, Großskrück)
function normalizePersonCode(s) {
  return s.trim();
}

// Tabelle rendern
function renderTable() {
  computeRingCodes();
  const filter = ($("#search").value || "").toLowerCase();
  const tbody = $("#peopleTable tbody");
  tbody.innerHTML = "";

  const cols = ["Gen", "Code", "RingCode", "Name", "Birth", "Death", "BirthPlace", "ParentCode", "PartnerCode", "InheritedFrom", "Note"];
  const highlight = txt => {
    if (!filter) return txt;
    const idx = txt.toLowerCase().indexOf(filter);
    if (idx < 0) return txt;
    return `${escapeHtml(txt.slice(0, idx))}<mark>${escapeHtml(txt.slice(idx, idx + filter.length))}</mark>${escapeHtml(txt.slice(idx + filter.length))}`;
  };

  people.sort((a, b) => (a.Gen - b.Gen) || a.Code.localeCompare(b.Code));

  people.forEach(p => {
    const haystack = (p.Name + p.Code).toLowerCase();
    if (filter && hy.stack.indexOf(filter) < 0) return;
    const tr = document.createElement("tr");
    cols.forEach(key => {
      const td = document.createElement("td");
      if (key === "Name") {
        let sym = "";
        if (p.Gender === "m") sym = "♂ ";
        else if (p.Gender === "w") sym = "♀ ";
        else if (p.Gender === "d") sym = "⚧ ";
        td.innerHTML = sym + highlight(p.Name || "");
      } else {
        td.innerHTML = highlight(p[key] || "");
      }
      tr.appendChild(td);
    });
    tr.addEventListener("dblclick", () => openEdit(p.Code));
    tbody.appendChild(tr);
  });
}

// Escape HTML
function escapeHtml(txt) {
  const div = document.createElement("div");
  div.textContent = txt;
  return div.innerHTML;
}

// Neue Person Dialog öffnen
function openNew() {
  $("#pName").value = "";
  $("#pBirth").value = "";
  $("#pDeath").value = "";
  $("#pPlace").value = "";
  $("#pGender").value = "";
  $("#pParent").value = "";
  $("#pPartner").value = "";
  $("#pInherited").value = "";
  $("#pNote").value = "";
  $("#dlgNew").showModal();
}

// Neue Person speichern
function addNew() {
  const person = {
    Name: $("#pName").value.trim(),
    Birth: $("#pBirth").value.trim(),
    Death: $("#pDeath").value.trim(),
    BirthPlace: $("#pPlace").value.trim(),
    Gender: $("#pGender").value,
    ParentCode: normalizePersonCode($("#pParent").value),
    PartnerCode: normalizePersonCode($("#pPartner").value),
    InheritedFrom: normalizePersonCode($("#pInherited").value),
    Note: $("#pNote").value.trim()
  };
  if (!person.Name || !person.BirthPlace || !person.Gender) {
    alert(messages.requiredFields);
    return;
  }
  if (person.Birth && !validateDate(person.Birth)) {
    alert(messages.invalidDateBirth);
    return;
  }
  if (person.Death && !validateDate(person.Death)) {
    alert(messages.invalidDateDeath);
    return;
  }
  // Erzeuge Code & Generation
  let code = "";
  let gen = 1;
  if (person.ParentCode) {
    const parent = people.find(p => p.Code === person.ParentCode);
    if (parent) {
      gen = (parent.Gen || 1) + 1;
      code = parent.Code + "x";
    } else {
      code = person.ParentCode + "x";
    }
  } else {
    code = people.some(p => p.Code === "1") ? "1x" : "1";
  }
  if (people.some(p => p.Code === code)) {
    alert(messages.duplicateCode);
    return;
  }
  person.Code = code;
  person.Gen = gen;
  person.RingCode = code;
  people.push(person);
  saveState();
  renderTable();
  $("#dlgNew").close();
}

// Edit Dialog öffnen
function openEdit(code) {
  const p = people.find(x => x.Code === code);
  if (!p) {
    alert(messages.personNotFound);
    return;
  }
  editCode = code;
  $("#eName").value = p.Name;
  $("#eBirth").value = p.Birth;
  $("#eDeath").value = p.Death;
  $("#ePlace").value = p.BirthPlace;
  $("#eGender").value = p.Gender;
  $("#eParent").value = p.ParentCode;
  $("#ePartner").value = p.PartnerCode;
  $("#eInherited").value = p.InheritedFrom;
  $("#eNote").value = p.Note;
  $("#dlgEdit").showModal();
}

// Änderungen speichern
function saveEdit() {
  const p = people.find(x => x.Code === editCode);
  if (!p) return;

  const newData = {
    Name: $("#eName").value.trim(),
    Birth: $("#eBirth").value.trim(),
    Death: $("#eDeath").value.trim(),
    BirthPlace: $("#ePlace").value.trim(),
    Gender: $("#eGender").value,
    ParentCode: normalizePersonCode($("#eParent").value),
    PartnerCode: normalizePersonCode($("#ePartner").value),
    InheritedFrom: normalizePersonCode($("#eInherited").value),
    Note: $("#eNote").value.trim()
  };
  if (!newData.Name || !newData.BirthPlace || !newData.Gender) {
    alert(messages.requiredFields);
    return;
  }
  if (newData.Birth && !validateDate(newData.Birth)) {
    alert(messages.invalidDateBirth);
    return;
  }
  if (newData.Death && !validateDate(newData.Death)) {
    alert(messages.invalidDateDeath);
    return;
  }

  Object.assign(p, newData);
  p.Gen = computeGenFromCode(p.Code);
  saveState();
  renderTable();
  $("#dlgEdit").close();
}

// Import & Export-Funktionen
function exportData() {
  const blob = new Blob([JSON.stringify(people, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "family_data.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importData(jsonString) {
  try {
    const arr = JSON.parse(jsonString);
    if (Array.isArray(arr)) {
      people = arr;
      saveState();
      renderTable();
    } else {
      throw new Error();
    }
  } catch {
    alert(messages.importError);
  }
}

// Rückgängig / Wiederholen
function undo() {
  if (!undoStack.length) return;
  redoStack.push(JSON.stringify(people));
  people = JSON.parse(undoStack.pop());
  saveState(false);
  renderTable();
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify(people));
  people = JSON.parse(redoStack.pop());
  saveState(false);
  renderTable();
}

// Initialisierung nach Laden
function init() {
  loadState();
  $("#btnNew").onclick = openNew;
  $("#saveNew").onclick = addNew;
  $("#btnDelete").onclick = () => alert("Löschen fehlt – bitte ergänzen");
  $("#btnImport").onclick = () => {
    const input = prompt("JSON eingeben / einfügen:");
    if (input) importData(input);
  };
  $("#btnExport").onclick = exportData;
  $("#btnUndo").onclick = undo;
  $("#btnRedo").onclick = redo;
  $("#saveEdit").onclick = saveEdit;
  $("#search").oninput = renderTable;
}

document.addEventListener("DOMContentLoaded", init);
