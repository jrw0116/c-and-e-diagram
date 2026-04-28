const sectionNames = [
  "Equipment",
  "Process",
  "People",
  "Materials",
  "Environment",
  "Management",
];

const defaultState = {
  effect: "",
  analysisDate: new Date().toISOString().slice(0, 10),
  sections: Object.fromEntries(
    sectionNames.map((name) => [
      name,
      {
        notes: "",
        causes: Array.from({ length: 3 }, () => ({ cause: "", subcause: "" })),
      },
    ]),
  ),
};

const storageKey = "cause-effect-diagram-state";

const form = document.querySelector("#diagramForm");
const sectionsContainer = document.querySelector("#sectionsContainer");
const sectionTemplate = document.querySelector("#sectionTemplate");
const causeRowTemplate = document.querySelector("#causeRowTemplate");
const diagramCanvas = document.querySelector("#diagramCanvas");

const saveButton = document.querySelector("#saveButton");
const exportButton = document.querySelector("#exportButton");
const importInput = document.querySelector("#importInput");
const resetButton = document.querySelector("#resetButton");
const printButton = document.querySelector("#printButton");

let state = loadState();

buildSections();
syncFormFromState();
renderDiagram();

form.addEventListener("input", handleInput);
saveButton.addEventListener("click", persistState);
exportButton.addEventListener("click", exportState);
importInput.addEventListener("change", importState);
resetButton.addEventListener("click", resetState);
printButton.addEventListener("click", () => window.print());

function buildSections() {
  sectionsContainer.innerHTML = "";

  sectionNames.forEach((name, index) => {
    const fragment = sectionTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".category-card");
    const title = fragment.querySelector(".category-title");
    const kicker = fragment.querySelector(".category-kicker");
    const notes = fragment.querySelector(".category-notes");
    const addButton = fragment.querySelector(".add-cause");
    const causeList = fragment.querySelector(".cause-list");

    card.dataset.section = name;
    title.textContent = name;
    kicker.textContent = `Section ${index + 1}`;
    notes.name = `${name}-notes`;
    notes.dataset.section = name;

    addButton.dataset.section = name;
    addButton.addEventListener("click", () => addCauseRow(name));

    sectionsContainer.appendChild(fragment);
    renderCauseRows(name, causeList);
  });
}

function renderCauseRows(sectionName, listElement) {
  const card = listElement || sectionsContainer.querySelector(`[data-section="${sectionName}"] .cause-list`);
  card.innerHTML = "";

  state.sections[sectionName].causes.forEach((item, index) => {
    const fragment = causeRowTemplate.content.cloneNode(true);
    const row = fragment.querySelector(".cause-row");
    const causeField = fragment.querySelector(".cause-text");
    const subcauseField = fragment.querySelector(".subcause-text");
    const removeButton = fragment.querySelector(".remove-cause");

    row.dataset.section = sectionName;
    row.dataset.index = String(index);
    causeField.value = item.cause;
    subcauseField.value = item.subcause;
    causeField.dataset.section = sectionName;
    causeField.dataset.index = String(index);
    causeField.dataset.field = "cause";
    subcauseField.dataset.section = sectionName;
    subcauseField.dataset.index = String(index);
    subcauseField.dataset.field = "subcause";

    removeButton.addEventListener("click", () => removeCauseRow(sectionName, index));
    card.appendChild(fragment);
  });
}

function syncFormFromState() {
  document.querySelector("#effect").value = state.effect;
  document.querySelector("#analysisDate").value = state.analysisDate;

  sectionNames.forEach((name) => {
    const notesField = sectionsContainer.querySelector(`[data-section="${name}"] .category-notes`);
    notesField.value = state.sections[name].notes;
    renderCauseRows(name);
  });
}

function handleInput(event) {
  const target = event.target;

  if (target.id === "effect" || target.id === "analysisDate") {
    state[target.id] = target.value;
    renderDiagram();
    return;
  }

  if (target.classList.contains("category-notes")) {
    state.sections[target.dataset.section].notes = target.value;
    renderDiagram();
    return;
  }

  if (target.dataset.section && target.dataset.index && target.dataset.field) {
    state.sections[target.dataset.section].causes[Number(target.dataset.index)][target.dataset.field] = target.value;
    renderDiagram();
  }
}

function addCauseRow(sectionName) {
  state.sections[sectionName].causes.push({ cause: "", subcause: "" });
  renderCauseRows(sectionName);
}

function removeCauseRow(sectionName, index) {
  if (state.sections[sectionName].causes.length === 1) {
    state.sections[sectionName].causes[0] = { cause: "", subcause: "" };
  } else {
    state.sections[sectionName].causes.splice(index, 1);
  }

  renderCauseRows(sectionName);
  renderDiagram();
}

function persistState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
  flashStatus("Saved locally");
}

function exportState() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = state.analysisDate || new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `cause-effect-diagram-${stamp}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importState(event) {
  const file = event.target.files?.[0];

  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      state = normalizeState(parsed);
      syncFormFromState();
      renderDiagram();
      persistState();
      flashStatus("Imported");
    } catch (error) {
      window.alert("That file could not be imported. Please choose a valid exported JSON file.");
    }
  };
  reader.readAsText(file);
  importInput.value = "";
}

function resetState() {
  state = structuredClone(defaultState);
  syncFormFromState();
  renderDiagram();
  persistState();
}

function loadState() {
  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    return structuredClone(defaultState);
  }

  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return structuredClone(defaultState);
  }
}

function normalizeState(source) {
  const next = structuredClone(defaultState);
  next.effect = source?.effect || "";
  next.analysisDate = source?.analysisDate || defaultState.analysisDate;

  sectionNames.forEach((name) => {
    next.sections[name].notes = source?.sections?.[name]?.notes || "";
    const causes = source?.sections?.[name]?.causes;
    if (Array.isArray(causes) && causes.length > 0) {
      next.sections[name].causes = causes.map((item) => ({
        cause: item?.cause || "",
        subcause: item?.subcause || "",
      }));
    }
  });

  return next;
}

function flashStatus(text) {
  const existing = document.querySelector(".status-chip");
  if (existing) {
    existing.remove();
  }

  const chip = document.createElement("div");
  chip.className = "status-chip";
  chip.textContent = text;
  document.querySelector(".preview-header").appendChild(chip);

  window.setTimeout(() => chip.remove(), 2200);
}

function renderDiagram() {
  const topLeft = ["Equipment", "Process", "People"];
  const bottomLeft = ["Materials", "Environment", "Management"];

  diagramCanvas.innerHTML = `
    <svg viewBox="0 0 1200 760" role="img" aria-label="Cause and effect fishbone diagram preview">
      <defs>
        <linearGradient id="cardFill" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stop-color="#fffdf8"></stop>
          <stop offset="100%" stop-color="#f7efe2"></stop>
        </linearGradient>
      </defs>

      <line x1="120" y1="380" x2="905" y2="380" stroke="#355d4f" stroke-width="6" stroke-linecap="round"></line>
      <polygon points="905,350 1035,380 905,410" fill="#355d4f"></polygon>
      <rect x="1035" y="310" width="125" height="140" rx="22" fill="#d7662b"></rect>
      <text x="1097" y="350" text-anchor="middle" fill="#fff8f0" font-size="20" font-family="Space Grotesk, sans-serif">Effect</text>
      <text x="1097" y="390" text-anchor="middle" fill="#fffefb" font-size="18" font-family="Outfit, sans-serif">${escapeXml(state.effect || "Describe the problem")}</text>
      <text x="1097" y="420" text-anchor="middle" fill="#fff5ee" font-size="13" font-family="Outfit, sans-serif">${escapeXml(state.analysisDate || "")}</text>

      ${renderBranchGroup(topLeft, true)}
      ${renderBranchGroup(bottomLeft, false)}
    </svg>
  `;
}

function renderBranchGroup(names, isTop) {
  const startX = 230;
  const gap = 210;
  const branchLength = 140;
  const anchorY = 380;
  const sign = isTop ? -1 : 1;

  return names
    .map((name, index) => {
      const x = startX + gap * index;
      const y = anchorY + sign * 14;
      const branchEndX = x + 95;
      const branchEndY = anchorY + sign * branchLength;
      const boxX = x - 100;
      const boxY = isTop ? branchEndY - 170 : branchEndY + 16;
      const content = getSectionLines(name);
      const textStartY = boxY + 56;

      return `
        <line x1="${x}" y1="${y}" x2="${branchEndX}" y2="${branchEndY}" stroke="#5e8b7e" stroke-width="4" stroke-linecap="round"></line>
        <rect x="${boxX}" y="${boxY}" width="220" height="154" rx="22" fill="url(#cardFill)" stroke="#d7c7b0"></rect>
        <text x="${boxX + 18}" y="${boxY + 32}" fill="#9e3d14" font-size="14" font-family="Outfit, sans-serif" letter-spacing="2">SECTION</text>
        <text x="${boxX + 18}" y="${boxY + 52}" fill="#1c2b24" font-size="20" font-family="Space Grotesk, sans-serif">${escapeXml(name)}</text>
        ${content
          .map(
            (line, lineIndex) => `
              <text x="${boxX + 18}" y="${textStartY + lineIndex * 18}" fill="#44524b" font-size="14" font-family="Outfit, sans-serif">${escapeXml(line)}</text>`,
          )
          .join("")}
      `;
    })
    .join("");
}

function getSectionLines(name) {
  const section = state.sections[name];
  const lines = [];

  if (section.notes.trim()) {
    lines.push(trimLine(section.notes.trim(), 28));
  }

  section.causes.forEach((item) => {
    const cause = item.cause.trim();
    const subcause = item.subcause.trim();
    if (!cause && !subcause) {
      return;
    }

    const label = subcause ? `${cause} - ${subcause}` : cause || subcause;
    lines.push(trimLine(label, 28));
  });

  if (lines.length === 0) {
    lines.push("Add causes here");
  }

  return lines.slice(0, 5);
}

function trimLine(text, max) {
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
