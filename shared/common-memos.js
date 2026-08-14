import { ACADEMIC_CYCLE_PATTERN } from "./basis.js";

export const COMMON_MEMO_SCHEMA_VERSION = 2;

export const COMMON_MEMO_FIELD_KEYS = Object.freeze([
  "",
  "entryRequirements",
  "koreanAcademicRequirements",
  "englishRequirements",
  "tuitionFee",
  "applicationFee",
  "universityApplicationDeadline",
  "reference",
  "sopGuideline",
  "cv"
]);

export const COMMON_MEMO_SUMMARY_OPTIONS = Object.freeze({
  koreanAcademicRequirements: Object.freeze([
    "별도 페이지",
    "지원서 내부 확인",
    "못 찾음"
  ]),
  englishRequirements: Object.freeze([
    "별도 페이지",
    "지원서 내부 확인",
    "못 찾음"
  ]),
  applicationFee: Object.freeze([
    "공통",
    "No application fee",
    "못 찾음"
  ]),
  universityApplicationDeadline: Object.freeze([
    "공통",
    "Rolling basis",
    "Staged admission"
  ]),
  reference: Object.freeze([
    "별도 페이지",
    "지원서 내부 확인",
    "못 찾음"
  ]),
  sopGuideline: Object.freeze([
    "별도 페이지",
    "지원서 내부 확인",
    "못 찾음"
  ]),
  cv: Object.freeze([
    "선택 사항",
    "별도 페이지",
    "지원서 내부 확인",
    "못 찾음"
  ])
});

export function getCommonMemoSummaryOptions(fieldKey) {
  return [...(COMMON_MEMO_SUMMARY_OPTIONS[fieldKey] ?? [])];
}

export const MEMO_CONFIRMATION_STATE = Object.freeze({
  CONFIRMED: "confirmed",
  UNVERIFIED: "unverified"
});

export const MEMO_VERIFICATION_STATUS = Object.freeze({
  CONFIRMED: "confirmed",
  NEEDS_REVIEW: "needs_review",
  CHANGED_AFTER_VERIFICATION: "changed_after_verification",
  UNVERIFIED: "unverified"
});

function normalizeText(value, maxLength = 4000) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, maxLength);
}

function normalizeSingleLine(value, maxLength = 500) {
  return normalizeText(value, maxLength).replace(/\s+/g, " ");
}

function isValidTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isValidAcademicCycle(value) {
  const match = ACADEMIC_CYCLE_PATTERN.exec(String(value ?? ""));
  if (!match) return false;
  const startYear = Number(match[1]);
  return match[2] === String((startYear + 1) % 100).padStart(2, "0");
}

function isValidDateOnly(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? "")) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

export function isSafeMemoSourceUrl(value) {
  if (!normalizeSingleLine(value)) return true;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function normalizeUniversityKey(value) {
  return normalizeSingleLine(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/\b(the|university|of|college|london)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildCommonMemoId(record) {
  return [
    normalizeSingleLine(record?.siteKey, 100).toLowerCase(),
    normalizeSingleLine(record?.fieldKey, 100) || "university"
  ].join("::");
}

function hasValidVerificationByCycle(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).every(
    ([cycle, verification]) =>
      isValidAcademicCycle(cycle) &&
      verification &&
      typeof verification === "object" &&
      isValidDateOnly(verification.confirmedDate) &&
      normalizeSingleLine(verification.summary).length > 0 &&
      typeof verification.sourceUrl === "string" &&
      isSafeMemoSourceUrl(verification.sourceUrl)
  );
}

export function isValidCommonMemoRecord(record) {
  if (!record || typeof record !== "object") return false;
  const siteKey = normalizeSingleLine(record.siteKey, 100).toLowerCase();
  return Boolean(
    /^[a-z0-9-]+$/.test(siteKey) &&
      normalizeSingleLine(record.universityName).length > 0 &&
      normalizeSingleLine(record.universityKey).length > 0 &&
      COMMON_MEMO_FIELD_KEYS.includes(record.fieldKey) &&
      normalizeSingleLine(record.summary).length > 0 &&
      typeof record.details === "string" &&
      isSafeMemoSourceUrl(record.sourceUrl) &&
      typeof record.sourceLabel === "string" &&
      Object.values(MEMO_CONFIRMATION_STATE).includes(record.confirmationState) &&
      isValidTimestamp(record.updatedAt) &&
      hasValidVerificationByCycle(record.verificationByCycle) &&
      record.id === buildCommonMemoId(record)
  );
}

export function createCommonMemoRecord(input, now = new Date()) {
  const universityName = normalizeSingleLine(input?.universityName);
  const record = {
    id: "",
    siteKey: normalizeSingleLine(input?.siteKey, 100).toLowerCase(),
    universityKey:
      normalizeSingleLine(input?.universityKey, 200) ||
      normalizeUniversityKey(universityName),
    universityName,
    fieldKey: normalizeSingleLine(input?.fieldKey, 100),
    summary: normalizeSingleLine(input?.summary ?? input?.value, 500),
    details: normalizeText(input?.details, 4000),
    sourceUrl: normalizeSingleLine(input?.sourceUrl, 1500),
    sourceLabel: normalizeSingleLine(input?.sourceLabel, 500),
    confirmationState: Object.values(MEMO_CONFIRMATION_STATE).includes(
      input?.confirmationState
    )
      ? input.confirmationState
      : MEMO_CONFIRMATION_STATE.UNVERIFIED,
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
    throw new TypeError("확인한 사항 형식이 올바르지 않습니다.");
  }
  return record;
}

export function verifyCommonMemoForCycle(
  record,
  academicCycle,
  confirmedDate,
  now = new Date()
) {
  if (
    !isValidCommonMemoRecord(record) ||
    !isValidAcademicCycle(academicCycle) ||
    !isValidDateOnly(confirmedDate)
  ) {
    throw new TypeError("확인할 메모, 학년도 또는 확인일 형식이 올바르지 않습니다.");
  }
  return {
    ...structuredClone(record),
    confirmationState: MEMO_CONFIRMATION_STATE.CONFIRMED,
    updatedAt: now.toISOString(),
    verificationByCycle: {
      ...structuredClone(record.verificationByCycle),
      [academicCycle]: {
        confirmedDate,
        summary: record.summary,
        sourceUrl: record.sourceUrl
      }
    }
  };
}

export function markCommonMemoUnverified(record, now = new Date()) {
  if (!isValidCommonMemoRecord(record)) {
    throw new TypeError("미확인으로 바꿀 메모 형식이 올바르지 않습니다.");
  }
  return {
    ...structuredClone(record),
    confirmationState: MEMO_CONFIRMATION_STATE.UNVERIFIED,
    updatedAt: now.toISOString()
  };
}

export function getMemoVerificationStatus(record, academicCycle) {
  if (!isValidCommonMemoRecord(record) || !isValidAcademicCycle(academicCycle)) {
    return MEMO_VERIFICATION_STATUS.UNVERIFIED;
  }
  if (record.confirmationState === MEMO_CONFIRMATION_STATE.UNVERIFIED) {
    return MEMO_VERIFICATION_STATUS.UNVERIFIED;
  }
  const current = record.verificationByCycle[academicCycle];
  if (!current) {
    return Object.keys(record.verificationByCycle).length > 0
      ? MEMO_VERIFICATION_STATUS.NEEDS_REVIEW
      : MEMO_VERIFICATION_STATUS.UNVERIFIED;
  }
  return current.summary === record.summary && current.sourceUrl === record.sourceUrl
    ? MEMO_VERIFICATION_STATUS.CONFIRMED
    : MEMO_VERIFICATION_STATUS.CHANGED_AFTER_VERIFICATION;
}

export function getLatestMemoVerification(record) {
  return Object.entries(record?.verificationByCycle ?? {})
    .map(([academicCycle, verification]) => ({ academicCycle, ...verification }))
    .sort((left, right) => right.confirmedDate.localeCompare(left.confirmedDate))[0] ?? null;
}

export function resolveCommonMemos(records, context, fieldKey) {
  const siteKey = normalizeSingleLine(context?.siteKey, 100).toLowerCase();
  const universityKey = normalizeUniversityKey(context?.universityName);
  return (records ?? []).filter(
    (record) =>
      isValidCommonMemoRecord(record) &&
      record.fieldKey === fieldKey &&
      (record.siteKey === siteKey ||
        (universityKey && record.universityKey === universityKey))
  );
}

export function migrateCommonMemoRecordV1(record, now = new Date()) {
  const verificationByCycle = {};
  for (const [cycle, verification] of Object.entries(
    record?.verificationByCycle ?? {}
  )) {
    if (!isValidAcademicCycle(cycle) || !isValidTimestamp(verification?.verifiedAt)) {
      continue;
    }
    verificationByCycle[cycle] = {
      confirmedDate: verification.verifiedAt.slice(0, 10),
      summary: normalizeSingleLine(verification.verifiedValue ?? record?.value, 500),
      sourceUrl: isSafeMemoSourceUrl(verification.sourceUrl)
        ? normalizeSingleLine(verification.sourceUrl, 1500)
        : ""
    };
  }
  const migrated = createCommonMemoRecord(
    {
      siteKey: record?.siteKey,
      universityName: record?.universityName,
      fieldKey: COMMON_MEMO_FIELD_KEYS.includes(record?.fieldKey)
        ? record.fieldKey
        : "",
      summary: record?.value,
      details:
        record?.scopeType && record.scopeType !== "university"
          ? `${record.scopeLabel || record.scopeType} 범위에서 기록한 기존 메모`
          : "",
      sourceUrl: isSafeMemoSourceUrl(record?.sourceUrl) ? record.sourceUrl : "",
      sourceLabel: record?.sourceLabel ?? "",
      confirmationState:
        Object.keys(verificationByCycle).length > 0
          ? MEMO_CONFIRMATION_STATE.CONFIRMED
          : MEMO_CONFIRMATION_STATE.UNVERIFIED,
      verificationByCycle
    },
    isValidTimestamp(record?.updatedAt) ? new Date(record.updatedAt) : now
  );
  return migrated;
}
