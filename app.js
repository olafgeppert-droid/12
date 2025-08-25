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
        1: "#e8f5e8", 2: "#e3f2fd", 3: "#f3e5f5",
        4: "#fff3e0", 5: "#e8eaf6", 6: "#f1f8e9", 7: "#ffebee"
    };

    people.sort((a, b) => (a.Gen || 0) - (b.Gen || 0) || String(a.Code).localeCompare(String(b.Code)));
    
    for (const p of people) {
        const hay = (p.Name || "") + " " + (p.Code || "");
        if (q && hay.toLowerCase().indexOf(q) === -1) continue;

        const tr = document.createElement("tr");
        const cols = ["Gen", "Code", "RingCode", "Name", "Birth", "BirthPlace", "Gender", "ParentCode", "PartnerCode", "InheritedFrom", "Note"];

        const gen = p.Gen || 1;
        const bgColor = genColors[gen] || "#ffffff";
        tr.style.backgroundColor = bgColor;

        cols.forEach(k => {
            const td = document.createElement("td");
            td.innerHTML = safeMark(p[k] ?? "");
            tr.appendChild(td);
        });

        tr.addEventListener("dblclick", () => openEdit(p.Code));
        tb.appendChild(tr);
    }
}

function renderTree() {
    computeRingCodes();
    const el = $("#tree");
    if (!el) return;
    el.innerHTML = "";

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    el.appendChild(svg);

    const genColors = {
        1: "#e8f5e8", 2: "#e3f2fd", 3: "#f3e5f5",
        4: "#fff3e0", 5: "#e8eaf6", 6: "#f1f8e9", 7: "#ffebee"
    };

    const byGeneration = {};
    const partnerGroups = new Map();

    people.forEach(person => {
        const gen = person.Gen || 1;
        if (!byGeneration[gen]) byGeneration[gen] = [];
        byGeneration[gen].push(person);

        if (person.PartnerCode) {
            const partnerKey = [person.Code, person.PartnerCode].sort().join('-');
            if (!partnerGroups.has(partnerKey)) {
                partnerGroups.set(partnerKey, [person.Code, person.PartnerCode]);
            }
        }
    });

    let maxBoxWidth = 220;
    people.forEach(person => {
        const text = `${person.Code} / ${person.Name || person.Code}`;
        const estimatedWidth = text.length * 9 + 50;
        if (estimatedWidth > maxBoxWidth) maxBoxWidth = Math.min(estimatedWidth, 260);
    });

    const boxWidth = maxBoxWidth;
    const boxHeight = 100;
    const partnerGap = 40;
    const verticalSpacing = 220;
    const horizontalSpacing = 120;

    const positions = new Map();
    const generations = Object.keys(byGeneration).sort((a, b) => a - b);

    // Berechne die maximale Breite pro Generation
    const generationWidths = {};
    let totalSvgWidth = 0;
    let totalSvgHeight = 0;

    generations.forEach((gen, genIndex) => {
        const persons = byGeneration[gen];
        const y = 140 + genIndex * verticalSpacing;

        const groupedPersons = [];
        const processed = new Set();

        persons.forEach(person => {
            if (processed.has(person.Code)) return;

            let partnerCodes = [];
            if (person.PartnerCode) {
                const partnerKey = [person.Code, person.PartnerCode].sort().join('-');
                partnerCodes = partnerGroups.get(partnerKey) || [];
            }

            if (partnerCodes.length > 0) {
                const partnerGroup = partnerCodes.map(code =>
                    persons.find(p => p.Code === code)
                ).filter(Boolean);
                groupedPersons.push(partnerGroup);
                partnerCodes.forEach(code => processed.add(code));
            } else {
                groupedPersons.push([person]);
                processed.add(person.Code);
            }
        });

        // Berechne benötigte Breite für diese Generation
        let genWidth = 200; // Start mit Margin
        groupedPersons.forEach(group => {
            genWidth += group.length === 2 ? (boxWidth * 2 + partnerGap + horizontalSpacing) : (boxWidth + horizontalSpacing);
        });

        generationWidths[gen] = genWidth;
        totalSvgWidth = Math.max(totalSvgWidth, genWidth);
        totalSvgHeight = y + boxHeight + 100;
    });

    // Setze die ViewBox basierend auf den berechneten Dimensionen
    svg.setAttribute("viewBox", `0 0 ${totalSvgWidth} ${totalSvgHeight}`);
    svg.setAttribute("width", totalSvgWidth);
    svg.setAttribute("height", totalSvgHeight);

    generations.forEach((gen, genIndex) {
        const persons = byGeneration[gen];
        const y = 140 + genIndex * verticalSpacing;

        const groupedPersons = [];
        const processed = new Set();

        persons.forEach(person => {
            if (processed.has(person.Code)) return;

            let partnerCodes = [];
            if (person.PartnerCode) {
                const partnerKey = [person.Code, person.PartnerCode].sort().join('-');
                partnerCodes = partnerGroups.get(partnerKey) || [];
            }

            if (partnerCodes.length > 0) {
                const partnerGroup = partnerCodes.map(code =>
                    persons.find(p => p.Code === code)
                ).filter(Boolean);
                groupedPersons.push(partnerGroup);
                partnerCodes.forEach(code => processed.add(code));
            } else {
                groupedPersons.push([person]);
                processed.add(person.Code);
            }
        });

        let currentX = 100; // Start mit Margin

        groupedPersons.forEach((group) => {
            if (group.length === 2) {
                const partner1 = group[0];
                const partner2 = group[1];

                positions.set(partner1.Code, { x: currentX + boxWidth / 2, y: y, person: partner1 });
                positions.set(partner2.Code, { x: currentX + boxWidth + partnerGap + boxWidth / 2, y: y, person: partner2 });
                currentX += boxWidth * 2 + partnerGap + horizontalSpacing;
            } else {
                const person = group[0];
                positions.set(person.Code, { x: currentX + boxWidth / 2, y: y, person: person });
                currentX += boxWidth + horizontalSpacing;
            }
        });
    });

    const nodesGroup = document.createElementNS(svgNS, "g");
    nodesGroup.setAttribute("class", "nodes");
    svg.appendChild(nodesGroup);

    const sortedPeople = [...people].sort((a, b) => {
        if (a.Gen !== b.Gen) return a.Gen - b.Gen;
        return a.Code.localeCompare(b.Code);
    });

    sortedPeople.forEach(person => {
        const pos = positions.get(person.Code);
        if (!pos) return;

        const gen = person.Gen || 1;
        const color = genColors[gen] || "#f9fafb";

        const personGroup = document.createElementNS(svgNS, "g");
        personGroup.setAttribute("class", "node");
        personGroup.setAttribute("transform", `translate(${pos.x - boxWidth / 2}, ${pos.y})`);
        personGroup.setAttribute("data-code", person.Code);

        const rect = document.createElementNS(svgNS, "rect");
        rect.setAttribute("width", boxWidth);
        rect.setAttribute("height", boxHeight);
        rect.setAttribute("rx", "8");
        rect.setAttribute("ry", "8");
        rect.setAttribute("fill", color);
        rect.setAttribute("stroke", "#374151");
        rect.setAttribute("stroke-width", "2");
        personGroup.appendChild(rect);

        const nameText = document.createElementNS(svgNS, "text");
        nameText.setAttribute("x", boxWidth / 2);
        nameText.setAttribute("y", 30);
        nameText.setAttribute("text-anchor", "middle");
        nameText.setAttribute("font-size", gen <= 2 ? "18px" : "16px");
        nameText.setAttribute("font-weight", "600");
        nameText.setAttribute("fill", "#111827");

        const displayName = person.Name || person.Code;
        const maxLength = Math.floor((boxWidth - 40) / (gen <= 2 ? 7 : 8));
        const displayText = displayName.length > maxLength ?
            displayName.substring(0, maxLength - 3) + "..." : displayName;
        nameText.textContent = `${person.Code}: ${displayText}`;
        personGroup.appendChild(nameText);

        const detailsText = document.createElementNS(svgNS, "text");
        detailsText.setAttribute("x", boxWidth / 2);
        detailsText.setAttribute("y", 60);
        detailsText.setAttribute("text-anchor", "middle");
        detailsText.setAttribute("font-size", gen <= 2 ? "16px" : "15px");
        detailsText.setAttribute("fill", "#4b5563");

        let genderSymbol = "";
        if (person.Gender === "m") genderSymbol = "♂";
        else if (person.Gender === "w") genderSymbol = "♀";
        else if (person.Gender === "d") genderSymbol = "⚧";

        let details = genderSymbol ? `${genderSymbol} / ` : "";
        details += `Gen ${gen}`;
        if (person.Birth) details += ` / ${person.Birth}`;
        detailsText.textContent = details;
        personGroup.appendChild(detailsText);

        personGroup.addEventListener("dblclick", () => openEdit(person.Code));

        personGroup.addEventListener("mouseenter", function () {
            rect.setAttribute("stroke-width", "3");
            rect.setAttribute("filter", "url(#dropShadow)");
        });

        personGroup.addEventListener("mouseleave", function () {
            rect.setAttribute("stroke-width", "2");
            rect.setAttribute("filter", "none");
        });

        nodesGroup.appendChild(personGroup);
    });

    const connectionsGroup = document.createElementNS(svgNS, "g");
    connectionsGroup.setAttribute("class", "connections");
    svg.appendChild(connectionsGroup);

    people.forEach(person => {
        if (person.ParentCode) {
            const parent = positions.get(person.ParentCode);
            const child = positions.get(person.Code);
            if (parent && child) {
                const verticalLine = document.createElementNS(svgNS, "line");
                verticalLine.setAttribute("x1", parent.x);
                verticalLine.setAttribute("y1", parent.y + boxHeight);
                verticalLine.setAttribute("x2", parent.x);
                verticalLine.setAttribute("y2", child.y - 15);
                verticalLine.setAttribute("stroke", "#6b7280");
                verticalLine.setAttribute("stroke-width", "2");
                connectionsGroup.appendChild(verticalLine);

                const horizontalLine = document.createElementNS(svgNS, "line");
                horizontalLine.setAttribute("x1", parent.x);
                horizontalLine.setAttribute("y1", child.y - 15);
                horizontalLine.setAttribute("x2", child.x);
                horizontalLine.setAttribute("y2", child.y - 15);
                horizontalLine.setAttribute("stroke", "#6b7280");
                horizontalLine.setAttribute("stroke-width", "2");
                connectionsGroup.appendChild(horizontalLine);

                const verticalConnector = document.createElementNS(svgNS, "line");
                verticalConnector.setAttribute("x1", child.x);
                verticalConnector.setAttribute("y1", child.y - 15);
                verticalConnector.setAttribute("x2", child.x);
                verticalConnector.setAttribute("y2", child.y);
                verticalConnector.setAttribute("stroke", "#6b7280");
                verticalConnector.setAttribute("stroke-width", "2");
                connectionsGroup.appendChild(verticalConnector);
            }
        }
    });

    partnerGroups.forEach((partnerCodes) => {
        const partner1 = positions.get(partnerCodes[0]);
        const partner2 = positions.get(partnerCodes[1]);
        if (partner1 && partner2 && Math.abs(partner1.y - partner2.y) < 10) {
            const line = document.createElementNS(svgNS, "line");
            line.setAttribute("x1", partner1.x + boxWidth / 2);
            line.setAttribute("y1", partner1.y + boxHeight / 2);
            line.setAttribute("x2", partner2.x - boxWidth / 2);
            line.setAttribute("y2", partner2.y + boxHeight / 2);
            line.setAttribute("stroke", "#dc2626");
            line.setAttribute("stroke-width", "3");
            connectionsGroup.appendChild(line);
        }
    });

    generations.forEach((gen, genIndex) {
        const y = 140 + genIndex * verticalSpacing - 20;
        const labelText = document.createElementNS(svgNS, "text");
        labelText.setAttribute("x", "40");
        labelText.setAttribute("y", y);
        labelText.setAttribute("font-size", "30px");
        labelText.setAttribute("font-weight", "bold");
        labelText.setAttribute("fill", "#374151");
        labelText.setAttribute("text-anchor", "start");

        switch (gen) {
            case "1": labelText.textContent = "Stammeltern"; break;
            case "2": labelText.textContent = "Kinder"; break;
            case "3": labelText.textContent = "Enkel"; break;
            case "4": labelText.textContent = "Urenkel"; break;
            default: labelText.textContent = `Generation ${gen}`;
        }
        svg.appendChild(labelText);
    });

    const defs = document.createElementNS(svgNS, "defs");
    const filter = document.createElementNS(svgNS, "filter");
    filter.setAttribute("id", "dropShadow");
    filter.setAttribute("height", "130%");

    const feGaussianBlur = document.createElementNS(svgNS, "feGaussianBlur");
    feGaussianBlur.setAttribute("in", "SourceAlpha");
    feGaussianBlur.setAttribute("stdDeviation", "2");
    filter.appendChild(feGaussianBlur);

    const feOffset = document.createElementNS(svgNS, "feOffset");
    feOffset.setAttribute("dx", "3");
    feOffset.setAttribute("dy", "3");
    feOffset.setAttribute("result", "offsetblur");
    filter.appendChild(feOffset);

    const feFlood = document.createElementNS(svgNS, "feFlood");
    feFlood.setAttribute("flood-color", "rgba(0,0,0,0.2)");
    filter.appendChild(feFlood);

    const feComposite = document.createElementNS(svgNS, "feComposite");
    feComposite.setAttribute("in2", "offsetblur");
    feComposite.setAttribute("operator", "in");
    filter.appendChild(feComposite);

    const feMerge = document.createElementNS(svgNS, "feMerge");
    const feMergeNode1 = document.createElementNS(svgNS, "feMergeNode");
    const feMergeNode2 = document.createElementNS(svgNS, "feMergeNode");
    feMergeNode2.setAttribute("in", "SourceGraphic");
    feMerge.appendChild(feMergeNode1);
    feMerge.appendChild(feMergeNode2);
    filter.appendChild(feMerge);

    defs.appendChild(filter);
    svg.appendChild(defs);

    // Container für Scrollbarkeit anpassen
    const treeContainer = $("#tree");
    treeContainer.style.overflow = "auto";
    treeContainer.style.maxHeight = "70vh";
}

function openNew() {
    $("#pName").value = ""; $("#pBirth").value = ""; $("#pPlace").value = "";
    $("#pGender").value = ""; $("#pParent").value = ""; $("#pPartner").value = ""; $("#pInherited").value = ""; $("#pNote").value = "";
    $("#dlgNew").showModal();
}

function addNew() {
    const name = $("#pName").value.trim();
    const birth = $("#pBirth").value.trim();
    const place = $("#pPlace").value.trim();
    const gender = $("#pGender").value;
    const parent = normalizePersonCode($("#pParent").value.trim());
    const partner = normalizePersonCode($("#pPartner").value.trim());
    const inherited = normalizePersonCode($("#pInherited").value.trim());
    const note = $("#pNote").value.trim();

    if (!name || !place || !gender) {
        alert(messages.requiredFields);
        return;
    }

    if (birth && !validateBirthDate(birth)) {
        alert(messages.invalidDate);
        $("#pBirth").value = "";
        return;
    }

    let gen = 1, code = "";

    if (parent) {
        const parentP = people.find(p => p.Code === parent);
        gen = parentP ? (parentP.Gen || 1) + 1 : 2;
        code = nextChildCode(parent);
    } else {
        if (partner && people.some(p => p.Code === partner)) {
            code = "1x";
            gen = 1;
        } else {
            code = "1";
            gen = 1;
        }
    }

    if (people.some(p => p.Code === code)) {
        alert(messages.duplicateCode);
        return;
    }

    const p = {
        Gen: gen, Code: code, Name: name, Birth: birth, BirthPlace: place,
        Gender: gender, ParentCode: parent, PartnerCode: partner,
        InheritedFrom: inherited, Note: note, RingCode: code
    };

    people.push(p);
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

function saveEdit() {
    const p = people.find(x => x.Code === editCode);
    if (!p) return;

    const name = $("#eName").value.trim();
    const birth = $("#eBirth").value.trim();
    const place = $("#ePlace").value.trim();
    const gender = $("#eGender").value;
    const parent = normalizePersonCode($("#eParent").value.trim());
    const partner = normalizePersonCode($("#ePartner").value.trim());
    const inherited = normalizePersonCode($("#eInherited").value.trim());
    const note = $("#eNote").value.trim();

    if (!name || !place || !gender) {
        alert(messages.requiredFields);
        return;
    }

    if (birth && !validateBirthDate(birth)) {
        alert(messages.invalidDate);
        $("#eBirth").value = "";
        return;
    }

    p.Name = name;
    p.Birth = birth;
    p.BirthPlace = place;
    p.Gender = gender;
    p.ParentCode = parent;
    p.PartnerCode = partner;
    p.InheritedFrom = inherited;
    p.Note = note;
    p.Gen = computeGenFromCode(p.Code);

    saveState();
    updateUI();
    $("#dlgEdit").close();
}

function deletePerson() {
    const code = prompt("Bitte Code der zu löschenden Person eingeben:");
    if (!code) return;
    const p = people.find(x => x.Code === normalizePersonCode(code));
    if (!p) {
        alert(messages.personNotFound);
        return;
    }
    if (!confirm(`Soll "${p.Name}" (${p.Code}) wirklich gelöscht werden?`)) return;
    
    people = people.filter(x => x.Code !== p.Code);
    
    // Entferne Referenzen auf die gelöschte Person
    people.forEach(person => {
        if (person.ParentCode === p.Code) person.ParentCode = "";
        if (person.PartnerCode === p.Code) person.PartnerCode = "";
        if (person.InheritedFrom === p.Code) person.InheritedFrom = "";
    });
    
    saveState();
    updateUI();
}

function importData() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.csv";
    input.addEventListener("change", function () {
        const file = this.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                let data;
                if (file.name.toLowerCase().endsWith('.csv')) {
                    data = parseCSV(e.target.result);
                } else {
                    data = JSON.parse(e.target.result);
                }
                
                if (!Array.isArray(data)) throw new Error("Daten müssen ein Array sein");
                if (data.length === 0) throw new Error("Keine Daten");
                
                // Validiere alle Datensätze
                const validData = [];
                let hasErrors = false;
                
                for (const item of data) {
                    if (item && typeof item === 'object' && item.Code && typeof item.Code === 'string') {
                        if (!validateRequiredFields(item) || (item.Birth && !validateBirthDate(item.Birth))) {
                            hasErrors = true;
                            break;
                        }
                        validData.push(item);
                    }
                }

                if (hasErrors || validData.length === 0) {
                    $("#dlgImportError").showModal();
                    return;
                }

                people = validData;
                postLoadFixups();
                saveState();
                updateUI();
                alert(`Erfolgreich ${data.length} Personen importiert.`);
            } catch (error) {
                console.error("Import-Fehler:", error);
                $("#dlgImportError").showModal();
            }
        };
        reader.readAsText(file);
    });
    input.click();
}

function parseCSV(csvText) {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(';').map(h => h.trim());
    const result = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(';').map(v => v.trim());
        if (values.length !== headers.length) continue;
        
        const obj = {};
        headers.forEach((header, index) => {
            obj[header] = values[index] || '';
        });
        result.push(obj);
    }
    return result;
}

function exportData(format) {
    if (format === 'json') {
        const dataStr = JSON.stringify(people, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `familien-datenbank_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    } else if (format === 'csv') {
        const headers = ["Gen", "Code", "RingCode", "Name", "Birth", "BirthPlace", "Gender", "ParentCode", "PartnerCode", "InheritedFrom", "Note"];
        const csvContent = [
            headers.join(';'),
            ...people.map(p => headers.map(h => `"${(p[h] || '').toString().replace(/"/g, '""')}"`).join(';'))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `familien-datenbank_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }
}

// DRUCKFUNKTIONEN FÜR WINDOWS/MAC
function printTable() {
    $("#dlgPrint").close();
    
    const originalStyles = document.head.innerHTML;
    const printWindow = window.open('', '_blank');
    
    const tableContent = $("#peopleTable").outerHTML;
    const title = "Wappenringe der Familie GEPPERT - Personenliste";
    const date = new Date().toLocaleDateString('de-DE');
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title}</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    margin: 20px; 
                    font-size: 12px;
                }
                h1 { 
                    text-align: center; 
                    color: #2c3e50; 
                    margin-bottom: 10px;
                    font-size: 18px;
                }
                .print-date {
                    text-align: center;
                    color: #666;
                    margin-bottom: 20px;
                    font-size: 11px;
                }
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin-top: 10px;
                    font-size: 11px;
                }
                th, td { 
                    border: 1px solid #ddd; 
                    padding: 6px; 
                    text-align: left;
                }
                th { 
                    background-color: #f8f9fa; 
                    font-weight: bold;
                }
                tr:nth-child(even) {
                    background-color: #f8f9fa;
                }
                @media print {
                    body { margin: 0; padding: 15px; }
                    table { font-size: 10px; }
                    th, td { padding: 4px; }
                }
                @page {
                    margin: 1cm;
                    size: landscape;
                }
            </style>
        </head>
        <body>
            <h1>${title}</h1>
            <div class="print-date">Druckdatum: ${date}</div>
            ${tableContent}
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(function() {
                        window.close();
                    }, 100);
                }
            <\/script>
        </body>
        </html>
    `);
    
    printWindow.document.close();
}

function printTree() {
    $("#dlgPrint").close();
    
    const treeContainer = $("#tree");
    const title = "Wappenringe der Familie GEPPERT - Stammbaum";
    const date = new Date().toLocaleDateString('de-DE');
    
    // SVG klonen und für Druck optimieren
    const svg = treeContainer.querySelector('svg');
    if (!svg) {
        alert("Stammbaum konnte nicht gefunden werden.");
        return;
    }
    
    const clonedSvg = svg.cloneNode(true);
    clonedSvg.setAttribute('width', '100%');
    clonedSvg.setAttribute('height', 'auto');
    
    const printWindow = window.open('', '_blank');
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title}</title>
            <style>
                body { 
                    margin: 0; 
                    padding: 20px; 
                    background: white;
                    font-family: Arial, sans-serif;
                }
                .print-header {
                    text-align: center;
                    margin-bottom: 20px;
                }
                h1 {
                    color: #2c3e50;
                    font-size: 20px;
                    margin: 0 0 5px 0;
                }
                .print-date {
                    color: #666;
                    font-size: 12px;
                }
                .tree-container {
                    width: 100%;
                    height: auto;
                    overflow: visible;
                }
                svg {
                    max-width: 100%;
                    height: auto;
                }
                @media print {
                    body { padding: 0; margin: 0; }
                    .print-header { margin-bottom: 10px; }
                    h1 { font-size: 16px; }
                    @page {
                        margin: 1cm;
                        size: landscape;
                    }
                }
            </style>
        </head>
        <body>
            <div class="print-header">
                <h1>${title}</h1>
                <div class="print-date">Druckdatum: ${date}</div>
            </div>
            <div class="tree-container">${clonedSvg.outerHTML}</div>
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(function() {
                        window.close();
                    }, 100);
                }
            <\/script>
        </body>
        </html>
    `);
    
    printWindow.document.close();
}

function showStats() {
    const stats = {
        total: people.length,
        byGender: { m: 0, w: 0, d: 0 },
        byGeneration: {},
        withPartner: 0,
        withChildren: 0
    };

    people.forEach(p => {
        stats.byGender[p.Gender] = (stats.byGender[p.Gender] || 0) + 1;
        stats.byGeneration[p.Gen] = (stats.byGeneration[p.Gen] || 0) + 1;
        if (p.PartnerCode) stats.withPartner++;
        if (people.some(child => child.ParentCode === p.Code)) stats.withChildren++;
    });

    let html = `<div class="stats-grid">
        <div class="stat-card"><h3>Gesamt</h3><span class="stat-number">${stats.total}</span></div>
        <div class="stat-card"><h3>Männlich</h3><span class="stat-number">${stats.byGender.m}</span></div>
        <div class="stat-card"><h3>Weiblich</h3><span class="stat-number">${stats.byGender.w}</span></div>
        <div class="stat-card"><h3>Divers</h3><span class="stat-number">${stats.byGender.d}</span></div>
        <div class="stat-card"><h3>Mit Partner</h3><span class="stat-number">${stats.withPartner}</span></div>
        <div class="stat-card"><h3>Mit Kindern</h3><span class="stat-number">${stats.withChildren}</span></div>
    </div>`;

    html += `<h3>Verteilung nach Generationen:</h3><ul>`;
    Object.entries(stats.byGeneration).sort((a, b) => a[0] - b[0]).forEach(([gen, count]) => {
        html += `<li>Generation ${gen}: ${count} Personen</li>`;
    });
    html += `</ul>`;

    $("#statsContent").innerHTML = html;
    $("#dlgStats").showModal();
}

function showHelp() {
    $("#helpContent").innerHTML = `
        <h3>Anleitung zur Familien-Datenbank</h3>
        <p>Diese Anwendung hilft dir, den Überblick über deine Familie zu behalten und die Weitergabe von Wappenringen zu dokumentieren.</p>

        <h4>Grundfunktionen:</h4>
        <ul>
            <li><strong>Neue Person anlegen</strong>: Über den Button "➕ Neue Person" kannst du Familienmitglieder hinzufügen.</li>
            <li><strong>Person bearbeiten</strong>: Doppelklick auf eine Zeile in der Tabelle oder auf eine Person im Stammbaum.</li>
            <li><strong>Person löschen</strong>: Über den Button "🗑️ Löschen" und Eingabe des Personencodes.</li>
            <li><strong>Daten sichern</strong>: Verwende den "📤 Export"-Button, um deine Daten als JSON oder CSV zu exportieren.</li>
            <li><strong>Daten importieren</strong>: Über "📥 Import" kannst du zuvor exportierte Daten wieder einlesen.</li>
        </ul>

        <h4>Wichtige Felder:</h4>
        <ul>
            <li><strong>Code</strong>: Wird automatisch vergeben (z.B. "1", "1A", "1Bx")</li>
            <li><strong>Ring-Code</strong>: Zeigt die Weitergabe der Wappenringe (wird automatisch berechnet)</li>
            <li><strong>Eltern-Code</strong>: Code der Eltern dieser Person</li>
            <li><strong>Partner-Code</strong>: Code des Partners/der Partnerin</li>
            <li><strong>Geerbt von</strong>: Code der Person, von der ein Ring geerbt wurde</li>
        </ul>

        <h4>Tipps:</h4>
        <ul>
            <li>Die Generation wird automatisch aus dem Code berechnet</li>
            <li>Partner bekommen den Code mit angehängtem "x" (z.B. "1x" für Partner von "1")</li>
            <li>Kinder bekommen den Code der Eltern plus Buchstabe (z.B. "1A", "1B")</li>
            <li>Enkel bekommen den Code der Eltern plus Zahl (z.B. "1A1", "1A2")</li>
            <li>Denke regelmäßig an den Export als Backup!</li>
        </ul>
    `;
    $("#dlgHelp").showModal();
}

function resetData() {
    if (confirm("ACHTUNG: Wirklich alle Daten löschen? Diese Aktion kann nicht rückgängig gemacht werden!")) {
        if (confirm("Bist du absolut sicher? Alle Daten gehen unwiederbringlich verloren!")) {
            people = seedData();
            saveState();
            updateUI();
            alert("Daten wurden zurückgesetzt.");
        }
    }
}

function undo() {
    if (undoStack.length === 0) return;
    redoStack.push(JSON.stringify(people));
    people = JSON.parse(undoStack.pop());
    saveState(false);
    updateUI();
}

function redo() {
    if (redoStack.length === 0) return;
    undoStack.push(JSON.stringify(people));
    people = JSON.parse(redoStack.pop());
    saveState(false);
    updateUI();
}

function updateUI() {
    renderTable();
    renderTree();
}

function setupEventListeners() {
    // Haupt-Buttons
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

    // Dialog-Buttons
    $("#btnExportJSON").addEventListener("click", () => exportData('json'));
    $("#btnExportCSV").addEventListener("click", () => exportData('csv'));
    $("#btnPrintTable").addEventListener("click", printTable);
    $("#btnPrintTree").addEventListener("click", printTree);

    // Formulare
    $("#formNew").addEventListener("submit", function(e) {
        e.preventDefault();
        if (e.submitter && e.submitter.value === 'default') {
            addNew();
        }
    });

    $("#formEdit").addEventListener("submit", function(e) {
        e.preventDefault();
        if (e.submitter && e.submitter.value === 'default') {
            saveEdit();
        }
    });

    // Suchfunktion
    $("#search").addEventListener("input", renderTable);

    // Dialog-Close-Handler
    $("#dlgNew").addEventListener("close", () => $("#formNew").reset());
    $("#dlgEdit").addEventListener("close", () => editCode = null);

    // Datumsvalidierung
    $("#pBirth").addEventListener("blur", function() {
        if (this.value && !validateBirthDate(this.value)) {
            alert(messages.invalidDate);
            this.value = "";
            this.focus();
        }
    });

    $("#eBirth").addEventListener("blur", function() {
        if (this.value && !validateBirthDate(this.value)) {
            alert(messages.invalidDate);
            this.value = "";
            this.focus();
        }
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            undo();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
            e.preventDefault();
            redo();
        }
    });
}

function setupTreeInteractions() {
    let scale = 1;
    const treeContainer = $("#tree");

    treeContainer.addEventListener("wheel", (e) => {
        e.preventDefault();
        scale += e.deltaY * -0.001;
        scale = Math.min(Math.max(0.5, scale), 3);
        treeContainer.style.transform = `scale(${scale})`;
    });

    let startX, startY, scrollLeft, scrollTop;
    let isDragging = false;

    treeContainer.addEventListener("mousedown", (e) => {
        isDragging = true;
        startX = e.pageX - treeContainer.offsetLeft;
        startY = e.pageY - treeContainer.offsetTop;
        scrollLeft = treeContainer.scrollLeft;
        scrollTop = treeContainer.scrollTop;
    });

    treeContainer.addEventListener("mouseleave", () => { isDragging = false; });
    treeContainer.addEventListener("mouseup", () => { isDragging = false; });

    treeContainer.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const x = e.pageX - treeContainer.offsetLeft;
        const y = e.pageY - treeContainer.offsetTop;
        const walkX = (x - startX) * 2;
        const walkY = (y - startY) * 2;
        treeContainer.scrollLeft = scrollLeft - walkX;
        treeContainer.scrollTop = scrollTop - walkY;
    });
}

function ensureVersionVisibility() {
    const versionRibbon = document.getElementById('versionRibbon');
    const versionUnderTable = document.getElementById('versionUnderTable');

    if (versionRibbon) versionRibbon.style.display = 'block';
    if (versionUnderTable) versionUnderTable.style.display = 'block';
}

// Initialisierung
document.addEventListener("DOMContentLoaded", function() {
    loadState();
    setupEventListeners();
    updateUI();
    setTimeout(setupTreeInteractions, 1000);
    ensureVersionVisibility();
});