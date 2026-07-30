export const ACADEMIC_CYCLE_PATTERN = /^(\d{4})\/(\d{2})$/;
export const INTAKE_MONTHS = Object.freeze(
  Array.from({ length: 12 }, (_, index) => index + 1)
);
export const STUDY_MODES = Object.freeze(["full-time", "part-time"]);
export const FEE_STATUSES = Object.freeze(["international", "home"]);

export const STUDY_MODE_LABELS = Object.freeze({
  "full-time": "Full-time",
  "part-time": "Part-time"
});

export const FEE_STATUS_LABELS = Object.freeze({
  international: "International",
  home: "Home"
});

function hasValidAcademicCycle(value) {
  const match = ACADEMIC_CYCLE_PATTERN.exec(value);
  if (!match) {
    return false;
  }

  const startYear = Number(match[1]);
  const expectedSuffix = String((startYear + 1) % 100).padStart(2, "0");
  return match[2] === expectedSuffix;
}

function hasValidTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function isValidBasis(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      hasValidAcademicCycle(value.academicCycle) &&
      Number.isInteger(value.intakeMonth) &&
      INTAKE_MONTHS.includes(value.intakeMonth) &&
      Number.isInteger(value.intakeYear) &&
      value.intakeYear >= 2000 &&
      value.intakeYear <= 2100 &&
      STUDY_MODES.includes(value.studyMode) &&
      FEE_STATUSES.includes(value.feeStatus) &&
      hasValidTimestamp(value.updatedAt)
  );
}

export function createDefaultBasis(now = new Date()) {
  return {
    academicCycle: "2026/27",
    intakeMonth: 9,
    intakeYear: 2026,
    studyMode: "full-time",
    feeStatus: "international",
    updatedAt: now.toISOString()
  };
}

export function createBasis(value, now = new Date()) {
  const basis = {
    academicCycle: String(value.academicCycle ?? "").trim(),
    intakeMonth: Number(value.intakeMonth),
    intakeYear: Number(value.intakeYear),
    studyMode: String(value.studyMode ?? ""),
    feeStatus: String(value.feeStatus ?? ""),
    updatedAt: now.toISOString()
  };

  if (!isValidBasis(basis)) {
    throw new TypeError("입력한 기준값의 형식이 올바르지 않습니다.");
  }

  return basis;
}

export function normalizeBasis(value, now = new Date()) {
  if (!isValidBasis(value)) {
    return createDefaultBasis(now);
  }

  return {
    academicCycle: value.academicCycle,
    intakeMonth: value.intakeMonth,
    intakeYear: value.intakeYear,
    studyMode: value.studyMode,
    feeStatus: value.feeStatus,
    updatedAt: value.updatedAt
  };
}

export function formatBasis(basis) {
  return {
    cycleAndIntake: `${basis.academicCycle} · ${basis.intakeYear}년 ${basis.intakeMonth}월`,
    modeAndFee: `${STUDY_MODE_LABELS[basis.studyMode]} · ${FEE_STATUS_LABELS[basis.feeStatus]}`
  };
}
