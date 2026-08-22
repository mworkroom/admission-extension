import { createBasis, formatBasis, INTAKE_MONTHS } from "../shared/basis.js";
import { EXTRACTION_STATUS, STATUS_META } from "../shared/extraction-status.js";
import { FIELDS } from "../shared/fields.js";
import {
  COMMON_MEMO_FIELD_KEYS,
  MEMO_CONFIRMATION_STATE,
  MEMO_VERIFICATION_STATUS,
  createCommonMemoRecord,
  getCommonMemoSummaryOptions,
  getLatestMemoVerification,
  getMemoVerificationStatus,
  resolveCommonMemos,
  verifyCommonMemoForCycle
} from "../shared/common-memos.js";
import {
  deleteCommonMemoRecord,
  loadCommonMemoState,
  saveCommonMemoStore,
  upsertCommonMemoRecord
} from "../shared/common-memo-storage.js";
import {
  mergeCommonMemoStores,
  parseCommonMemoBackup,
  serializeCommonMemoBackup
} from "../shared/common-memo-backup.js";
import {
  ISSUE_STATUS,
  createIssueNoteRecord,
  deleteIssueNoteRecord,
  loadIssueNoteState,
  saveIssueNoteStore,
  serializeIssueNotesJson,
  setIssueNoteStatus,
  updateIssueNoteRecord,
  upsertIssueNoteRecord
} from "../shared/issue-notes.js";
import { parseCourseSnapshot } from "../shared/course-parser.js";
import { parseKclSnapshot } from "../shared/kcl-parser.js";
import { getSupportedSite } from "../shared/site-registry.js";
import {
  appendAnalysisEvent,
  loadAnalysisState,
  loadAppState,
  markAnalysisStale,
  saveAnalysis,
  saveBasis
} from "../shared/storage.js";
import {
  createDefaultWidgetPreferences,
  loadWidgetPreferences,
  saveWidgetPreferences
} from "../shared/widget-preferences.js";
import { readKclPage } from "../content/read-kcl-page.js";
import { readGenericPage } from "../content/read-generic-page.js";
import { readManchesterPage } from "../content/read-manchester-page.js";
import { readQmulPage } from "../content/read-qmul-page.js";
import { readSoasPage } from "../content/read-soas-page.js";
import { focusSourceInPage } from "../content/focus-source.js";

const PAGE_READERS = Object.freeze({
  generic: readGenericPage,
  kcl: readKclPage,
  soas: readSoasPage,
  qmul: readQmulPage,
  manchester: readManchesterPage
});

const FIELD_GROUP_SEPARATOR_KEY = "reference";
const COPY_FIELD_KEYS = new Set([
  "entryRequirements",
  "tuitionFee",
  "applicationFee"
]);
const IDENTITY_FIELD_KEYS = new Set(["university", "course"]);

const FIELD_LABELS = Object.freeze({
  "": "대학 전체",
  entryRequirements: "Entry Requirements",
  koreanAcademicRequirements: "Korean Equivalent",
  englishRequirements: "IELTS",
  tuitionFee: "Tuition Fee",
  applicationFee: "Application Fee",
  universityApplicationDeadline: "Application Deadline",
  reference: "Reference",
  sopGuideline: "SOP Guideline",
  cv: "CV"
});

const KNOWN_WIDGET_CSS = `
#unibuddy-popcard-wrapper,
#unibuddy-popcard-iframe,
iframe[src*="popcard.unibuddy.co"],
iframe[title="Unibuddy Popcard"] { display: none !important; }
`;

const elements = {
  basisCycle: document.querySelector("#basis-cycle"),
  basisMode: document.querySelector("#basis-mode"),
  basisStatus: document.querySelector("#basis-status"),
  nonSeptemberWarning: document.querySelector("#non-september-warning"),
  editBasisButton: document.querySelector("#edit-basis-button"),
  universityName: document.querySelector("#university-name"),
  courseName: document.querySelector("#course-name"),
  pageKicker: document.querySelector("#page-kicker"),
  pageMessage: document.querySelector("#page-message"),
  universityMemo: document.querySelector("#university-memo"),
  editUniversityMemoButton: document.querySelector("#edit-university-memo-button"),
  analysisSummary: document.querySelector("#analysis-summary"),
  analyzeButton: document.querySelector("#analyze-button"),
  staleNotice: document.querySelector("#stale-notice"),
  fieldList: document.querySelector("#field-list"),
  fieldGroupDivider: document.querySelector("#field-group-divider"),
  supportingFieldList: document.querySelector("#supporting-field-list"),
  toolsDialog: document.querySelector("#tools-dialog"),
  openToolsButton: document.querySelector("#open-tools-button"),
  closeToolsButton: document.querySelector("#close-tools-button"),
  openIssueManagerButton: document.querySelector("#open-issue-manager-button"),
  openIssueCount: document.querySelector("#open-issue-count"),
  exportIssuesButton: document.querySelector("#export-issues-button"),
  exportMemosButton: document.querySelector("#export-memos-button"),
  importMemosButton: document.querySelector("#import-memos-button"),
  importMemosInput: document.querySelector("#import-memos-input"),
  memoBackupCount: document.querySelector("#memo-backup-count"),
  hideKnownWidgetsInput: document.querySelector("#hide-known-widgets-input"),
  toolsStatus: document.querySelector("#tools-status"),
  basisDialog: document.querySelector("#basis-dialog"),
  basisForm: document.querySelector("#basis-form"),
  closeBasisButton: document.querySelector("#close-basis-button"),
  cancelBasisButton: document.querySelector("#cancel-basis-button"),
  saveBasisButton: document.querySelector("#save-basis-button"),
  basisError: document.querySelector("#basis-error"),
  academicCycleInput: document.querySelector("#academic-cycle-input"),
  intakeMonthInput: document.querySelector("#intake-month-input"),
  intakeYearInput: document.querySelector("#intake-year-input"),
  studyModeInput: document.querySelector("#study-mode-input"),
  feeStatusInput: document.querySelector("#fee-status-input"),
  memoDialog: document.querySelector("#memo-dialog"),
  memoForm: document.querySelector("#memo-form"),
  memoDialogEyebrow: document.querySelector("#memo-dialog-eyebrow"),
  memoDialogTitle: document.querySelector("#memo-dialog-title"),
  memoContext: document.querySelector("#memo-context"),
  closeMemoButton: document.querySelector("#close-memo-button"),
  cancelMemoButton: document.querySelector("#cancel-memo-button"),
  saveMemoButton: document.querySelector("#save-memo-button"),
  deleteMemoButton: document.querySelector("#delete-memo-button"),
  memoSummarySelectField: document.querySelector("#memo-summary-select-field"),
  memoSummaryTextField: document.querySelector("#memo-summary-text-field"),
  memoSummarySelect: document.querySelector("#memo-summary-select"),
  memoSummaryInput: document.querySelector("#memo-summary-input"),
  memoDetailsInput: document.querySelector("#memo-details-input"),
  memoSourceUrlInput: document.querySelector("#memo-source-url-input"),
  memoUnverifiedInput: document.querySelector("#memo-unverified-input"),
  memoConfirmedInput: document.querySelector("#memo-confirmed-input"),
  confirmationDateFields: document.querySelector("#confirmation-date-fields"),
  memoConfirmedDateInput: document.querySelector("#memo-confirmed-date-input"),
  memoTodayButton: document.querySelector("#memo-today-button"),
  memoError: document.querySelector("#memo-error"),
  issueDialog: document.querySelector("#issue-dialog"),
  closeIssueButton: document.querySelector("#close-issue-button"),
  issueForm: document.querySelector("#issue-form"),
  issueContext: document.querySelector("#issue-context"),
  issueNoteInput: document.querySelector("#issue-note-input"),
  saveIssueButton: document.querySelector("#save-issue-button"),
  cancelIssueEditButton: document.querySelector("#cancel-issue-edit-button"),
  issueStatus: document.querySelector("#issue-status"),
  issueCount: document.querySelector("#issue-count"),
  showResolvedInput: document.querySelector("#show-resolved-input"),
  issueEmpty: document.querySelector("#issue-empty"),
  issueList: document.querySelector("#issue-list")
};

let currentBasis = null;
let currentTab = null;
let currentAnalysis = null;
let currentMemoState = null;
let currentIssueNoteState = null;
let currentWidgetPreferences = createDefaultWidgetPreferences();
let isAnalyzing = false;
let analysisError = "";
let editingMemoId = "";
let editingMemoFieldKey = "";
let deleteMemoArmed = false;
let editingIssueNoteId = "";
let isSavingMemo = false;
let isSavingIssue = false;
let tabRefreshTimer = null;

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSafeHttpUrl(value) {
  if (!String(value ?? "").trim()) return true;
  try { return ["http:", "https:"].includes(new URL(value).protocol); }
  catch { return false; }
}

function getField(fieldKey) {
  return currentAnalysis?.fields?.find((field) => field.key === fieldKey) ?? null;
}

function getUniversityName() {
  return String(getField("university")?.value ?? "").trim();
}

function getCourseName() {
  return String(getField("course")?.value ?? "").trim();
}

function analysisMatchesCurrentPage() {
  return Boolean(currentAnalysis && currentTab && currentAnalysis.page.url === currentTab.url);
}

function isChromeRestrictedPage(url) {
  return url.protocol === "chrome:" ||
    url.hostname === "chromewebstore.google.com" ||
    (url.hostname === "chrome.google.com" && url.pathname.startsWith("/webstore"));
}

function inspectTab(tab) {
  if (!tab || typeof tab.url !== "string" || !tab.url) {
    return { accessible: false, analyzable: false, title: "현재 페이지를 확인할 수 없음", url: "", message: "대학 페이지에서 확장 아이콘을 다시 눌러주세요." };
  }
  try {
    const url = new URL(tab.url);
    if (isChromeRestrictedPage(url) || !["http:", "https:"].includes(url.protocol)) {
      return { accessible: false, analyzable: false, title: tab.title || "분석할 수 없는 페이지", url: tab.url, message: "Chrome 보안 제한으로 이 페이지는 분석할 수 없습니다." };
    }
    const site = getSupportedSite(tab.url);
    return {
      accessible: true,
      analyzable: Boolean(site),
      title: tab.title || "제목 없는 페이지",
      url: tab.url,
      siteKey: site?.key ?? "",
      message: site ? "공개 페이지에서 확인 가능한 내용을 자동으로 찾습니다." : "이 페이지는 분석할 수 없습니다."
    };
  } catch {
    return { accessible: false, analyzable: false, title: tab.title || "주소 확인 불가", url: tab.url, message: "페이지 주소를 확인할 수 없습니다." };
  }
}

function renderBasis() {
  const formatted = formatBasis(currentBasis);
  elements.basisCycle.textContent = formatted.cycleAndIntake;
  elements.basisMode.textContent = formatted.modeAndFee;
  elements.nonSeptemberWarning.hidden = currentBasis.intakeMonth === 9;
}

function getMemoRecords(fieldKey) {
  if (!analysisMatchesCurrentPage() || !currentMemoState?.persisted || currentMemoState.unsupportedSchema) return [];
  return resolveCommonMemos(
    currentMemoState.store.records,
    { siteKey: currentAnalysis.siteKey, universityName: getUniversityName() },
    fieldKey
  ).sort((left, right) => {
    const exactLeft = left.siteKey === currentAnalysis.siteKey ? 1 : 0;
    const exactRight = right.siteKey === currentAnalysis.siteKey ? 1 : 0;
    return exactRight - exactLeft || Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
  });
}

function canManageMemos() {
  return Boolean(
    currentMemoState?.persisted &&
    !currentMemoState.unsupportedSchema &&
    currentMemoState.invalidRecordCount === 0 &&
    analysisMatchesCurrentPage() &&
    getUniversityName()
  );
}

function memoStatusCopy(record) {
  const status = getMemoVerificationStatus(record, currentBasis.academicCycle);
  const latest = getLatestMemoVerification(record);
  if (status === MEMO_VERIFICATION_STATUS.CONFIRMED) {
    const current = record.verificationByCycle[currentBasis.academicCycle];
    return { status, label: `${formatMemoDate(current.confirmedDate)} 확인됨` };
  }
  if (status === MEMO_VERIFICATION_STATUS.NEEDS_REVIEW) {
    return { status, label: latest ? `${formatMemoDate(latest.confirmedDate)} 확인 · 다시 확인 필요` : "다시 확인 필요" };
  }
  if (status === MEMO_VERIFICATION_STATUS.CHANGED_AFTER_VERIFICATION) {
    return { status, label: latest ? `${formatMemoDate(latest.confirmedDate)} 확인 후 내용 변경 · 다시 확인 필요` : "내용 변경 · 다시 확인 필요" };
  }
  return { status, label: latest ? `${formatMemoDate(latest.confirmedDate)} 마지막 확인 · 미확인` : "미확인" };
}

function formatMemoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return value ?? "";
  return `${Number(match[2])}/${Number(match[3])}/${match[1].slice(-2)}`;
}

function createMemoLine(record) {
  const statusCopy = memoStatusCopy(record);
  const box = document.createElement("div");
  box.className = `memo-line ${statusCopy.status === MEMO_VERIFICATION_STATUS.CONFIRMED ? "memo-line--confirmed" : ""}`;
  const title = document.createElement("strong");
  title.className = "memo-line__title";
  title.textContent = record.summary;
  box.append(title);
  if (record.details) {
    const description = document.createElement("p");
    description.className = "memo-line__details";
    description.textContent = record.details;
    box.append(description);
  }
  if (record.sourceUrl) {
    const source = document.createElement("a");
    source.className = "memo-line__source";
    source.href = record.sourceUrl;
    source.target = "_blank";
    source.rel = "noreferrer";
    source.textContent = "출처";
    box.append(source);
  }
  const state = document.createElement("p");
  state.className = "memo-state";
  state.textContent = statusCopy.label;
  box.append(state);
  return box;
}

function renderIdentity() {
  const page = inspectTab(currentTab);
  const matching = analysisMatchesCurrentPage();
  elements.pageKicker.textContent = matching ? "현재 과정" : "현재 페이지";
  elements.universityName.textContent = matching && getUniversityName() ? getUniversityName() : page.title;
  elements.courseName.textContent = matching ? getCourseName() : "";
  elements.pageMessage.textContent = isAnalyzing ? "페이지를 확인하고 있습니다…" : page.message;
  elements.editUniversityMemoButton.disabled = !canManageMemos();
  const record = getMemoRecords("")[0];
  elements.universityMemo.replaceChildren(record ? createMemoLine(record) : document.createDocumentFragment());
}

function makeDefaultField(field, status = EXTRACTION_STATUS.NOT_ANALYZED) {
  return { ...field, status, value: "", detail: status === EXTRACTION_STATUS.ANALYZING ? "확인 중…" : "", nextAction: "", source: null, copyText: "" };
}

function createStatusBadge(status) {
  const meta = STATUS_META[status] ?? STATUS_META[EXTRACTION_STATUS.NOT_ANALYZED];
  const badge = document.createElement("span");
  badge.className = `status-badge status-badge--${status}`;
  badge.setAttribute("aria-label", meta.label);
  badge.title = meta.label;
  badge.textContent = meta.symbol;
  return badge;
}

function comparablePageUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.pathname = url.pathname.replace(/\/$/, "") || "/";
    return url.href;
  } catch {
    return "";
  }
}

function canFocusSourceOnCurrentPage(source) {
  return Boolean(
    Number.isInteger(currentTab?.id) &&
      source?.excerpt &&
      isSafeHttpUrl(source?.url) &&
      comparablePageUrl(source.url) === comparablePageUrl(currentTab.url)
  );
}

async function focusSource(source, button, status) {
  if (!canFocusSourceOnCurrentPage(source)) return;
  button.disabled = true;
  status.textContent = "이동 중…";
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: focusSourceInPage,
      args: [{ excerpt: source.excerpt, sectionLabel: source.sectionLabel }]
    });
    const result = results?.[0]?.result;
    if (!result?.found) {
      throw new Error(result?.reason || "source_element_not_found");
    }
    button.classList.add("source-view-button--success");
    status.textContent = "왼쪽 페이지에서 강조함";
  } catch {
    button.classList.add("source-view-button--failed");
    status.textContent = "원문 위치를 찾지 못했습니다";
  } finally {
    button.disabled = false;
    window.setTimeout(() => {
      button.classList.remove(
        "source-view-button--success",
        "source-view-button--failed"
      );
      status.textContent = "";
    }, 2400);
  }
}

function createSourceActions(field) {
  const actions = document.createElement("div");
  actions.className = "source-actions";
  const source = field.source;
  const sourceUrl = source?.url || "";

  if (canFocusSourceOnCurrentPage(source)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "source-view-button";
    button.textContent = "원문 보기";
    button.setAttribute(
      "aria-label",
      `${source.sectionLabel || "해당 항목"} 원문 위치 보기`
    );
    const status = document.createElement("span");
    status.className = "source-view-status";
    status.setAttribute("aria-live", "polite");
    button.addEventListener("click", () => void focusSource(source, button, status));
    actions.append(button, status);
  } else if (sourceUrl && isSafeHttpUrl(sourceUrl)) {
    const link = document.createElement("a");
    link.className = "source-view-link";
    link.href = sourceUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "원문 보기";
    actions.append(link);
  }

  if (
    field.detailUrl &&
    isSafeHttpUrl(field.detailUrl) &&
    comparablePageUrl(field.detailUrl) !== comparablePageUrl(sourceUrl)
  ) {
    const detailLink = document.createElement("a");
    detailLink.className = "source-detail-link";
    detailLink.href = field.detailUrl;
    detailLink.target = "_blank";
    detailLink.rel = "noreferrer";
    detailLink.textContent = "등급 세부 기준";
    actions.append(detailLink);
  }

  return actions;
}

async function copyField(field, button) {
  const original = button.textContent;
  try {
    await navigator.clipboard.writeText(field.copyText);
    button.textContent = "복사됨";
    button.classList.add("copy-button--copied");
    await appendAnalysisEvent({ type: "copy_succeeded", fieldKey: field.key }).catch(() => {});
  } catch (error) {
    button.textContent = "복사 실패";
    await appendAnalysisEvent({ type: "copy_failed", fieldKey: field.key, detail: error?.message || "" }).catch(() => {});
  } finally {
    window.setTimeout(() => {
      button.textContent = original;
      button.classList.remove("copy-button--copied");
    }, 1400);
  }
}

function createPencilButton(fieldKey, record) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "pencil-button";
  button.textContent = "✎";
  button.title = `${FIELD_LABELS[fieldKey]} 메모 편집`;
  button.setAttribute("aria-label", `${FIELD_LABELS[fieldKey]} 확인한 사항 편집`);
  button.disabled = !canManageMemos();
  button.addEventListener("click", () => showMemoDialog(fieldKey, record));
  return button;
}

function createFieldCard(field) {
  const memoRecord = getMemoRecords(field.key)[0] ?? null;
  const attention =
    !memoRecord &&
    field.status !== EXTRACTION_STATUS.FOUND &&
    field.status !== EXTRACTION_STATUS.NOT_REQUIRED;
  const card = document.createElement("li");
  card.className = `field-card ${attention ? "field-card--attention" : ""} ${field.status === EXTRACTION_STATUS.SOURCE_ERROR ? "field-card--error" : ""}`;
  card.dataset.fieldKey = field.key;

  const header = document.createElement("div");
  header.className = "field-card__header";
  const title = document.createElement("h3");
  title.className = "field-card__title";
  title.textContent = FIELD_LABELS[field.key] ?? field.label;
  header.append(title);
  if (!memoRecord) header.append(createStatusBadge(field.status));
  header.append(createPencilButton(field.key, memoRecord));

  const body = document.createElement("div");
  body.className = "field-card__body";
  if (field.value) {
    const value = document.createElement("p");
    value.className = "field-card__value";
    value.textContent = field.value;
    body.append(value);
  }
  if (field.detail) {
    const detail = document.createElement("p");
    detail.className = "field-card__detail";
    detail.textContent = field.detail;
    body.append(detail);
  }
  if (field.nextAction) {
    const action = document.createElement("p");
    action.className = "field-card__action";
    action.textContent = field.nextAction;
    body.append(action);
  }

  const footer = document.createElement("div");
  footer.className = "field-card__footer";
  const sourceActions = createSourceActions(field);
  if (sourceActions.childElementCount) footer.append(sourceActions);
  if (COPY_FIELD_KEYS.has(field.key) && field.status === EXTRACTION_STATUS.FOUND && field.copyText) {
    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "copy-button";
    copyButton.textContent = "복사";
    copyButton.addEventListener("click", () => copyField(field, copyButton));
    footer.append(copyButton);
  }

  card.append(header);
  if (memoRecord) {
    card.append(createMemoLine(memoRecord));
  } else {
    card.append(body);
    if (footer.childElementCount) card.append(footer);
  }
  return card;
}

function renderFields({ analyzing = false } = {}) {
  const fields = (analyzing
    ? FIELDS.map((field) => makeDefaultField(field, EXTRACTION_STATUS.ANALYZING))
    : analysisMatchesCurrentPage()
      ? currentAnalysis.fields
      : FIELDS.map((field) => makeDefaultField(field)))
    .filter((field) => !IDENTITY_FIELD_KEYS.has(field.key))
    .sort((left, right) => left.order - right.order);
  const separatorIndex = fields.findIndex((field) => field.key === FIELD_GROUP_SEPARATOR_KEY);
  const primary = separatorIndex === -1 ? fields : fields.slice(0, separatorIndex);
  const supporting = separatorIndex === -1 ? [] : fields.slice(separatorIndex);

  elements.fieldList.replaceChildren(...primary.map(createFieldCard));
  elements.supportingFieldList.replaceChildren(...supporting.map(createFieldCard));
  elements.fieldGroupDivider.hidden = supporting.length === 0;
}

function renderAnalysis(message = analysisError) {
  const page = inspectTab(currentTab);
  const matches = analysisMatchesCurrentPage();
  const summary = currentAnalysis?.summary;
  if (isAnalyzing) {
    elements.analysisSummary.textContent = "11개 항목 확인 중…";
  } else if (message) {
    elements.analysisSummary.textContent = message;
  } else if (matches && summary) {
    const found = summary[EXTRACTION_STATUS.FOUND] ?? summary.found ?? 0;
    const attention =
      (summary[EXTRACTION_STATUS.ACTION_REQUIRED] ?? 0) +
      (summary[EXTRACTION_STATUS.MULTIPLE_CANDIDATES] ?? 0) +
      (summary[EXTRACTION_STATUS.NOT_FOUND] ?? 0) +
      (summary[EXTRACTION_STATUS.SOURCE_ERROR] ?? 0);
    elements.analysisSummary.textContent = `${found}/11 확인 · 다시 볼 항목 ${attention}`;
  } else {
    elements.analysisSummary.textContent = page.analyzable ? "자동 분석을 준비하고 있습니다." : page.message;
  }
  const showRetry = !isAnalyzing && page.analyzable && (Boolean(message) || Boolean(matches && currentAnalysis.stale));
  elements.analyzeButton.hidden = !showRetry;
  elements.analyzeButton.disabled = isAnalyzing;
  elements.analyzeButton.textContent = "다시 분석";
  elements.staleNotice.hidden = !(matches && currentAnalysis?.stale);
  renderIdentity();
  renderFields({ analyzing: isAnalyzing && !matches });
}

async function applyKnownWidgetPreference(tab = currentTab) {
  const page = inspectTab(tab);
  if (!Number.isInteger(tab?.id) || !page.accessible) return;
  const injection = { target: { tabId: tab.id }, css: KNOWN_WIDGET_CSS };
  try {
    if (currentWidgetPreferences.hideKnownWidgets) {
      await chrome.scripting.removeCSS(injection).catch(() => {});
      await chrome.scripting.insertCSS(injection);
    } else {
      await chrome.scripting.removeCSS(injection).catch(() => {});
    }
    elements.toolsStatus.textContent = currentWidgetPreferences.hideKnownWidgets ? "현재 탭에 위젯 숨김을 적용했습니다." : "위젯 숨김을 해제했습니다.";
  } catch {
    elements.toolsStatus.textContent = "현재 탭에는 위젯 설정을 적용하지 못했습니다.";
  }
}

async function analyzeCurrentPage() {
  const page = inspectTab(currentTab);
  if (!page.analyzable || !Number.isInteger(currentTab?.id) || isAnalyzing) return;
  isAnalyzing = true;
  analysisError = "";
  renderAnalysis();
  try {
    const site = getSupportedSite(currentTab.url);
    const reader = PAGE_READERS[site?.readerKey];
    if (!site || !reader) throw new Error("페이지 분석기를 찾지 못했습니다.");
    const execution = { target: { tabId: currentTab.id }, func: reader };
    if (site.readerKey === "generic") {
      execution.args = [{
        siteKey: site.key,
        universityName: site.universityName,
        basis: currentBasis,
        autoSelectCountry: Boolean(site.autoSelectCountry),
        koreanAcademicResultSelector:
          site.koreanAcademicResultSelector || "",
        expandEnglishAccordion: Boolean(site.expandEnglishAccordion),
        captureVisaRequiredDeadline: Boolean(site.captureVisaRequiredDeadline),
        koreanAcademicRequirementsUrl:
          site.koreanAcademicRequirementsUrl || "",
        koreanAcademicDefaultDegreeClass:
          site.koreanAcademicDefaultDegreeClass || "",
        additionalContentSelector: site.additionalContentSelector || "",
        applicationFeeUrl: site.applicationFeeUrl || "",
        applicationDeadlineUrl: site.applicationDeadlineUrl || "",
        cvGuidelineUrl: site.cvGuidelineUrl || ""
      }];
    }
    const injectionResults = await chrome.scripting.executeScript(execution);
    const payload = injectionResults?.[0]?.result;
    if (!payload) throw new Error("분석 결과가 비어 있습니다.");
    const analysis = site.key === "kcl"
      ? parseKclSnapshot(payload, currentBasis)
      : parseCourseSnapshot(payload, currentBasis);
    await saveAnalysis(analysis);
    currentAnalysis = analysis;
    await appendAnalysisEvent({ type: "analysis_completed", detail: `${analysis.summary.found ?? 0}/${analysis.summary.total}` }).catch(() => {});
  } catch (error) {
    analysisError = `분석하지 못했습니다. ${error?.message || "다시 시도해주세요."}`;
    await appendAnalysisEvent({ type: "analysis_failed", detail: error?.message || "" }).catch(() => {});
  } finally {
    isAnalyzing = false;
    renderAnalysis();
  }
}

async function applyTab(tab, { autoAnalyze = false } = {}) {
  const urlChanged = currentTab?.url !== tab?.url;
  currentTab = tab ?? null;
  if (urlChanged) {
    analysisError = "";
    editingIssueNoteId = "";
  }
  await applyKnownWidgetPreference(currentTab);
  renderAnalysis();
  if (
    autoAnalyze &&
    inspectTab(currentTab).analyzable &&
    (!currentAnalysis || currentAnalysis.page.url !== currentTab.url || currentAnalysis.stale)
  ) await analyzeCurrentPage();
}

async function refreshCurrentPage({ autoAnalyze = true } = {}) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    await applyTab(tabs[0], { autoAnalyze });
  } catch {
    await applyTab(null);
  }
}

function scheduleTabRefresh() {
  window.clearTimeout(tabRefreshTimer);
  tabRefreshTimer = window.setTimeout(() => void refreshCurrentPage({ autoAnalyze: true }), 180);
}

function populateBasisForm() {
  elements.academicCycleInput.value = currentBasis.academicCycle;
  elements.intakeMonthInput.value = String(currentBasis.intakeMonth);
  elements.intakeYearInput.value = String(currentBasis.intakeYear);
  elements.studyModeInput.value = currentBasis.studyMode;
  elements.feeStatusInput.value = currentBasis.feeStatus;
  elements.basisError.textContent = "";
}

function closeBasisDialog() { elements.basisDialog.close(); }

async function persistBasisFromForm(event) {
  event.preventDefault();
  elements.basisError.textContent = "";
  elements.saveBasisButton.disabled = true;
  try {
    const next = createBasis({
      academicCycle: elements.academicCycleInput.value,
      intakeMonth: elements.intakeMonthInput.value,
      intakeYear: elements.intakeYearInput.value,
      studyMode: elements.studyModeInput.value,
      feeStatus: elements.feeStatusInput.value
    });
    await saveBasis(next);
    currentBasis = next;
    renderBasis();
    if (currentAnalysis) {
      currentAnalysis = { ...currentAnalysis, stale: true };
      currentAnalysis = await markAnalysisStale(currentAnalysis).catch(() => currentAnalysis);
    }
    elements.basisStatus.textContent = "기준을 저장했습니다.";
    closeBasisDialog();
    renderAnalysis();
  } catch {
    elements.basisError.textContent = "학년도와 입학 기준을 확인해주세요.";
  } finally {
    elements.saveBasisButton.disabled = false;
  }
}

function renderConfirmationFields() {
  elements.confirmationDateFields.hidden = !elements.memoConfirmedInput.checked;
}

function renderMemoSummaryField(fieldKey, summary = "") {
  const options = getCommonMemoSummaryOptions(fieldKey);
  const usesSelect = options.length > 0;
  elements.memoSummarySelectField.hidden = !usesSelect;
  elements.memoSummaryTextField.hidden = usesSelect;
  elements.memoSummarySelect.required = usesSelect;
  elements.memoSummaryInput.required = !usesSelect;
  elements.memoSummarySelect.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "선택해주세요";
  elements.memoSummarySelect.append(placeholder);
  for (const optionValue of options) {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = optionValue;
    elements.memoSummarySelect.append(option);
  }
  elements.memoSummarySelect.value = options.includes(summary) ? summary : "";
  elements.memoSummaryInput.value = usesSelect ? "" : summary;
}

function showMemoDialog(fieldKey, record = null) {
  if (!canManageMemos() || !COMMON_MEMO_FIELD_KEYS.includes(fieldKey)) return;
  const field = getField(fieldKey);
  const resolvedRecord = record ?? getMemoRecords(fieldKey)[0] ?? null;
  const currentVerification = resolvedRecord?.verificationByCycle?.[currentBasis.academicCycle];
  const latest = getLatestMemoVerification(resolvedRecord);
  editingMemoId = resolvedRecord?.id ?? "";
  editingMemoFieldKey = fieldKey;
  elements.memoDialogEyebrow.textContent = FIELD_LABELS[fieldKey];
  elements.memoDialogTitle.textContent = resolvedRecord ? "확인한 사항 수정" : "확인한 사항 추가";
  elements.memoContext.textContent = `${getUniversityName()} · ${FIELD_LABELS[fieldKey]}`;
  renderMemoSummaryField(fieldKey, resolvedRecord?.summary ?? "");
  elements.memoDetailsInput.value = resolvedRecord?.details ?? "";
  elements.memoSourceUrlInput.value = resolvedRecord?.sourceUrl ?? (isSafeHttpUrl(field?.source?.url) ? field.source.url : currentTab.url);
  const confirmed = resolvedRecord?.confirmationState === MEMO_CONFIRMATION_STATE.CONFIRMED;
  elements.memoConfirmedInput.checked = confirmed;
  elements.memoUnverifiedInput.checked = !confirmed;
  elements.memoConfirmedDateInput.value = currentVerification?.confirmedDate ?? latest?.confirmedDate ?? "";
  deleteMemoArmed = false;
  elements.deleteMemoButton.textContent = "삭제";
  elements.deleteMemoButton.hidden = !resolvedRecord;
  elements.memoError.textContent = "";
  renderConfirmationFields();
  elements.memoDialog.showModal();
  (elements.memoSummarySelectField.hidden ? elements.memoSummaryInput : elements.memoSummarySelect).focus();
}

function setMemoSaving(saving) {
  isSavingMemo = saving;
  elements.saveMemoButton.disabled = saving;
  elements.deleteMemoButton.disabled = saving;
  elements.closeMemoButton.disabled = saving;
  elements.cancelMemoButton.disabled = saving;
}

async function persistMemo(event) {
  event.preventDefault();
  if (isSavingMemo || !canManageMemos()) return;
  const usesSummarySelect = !elements.memoSummarySelectField.hidden;
  const summary = (usesSummarySelect ? elements.memoSummarySelect.value : elements.memoSummaryInput.value).trim();
  const sourceUrl = elements.memoSourceUrlInput.value.trim();
  const confirmed = elements.memoConfirmedInput.checked;
  const confirmedDate = elements.memoConfirmedDateInput.value;
  if (!summary) {
    elements.memoError.textContent = usesSummarySelect ? "확인 내용을 선택해주세요." : "한 줄 요약을 입력해주세요.";
    (usesSummarySelect ? elements.memoSummarySelect : elements.memoSummaryInput).focus();
    return;
  }
  if (!isSafeHttpUrl(sourceUrl)) {
    elements.memoError.textContent = "출처는 http 또는 https 주소로 입력해주세요.";
    elements.memoSourceUrlInput.focus();
    return;
  }
  if (confirmed && !confirmedDate) {
    elements.memoError.textContent = "확인일을 선택하거나 오늘을 눌러주세요.";
    elements.memoConfirmedDateInput.focus();
    return;
  }

  setMemoSaving(true);
  try {
    const existing = currentMemoState.store.records.find((record) => record.id === editingMemoId);
    let record = createCommonMemoRecord({
      siteKey: currentAnalysis.siteKey,
      universityName: getUniversityName(),
      fieldKey: editingMemoFieldKey,
      summary,
      details: elements.memoDetailsInput.value,
      sourceUrl,
      sourceLabel: existing?.sourceLabel ?? "",
      confirmationState: confirmed ? MEMO_CONFIRMATION_STATE.CONFIRMED : MEMO_CONFIRMATION_STATE.UNVERIFIED,
      verificationByCycle: existing?.verificationByCycle ?? {}
    });
    const previousDate = existing?.verificationByCycle?.[currentBasis.academicCycle]?.confirmedDate ?? "";
    if (confirmed && confirmedDate !== previousDate) {
      record = verifyCommonMemoForCycle(record, currentBasis.academicCycle, confirmedDate);
    }
    const nextStore = upsertCommonMemoRecord(currentMemoState.store, record);
    const stored = await saveCommonMemoStore(nextStore);
    currentMemoState = { ...currentMemoState, store: stored, recovered: false, migrated: false, invalidRecordCount: 0 };
    elements.memoDialog.close();
    renderAnalysis();
  } catch (error) {
    elements.memoError.textContent = error?.message || "확인한 사항을 저장하지 못했습니다.";
  } finally {
    setMemoSaving(false);
  }
}

async function deleteEditingMemo() {
  const existing = currentMemoState?.store.records.find((record) => record.id === editingMemoId);
  if (!existing || isSavingMemo) return;
  if (!deleteMemoArmed) {
    deleteMemoArmed = true;
    elements.deleteMemoButton.textContent = "삭제 확인";
    elements.memoError.textContent = "삭제하려면 삭제 확인을 한 번 더 눌러주세요.";
    return;
  }
  setMemoSaving(true);
  try {
    const nextStore = deleteCommonMemoRecord(currentMemoState.store, existing.id);
    const stored = await saveCommonMemoStore(nextStore);
    currentMemoState = { ...currentMemoState, store: stored, invalidRecordCount: 0 };
    deleteMemoArmed = false;
    elements.memoDialog.close();
    renderAnalysis();
  } catch (error) {
    elements.memoError.textContent = error?.message || "확인한 사항을 삭제하지 못했습니다.";
  } finally {
    setMemoSaving(false);
  }
}

function deriveCourseKey(urlValue) {
  try {
    const url = new URL(urlValue);
    const parts = url.pathname.split("/").filter(Boolean);
    return (parts.slice(-3).join("-") || url.hostname).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 300);
  } catch { return ""; }
}

function getIssueContext() {
  const page = inspectTab(currentTab);
  const site = page.analyzable ? getSupportedSite(page.url) : null;
  if (!site || !currentBasis || !page.url.startsWith("https://")) return null;
  return {
    siteKey: site.key,
    courseKey: deriveCourseKey(page.url),
    universityName: analysisMatchesCurrentPage() ? getUniversityName() || site.label : site.universityName || site.label,
    courseName: analysisMatchesCurrentPage() ? getCourseName() || currentTab.title : currentTab.title,
    academicCycle: currentBasis.academicCycle,
    sourceUrl: page.url
  };
}

function canPersistIssues() {
  return Boolean(currentIssueNoteState?.persisted && !currentIssueNoteState.unsupportedSchema && currentIssueNoteState.invalidRecordCount === 0);
}

function resetIssueEditor({ keepStatus = false } = {}) {
  editingIssueNoteId = "";
  elements.issueNoteInput.value = "";
  elements.cancelIssueEditButton.hidden = true;
  elements.saveIssueButton.textContent = "저장";
  if (!keepStatus) elements.issueStatus.textContent = "";
}

function renderIssueNotes() {
  const context = getIssueContext();
  const allRecords = [...(currentIssueNoteState?.store.records ?? [])].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const openCount = allRecords.filter((record) => record.status === ISSUE_STATUS.OPEN).length;
  const records = elements.showResolvedInput.checked ? allRecords : allRecords.filter((record) => record.status === ISSUE_STATUS.OPEN);
  elements.openIssueCount.textContent = openCount;
  elements.issueCount.textContent = `${allRecords.length}`;
  elements.issueContext.textContent = context ? `${context.universityName} · ${context.courseName} · ${context.academicCycle}` : "분석 가능한 HTTPS 대학 페이지에서 기록할 수 있습니다.";
  const canCreate = Boolean(context && canPersistIssues());
  elements.issueNoteInput.disabled = isSavingIssue || (!canCreate && !editingIssueNoteId);
  elements.saveIssueButton.disabled = elements.issueNoteInput.disabled;
  elements.issueEmpty.hidden = records.length > 0;
  const items = records.map((record) => {
    const item = document.createElement("li");
    item.className = `issue-note ${record.status === ISSUE_STATUS.RESOLVED ? "issue-note--resolved" : ""}`;
    const note = document.createElement("p");
    note.className = "issue-note__text";
    note.textContent = record.note;
    const meta = document.createElement("p");
    meta.className = "issue-note__meta";
    meta.textContent = `${record.status === ISSUE_STATUS.OPEN ? "미해결" : "해결됨"} · ${record.universityName || record.siteKey} · ${record.academicCycle} · ${new Date(record.updatedAt).toLocaleDateString("ko-KR")}`;
    const source = document.createElement("a");
    source.href = record.sourceUrl;
    source.target = "_blank";
    source.rel = "noreferrer";
    source.textContent = "기록한 페이지";
    const actions = document.createElement("div");
    actions.className = "issue-note__actions";
    const statusButton = document.createElement("button");
    statusButton.className = "button button--secondary button--compact";
    statusButton.type = "button";
    statusButton.textContent = record.status === ISSUE_STATUS.OPEN ? "해결됨" : "다시 열기";
    statusButton.addEventListener("click", () => void changeIssueStatus(record));
    const editButton = document.createElement("button");
    editButton.className = "button button--secondary button--compact";
    editButton.type = "button";
    editButton.textContent = "수정";
    editButton.addEventListener("click", () => beginIssueEdit(record));
    const deleteButton = document.createElement("button");
    deleteButton.className = "text-button text-button--danger";
    deleteButton.type = "button";
    deleteButton.textContent = "삭제";
    deleteButton.addEventListener("click", () => void removeIssue(record));
    actions.append(statusButton, editButton, deleteButton);
    item.append(note, meta, source, actions);
    return item;
  });
  elements.issueList.replaceChildren(...items);
  elements.exportIssuesButton.disabled = allRecords.length === 0;
  if (!canPersistIssues()) {
    elements.issueStatus.textContent = currentIssueNoteState?.unsupportedSchema ? "더 최신 형식의 문제 기록은 수정할 수 없습니다." : "문제 기록 저장소를 안전하게 읽지 못했습니다.";
  }
}

function beginIssueEdit(record) {
  if (!canPersistIssues()) return;
  editingIssueNoteId = record.id;
  elements.issueNoteInput.value = record.note;
  elements.cancelIssueEditButton.hidden = false;
  elements.saveIssueButton.textContent = "수정 저장";
  elements.issueNoteInput.focus();
}

async function persistIssue(event) {
  event.preventDefault();
  if (isSavingIssue || !canPersistIssues()) return;
  const note = elements.issueNoteInput.value.trim();
  const existing = currentIssueNoteState.store.records.find((record) => record.id === editingIssueNoteId);
  const context = getIssueContext();
  if (!note || (!existing && !context)) {
    elements.issueStatus.textContent = "문제 내용을 입력해주세요.";
    return;
  }
  isSavingIssue = true;
  renderIssueNotes();
  try {
    const record = existing ? updateIssueNoteRecord(existing, note) : createIssueNoteRecord({ ...context, note });
    const nextStore = upsertIssueNoteRecord(currentIssueNoteState.store, record);
    const stored = await saveIssueNoteStore(nextStore);
    currentIssueNoteState = { ...currentIssueNoteState, store: stored, invalidRecordCount: 0 };
    resetIssueEditor({ keepStatus: true });
    elements.issueStatus.textContent = existing ? "문제 기록을 수정했습니다." : "문제 기록을 저장했습니다.";
  } catch {
    elements.issueStatus.textContent = "문제 기록을 저장하지 못했습니다. 기존 기록은 유지됩니다.";
  } finally {
    isSavingIssue = false;
    renderIssueNotes();
  }
}

async function changeIssueStatus(record) {
  if (!canPersistIssues()) return;
  try {
    const status = record.status === ISSUE_STATUS.OPEN ? ISSUE_STATUS.RESOLVED : ISSUE_STATUS.OPEN;
    const nextStore = upsertIssueNoteRecord(currentIssueNoteState.store, setIssueNoteStatus(record, status));
    const stored = await saveIssueNoteStore(nextStore);
    currentIssueNoteState = { ...currentIssueNoteState, store: stored };
    renderIssueNotes();
  } catch { elements.issueStatus.textContent = "상태를 변경하지 못했습니다."; }
}

async function removeIssue(record) {
  if (!canPersistIssues() || !window.confirm("이 문제 기록을 완전히 삭제할까요?")) return;
  try {
    const nextStore = deleteIssueNoteRecord(currentIssueNoteState.store, record.id);
    const stored = await saveIssueNoteStore(nextStore);
    currentIssueNoteState = { ...currentIssueNoteState, store: stored };
    if (editingIssueNoteId === record.id) resetIssueEditor();
    renderIssueNotes();
  } catch { elements.issueStatus.textContent = "문제 기록을 삭제하지 못했습니다."; }
}

function downloadTextFile(text, fileName, mimeType) {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function exportIssues() {
  try {
    const now = new Date();
    downloadTextFile(
      serializeIssueNotesJson(currentIssueNoteState.store, now),
      `admission-issues-${localDateString(now)}.json`,
      "application/json;charset=utf-8"
    );
    elements.toolsStatus.textContent = "문제 기록 JSON을 준비했습니다.";
  } catch { elements.toolsStatus.textContent = "문제 기록을 내보내지 못했습니다."; }
}

function renderMemoBackupState() {
  const records = currentMemoState?.store?.records ?? [];
  const available = Boolean(
    currentMemoState?.persisted &&
    !currentMemoState.unsupportedSchema &&
    currentMemoState.invalidRecordCount === 0
  );
  elements.memoBackupCount.textContent = `${records.length}`;
  elements.exportMemosButton.disabled = !available || records.length === 0;
  elements.importMemosButton.disabled = !available;
}

function exportMemos() {
  try {
    const now = new Date();
    downloadTextFile(
      serializeCommonMemoBackup(currentMemoState.store, now),
      `admission-memos-${localDateString(now)}.json`,
      "application/json;charset=utf-8"
    );
    elements.toolsStatus.textContent = `${currentMemoState.store.records.length}개 메모 백업을 준비했습니다.`;
  } catch (error) {
    elements.toolsStatus.textContent = error?.message || "메모 백업을 내보내지 못했습니다.";
  }
}

async function importMemos(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  if (file.size > 5_000_000) {
    elements.toolsStatus.textContent = "5MB 이하의 메모 백업 JSON을 선택해주세요.";
    return;
  }
  elements.importMemosButton.disabled = true;
  try {
    const imported = parseCommonMemoBackup(await file.text());
    const merged = mergeCommonMemoStores(currentMemoState.store, imported);
    const stored = await saveCommonMemoStore(merged.store);
    currentMemoState = {
      ...currentMemoState,
      store: stored,
      recovered: false,
      migrated: false,
      invalidRecordCount: 0
    };
    renderAnalysis();
    elements.toolsStatus.textContent = `메모 백업을 가져왔습니다. 추가 ${merged.added}개 · 업데이트 ${merged.updated}개 · 기존 유지 ${merged.kept}개`;
  } catch (error) {
    elements.toolsStatus.textContent = error?.message || "메모 백업을 가져오지 못했습니다.";
  } finally {
    renderMemoBackupState();
  }
}

elements.openToolsButton.addEventListener("click", () => {
  renderIssueNotes();
  renderMemoBackupState();
  elements.toolsDialog.showModal();
  elements.closeToolsButton.focus();
});
elements.closeToolsButton.addEventListener("click", () => elements.toolsDialog.close());
elements.openIssueManagerButton.addEventListener("click", () => {
  elements.toolsDialog.close();
  resetIssueEditor();
  renderIssueNotes();
  elements.issueDialog.showModal();
  elements.issueNoteInput.focus();
});
elements.exportIssuesButton.addEventListener("click", exportIssues);
elements.exportMemosButton.addEventListener("click", exportMemos);
elements.importMemosButton.addEventListener("click", () => {
  elements.importMemosInput.value = "";
  elements.importMemosInput.click();
});
elements.importMemosInput.addEventListener("change", importMemos);
elements.hideKnownWidgetsInput.addEventListener("change", async () => {
  const previous = currentWidgetPreferences;
  currentWidgetPreferences = { ...previous, hideKnownWidgets: elements.hideKnownWidgetsInput.checked };
  try {
    currentWidgetPreferences = await saveWidgetPreferences(currentWidgetPreferences);
    await applyKnownWidgetPreference();
  } catch {
    currentWidgetPreferences = previous;
    elements.hideKnownWidgetsInput.checked = previous.hideKnownWidgets;
    elements.toolsStatus.textContent = "위젯 설정을 저장하지 못했습니다.";
  }
});
elements.editBasisButton.addEventListener("click", () => {
  populateBasisForm();
  elements.basisDialog.showModal();
  elements.academicCycleInput.focus();
});
elements.closeBasisButton.addEventListener("click", closeBasisDialog);
elements.cancelBasisButton.addEventListener("click", closeBasisDialog);
elements.basisForm.addEventListener("submit", persistBasisFromForm);
elements.analyzeButton.addEventListener("click", analyzeCurrentPage);
elements.editUniversityMemoButton.addEventListener("click", () => showMemoDialog("", getMemoRecords("")[0]));
elements.closeMemoButton.addEventListener("click", () => !isSavingMemo && elements.memoDialog.close());
elements.cancelMemoButton.addEventListener("click", () => !isSavingMemo && elements.memoDialog.close());
elements.memoForm.addEventListener("submit", persistMemo);
elements.memoConfirmedInput.addEventListener("change", renderConfirmationFields);
elements.memoUnverifiedInput.addEventListener("change", renderConfirmationFields);
elements.memoTodayButton.addEventListener("click", () => { elements.memoConfirmedDateInput.value = localDateString(); });
elements.deleteMemoButton.addEventListener("click", deleteEditingMemo);
elements.closeIssueButton.addEventListener("click", () => elements.issueDialog.close());
elements.issueForm.addEventListener("submit", persistIssue);
elements.cancelIssueEditButton.addEventListener("click", () => { resetIssueEditor(); renderIssueNotes(); });
elements.showResolvedInput.addEventListener("change", renderIssueNotes);

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "ACTIVE_TAB_CONTEXT") {
    void applyTab(
      { id: message.tab?.tabId, title: message.tab?.title, url: message.tab?.url },
      { autoAnalyze: true }
    );
  }
});
chrome.tabs.onActivated?.addListener(scheduleTabRefresh);
chrome.tabs.onUpdated?.addListener((tabId, changeInfo) => {
  if (tabId === currentTab?.id && (changeInfo.url || changeInfo.status === "complete")) scheduleTabRefresh();
});

for (const month of INTAKE_MONTHS) {
  const option = document.createElement("option");
  option.value = String(month);
  option.textContent = `${month}월`;
  elements.intakeMonthInput.append(option);
}

const [appState, analysisState, memoState, issueState, widgetState] = await Promise.all([
  loadAppState(),
  loadAnalysisState(),
  loadCommonMemoState(),
  loadIssueNoteState(),
  loadWidgetPreferences()
]);
currentBasis = appState.basis;
currentAnalysis = analysisState.analysis;
currentMemoState = memoState;
currentIssueNoteState = issueState;
currentWidgetPreferences = widgetState.preferences;
elements.hideKnownWidgetsInput.checked = currentWidgetPreferences.hideKnownWidgets;
renderBasis();
renderIssueNotes();
if (memoState.migrated || issueState.migrated) {
  elements.toolsStatus.textContent = "기존 메모와 문제 기록을 새 형식으로 안전하게 변환했습니다.";
}
await refreshCurrentPage({ autoAnalyze: true });
