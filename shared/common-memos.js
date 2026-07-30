import { ACADEMIC_CYCLE_PATTERN } from "./basis.js";

export const COMMON_MEMO_SCHEMA_VERSION = 1;

export const COMMON_MEMO_FIELD_KEYS = Object.freeze([
  "englishRequirements",
  "applicationFee",
  "universityApplicationDeadline",
  "reference",
  "sopGuideline"
]);

export const COMMON_MEMO_SCOPE_TYPES = Object.freeze([
  "university",
  "school",
  "faculty"
]);

export const MEMO_VERIFICATION_STATUS = Object.freeze({
  CONFIRMED: "confirmed",
  NEEDS_REVIEW: "needs_review",
  CHANGED_AFTER_VERIFICATION: "changed_after_verification",
  UNVERIFIED: "unverified"
});

export const MEMO_COMPARISON_STATUS = Object.freeze({
  SAME: "same",
  DIFFERENT: "different",
  PAGE_MISSING: "page_missing",
  MEMO_MISSING: "memo_missing",
  BOTH_MISSING: "both_missing"
});

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isValidTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isValidAcademicCycle(value) {
  const match = ACADEMIC_CYCLE_PATTERN.exec(String(value ?? ""));
  if (!match) {
    return false;
  }
  const startYear = Number(match[1]);
  return match[2] === String((startYear + 1) % 100).padStart(2, "0");
}

export function isSafeMemoSourceUrl(value) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function normalizeMemoScopeKey(value) {
  return normalizeText(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildCommonMemoId(record) {
  return [
    normalizeText(record?.siteKey).toLowerCase(),
    normalizeText(record?.scopeType).toLowerCase(),
    normalizeText(record?.scopeKey).toLowerCase(),
    normalizeText(record?.fieldKey)
  ].join("::");
}

function hasValidVerificationByCycle(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.entries(value).every(
    ([cycle, verification]) =>
      isValidAcademicCycle(cycle) &&
      verification &&
      typeof verification === "object" &&
      isValidTimestamp(verification.verifiedAt) &&
      normalizeText(verification.verifiedValue).length > 0 &&
      isSafeMemoSourceUrl(verification.sourceUrl)
  );
}

export function isValidCommonMemoRecord(record) {
  if (!record || typeof record !== "object") {
    return false;
  }

  const siteKey = normalizeText(record.siteKey).toLowerCase();
  const scopeType = normalizeText(record.scopeType).toLowerCase();
  const scopeKey = normalizeText(record.scopeKey).toLowerCase();
  const fieldKey = normalizeText(record.fieldKey);

  return Boolean(
    /^[a-z0-9-]+$/.test(siteKey) &&
      COMMON_MEMO_SCOPE_TYPES.includes(scopeType) &&
      scopeKey.length > 0 &&
      normalizeText(record.scopeLabel).length > 0 &&
      normalizeText(record.universityName).length > 0 &&
      COMMON_MEMO_FIELD_KEYS.includes(fieldKey) &&
      normalizeText(record.value).length > 0 &&
      isSafeMemoSourceUrl(record.sourceUrl) &&
      typeof record.sourceLabel === "string" &&
      isValidTimestamp(record.updatedAt) &&
      hasValidVerificationByCycle(record.verificationByCycle) &&
      record.id === buildCommonMemoId(record)
  );
}

export function createCommonMemoRecord(input, now = new Date()) {
  const siteKey = normalizeText(input?.siteKey).toLowerCase();
  const scopeType = normalizeText(input?.scopeType).toLowerCase();
  const scopeLabel =
    scopeType === "university"
      ? normalizeText(input?.universityName)
      : normalizeText(input?.scopeLabel);
  const scopeKey =
    scopeType === "university"
      ? siteKey
      : normalizeMemoScopeKey(input?.scopeKey || scopeLabel);

  const record = {
    id: "",
    siteKey,
    universityName: normalizeText(input?.universityName),
    scopeType,
    scopeKey,
    scopeLabel,
    fieldKey: normalizeText(input?.fieldKey),
    value: normalizeText(input?.value),
    sourceUrl: normalizeText(input?.sourceUrl),
    sourceLabel: normalizeText(input?.sourceLabel),
    updatedAt: now.toISOString(),
    verificationByCycle:
      input?.verificationByCycle &&
      typeof input.verificationByCycle === "object" &&
      !Array.isArray(input.verificationByCycle)
        ? structuredClone(input.verificationByCycle)
        : {}
  };
  record.id = buildCommonMemoId(record);

  if (!isValidCommonMemoRecord(record)) {
    throw new TypeError("공통 메모 형식이 올바르지 않습니다.");
  }
  return record;
}

export function verifyCommonMemoForCycle(
  record,
  academicCycle,
  now = new Date()
) {
  if (!isValidCommonMemoRecord(record) || !isValidAcademicCycle(academicCycle)) {
    throw new TypeError("확인할 공통 메모 또는 학년도 형식이 올바르지 않습니다.");
  }

  return {
    ...record,
    verificationByCycle: {
      ...record.verificationByCycle,
      [academicCycle]: {
        verifiedAt: now.toISOString(),
        verifiedValue: record.value,
        sourceUrl: record.sourceUrl
      }
    }
  };
}

export function getMemoVerificationStatus(record, academicCycle) {
  if (!isValidCommonMemoRecord(record) || !isValidAcademicCycle(academicCycle)) {
    return MEMO_VERIFICATION_STATUS.UNVERIFIED;
  }

  const entries = Object.values(record.verificationByCycle);
  const current = record.verificationByCycle[academicCycle];
  if (!current) {
    return entries.length > 0
      ? MEMO_VERIFICATION_STATUS.NEEDS_REVIEW
      : MEMO_VERIFICATION_STATUS.UNVERIFIED;
  }

  return normalizeText(current.verifiedValue) === normalizeText(record.value) &&
    current.sourceUrl === record.sourceUrl
    ? MEMO_VERIFICATION_STATUS.CONFIRMED
    : MEMO_VERIFICATION_STATUS.CHANGED_AFTER_VERIFICATION;
}

export function resolveCommonMemos(records, context, fieldKey) {
  const siteKey = normalizeText(context?.siteKey).toLowerCase();
  const scopeType = normalizeText(context?.scopeType).toLowerCase();
  const scopeKey = normalizeText(context?.scopeKey).toLowerCase();

  const eligible = (records ?? []).filter(
    (record) =>
      isValidCommonMemoRecord(record) &&
      record.siteKey === siteKey &&
      record.fieldKey === fieldKey
  );
  const exact =
    COMMON_MEMO_SCOPE_TYPES.includes(scopeType) &&
    scopeType !== "university" &&
    scopeKey
      ? eligible.filter(
          (record) =>
            record.scopeType === scopeType && record.scopeKey === scopeKey
        )
      : [];
  const university = eligible.filter(
    (record) => record.scopeType === "university"
  );

  return [...exact, ...university];
}

export function comparePageValueToMemo(pageValue, memoValue) {
  const page = normalizeText(pageValue);
  const memo = normalizeText(memoValue);

  if (!page && !memo) {
    return MEMO_COMPARISON_STATUS.BOTH_MISSING;
  }
  if (!page) {
    return MEMO_COMPARISON_STATUS.PAGE_MISSING;
  }
  if (!memo) {
    return MEMO_COMPARISON_STATUS.MEMO_MISSING;
  }
  return page === memo
    ? MEMO_COMPARISON_STATUS.SAME
    : MEMO_COMPARISON_STATUS.DIFFERENT;
}

export function shouldHideMissingPageResultForConfirmedMemo(
  records,
  academicCycle,
  pageValue
) {
  if (normalizeText(pageValue)) {
    return false;
  }

  return (records ?? []).some(
    (record) =>
      getMemoVerificationStatus(record, academicCycle) ===
      MEMO_VERIFICATION_STATUS.CONFIRMED
  );
}
