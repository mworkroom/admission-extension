import {
  createBasis,
  formatBasis,
  INTAKE_MONTHS
} from "../shared/basis.js";
import { EXTRACTION_STATUS, STATUS_META } from "../shared/extraction-status.js";
import { FIELDS } from "../shared/fields.js";
import {
  COMMON_MEMO_FIELD_KEYS,
  MEMO_COMPARISON_STATUS,
  MEMO_VERIFICATION_STATUS,
  comparePageValueToMemo,
  createCommonMemoRecord,
  getMemoVerificationStatus,
  resolveCommonMemos,
  shouldHideMissingPageResultForConfirmedMemo,
  verifyCommonMemoForCycle
} from "../shared/common-memos.js";
import {
  deleteCommonMemoRecord,
  loadCommonMemoState,
  saveCommonMemoStore,
  upsertCommonMemoRecord
} from "../shared/common-memo-storage.js";
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
import { readKclPage } from "../content/read-kcl-page.js";
import { readQmulPage } from "../content/read-qmul-page.js";
import { readSoasPage } from "../content/read-soas-page.js";

const PAGE_READERS = Object.freeze({
  kcl: readKclPage,
  soas: readSoasPage,
  qmul: readQmulPage
});

const MEMO_FIELD_LABELS = Object.freeze({
  englishRequirements: "English Requirements",
  applicationFee: "Application Fee",
  universityApplicationDeadline: "University Application Deadline",
  reference: "Reference",
  sopGuideline: "SOP Guideline"
});

const MEMO_VALUE_PLACEHOLDERS = Object.freeze({
  englishRequirements:
    "예: 학교 전체 IELTS 조건 동일: IELTS 6.5 overall, 각 영역 6.0 이상",
  applicationFee: "예: 대학 전체 Application Fee: £85",
  universityApplicationDeadline:
    "예: 대학 전체 지원 마감일: 25 July 2026",
  reference: "예: References are optional.",
  sopGuideline:
    "예: Supporting statement required, maximum 4,000 characters"
});

const MEMO_SCOPE_LABELS = Object.freeze({
  university: "대학 공통",
  school: "스쿨",
  faculty: "학부"
});

const MEMO_VERIFICATION_META = Object.freeze({
  [MEMO_VERIFICATION_STATUS.CONFIRMED]: {
    symbol: "✓",
    label: "이번 학년도 확인"
  },
  [MEMO_VERIFICATION_STATUS.NEEDS_REVIEW]: {
    symbol: "!",
    label: "재확인 필요"
  },
  [MEMO_VERIFICATION_STATUS.CHANGED_AFTER_VERIFICATION]: {
    symbol: "!",
    label: "확인 후 변경"
  },
  [MEMO_VERIFICATION_STATUS.UNVERIFIED]: {
    symbol: "–",
    label: "확인 전"
  }
});

const elements = {
  basisCycle: document.querySelector("#basis-cycle"),
  basisMode: document.querySelector("#basis-mode"),
  basisStatus: document.querySelector("#basis-status"),
  nonSeptemberWarning: document.querySelector("#non-september-warning"),
  editBasisButton: document.querySelector("#edit-basis-button"),
  resetSeptemberButton: document.querySelector("#reset-september-button"),
  pageSummary: document.querySelector("#page-summary"),
  refreshPageButton: document.querySelector("#refresh-page-button"),
  analyzeButton: document.querySelector("#analyze-button"),
  analysisSummary: document.querySelector("#analysis-summary"),
  staleNotice: document.querySelector("#stale-notice"),
  fieldList: document.querySelector("#field-list"),
  basisDialog: document.querySelector("#basis-dialog"),
  basisForm: document.querySelector("#basis-form"),
  closeDialogButton: document.querySelector("#close-dialog-button"),
  cancelDialogButton: document.querySelector("#cancel-dialog-button"),
  saveBasisButton: document.querySelector("#save-basis-button"),
  dialogError: document.querySelector("#dialog-error"),
  academicCycleInput: document.querySelector("#academic-cycle-input"),
  intakeMonthInput: document.querySelector("#intake-month-input"),
  intakeYearInput: document.querySelector("#intake-year-input"),
  studyModeInput: document.querySelector("#study-mode-input"),
  feeStatusInput: document.querySelector("#fee-status-input"),
  memoDialog: document.querySelector("#memo-dialog"),
  memoForm: document.querySelector("#memo-form"),
  memoDialogEyebrow: document.querySelector("#memo-dialog-eyebrow"),
  memoDialogTitle: document.querySelector("#memo-dialog-title"),
  closeMemoDialogButton: document.querySelector("#close-memo-dialog-button"),
  cancelMemoDialogButton: document.querySelector("#cancel-memo-dialog-button"),
  saveMemoButton: document.querySelector("#save-memo-button"),
  memoFieldLabel: document.querySelector("#memo-field-label"),
  memoScopeLabel: document.querySelector("#memo-scope-label"),
  memoValueInput: document.querySelector("#memo-value-input"),
  memoSourceUrlInput: document.querySelector("#memo-source-url-input"),
  memoSourceLabelInput: document.querySelector("#memo-source-label-input"),
  memoDialogError: document.querySelector("#memo-dialog-error"),
  memoDeleteDialog: document.querySelector("#memo-delete-dialog"),
  memoDeleteForm: document.querySelector("#memo-delete-form"),
  closeMemoDeleteDialogButton: document.querySelector(
    "#close-memo-delete-dialog-button"
  ),
  cancelMemoDeleteDialogButton: document.querySelector(
    "#cancel-memo-delete-dialog-button"
  ),
  confirmMemoDeleteButton: document.querySelector(
    "#confirm-memo-delete-button"
  ),
  memoDeleteFieldLabel: document.querySelector("#memo-delete-field-label"),
  memoDeleteScopeLabel: document.querySelector("#memo-delete-scope-label"),
  memoDeleteValue: document.querySelector("#memo-delete-value"),
  memoDeleteVerificationSummary: document.querySelector(
    "#memo-delete-verification-summary"
  ),
  memoDeleteDialogError: document.querySelector("#memo-delete-dialog-error")
};

let currentBasis = null;
let currentTab = null;
let currentAnalysis = null;
let currentMemoState = null;
let editingMemoId = "";
let editingMemoFieldKey = "";
let deletingMemoId = "";
let memoActionStatus = null;
let isAnalyzing = false;

function renderBasis(basis) {
  const formatted = formatBasis(basis);
  elements.basisCycle.textContent = formatted.cycleAndIntake;
  elements.basisMode.textContent = formatted.modeAndFee;
  elements.nonSeptemberWarning.hidden = basis.intakeMonth === 9;
}

function populateBasisForm(basis) {
  elements.academicCycleInput.value = basis.academicCycle;
  elements.intakeMonthInput.value = String(basis.intakeMonth);
  elements.intakeYearInput.value = String(basis.intakeYear);
  elements.studyModeInput.value = basis.studyMode;
  elements.feeStatusInput.value = basis.feeStatus;
  elements.dialogError.textContent = "";
}

function showBasisDialog() {
  populateBasisForm(currentBasis);
  elements.basisDialog.showModal();
  elements.academicCycleInput.focus();
}

function setBasisSaving(saving) {
  elements.saveBasisButton.disabled = saving;
  elements.cancelDialogButton.disabled = saving;
  elements.closeDialogButton.disabled = saving;
  elements.saveBasisButton.textContent = saving ? "저장 중…" : "기준 저장";
}

function getCurrentUniversityName() {
  return (
    currentAnalysis?.fields?.find((field) => field.key === "university")
      ?.value || ""
  ).trim();
}

function getCurrentAnalysisField(fieldKey) {
  return (
    currentAnalysis?.fields?.find((field) => field.key === fieldKey) ?? null
  );
}

function canManageCommonMemos() {
  return Boolean(
    currentMemoState?.persisted &&
      !currentMemoState.unsupportedSchema &&
      currentMemoState.invalidRecordCount === 0 &&
      currentAnalysis &&
      currentTab &&
      currentAnalysis.page.url === currentTab.url &&
      getCurrentUniversityName()
  );
}

function setMemoSaving(saving) {
  elements.saveMemoButton.disabled = saving;
  elements.cancelMemoDialogButton.disabled = saving;
  elements.closeMemoDialogButton.disabled = saving;
  elements.memoValueInput.disabled = saving;
  elements.memoSourceUrlInput.disabled = saving;
  elements.memoSourceLabelInput.disabled = saving;
  elements.saveMemoButton.textContent = saving ? "저장 중…" : "저장";
}

function closeMemoDialog() {
  if (!elements.saveMemoButton.disabled) {
    elements.memoDialog.close();
  }
}

function setMemoDeleting(deleting) {
  elements.confirmMemoDeleteButton.disabled = deleting;
  elements.cancelMemoDeleteDialogButton.disabled = deleting;
  elements.closeMemoDeleteDialogButton.disabled = deleting;
  elements.confirmMemoDeleteButton.textContent = deleting
    ? "삭제 중…"
    : "삭제";
}

function closeMemoDeleteDialog() {
  if (!elements.confirmMemoDeleteButton.disabled) {
    elements.memoDeleteDialog.close();
  }
}

function showMemoDeleteDialog(record) {
  const currentRecord = currentMemoState?.store.records.find(
    (item) => item.id === record.id
  );
  if (!canManageCommonMemos() || !currentRecord) {
    return;
  }

  const verificationCount = Object.keys(
    currentRecord.verificationByCycle ?? {}
  ).length;
  deletingMemoId = currentRecord.id;
  elements.memoDeleteFieldLabel.textContent =
    MEMO_FIELD_LABELS[currentRecord.fieldKey] ?? currentRecord.fieldKey;
  elements.memoDeleteScopeLabel.textContent =
    `${MEMO_SCOPE_LABELS[currentRecord.scopeType] ?? currentRecord.scopeType} · ` +
    currentRecord.scopeLabel;
  elements.memoDeleteValue.textContent = currentRecord.value;
  elements.memoDeleteVerificationSummary.textContent =
    verificationCount > 0
      ? `이 확인한 사항과 학년도별 확인 기록 ${verificationCount}개가 함께 삭제됩니다.`
      : "이 확인한 사항을 삭제하면 현재 값을 다시 입력해야 합니다.";
  elements.memoDeleteDialogError.textContent = "";
  elements.memoDeleteDialog.showModal();
  elements.cancelMemoDeleteDialogButton.focus();
}

function showMemoDialog(fieldKey, record = null) {
  if (!canManageCommonMemos() || !COMMON_MEMO_FIELD_KEYS.includes(fieldKey)) {
    return;
  }

  const field = getCurrentAnalysisField(fieldKey);
  const universityName = getCurrentUniversityName();
  const defaultSourceUrl = isSafeHttpUrl(field?.source?.url)
    ? field.source.url
    : currentTab.url;

  editingMemoId = record?.id || "";
  editingMemoFieldKey = fieldKey;
  elements.memoDialogEyebrow.textContent =
    MEMO_FIELD_LABELS[fieldKey] ?? fieldKey;
  elements.memoDialogTitle.textContent = record
    ? "확인한 사항 수정"
    : "확인한 사항 추가";
  elements.memoFieldLabel.textContent =
    MEMO_FIELD_LABELS[fieldKey] ?? fieldKey;
  elements.memoScopeLabel.textContent = `대학 전체 · ${universityName}`;
  elements.memoValueInput.value = record?.value || "";
  elements.memoValueInput.placeholder =
    MEMO_VALUE_PLACEHOLDERS[fieldKey] || "확인한 내용을 입력하세요.";
  elements.memoSourceUrlInput.value = record?.sourceUrl || defaultSourceUrl;
  elements.memoSourceLabelInput.value =
    record?.sourceLabel ||
    `${universityName} ${MEMO_FIELD_LABELS[fieldKey] ?? fieldKey}`;
  elements.memoDialogError.textContent = "";
  elements.memoDialog.showModal();
  elements.memoValueInput.focus();
}

function isChromeWebStore(url) {
  return (
    url.hostname === "chromewebstore.google.com" ||
    (url.hostname === "chrome.google.com" && url.pathname.startsWith("/webstore"))
  );
}

function inspectTab(tab) {
  if (!tab || typeof tab.url !== "string" || tab.url.length === 0) {
    return {
      accessible: false,
      analyzable: false,
      title: tab?.title || "현재 페이지 정보를 읽을 수 없음",
      url: "",
      message:
        "현재 탭 주소를 읽을 수 없습니다. 지원 과정 페이지에서 확장 아이콘을 다시 눌러주세요."
    };
  }

  let url;
  try {
    url = new URL(tab.url);
  } catch {
    return {
      accessible: false,
      analyzable: false,
      title: tab.title || "현재 페이지 정보를 읽을 수 없음",
      url: tab.url,
      message: "현재 탭의 주소 형식을 확인할 수 없습니다."
    };
  }

  if (isChromeWebStore(url)) {
    return {
      accessible: false,
      analyzable: false,
      title: tab.title || "Chrome Web Store",
      url: tab.url,
      message:
        "Chrome Web Store는 Chrome 보안 제한으로 확장 프로그램이 내용을 읽을 수 없습니다."
    };
  }

  if (url.protocol === "chrome:") {
    return {
      accessible: false,
      analyzable: false,
      title: tab.title || "Chrome 내부 페이지",
      url: tab.url,
      message:
        "chrome://extensions 같은 Chrome 내부 페이지는 보안 제한으로 분석할 수 없습니다. 이 안내가 Phase 0의 ‘제한 페이지 안내’입니다."
    };
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    return {
      accessible: false,
      analyzable: false,
      title: tab.title || "지원하지 않는 페이지",
      url: tab.url,
      message: "이 주소 형식은 Chrome 보안 제한으로 분석할 수 없습니다."
    };
  }

  const site = getSupportedSite(tab.url);
  const analyzable = Boolean(site);
  return {
    accessible: true,
    analyzable,
    siteKey: site?.key ?? "",
    title: tab.title || "제목 없는 페이지",
    url: tab.url,
    message: analyzable
      ? `${site.label} 과정 페이지를 분석할 수 있습니다.`
      : "현재 KCL, SOAS, QMUL 과정 페이지를 지원합니다."
  };
}

function renderPage(tab) {
  const page = inspectTab(tab);
  const fragment = document.createDocumentFragment();

  const title = document.createElement("p");
  title.className = page.accessible ? "page-title" : "unsupported-title";
  title.textContent = page.title;
  fragment.append(title);

  if (page.url) {
    const label = document.createElement("label");
    label.className = "url-label";
    label.textContent = "전체 URL";

    const urlValue = document.createElement("input");
    urlValue.className = "url-value";
    urlValue.type = "text";
    urlValue.readOnly = true;
    urlValue.value = page.url;
    urlValue.title = page.url;
    urlValue.setAttribute("aria-label", "현재 페이지 전체 URL");
    label.append(urlValue);
    fragment.append(label);
  }

  const message = document.createElement("p");
  message.className = page.analyzable ? "supported-message" : "unsupported-message";
  message.textContent = page.message;
  fragment.append(message);

  elements.pageSummary.replaceChildren(fragment);
  elements.pageSummary.setAttribute("aria-busy", "false");
  elements.analyzeButton.disabled = !page.analyzable || isAnalyzing;
}

function renderPageLoading() {
  const message = document.createElement("p");
  message.className = "loading-message";
  message.textContent = "활성 탭을 확인하고 있습니다.";
  elements.pageSummary.replaceChildren(message);
  elements.pageSummary.setAttribute("aria-busy", "true");
}

function makeDefaultFieldResult(field, status = EXTRACTION_STATUS.NOT_ANALYZED) {
  return {
    ...field,
    status,
    value: "",
    detail:
      status === EXTRACTION_STATUS.ANALYZING
        ? "현재 페이지에서 근거를 찾고 있습니다."
        : "아직 현재 페이지를 분석하지 않았습니다.",
    nextAction: "",
    source: null,
    copyText: "",
    copyState: "idle"
  };
}

function createStatusBadge(status) {
  const meta = STATUS_META[status] ?? STATUS_META[EXTRACTION_STATUS.NOT_ANALYZED];
  const badge = document.createElement("span");
  badge.className = `status-badge status-badge--${status}`;

  const symbol = document.createElement("span");
  symbol.className = "status-badge__symbol";
  symbol.setAttribute("aria-hidden", "true");
  symbol.textContent = meta.symbol;

  const label = document.createElement("span");
  label.textContent = meta.label;
  badge.append(symbol, label);
  return badge;
}

function createSourceDetails(source) {
  const details = document.createElement("details");
  details.className = "source-details";

  const summary = document.createElement("summary");
  summary.textContent = source.summaryLabel || "출처 확인";
  details.append(summary);

  if (source.sectionLabel) {
    const section = document.createElement("p");
    section.className = "source-details__section";
    section.textContent = source.sectionLabel;
    details.append(section);
  }

  if (source.excerpt) {
    const excerpt = document.createElement("blockquote");
    excerpt.textContent = source.excerpt;
    details.append(excerpt);
  }

  try {
    const url = new URL(source.url);
    if (["http:", "https:"].includes(url.protocol)) {
      const link = document.createElement("a");
      link.href = url.href;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = source.pageTitle || "원문 페이지 열기";
      details.append(link);
    }
  } catch {
    // 저장된 출처 URL이 잘못된 경우 링크를 만들지 않는다.
  }

  return details;
}

async function copyField(field, button) {
  if (!field.copyText) {
    return;
  }

  const original = button.textContent;
  try {
    await navigator.clipboard.writeText(field.copyText);
    button.textContent = "복사됨";
    button.classList.add("copy-button--copied");
    await appendAnalysisEvent({
      type: "copy_succeeded",
      fieldKey: field.key
    });
  } catch (error) {
    button.textContent = "복사 실패";
    await appendAnalysisEvent({
      type: "copy_failed",
      fieldKey: field.key,
      detail: error?.message || ""
    }).catch(() => {});
  } finally {
    window.setTimeout(() => {
      button.textContent = original;
      button.classList.remove("copy-button--copied");
    }, 1600);
  }
}

function createMemoStatusBadge(status) {
  const meta =
    MEMO_VERIFICATION_META[status] ??
    MEMO_VERIFICATION_META[MEMO_VERIFICATION_STATUS.UNVERIFIED];
  const badge = document.createElement("span");
  badge.className = `memo-status memo-status--${status}`;

  const symbol = document.createElement("span");
  symbol.className = "memo-status__symbol";
  symbol.setAttribute("aria-hidden", "true");
  symbol.textContent = meta.symbol;

  const label = document.createElement("span");
  label.textContent = meta.label;
  badge.append(symbol, label);
  return badge;
}

function getLatestMemoVerification(record) {
  return Object.entries(record.verificationByCycle ?? {})
    .map(([academicCycle, verification]) => ({
      academicCycle,
      ...verification
    }))
    .sort(
      (left, right) =>
        Date.parse(right.verifiedAt) - Date.parse(left.verifiedAt)
    )[0];
}

function getMemoComparisonCopy(status) {
  if (status === MEMO_COMPARISON_STATUS.SAME) {
    return {
      label: "현재 페이지 내용과 같음",
      detail: ""
    };
  }
  if (status === MEMO_COMPARISON_STATUS.DIFFERENT) {
    return {
      label: "현재 페이지 안내와 다름",
      detail: "위의 페이지 값과 확인한 사항을 함께 확인하세요."
    };
  }
  if (status === MEMO_COMPARISON_STATUS.PAGE_MISSING) {
    return {
      label: "페이지에는 구체적인 값 없음",
      detail: "아래 확인한 사항을 함께 참고하세요."
    };
  }
  return {
    label: "비교할 값 없음",
    detail: "현재 페이지와 공통 메모를 비교할 수 없습니다."
  };
}

function isSafeHttpUrl(value) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function createDirectFieldLink(field) {
  if (
    !COMMON_MEMO_FIELD_KEYS.includes(field.key) ||
    !/별도.*페이지/i.test(field.value || "") ||
    !isSafeHttpUrl(field.source?.url)
  ) {
    return null;
  }

  const link = document.createElement("a");
  link.className = "field-card__direct-link";
  link.href = field.source.url;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent =
    field.key === "englishRequirements"
      ? "English requirements 페이지 열기"
      : "안내 페이지 열기";
  return link;
}

async function copyCommonMemo(record, button) {
  const original = button.textContent;
  try {
    await navigator.clipboard.writeText(record.value);
    button.textContent = "복사됨";
    button.classList.add("copy-button--copied");
    await appendAnalysisEvent({
      type: "common_memo_copy_succeeded",
      fieldKey: record.fieldKey
    });
  } catch (error) {
    button.textContent = "복사 실패";
    await appendAnalysisEvent({
      type: "common_memo_copy_failed",
      fieldKey: record.fieldKey,
      detail: error?.message || ""
    }).catch(() => {});
  } finally {
    window.setTimeout(() => {
      button.textContent = original;
      button.classList.remove("copy-button--copied");
    }, 1600);
  }
}

function getComparablePageValue(field) {
  if (/별도.*페이지/i.test(field?.value || "")) {
    return "";
  }
  if (["reference", "sopGuideline"].includes(field?.key)) {
    return (
      field?.source?.excerpt ||
      field?.copyText ||
      field?.detail ||
      field?.value ||
      ""
    );
  }
  return field?.value;
}

function createInlineMemo(record, pageField) {
  const verificationStatus = getMemoVerificationStatus(
    record,
    currentBasis.academicCycle
  );
  const comparisonStatus = comparePageValueToMemo(
    getComparablePageValue(pageField),
    record.value
  );
  const hideMissingPageComparison =
    verificationStatus === MEMO_VERIFICATION_STATUS.CONFIRMED &&
    comparisonStatus === MEMO_COMPARISON_STATUS.PAGE_MISSING;
  const comparison = getMemoComparisonCopy(comparisonStatus);
  const latestVerification = getLatestMemoVerification(record);

  const memo = document.createElement("div");
  memo.className = `inline-memo inline-memo--${verificationStatus}`;
  memo.setAttribute("role", "group");
  memo.setAttribute("aria-label", `${pageField.label} 확인한 사항`);

  const header = document.createElement("div");
  header.className = "inline-memo__header";
  const title = document.createElement("p");
  title.className = "inline-memo__title";
  title.textContent = "확인한 사항";
  header.append(title, createMemoStatusBadge(verificationStatus));

  const scope = document.createElement("p");
  scope.className = "inline-memo__scope";
  scope.textContent = `${MEMO_SCOPE_LABELS[record.scopeType] ?? record.scopeType} · ${record.scopeLabel}`;

  const value = document.createElement("p");
  value.className = "inline-memo__value";
  value.textContent = record.value;

  const comparisonBox = document.createElement("div");
  comparisonBox.className = `inline-memo__comparison inline-memo__comparison--${comparisonStatus}`;
  const comparisonLabel = document.createElement("strong");
  comparisonLabel.textContent = comparison.label;
  comparisonBox.append(comparisonLabel);
  if (comparison.detail) {
    const comparisonDetail = document.createElement("p");
    comparisonDetail.textContent = comparison.detail;
    comparisonBox.append(comparisonDetail);
  }

  const meta = document.createElement("p");
  meta.className = "inline-memo__meta";
  if (latestVerification) {
    const verifiedDate = new Date(
      latestVerification.verifiedAt
    ).toLocaleDateString("ko-KR");
    meta.textContent = `최근 확인 ${latestVerification.academicCycle} · ${verifiedDate}`;
  } else {
    meta.textContent = `${currentBasis.academicCycle} 확인 기록 없음`;
  }

  const footer = document.createElement("div");
  footer.className = "inline-memo__footer";
  footer.append(
    createSourceDetails({
      url: record.sourceUrl,
      pageTitle: record.sourceLabel || "공통 메모 출처 열기",
      sectionLabel: `${record.scopeLabel} · 공통 메모`,
      excerpt: record.value,
      summaryLabel: "메모 출처 확인"
    })
  );

  const actions = document.createElement("div");
  actions.className = "inline-memo__actions";

  if (
    canManageCommonMemos() &&
    verificationStatus !== MEMO_VERIFICATION_STATUS.CONFIRMED
  ) {
    const verifyButton = document.createElement("button");
    verifyButton.type = "button";
    verifyButton.className = "memo-verify-button";
    verifyButton.textContent = "이번 학년도 확인 완료";
    verifyButton.setAttribute(
      "aria-label",
      `${currentBasis.academicCycle} 학년도 확인 완료`
    );
    verifyButton.addEventListener("click", () =>
      verifyCommonMemoForCurrentCycle(record, verifyButton)
    );
    actions.append(verifyButton);
  }

  if (canManageCommonMemos()) {
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "memo-edit-button";
    editButton.textContent = "수정";
    editButton.addEventListener("click", () =>
      showMemoDialog(record.fieldKey, record)
    );
    actions.append(editButton);
  }

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "copy-button";
  copyButton.textContent = "복사";
  copyButton.addEventListener("click", () =>
    copyCommonMemo(record, copyButton)
  );
  actions.append(copyButton);

  if (canManageCommonMemos()) {
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "memo-delete-button";
    deleteButton.textContent = "삭제";
    deleteButton.setAttribute(
      "aria-label",
      `${MEMO_FIELD_LABELS[record.fieldKey] ?? record.fieldKey} 확인한 사항 삭제`
    );
    deleteButton.addEventListener("click", () =>
      showMemoDeleteDialog(record)
    );
    actions.append(deleteButton);
  }
  footer.append(actions);

  memo.append(header, scope, value);
  if (!hideMissingPageComparison) {
    memo.append(comparisonBox);
  }
  memo.append(meta, footer);
  return memo;
}

function getInlineMemoRecords(fieldKey) {
  const analysisMatchesPage =
    currentAnalysis &&
    currentTab &&
    currentAnalysis.page.url === currentTab.url;

  if (
    !COMMON_MEMO_FIELD_KEYS.includes(fieldKey) ||
    !analysisMatchesPage ||
    !currentMemoState?.persisted ||
    currentMemoState.unsupportedSchema
  ) {
    return [];
  }

  return resolveCommonMemos(
    currentMemoState.store.records,
    { siteKey: currentAnalysis.siteKey },
    fieldKey
  );
}

function createInlineMemoStateNotice(fieldKey) {
  if (
    fieldKey !== "englishRequirements" ||
    !currentMemoState ||
    !currentAnalysis ||
    currentAnalysis.page.url !== currentTab?.url
  ) {
    return null;
  }

  let message = "";
  if (!currentMemoState.persisted) {
    message = "확인한 사항 저장소를 읽지 못했습니다.";
  } else if (currentMemoState.unsupportedSchema) {
    message =
      "더 새로운 형식의 확인한 사항입니다. 확장 프로그램 업데이트가 필요합니다.";
  } else if (currentMemoState.invalidRecordCount > 0) {
    message =
      `손상된 확인한 사항 ${currentMemoState.invalidRecordCount}개를 제외했습니다. ` +
      "저장값은 자동으로 덮어쓰지 않았습니다.";
  }

  if (!message) {
    return null;
  }

  const notice = document.createElement("p");
  notice.className = "inline-memo-state";
  notice.setAttribute("role", "status");
  notice.textContent = message;
  return notice;
}

function createMemoActionStatus(fieldKey) {
  if (!memoActionStatus || memoActionStatus.fieldKey !== fieldKey) {
    return null;
  }

  const status = document.createElement("p");
  status.className = memoActionStatus.error
    ? "memo-action-status memo-action-status--error"
    : "memo-action-status";
  status.setAttribute("role", "status");
  status.textContent = memoActionStatus.message;
  return status;
}

function createMemoAddButton(fieldKey) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "memo-add-button";
  button.textContent = "확인한 사항 추가";
  button.addEventListener("click", () => showMemoDialog(fieldKey));
  return button;
}

async function verifyCommonMemoForCurrentCycle(record, button) {
  const currentRecord = currentMemoState?.store.records.find(
    (item) => item.id === record.id
  );
  if (!canManageCommonMemos() || !currentRecord || !currentBasis) {
    return;
  }

  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = "저장 중…";
  memoActionStatus = null;

  try {
    const verifiedRecord = verifyCommonMemoForCycle(
      currentRecord,
      currentBasis.academicCycle
    );
    const nextStore = upsertCommonMemoRecord(
      currentMemoState.store,
      verifiedRecord
    );
    const stored = await saveCommonMemoStore(nextStore);
    currentMemoState = {
      ...currentMemoState,
      store: stored,
      invalidRecordCount: 0,
      recovered: false,
      persisted: true,
      error: null
    };
    memoActionStatus = {
      fieldKey: record.fieldKey,
      message: `${currentBasis.academicCycle} 학년도 확인을 완료했습니다.`
    };
    renderFields();
    await appendAnalysisEvent({
      type: "common_memo_verified",
      fieldKey: record.fieldKey,
      detail: currentBasis.academicCycle
    }).catch(() => {});
  } catch {
    button.disabled = false;
    button.textContent = originalLabel;
    memoActionStatus = {
      fieldKey: record.fieldKey,
      message:
        "학년도 확인 기록을 저장하지 못했습니다. 기존 내용은 유지됩니다.",
      error: true
    };
    renderFields();
  }
}

async function persistMemoDeletion() {
  const existingRecord = currentMemoState?.store.records.find(
    (record) => record.id === deletingMemoId
  );
  if (!canManageCommonMemos() || !existingRecord) {
    elements.memoDeleteDialogError.textContent =
      "삭제할 확인한 사항을 찾지 못했습니다. 창을 닫고 다시 시도해주세요.";
    return;
  }

  setMemoDeleting(true);
  let deleted = false;
  try {
    const nextStore = deleteCommonMemoRecord(
      currentMemoState.store,
      existingRecord.id
    );
    const stored = await saveCommonMemoStore(nextStore);
    currentMemoState = {
      ...currentMemoState,
      store: stored,
      invalidRecordCount: 0,
      recovered: false,
      persisted: true,
      error: null
    };
    memoActionStatus = {
      fieldKey: existingRecord.fieldKey,
      message: "확인한 사항을 삭제했습니다."
    };
    renderFields();
    deleted = true;
    await appendAnalysisEvent({
      type: "common_memo_deleted",
      fieldKey: existingRecord.fieldKey
    }).catch(() => {});
  } catch {
    elements.memoDeleteDialogError.textContent =
      "확인한 사항을 삭제하지 못했습니다. 기존 내용과 확인 기록은 유지됩니다.";
  } finally {
    setMemoDeleting(false);
    if (deleted) {
      elements.memoDeleteDialog.close();
    }
  }
}

function renderFields(options = {}) {
  const results = options.analyzing
    ? FIELDS.map((field) =>
        makeDefaultFieldResult(field, EXTRACTION_STATUS.ANALYZING)
      )
    : currentAnalysis?.fields ??
      FIELDS.map((field) => makeDefaultFieldResult(field));
  const fragment = document.createDocumentFragment();

  for (const field of results) {
    const memoRecords = getInlineMemoRecords(field.key);
    const hideMissingPageResult =
      !options.analyzing &&
      shouldHideMissingPageResultForConfirmedMemo(
        memoRecords,
        currentBasis?.academicCycle,
        getComparablePageValue(field)
      );
    const card = document.createElement("li");
    card.className = `field-card field-card--${
      hideMissingPageResult ? "memo-confirmed" : field.status
    }`;
    card.dataset.fieldKey = field.key;

    const header = document.createElement("div");
    header.className = "field-card__header";

    const title = document.createElement("h3");
    title.className = "field-card__title";
    title.textContent = field.label;
    header.append(title);
    if (!hideMissingPageResult) {
      header.append(createStatusBadge(field.status));
    }

    const body = document.createElement("div");
    body.className = "field-card__body";

    if (!hideMissingPageResult) {
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
    }

    const directLink = createDirectFieldLink(field);
    if (directLink) {
      body.append(directLink);
    }
    const isLinkOnlyValue = Boolean(directLink);

    const footer = document.createElement("div");
    footer.className = "field-card__footer";

    const hasFieldActions = !["university", "course"].includes(field.key);

    if (hasFieldActions && field.source && !isLinkOnlyValue) {
      footer.append(createSourceDetails(field.source));
    }

    if (
      hasFieldActions &&
      !isLinkOnlyValue &&
      field.copyText &&
      field.status === EXTRACTION_STATUS.FOUND
    ) {
      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.className = "copy-button";
      copyButton.textContent = "복사";
      copyButton.addEventListener("click", () => copyField(field, copyButton));
      footer.append(copyButton);
    }

    card.append(header, body);
    if (footer.childElementCount > 0) {
      card.append(footer);
    }

    const memoStateNotice = createInlineMemoStateNotice(field.key);
    if (memoStateNotice) {
      card.append(memoStateNotice);
    }

    const memoStatus = createMemoActionStatus(field.key);
    if (memoStatus) {
      card.append(memoStatus);
    }

    for (const record of memoRecords) {
      card.append(createInlineMemo(record, field));
    }

    if (
      COMMON_MEMO_FIELD_KEYS.includes(field.key) &&
      memoRecords.length === 0 &&
      canManageCommonMemos()
    ) {
      card.append(createMemoAddButton(field.key));
    }
    fragment.append(card);
  }

  elements.fieldList.replaceChildren(fragment);
}

function renderAnalysisSummary(message = "") {
  const fragment = document.createDocumentFragment();
  const analysisMatchesPage =
    currentAnalysis &&
    currentTab &&
    currentAnalysis.page.url === currentTab.url;

  if (isAnalyzing) {
    const status = document.createElement("p");
    status.className = "analysis-summary__lead";
    status.textContent = "11개 항목을 분석하고 있습니다…";
    fragment.append(status);
  } else if (message) {
    const status = document.createElement("p");
    status.className = "analysis-summary__lead analysis-summary__lead--error";
    status.textContent = message;
    fragment.append(status);
  } else if (analysisMatchesPage) {
    const summary = currentAnalysis.summary;
    const found = summary[EXTRACTION_STATUS.FOUND] ?? 0;
    const actionRequired =
      (summary[EXTRACTION_STATUS.ACTION_REQUIRED] ?? 0) +
      (summary[EXTRACTION_STATUS.MULTIPLE_CANDIDATES] ?? 0);
    const missing =
      (summary[EXTRACTION_STATUS.NOT_FOUND] ?? 0) +
      (summary[EXTRACTION_STATUS.SOURCE_ERROR] ?? 0);

    const lead = document.createElement("p");
    lead.className = "analysis-summary__lead";
    lead.textContent = `11개 중 ${found}개 확인`;

    const counts = document.createElement("p");
    counts.className = "analysis-summary__counts";
    counts.textContent = `선택·확인 필요 ${actionRequired} · 미확인 ${missing}`;

    const timestamp = document.createElement("time");
    timestamp.className = "analysis-summary__time";
    timestamp.dateTime = currentAnalysis.analyzedAt;
    timestamp.textContent = `마지막 분석 ${new Date(
      currentAnalysis.analyzedAt
    ).toLocaleString("ko-KR")}`;
    fragment.append(lead, counts, timestamp);
  } else {
    const status = document.createElement("p");
    status.className = "analysis-summary__lead";
    status.textContent = inspectTab(currentTab).analyzable
      ? "현재 페이지를 분석해 11개 항목을 채우세요."
      : "KCL, SOAS, QMUL 과정 페이지에서 분석할 수 있습니다.";
    fragment.append(status);
  }

  elements.analysisSummary.replaceChildren(fragment);
  elements.staleNotice.hidden = !(
    analysisMatchesPage && currentAnalysis?.stale
  );
}

function renderAnalysis(message = "") {
  renderAnalysisSummary(message);
  renderFields();
}

async function analyzeCurrentPage() {
  const page = inspectTab(currentTab);
  if (!page.analyzable || !Number.isInteger(currentTab?.id) || isAnalyzing) {
    return;
  }

  isAnalyzing = true;
  let analysisError = "";
  elements.analyzeButton.disabled = true;
  elements.analyzeButton.textContent = "분석 중…";
  renderAnalysisSummary();
  if (!currentAnalysis || currentAnalysis.page.url !== currentTab.url) {
    renderFields({ analyzing: true });
  }

  try {
    const site = getSupportedSite(currentTab.url);
    const reader = PAGE_READERS[site?.key];
    if (!site || !reader) {
      throw new Error("이 과정 페이지의 분석기를 찾지 못했습니다.");
    }
    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: reader
    });
    const payload = injectionResults?.[0]?.result;
    if (!payload) {
      throw new Error("페이지 분석 결과가 비어 있습니다.");
    }

    const analysis =
      site.key === "kcl"
        ? parseKclSnapshot(payload, currentBasis)
        : parseCourseSnapshot(payload, currentBasis);
    await saveAnalysis(analysis);
    currentAnalysis = analysis;
    renderAnalysis();
    await appendAnalysisEvent({
      type: "analysis_completed",
      detail: `${analysis.summary.found ?? 0}/${analysis.summary.total}`
    });
  } catch (error) {
    analysisError = `페이지를 분석하지 못했습니다. ${
      error?.message || "잠시 후 다시 시도하세요."
    }`;
    await appendAnalysisEvent({
      type: "analysis_failed",
      detail: error?.message || ""
    }).catch(() => {});
  } finally {
    isAnalyzing = false;
    elements.analyzeButton.textContent = "현재 페이지 분석";
    elements.analyzeButton.disabled = !inspectTab(currentTab).analyzable;
    renderAnalysis(analysisError);
  }
}

async function applyTab(tab, { autoAnalyze = false } = {}) {
  if (currentTab?.url !== tab?.url) {
    memoActionStatus = null;
  }
  currentTab = tab ?? null;
  renderPage(currentTab);

  if (!currentAnalysis || currentAnalysis.page.url !== currentTab?.url) {
    renderAnalysis();
  } else {
    renderAnalysis();
  }

  if (
    autoAnalyze &&
    inspectTab(currentTab).analyzable &&
    (!currentAnalysis ||
      currentAnalysis.page.url !== currentTab.url ||
      currentAnalysis.stale)
  ) {
    await analyzeCurrentPage();
  }
}

async function refreshCurrentPage({ autoAnalyze = false } = {}) {
  renderPageLoading();
  elements.refreshPageButton.disabled = true;
  elements.refreshPageButton.textContent = "확인 중…";

  try {
    const tabs = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });
    await applyTab(tabs[0], { autoAnalyze });
  } catch {
    await applyTab(null);
  } finally {
    elements.refreshPageButton.disabled = false;
    elements.refreshPageButton.textContent = "페이지 다시 확인";
  }
}

async function persistBasis(nextBasis, successMessage) {
  await saveBasis(nextBasis);
  currentBasis = nextBasis;
  renderBasis(currentBasis);
  elements.basisStatus.textContent = successMessage;

  if (currentAnalysis) {
    currentAnalysis = { ...currentAnalysis, stale: true };
  }
  renderAnalysis();

  try {
    if (currentAnalysis) {
      currentAnalysis = await markAnalysisStale(currentAnalysis);
    }
    await appendAnalysisEvent({
      type: "basis_changed",
      detail: `${nextBasis.academicCycle}/${nextBasis.studyMode}/${nextBasis.feeStatus}`
    });
  } catch {
    elements.basisStatus.textContent =
      "기준은 저장했지만 변경 이력을 완전히 저장하지 못했습니다. 다시 분석해주세요.";
  }
}

async function persistMemoFromDialog() {
  const universityName = getCurrentUniversityName();
  const value = elements.memoValueInput.value.trim();
  const sourceUrl = elements.memoSourceUrlInput.value.trim();
  const sourceLabel = elements.memoSourceLabelInput.value.trim();
  const existingRecord = currentMemoState?.store.records.find(
    (record) => record.id === editingMemoId
  );

  if (!universityName || !COMMON_MEMO_FIELD_KEYS.includes(editingMemoFieldKey)) {
    elements.memoDialogError.textContent =
      "현재 대학과 항목을 확인하지 못했습니다. 창을 닫고 페이지를 다시 분석해주세요.";
    return;
  }
  if (!value) {
    elements.memoDialogError.textContent = "확인한 사항을 입력해주세요.";
    elements.memoValueInput.focus();
    return;
  }
  if (!isSafeHttpUrl(sourceUrl)) {
    elements.memoDialogError.textContent =
      "출처 URL은 http:// 또는 https:// 주소로 입력해주세요.";
    elements.memoSourceUrlInput.focus();
    return;
  }
  if (editingMemoId && !existingRecord) {
    elements.memoDialogError.textContent =
      "수정할 확인한 사항을 찾지 못했습니다. 창을 닫고 다시 시도해주세요.";
    return;
  }

  let nextRecord;
  try {
    nextRecord = createCommonMemoRecord({
      siteKey: currentAnalysis.siteKey,
      universityName,
      scopeType: "university",
      scopeLabel: universityName,
      fieldKey: editingMemoFieldKey,
      value,
      sourceUrl,
      sourceLabel,
      verificationByCycle: existingRecord?.verificationByCycle ?? {}
    });
  } catch {
    elements.memoDialogError.textContent =
      "입력한 확인한 사항의 형식을 확인해주세요.";
    return;
  }

  if (
    !editingMemoId &&
    currentMemoState.store.records.some((record) => record.id === nextRecord.id)
  ) {
    elements.memoDialogError.textContent =
      "같은 항목의 대학 전체 확인 사항이 이미 있습니다. 기존 내용의 수정 버튼을 사용해주세요.";
    return;
  }

  setMemoSaving(true);
  let saved = false;
  try {
    const nextStore = upsertCommonMemoRecord(
      currentMemoState.store,
      nextRecord
    );
    const stored = await saveCommonMemoStore(nextStore);
    currentMemoState = {
      ...currentMemoState,
      store: stored,
      invalidRecordCount: 0,
      recovered: false,
      persisted: true,
      error: null
    };
    memoActionStatus = {
      fieldKey: editingMemoFieldKey,
      message: existingRecord
        ? "확인한 사항을 수정했습니다."
        : "확인한 사항을 저장했습니다."
    };
    renderFields();
    saved = true;
    await appendAnalysisEvent({
      type: existingRecord
        ? "common_memo_updated"
        : "common_memo_created",
      fieldKey: editingMemoFieldKey
    }).catch(() => {});
  } catch {
    elements.memoDialogError.textContent =
      "확인한 사항을 저장하지 못했습니다. 기존 내용은 유지됩니다. 잠시 후 다시 시도해주세요.";
  } finally {
    setMemoSaving(false);
    if (saved) {
      elements.memoDialog.close();
    }
  }
}

elements.editBasisButton.addEventListener("click", showBasisDialog);
elements.closeDialogButton.addEventListener("click", () =>
  elements.basisDialog.close()
);
elements.cancelDialogButton.addEventListener("click", () =>
  elements.basisDialog.close()
);
elements.refreshPageButton.addEventListener("click", () =>
  refreshCurrentPage({ autoAnalyze: false })
);
elements.analyzeButton.addEventListener("click", analyzeCurrentPage);
elements.closeMemoDialogButton.addEventListener("click", closeMemoDialog);
elements.cancelMemoDialogButton.addEventListener("click", closeMemoDialog);
elements.closeMemoDeleteDialogButton.addEventListener(
  "click",
  closeMemoDeleteDialog
);
elements.cancelMemoDeleteDialogButton.addEventListener(
  "click",
  closeMemoDeleteDialog
);

elements.basisDialog.addEventListener("click", (event) => {
  if (event.target === elements.basisDialog) {
    elements.basisDialog.close();
  }
});

elements.memoDialog.addEventListener("click", (event) => {
  if (event.target === elements.memoDialog) {
    closeMemoDialog();
  }
});

elements.memoDialog.addEventListener("close", () => {
  editingMemoId = "";
  editingMemoFieldKey = "";
  elements.memoDialogError.textContent = "";
});

elements.memoDeleteDialog.addEventListener("click", (event) => {
  if (event.target === elements.memoDeleteDialog) {
    closeMemoDeleteDialog();
  }
});

elements.memoDeleteDialog.addEventListener("close", () => {
  deletingMemoId = "";
  elements.memoDeleteDialogError.textContent = "";
});

elements.memoForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.memoDialogError.textContent = "";
  await persistMemoFromDialog();
});

elements.memoDeleteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.memoDeleteDialogError.textContent = "";
  await persistMemoDeletion();
});

elements.basisForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.dialogError.textContent = "";

  let nextBasis;
  try {
    nextBasis = createBasis({
      academicCycle: elements.academicCycleInput.value,
      intakeMonth: elements.intakeMonthInput.value,
      intakeYear: elements.intakeYearInput.value,
      studyMode: elements.studyModeInput.value,
      feeStatus: elements.feeStatusInput.value
    });
  } catch {
    elements.dialogError.textContent =
      "학년은 2026/27 형식으로, 입학 월과 연도는 올바른 범위로 입력해주세요.";
    elements.academicCycleInput.focus();
    return;
  }

  setBasisSaving(true);
  try {
    await persistBasis(nextBasis, "기준을 저장했습니다. 다시 분석해주세요.");
    elements.basisDialog.close();
  } catch {
    elements.dialogError.textContent =
      "기준을 저장하지 못했습니다. 기존 기준은 유지됩니다. 잠시 후 다시 시도해주세요.";
  } finally {
    setBasisSaving(false);
  }
});

elements.resetSeptemberButton.addEventListener("click", async () => {
  elements.resetSeptemberButton.disabled = true;
  elements.basisStatus.textContent = "";

  try {
    const septemberBasis = createBasis({
      ...currentBasis,
      intakeMonth: 9
    });
    await persistBasis(
      septemberBasis,
      "9월 기준으로 되돌렸습니다. 다시 분석해주세요."
    );
  } catch {
    elements.basisStatus.textContent =
      "9월 기준을 저장하지 못했습니다. 기존 기준은 유지됩니다.";
  } finally {
    elements.resetSeptemberButton.disabled = false;
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "ACTIVE_TAB_CONTEXT") {
    void applyTab(
      {
        id: message.tab?.tabId,
        title: message.tab?.title,
        url: message.tab?.url
      },
      { autoAnalyze: true }
    );
  }
});

for (const month of INTAKE_MONTHS) {
  const option = document.createElement("option");
  option.value = String(month);
  option.textContent = `${month}월`;
  elements.intakeMonthInput.append(option);
}

renderFields();

const [appState, analysisState, memoState] = await Promise.all([
  loadAppState(),
  loadAnalysisState(),
  loadCommonMemoState()
]);
currentBasis = appState.basis;
currentAnalysis = analysisState.analysis;
currentMemoState = memoState;
renderBasis(currentBasis);
renderFields();

if (!appState.persisted) {
  elements.basisStatus.textContent =
    "저장소를 읽지 못해 기본 기준을 사용 중입니다.";
} else if (appState.recovered) {
  elements.basisStatus.textContent =
    "저장된 기준을 사용할 수 없어 기본 기준으로 복구했습니다.";
}

await refreshCurrentPage({ autoAnalyze: true });
