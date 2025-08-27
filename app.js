/* app.js – komplette Datei (Teil 1/3) */

// Grundkonfiguration
const DB_KEY = "personenDB";
const VERSION = "v1.0.0";

// Datenhaltung
let personen = [];
let selectedPerson = null;

// Elemente aus DOM
const tableBody = document.querySelector("#peopleTable tbody");
const dlgNeuePerson = document.querySelector("#dlgNeuePerson");
const btnNeu = document.querySelector("#btnNeu");
const btnExport = document.querySelector("#btnExport");
const btnImport = document.querySelector("#btnImport");
const btnDruck = document.querySelector("#btnDruck");
const btnStatistik = document.querySelector("#btnStatistik");
const btnHilfe = document.querySelector("#btnHilfe");
const btnUndo = document.querySelector("#btnUndo");
const btnRedo = document.querySelector("#btnRedo");
const inputSearch = document.querySelector("#search");
const treeContainer = document.querySelector("#tree");
const versionSpans = document.querySelectorAll(".version, .version-under-title");

// Undo/Redo
let undoStack = [];
let redoStack = [];

// Initialisieren
document.addEventListener("DOMContentLoaded", () => {
  ladeDaten();
  renderTabelle();
  renderTree();

  versionSpans.forEach(el => el.textContent = VERSION);

  // Buttons
  btnNeu.addEventListener("click", () => {
    öffneDialog();
  });

  btnExport.addEventListener("click", () => {
    exportiereJSON();
  });

  btnImport.addEventListener("click", () => {
    importiereJSON();
  });

  btnDruck.addEventListener("click", () => {
    window.print();
  });

  btnStatistik.addEventListener("click", () => {
    zeigeStatistik();
  });

  btnHilfe.addEventListener("click", () => {
    zeigeHilfe();
  });

  btnUndo.addEventListener("click", () => {
    macheUndo();
  });

  btnRedo.addEventListener("click", () => {
    macheRedo();
  });

  // Suche
  inputSearch.addEventListener("input", (e) => {
    sucheInTabelle(e.target.value);
  });

  // Tabelle doppelklick bearbeiten
  tableBody.addEventListener("dblclick", (e) => {
    const tr = e.target.closest("tr");
    if (!tr) return;
    const id = tr.dataset.id;
    bearbeitePerson(id);
  });
});
/* app.js – komplette Datei (Teil 2/3) */

// Dialog öffnen
function öffneDialog(person = null) {
  selectedPerson = person;
  const form = dlgNeuePerson.querySelector("form");
  form.reset();
  if (person) {
    form.elements["vorname"].value = person.vorname;
    form.elements["nachname"].value = person.nachname;
    form.elements["geburtsdatum"].value = person.geburtsdatum;
  }
  dlgNeuePerson.showModal();
}

// Speichern
dlgNeuePerson.querySelector("form").addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target;
  const data = {
    id: selectedPerson ? selectedPerson.id : Date.now().toString(),
    vorname: form.elements["vorname"].value.trim(),
    nachname: form.elements["nachname"].value.trim(),
    geburtsdatum: form.elements["geburtsdatum"].value
  };

  if (selectedPerson) {
    // Update
    const idx = personen.findIndex(p => p.id === selectedPerson.id);
    personen[idx] = data;
  } else {
    personen.push(data);
  }

  speichereDaten();
  renderTabelle();
  renderTree();
  dlgNeuePerson.close();
});

// Abbrechen ohne Pflichtfelder
dlgNeuePerson.querySelector(".close-x").addEventListener("click", () => {
  dlgNeuePerson.close();
});

// Bearbeiten
function bearbeitePerson(id) {
  const person = personen.find(p => p.id === id);
  if (person) öffneDialog(person);
}

// Löschen
function löschePerson(id) {
  personen = personen.filter(p => p.id !== id);
  speichereDaten();
  renderTabelle();
  renderTree();
}

// Speicher
function ladeDaten() {
  const json = localStorage.getItem(DB_KEY);
  if (json) {
    try { personen = JSON.parse(json); } catch { personen = []; }
  }
}

function speichereDaten() {
  localStorage.setItem(DB_KEY, JSON.stringify(personen));
  undoStack.push(JSON.stringify(personen));
  redoStack = [];
}

// Undo/Redo
function macheUndo() {
  if (undoStack.length > 1) {
    redoStack.push(undoStack.pop());
    personen = JSON.parse(undoStack[undoStack.length - 1]);
    renderTabelle();
    renderTree();
  }
}

function macheRedo() {
  if (redoStack.length) {
    const next = redoStack.pop();
    undoStack.push(next);
    personen = JSON.parse(next);
    renderTabelle();
    renderTree();
  }
}

// Suche
function sucheInTabelle(query) {
  const rows = tableBody.querySelectorAll("tr");
  rows.forEach(row => {
    row.classList.remove("selected");
    const text = row.innerText.toLowerCase();
    if (text.includes(query.toLowerCase())) {
      row.classList.add("selected");
    }
  });
}

// Statistik
function zeigeStatistik() {
  alert(`Es gibt ${personen.length} Einträge.`);
}

// Hilfe
function zeigeHilfe() {
  alert("Doppelklick auf einen Eintrag zum Bearbeiten.\nÜber das Ribbon neue Personen hinzufügen, exportieren oder drucken.");
}

// Export
function exportiereJSON() {
  const blob = new Blob([JSON.stringify(personen, null, 2)], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "personen.json";
  a.click();
  URL.revokeObjectURL(url);
}

// Import
function importiereJSON() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.addEventListener("change", () => {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        personen = JSON.parse(e.target.result);
        speichereDaten();
        renderTabelle();
        renderTree();
      } catch {
        alert("Fehlerhafte Datei");
      }
    };
    reader.readAsText(file);
  });
  input.click();
}
/* app.js – komplette Datei (Teil 3/3) */

// Tabelle anzeigen
function renderTabelle() {
  tableBody.innerHTML = "";
  personen.forEach(p => {
    const tr = document.createElement("tr");
    tr.dataset.id = p.id;
    tr.innerHTML = `
      <td>${p.vorname}</td>
      <td>${p.nachname}</td>
      <td>${p.geburtsdatum}</td>
      <td><button onclick="löschePerson('${p.id}')">Löschen</button></td>
    `;
    tableBody.appendChild(tr);
  });
}

// Stammbaum anzeigen (einfache Darstellung mit Drag/Zoom)
let svg, g, zoom, drag = {active: false, x: 0, y: 0, startX: 0, startY: 0};

function renderTree() {
  treeContainer.innerHTML = "";
  svg = document.createElementNS("http://www.w3.org/2000/svg","svg");
  svg.setAttribute("width","100%");
  svg.setAttribute("height","600");
  g = document.createElementNS("http://www.w3.org/2000/svg","g");
  svg.appendChild(g);
  treeContainer.appendChild(svg);

  // Einfaches Layout
  personen.forEach((p, idx) => {
    const x = 100 + idx * 180;
    const y = 100;
    const rect = document.createElementNS("http://www.w3.org/2000/svg","rect");
    rect.setAttribute("x", x);
    rect.setAttribute("y", y);
    rect.setAttribute("width", 140);
    rect.setAttribute("height", 60);
    rect.setAttribute("rx", 8);
    rect.setAttribute("fill", "#fff");
    rect.setAttribute("stroke", "#333");
    g.appendChild(rect);

    const text = document.createElementNS("http://www.w3.org/2000/svg","text");
    text.setAttribute("x", x+10);
    text.setAttribute("y", y+30);
    text.setAttribute("font-size", "14");
    text.textContent = `${p.vorname} ${p.nachname}`;
    g.appendChild(text);
  });

  enableDragZoom(svg, g);
}

function enableDragZoom(svg, g) {
  let scale = 1;
  let panX = 0, panY = 0;
  let isDragging = false;
  let startX, startY;

  svg.addEventListener("wheel", e => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    scale *= delta;
    g.setAttribute("transform", `translate(${panX},${panY}) scale(${scale})`);
  });

  svg.addEventListener("mousedown", e => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
  });

  svg.addEventListener("mousemove", e => {
    if (!isDragging) return;
    panX += e.clientX - startX;
    panY += e.clientY - startY;
    startX = e.clientX;
    startY = e.clientY;
    g.setAttribute("transform", `translate(${panX},${panY}) scale(${scale})`);
  });

  svg.addEventListener("mouseup", () => { isDragging = false; });
  svg.addEventListener("mouseleave", () => { isDragging = false; });
}
