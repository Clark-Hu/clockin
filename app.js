import { DEFAULT_PROJECT_CATEGORIES } from "./projects.js";

const END_DATE_ISO = "2026-01-30";
const API_URL = "/api/data";

const LOCAL_CACHE_KEY = "checkin_cache_v1";
const LOCAL_AUTH_HASH_KEY = "checkin_local_auth_hash_v1";
const SESSION_AUTH_HASH_KEY = "checkin_session_auth_hash_v1";

const STATUS_DEFS = [
  { key: "satisfied", label: "满意", short: "满", score: 3, className: "status-satisfied" },
  { key: "ok", label: "一般", short: "般", score: 2, className: "status-ok" },
  { key: "unsatisfied", label: "不满意", short: "不", score: 1, className: "status-unsatisfied" },
  { key: "missed", label: "未完成", short: "未", score: 0, className: "status-missed" },
];

const STATUS_BY_KEY = new Map(STATUS_DEFS.map((s) => [s.key, s]));
const WEEKDAY_CN = ["日", "一", "二", "三", "四", "五", "六"];

const PROJECTS = DEFAULT_PROJECT_CATEGORIES.flatMap((c) =>
  c.projects.map((p) => ({
    ...p,
    categoryId: c.id,
    categoryName: c.name,
  })),
);

const PROJECT_BY_ID = new Map(PROJECTS.map((p) => [p.id, p]));

const elApp = document.getElementById("app");
const elSubtitle = document.getElementById("subtitle");
const elTabs = document.querySelector(".tabs");
const elPanels = new Map([
  ["checkin", document.getElementById("tab-checkin")],
  ["stats", document.getElementById("tab-stats")],
  ["settings", document.getElementById("tab-settings")],
]);

const elLogoutBtn = document.getElementById("logoutBtn");

const elSaveState = document.getElementById("saveState");
const elGridContainer = document.getElementById("gridContainer");
const elViewButtons = Array.from(document.querySelectorAll("[data-view]"));

const elPrevBtn = document.getElementById("prevBtn");
const elNextBtn = document.getElementById("nextBtn");
const elTodayBtn = document.getElementById("todayBtn");
const elFocusDate = document.getElementById("focusDate");

const elLoginOverlay = document.getElementById("loginOverlay");
const elPasswordInput = document.getElementById("passwordInput");
const elLoginBtn = document.getElementById("loginBtn");
const elLoginError = document.getElementById("loginError");

const elEditorOverlay = document.getElementById("editorOverlay");
const elEditorTitle = document.getElementById("editorTitle");
const elEditorSubtitle = document.getElementById("editorSubtitle");
const elEditorCloseBtn = document.getElementById("editorCloseBtn");
const elStatusButtons = Array.from(document.querySelectorAll(".status-btn[data-status]"));
const elNoteInput = document.getElementById("noteInput");
const elPhotoInput = document.getElementById("photoInput");
const elRemovePhotoBtn = document.getElementById("removePhotoBtn");
const elPhotoUrlInput = document.getElementById("photoUrlInput");
const elPhotoPreviewWrap = document.getElementById("photoPreviewWrap");
const elPhotoPreview = document.getElementById("photoPreview");
const elClearEntryBtn = document.getElementById("clearEntryBtn");
const elSaveEntryBtn = document.getElementById("saveEntryBtn");

const elExportBtn = document.getElementById("exportBtn");
const elImportFile = document.getElementById("importFile");
const elClearLocalBtn = document.getElementById("clearLocalBtn");

const elStatsProjectSelect = document.getElementById("statsProjectSelect");
const elProjectChart = document.getElementById("projectChart");
const elProjectStatsSummary = document.getElementById("projectStatsSummary");

const elRangeStart = document.getElementById("rangeStart");
const elRangeEnd = document.getElementById("rangeEnd");
const elApplyRange = document.getElementById("applyRange");
const elRangeSummary = document.getElementById("rangeSummary");
const elRangeChart = document.getElementById("rangeChart");
const elPerProjectAverages = document.getElementById("perProjectAverages");

let viewMode = "week";
let focusDateIso = toISODateString(startOfToday());
let authHash = sessionStorage.getItem(SESSION_AUTH_HASH_KEY) || null;
let storageMode = "cloud";

let data = null;
let saveTimer = null;
let saving = false;
let pendingSave = false;

let editorContext = null;
let editorDraft = null;

init();

function init() {
  initTabs();
  initViewToggle();
  initDateNav();
  initLogin();
  initEditor();
  initSettings();
  initStatsControls();

  if (authHash) {
    loadAll().catch(() => showLogin());
  } else {
    showLogin();
  }
}

function initTabs() {
  elTabs?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tab]");
    if (!btn) return;
    setActiveTab(btn.dataset.tab);
  });
}

function setActiveTab(tab) {
  for (const btn of Array.from(document.querySelectorAll(".tab-btn[data-tab]"))) {
    btn.classList.toggle("is-active", btn.dataset.tab === tab);
  }
  for (const [key, panel] of elPanels.entries()) {
    panel.classList.toggle("is-hidden", key !== tab);
  }
  if (tab === "stats") renderStats();
}

function initViewToggle() {
  for (const btn of elViewButtons) {
    btn.addEventListener("click", () => {
      viewMode = btn.dataset.view === "day" ? "day" : "week";
      for (const b of elViewButtons) b.classList.toggle("is-active", b === btn);
      renderAll();
    });
  }
}

function initDateNav() {
  elPrevBtn.addEventListener("click", () => shiftFocus(viewMode === "week" ? -7 : -1));
  elNextBtn.addEventListener("click", () => shiftFocus(viewMode === "week" ? 7 : 1));
  elTodayBtn.addEventListener("click", () => {
    focusDateIso = toISODateString(startOfToday());
    renderAll();
  });
  elFocusDate.addEventListener("change", () => {
    if (!elFocusDate.value) return;
    focusDateIso = elFocusDate.value;
    renderAll();
  });

  elLogoutBtn.addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_AUTH_HASH_KEY);
    authHash = null;
    data = null;
    showLogin();
  });
}

function initLogin() {
  elLoginBtn.addEventListener("click", () => login());
  elPasswordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") login();
  });
}

function showLogin() {
  elApp.setAttribute("aria-hidden", "true");
  elLoginOverlay.classList.remove("is-hidden");
  elPasswordInput.value = "";
  elLoginError.textContent = "";
  setTimeout(() => elPasswordInput.focus(), 0);
}

function hideLogin() {
  elApp.setAttribute("aria-hidden", "false");
  elLoginOverlay.classList.add("is-hidden");
}

function initEditor() {
  elEditorCloseBtn.addEventListener("click", closeEditor);
  elEditorOverlay.addEventListener("click", (e) => {
    if (e.target === elEditorOverlay) closeEditor();
  });

  for (const btn of elStatusButtons) {
    btn.addEventListener("click", () => {
      if (!editorDraft) return;
      editorDraft.status = btn.dataset.status;
      syncEditorUI();
    });
  }

  elNoteInput.addEventListener("input", () => {
    if (!editorDraft) return;
    editorDraft.note = elNoteInput.value;
  });

  elPhotoUrlInput.addEventListener("input", () => {
    if (!editorDraft) return;
    editorDraft.photoUrl = elPhotoUrlInput.value.trim();
  });

  elPhotoInput.addEventListener("change", async () => {
    if (!editorDraft) return;
    const file = elPhotoInput.files?.[0];
    if (!file) return;
    try {
      setSaveState("处理中…");
      const dataUrl = await imageFileToDataUrl(file, { maxSize: 1280, quality: 0.82 });
      editorDraft.photoDataUrl = dataUrl;
      syncEditorUI();
      setSaveState("");
    } catch (err) {
      console.error(err);
      alert("读取图片失败，建议换一张或改用图片链接。");
      setSaveState("");
    } finally {
      elPhotoInput.value = "";
    }
  });

  elRemovePhotoBtn.addEventListener("click", () => {
    if (!editorDraft) return;
    editorDraft.photoDataUrl = "";
    syncEditorUI();
  });

  elClearEntryBtn.addEventListener("click", () => {
    if (!editorContext) return;
    clearEntry(editorContext.dateIso, editorContext.projectId);
    closeEditor();
  });

  elSaveEntryBtn.addEventListener("click", () => {
    if (!editorContext || !editorDraft) return;
    upsertEntry(editorContext.dateIso, editorContext.projectId, editorDraft);
    closeEditor();
  });
}

function initSettings() {
  elExportBtn.addEventListener("click", () => exportJson());
  elImportFile.addEventListener("change", () => importJsonFile(elImportFile.files?.[0]));
  elClearLocalBtn.addEventListener("click", () => {
    if (!confirm("确定要清空本地缓存吗？（不会影响云端）")) return;
    localStorage.removeItem(LOCAL_CACHE_KEY);
    localStorage.removeItem(LOCAL_AUTH_HASH_KEY);
    alert("已清空。");
  });
}

function initStatsControls() {
  for (const p of PROJECTS) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.categoryName} / ${p.name}`;
    elStatsProjectSelect.appendChild(opt);
  }

  elStatsProjectSelect.addEventListener("change", () => renderStats());
  elApplyRange.addEventListener("click", () => renderStats());
  window.addEventListener("resize", () => {
    if (document.getElementById("tab-stats")?.classList.contains("is-hidden")) return;
    renderStats();
  });
}

async function login() {
  const password = elPasswordInput.value;
  elLoginError.textContent = "";

  if (!password) {
    elLoginError.textContent = "请输入密码。";
    return;
  }

  try {
    elLoginBtn.disabled = true;
    authHash = await sha256Hex(password);
    sessionStorage.setItem(SESSION_AUTH_HASH_KEY, authHash);

    await loadAll({ allowOffline: true });
    localStorage.setItem(LOCAL_AUTH_HASH_KEY, authHash);
    hideLogin();
  } catch (err) {
    console.error(err);
    if (err?.code === "AUTH") {
      elLoginError.textContent = "密码不对。";
      return;
    }

    elLoginError.textContent = "云端不可用，已进入本地模式（设置页可导出备份）。";
    storageMode = "local";
    data = loadLocalCache() || createEmptyData();
    ensureMeta();
    hideLogin();
    renderAll();
  } finally {
    elLoginBtn.disabled = false;
  }
}

async function loadAll({ allowOffline } = { allowOffline: false }) {
  if (!authHash) throw new Error("missing auth");

  storageMode = "cloud";
  setSaveState("加载中…");

  try {
    const remote = await apiGetData(authHash);
    data = normalizeData(remote);
    ensureMeta();
    cacheLocal(data);
    setSaveState("");
    hideLogin();
    renderAll();
  } catch (err) {
    setSaveState("");
    if (err?.code === "AUTH") throw err;
    if (!allowOffline) throw err;

    const localAuth = localStorage.getItem(LOCAL_AUTH_HASH_KEY);
    if (localAuth && localAuth !== authHash) {
      const e = new Error("bad password for offline");
      e.code = "AUTH";
      throw e;
    }

    storageMode = "local";
    data = loadLocalCache() || createEmptyData();
    ensureMeta();
    cacheLocal(data);
    hideLogin();
    renderAll();
  }
}

function ensureMeta() {
  if (!data.meta) data.meta = {};
  if (!data.meta.endDate) data.meta.endDate = END_DATE_ISO;
  if (!data.meta.startDate) data.meta.startDate = toISODateString(startOfToday());
  if (!data.meta.createdAt) data.meta.createdAt = new Date().toISOString();
  if (!data.updatedAt) data.updatedAt = new Date().toISOString();

  const start = parseISODate(data.meta.startDate);
  const end = parseISODate(data.meta.endDate);
  if (start.getTime() > end.getTime()) data.meta.startDate = data.meta.endDate;
}

function renderAll() {
  if (!data) return;

  const startIso = data.meta.startDate;
  const endIso = data.meta.endDate;

  const startDate = parseISODate(startIso);
  const endDate = parseISODate(endIso);
  const focusDate = clampDate(parseISODate(focusDateIso), startDate, endDate);
  focusDateIso = toISODateString(focusDate);

  elFocusDate.min = startIso;
  elFocusDate.max = endIso;
  elFocusDate.value = focusDateIso;

  elSubtitle.textContent = `${startIso} ～ ${endIso} · ${storageMode === "cloud" ? "云端" : "本地"}`;

  renderGrid();
  if (!document.getElementById("tab-stats")?.classList.contains("is-hidden")) renderStats();
}

function renderGrid() {
  const dateList = viewMode === "day" ? [parseISODate(focusDateIso)] : getWeekDates(parseISODate(focusDateIso));
  const startDate = parseISODate(data.meta.startDate);
  const endDate = parseISODate(data.meta.endDate);

  const table = document.createElement("table");
  table.className = "table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");

  headRow.appendChild(makeTh("项目", "col-project sticky-col sticky-head"));
  headRow.appendChild(makeTh("频率", "col-freq sticky-col second sticky-head"));

  for (const d of dateList) {
    const th = document.createElement("th");
    th.className = "date-head";
    const mmdd = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
    th.textContent = mmdd;

    const sub = document.createElement("span");
    sub.className = "date-sub";
    sub.textContent = `周${WEEKDAY_CN[d.getDay()]}`;
    th.appendChild(sub);
    headRow.appendChild(th);
  }

  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const cat of DEFAULT_PROJECT_CATEGORIES) {
    const trCat = document.createElement("tr");
    trCat.className = "category-row";
    const td = document.createElement("td");
    td.colSpan = 2 + dateList.length;
    td.textContent = cat.name;
    trCat.appendChild(td);
    tbody.appendChild(trCat);

    for (const proj of cat.projects) {
      const tr = document.createElement("tr");

      const tdName = document.createElement("td");
      tdName.className = "sticky-col col-project";
      const nameWrap = document.createElement("div");
      nameWrap.className = "project-name";
      const link = document.createElement("button");
      link.type = "button";
      link.className = "project-link";
      link.textContent = proj.name;
      link.addEventListener("click", () => openProjectStats(proj.id));
      nameWrap.appendChild(link);
      tdName.appendChild(nameWrap);
      tr.appendChild(tdName);

      const tdFreq = document.createElement("td");
      tdFreq.className = "sticky-col second col-freq muted";
      tdFreq.textContent = proj.frequency || "";
      tr.appendChild(tdFreq);

      for (const d of dateList) {
        const tdCell = document.createElement("td");
        const iso = toISODateString(d);
        const inRange = d.getTime() >= startDate.getTime() && d.getTime() <= endDate.getTime();
        const entry = getEntry(iso, proj.id);
        const statusKey = entry?.status || "";
        const statusDef = STATUS_BY_KEY.get(statusKey);

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `cell-btn ${statusDef?.className || "status-empty"}`;
        btn.disabled = !inRange;
        btn.title = inRange ? "点击打卡" : "不在范围内";
        btn.addEventListener("click", () => openEditor(iso, proj.id));

        const tag = document.createElement("span");
        tag.className = "cell-tag";
        tag.textContent = statusDef ? statusDef.short : "—";
        btn.appendChild(tag);

        const meta = document.createElement("span");
        meta.className = "cell-meta";
        if (entry?.note?.trim()) meta.appendChild(makeMetaDot("注"));
        if (entry?.photoDataUrl || entry?.photoUrl) meta.appendChild(makeMetaDot("图"));
        btn.appendChild(meta);

        tdCell.appendChild(btn);
        tr.appendChild(tdCell);
      }

      tbody.appendChild(tr);
    }
  }

  // 平均行（横向：每个日期的所有项目平均满意度）
  const avgRow = document.createElement("tr");
  avgRow.className = "avg-row";
  avgRow.appendChild(makeTd("平均满意度", "sticky-col col-project"));
  avgRow.appendChild(makeTd(viewMode === "week" ? "本周" : "当天", "sticky-col second col-freq muted"));

  for (const d of dateList) {
    const iso = toISODateString(d);
    const avg = computeAverageScoreForDate(iso);
    const td = document.createElement("td");
    td.textContent = avg == null ? "—" : avg.toFixed(2);
    avgRow.appendChild(td);
  }

  tbody.appendChild(avgRow);
  table.appendChild(tbody);

  elGridContainer.innerHTML = "";
  elGridContainer.appendChild(table);
}

function openProjectStats(projectId) {
  setActiveTab("stats");
  elStatsProjectSelect.value = projectId;
  renderStats();
}

function renderStats() {
  if (!data) return;

  const projectId = elStatsProjectSelect.value || PROJECTS[0]?.id;
  if (projectId) elStatsProjectSelect.value = projectId;

  const startIso = data.meta.startDate;
  const endIso = data.meta.endDate;

  elRangeStart.min = startIso;
  elRangeStart.max = endIso;
  elRangeEnd.min = startIso;
  elRangeEnd.max = endIso;

  if (!elRangeStart.value) elRangeStart.value = startIso;
  if (!elRangeEnd.value) elRangeEnd.value = endIso;

  const rangeStartIso = clampIso(elRangeStart.value || startIso, startIso, endIso);
  const rangeEndIso = clampIso(elRangeEnd.value || endIso, startIso, endIso);

  elRangeStart.value = rangeStartIso;
  elRangeEnd.value = rangeEndIso;

  renderProjectChart(projectId);
  renderRangeChart(rangeStartIso, rangeEndIso);
  renderPerProjectAverages(rangeStartIso, rangeEndIso);
}

function renderProjectChart(projectId) {
  const proj = PROJECT_BY_ID.get(projectId);
  if (!proj) return;

  const dateIsos = getDateIsoList(data.meta.startDate, data.meta.endDate);
  const values = dateIsos.map((iso) => scoreFromEntry(getEntry(iso, projectId)));
  drawLineChart(elProjectChart, values, { min: 0, max: 3, color: "rgba(122, 162, 255, 0.95)" });

  const stats = summarizeScores(values);
  elProjectStatsSummary.textContent = `${proj.categoryName} / ${proj.name} · 已打卡 ${stats.count} 天 · 平均 ${stats.avg == null ? "—" : stats.avg.toFixed(2)}`;
}

function renderRangeChart(rangeStartIso, rangeEndIso) {
  const dateIsos = getDateIsoList(rangeStartIso, rangeEndIso);
  const values = dateIsos.map((iso) => computeAverageScoreForDate(iso));

  const summary = summarizeScores(values);
  elRangeSummary.innerHTML = "";
  elRangeSummary.appendChild(makePill(`范围：${rangeStartIso} ～ ${rangeEndIso}`));
  elRangeSummary.appendChild(makePill(`有数据天数：${summary.count}/${dateIsos.length}`));
  elRangeSummary.appendChild(makePill(`平均满意度：${summary.avg == null ? "—" : summary.avg.toFixed(2)}`));

  drawLineChart(elRangeChart, values, { min: 0, max: 3, color: "rgba(29, 185, 84, 0.9)" });
}

function renderPerProjectAverages(rangeStartIso, rangeEndIso) {
  const dateIsos = getDateIsoList(rangeStartIso, rangeEndIso);

  const rows = PROJECTS.map((p) => {
    const scores = dateIsos.map((iso) => scoreFromEntry(getEntry(iso, p.id)));
    const { avg, count } = summarizeScores(scores);
    return { project: p, avg, count, total: dateIsos.length };
  }).sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));

  elPerProjectAverages.innerHTML = "";
  for (const r of rows) {
    const line = document.createElement("div");
    line.className = "row";

    const name = document.createElement("div");
    name.style.minWidth = "210px";
    name.textContent = `${r.project.categoryName} / ${r.project.name}`;

    const score = document.createElement("div");
    score.className = "pill";
    score.textContent = `平均 ${r.avg == null ? "—" : r.avg.toFixed(2)}`;

    const count = document.createElement("div");
    count.className = "pill";
    count.textContent = `打卡 ${r.count}/${r.total}`;

    line.appendChild(name);
    line.appendChild(score);
    line.appendChild(count);
    elPerProjectAverages.appendChild(line);
  }
}

function openEditor(dateIso, projectId) {
  const proj = PROJECT_BY_ID.get(projectId);
  if (!proj) return;
  editorContext = { dateIso, projectId };

  const existing = getEntry(dateIso, projectId);
  editorDraft = {
    status: existing?.status || "missed",
    note: existing?.note || "",
    photoDataUrl: existing?.photoDataUrl || "",
    photoUrl: existing?.photoUrl || "",
  };

  elEditorTitle.textContent = `${proj.categoryName} / ${proj.name}`;
  elEditorSubtitle.textContent = `${dateIso}（周${WEEKDAY_CN[parseISODate(dateIso).getDay()]}）`;

  syncEditorUI();
  elEditorOverlay.classList.remove("is-hidden");
}

function syncEditorUI() {
  if (!editorDraft) return;

  for (const btn of elStatusButtons) {
    btn.classList.toggle("is-selected", btn.dataset.status === editorDraft.status);
  }

  elNoteInput.value = editorDraft.note || "";
  elPhotoUrlInput.value = editorDraft.photoUrl || "";

  const previewUrl = editorDraft.photoDataUrl || editorDraft.photoUrl || "";
  if (previewUrl) {
    elPhotoPreview.src = previewUrl;
    elPhotoPreviewWrap.classList.remove("is-hidden");
  } else {
    elPhotoPreview.src = "";
    elPhotoPreviewWrap.classList.add("is-hidden");
  }
}

function closeEditor() {
  editorContext = null;
  editorDraft = null;
  elEditorOverlay.classList.add("is-hidden");
}

function getEntry(dateIso, projectId) {
  const byDate = data?.entries?.[dateIso];
  if (!byDate) return null;
  return byDate[projectId] || null;
}

function upsertEntry(dateIso, projectId, draft) {
  if (!data.entries) data.entries = {};
  if (!data.entries[dateIso]) data.entries[dateIso] = {};

  data.entries[dateIso][projectId] = {
    status: draft.status || "missed",
    note: draft.note || "",
    photoDataUrl: draft.photoDataUrl || "",
    photoUrl: draft.photoUrl || "",
    updatedAt: new Date().toISOString(),
  };

  data.updatedAt = new Date().toISOString();
  cacheLocal(data);
  scheduleSave();
  renderAll();
}

function clearEntry(dateIso, projectId) {
  if (!data?.entries?.[dateIso]?.[projectId]) return;
  delete data.entries[dateIso][projectId];
  if (Object.keys(data.entries[dateIso]).length === 0) delete data.entries[dateIso];
  data.updatedAt = new Date().toISOString();
  cacheLocal(data);
  scheduleSave();
  renderAll();
}

function scheduleSave() {
  pendingSave = true;
  setSaveState(storageMode === "cloud" ? "待保存…" : "已在本地保存");
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => flushSave(), 650);
}

async function flushSave() {
  if (!pendingSave || saving) return;
  pendingSave = false;
  saving = true;

  try {
    setSaveState(storageMode === "cloud" ? "保存中…" : "已在本地保存");
    cacheLocal(data);

    if (storageMode === "cloud") {
      await apiPutData(authHash, data);
      setSaveState("已保存");
    } else {
      setSaveState("已在本地保存");
    }
  } catch (err) {
    console.error(err);
    storageMode = "local";
    setSaveState("云端保存失败（已转本地）");
  } finally {
    saving = false;
    if (pendingSave) setTimeout(() => flushSave(), 0);
  }
}

function setSaveState(text) {
  elSaveState.textContent = text || "";
}

function cacheLocal(obj) {
  try {
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(obj));
  } catch (e) {
    console.error(e);
  }
}

function loadLocalCache() {
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY);
    if (!raw) return null;
    return normalizeData(JSON.parse(raw));
  } catch (e) {
    console.error(e);
    return null;
  }
}

function exportJson() {
  if (!data) return;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `checkin_${data.meta.startDate}_to_${data.meta.endDate}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function importJsonFile(file) {
  if (!file) return;
  if (!confirm("导入会覆盖当前数据，确定继续？")) return;

  try {
    const text = await file.text();
    const obj = normalizeData(JSON.parse(text));
    data = obj;
    ensureMeta();
    cacheLocal(data);
    scheduleSave();
    renderAll();
    alert("导入完成。");
  } catch (err) {
    console.error(err);
    alert("导入失败：文件不是有效 JSON。");
  } finally {
    elImportFile.value = "";
  }
}

function normalizeData(obj) {
  if (!obj || typeof obj !== "object") return createEmptyData();
  if (obj.version !== 1) return createEmptyData();
  if (!obj.meta || typeof obj.meta !== "object") obj.meta = {};
  if (!obj.entries || typeof obj.entries !== "object") obj.entries = {};
  return obj;
}

function createEmptyData() {
  return {
    version: 1,
    meta: {
      startDate: null,
      endDate: END_DATE_ISO,
      createdAt: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
    entries: {},
  };
}

function makeTh(text, className) {
  const th = document.createElement("th");
  th.textContent = text;
  if (className) th.className = className;
  return th;
}

function makeTd(text, className) {
  const td = document.createElement("td");
  td.textContent = text;
  if (className) td.className = className;
  return td;
}

function makeMetaDot(text) {
  const span = document.createElement("span");
  span.textContent = text;
  span.style.opacity = "0.85";
  return span;
}

function makePill(text) {
  const span = document.createElement("span");
  span.className = "pill";
  span.textContent = text;
  return span;
}

function computeAverageScoreForDate(dateIso) {
  const scores = PROJECTS.map((p) => scoreFromEntry(getEntry(dateIso, p.id))).filter((n) => n != null);
  if (scores.length === 0) return null;
  const sum = scores.reduce((a, b) => a + b, 0);
  return sum / scores.length;
}

function scoreFromEntry(entry) {
  if (!entry?.status) return null;
  const def = STATUS_BY_KEY.get(entry.status);
  return def ? def.score : null;
}

function summarizeScores(values) {
  const nums = values.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (nums.length === 0) return { avg: null, count: 0 };
  const sum = nums.reduce((a, b) => a + b, 0);
  return { avg: sum / nums.length, count: nums.length };
}

function getWeekDates(date) {
  const start = startOfWeek(date, 1);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

function startOfWeek(date, weekStartDay /* 1=Mon */) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day - weekStartDay + 7) % 7;
  return addDays(d, -diff);
}

function shiftFocus(deltaDays) {
  const start = parseISODate(data.meta.startDate);
  const end = parseISODate(data.meta.endDate);
  const next = addDays(parseISODate(focusDateIso), deltaDays);
  focusDateIso = toISODateString(clampDate(next, start, end));
  renderAll();
}

function getDateIsoList(startIso, endIso) {
  const start = parseISODate(startIso);
  const end = parseISODate(endIso);
  const days = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
  return Array.from({ length: days + 1 }, (_, i) => toISODateString(addDays(start, i)));
}

function clampIso(iso, minIso, maxIso) {
  const d = clampDate(parseISODate(iso), parseISODate(minIso), parseISODate(maxIso));
  return toISODateString(d);
}

function parseISODate(iso) {
  if (!iso) return startOfToday();
  return new Date(`${iso}T00:00:00`);
}

function toISODateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(date, delta) {
  const d = new Date(date);
  d.setDate(d.getDate() + delta);
  return d;
}

function clampDate(date, min, max) {
  const t = date.getTime();
  if (t < min.getTime()) return new Date(min);
  if (t > max.getTime()) return new Date(max);
  return date;
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function apiGetData(hash) {
  const res = await fetch(API_URL, {
    method: "GET",
    headers: {
      "X-Auth-Hash": hash,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (res.status === 401) {
    const e = new Error("unauthorized");
    e.code = "AUTH";
    throw e;
  }
  if (!res.ok) throw new Error(`GET ${API_URL} failed: ${res.status}`);
  return await res.json();
}

async function apiPutData(hash, obj) {
  const res = await fetch(API_URL, {
    method: "PUT",
    headers: {
      "X-Auth-Hash": hash,
      "Content-Type": "application/json;charset=utf-8",
    },
    body: JSON.stringify(obj),
  });
  if (res.status === 401) {
    const e = new Error("unauthorized");
    e.code = "AUTH";
    throw e;
  }
  if (!res.ok) throw new Error(`PUT ${API_URL} failed: ${res.status}`);
  return await res.json();
}

async function imageFileToDataUrl(file, { maxSize, quality }) {
  const type = file.type && file.type.includes("png") ? "image/png" : "image/jpeg";
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / bitmap.width, maxSize / bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(type, quality);
}

function drawLineChart(canvas, values, { min, max, color }) {
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const w = rect.width;
  const h = rect.height;
  ctx.clearRect(0, 0, w, h);

  const padL = 34;
  const padR = 10;
  const padT = 12;
  const padB = 22;
  const plotW = Math.max(1, w - padL - padR);
  const plotH = Math.max(1, h - padT - padB);

  // grid
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "11px ui-sans-serif, system-ui";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  const steps = Math.max(1, Math.round(max - min));
  for (let i = 0; i <= steps; i++) {
    const v = min + ((max - min) * i) / steps;
    const y = padT + plotH - ((v - min) / (max - min)) * plotH;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + plotW, y);
    ctx.stroke();
    ctx.fillText(String(v), padL - 8, y);
  }

  const numeric = values.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (numeric.length === 0) {
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("暂无数据", padL + plotW / 2, padT + plotH / 2);
    return;
  }

  const n = values.length;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();

  let started = false;
  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (typeof v !== "number" || !Number.isFinite(v)) {
      started = false;
      continue;
    }
    const x = padL + (n === 1 ? 0 : (i / (n - 1)) * plotW);
    const y = padT + plotH - ((v - min) / (max - min)) * plotH;
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  // points
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const x = padL + (n === 1 ? 0 : (i / (n - 1)) * plotW);
    const y = padT + plotH - ((v - min) / (max - min)) * plotH;
    ctx.beginPath();
    ctx.arc(x, y, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
}
