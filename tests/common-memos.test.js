import test from "node:test";
import assert from "node:assert/strict";

import {
  COMMON_MEMO_SUMMARY_OPTIONS,
  MEMO_CONFIRMATION_STATE,
  MEMO_VERIFICATION_STATUS,
  createCommonMemoRecord,
  getCommonMemoSummaryOptions,
  getMemoVerificationStatus,
  migrateCommonMemoRecordV1,
  resolveCommonMemos,
  verifyCommonMemoForCycle
} from "../shared/common-memos.js";

const NOW = new Date("2026-08-05T03:00:00.000Z");

function createMemo(overrides = {}) {
  return createCommonMemoRecord({
    siteKey: "kcl",
    universityName: "King's College London",
    fieldKey: "sopGuideline",
    summary: "SOP 질문과 길이는 과정마다 다름",
    details: "지원서 안에서 다시 확인",
    sourceUrl: "https://www.kcl.ac.uk/study/postgraduate-taught/courses",
    sourceLabel: "KCL course page",
    ...overrides
  }, NOW);
}

test("항목별 수동 확인 선택지를 지정된 순서로 제공한다", () => {
  assert.deepEqual(getCommonMemoSummaryOptions("koreanAcademicRequirements"), ["별도 페이지", "지원서 내부 확인", "못 찾음"]);
  assert.deepEqual(getCommonMemoSummaryOptions("englishRequirements"), ["별도 페이지", "지원서 내부 확인", "못 찾음"]);
  assert.deepEqual(getCommonMemoSummaryOptions("reference"), ["별도 페이지", "지원서 내부 확인", "못 찾음"]);
  assert.deepEqual(getCommonMemoSummaryOptions("sopGuideline"), ["별도 페이지", "지원서 내부 확인", "못 찾음"]);
  assert.deepEqual(getCommonMemoSummaryOptions("cv"), ["별도 페이지", "지원서 내부 확인", "못 찾음"]);
  assert.deepEqual(getCommonMemoSummaryOptions("applicationFee"), ["No application fee", "못 찾음"]);
  assert.deepEqual(getCommonMemoSummaryOptions("universityApplicationDeadline"), ["Rolling basis", "Staged admission"]);
  assert.deepEqual(getCommonMemoSummaryOptions("tuitionFee"), []);
  assert.ok(Object.isFrozen(COMMON_MEMO_SUMMARY_OPTIONS));
});

test("대학 전체와 항목별 한 줄 메모를 만들고 출처는 선택으로 둔다", () => {
  const school = createMemo({ fieldKey: "", summary: "지원서 안에서만 보이는 항목이 있음", sourceUrl: "" });
  assert.equal(school.fieldKey, "");
  assert.equal(school.sourceUrl, "");
  assert.equal(school.confirmationState, MEMO_CONFIRMATION_STATE.UNVERIFIED);
});

test("확인일은 명시된 날짜로만 현재 학년도에 기록된다", () => {
  const original = createMemo();
  const verified = verifyCommonMemoForCycle(original, "2026/27", "2026-08-05", NOW);
  assert.equal(verified.verificationByCycle["2026/27"].confirmedDate, "2026-08-05");
  assert.equal(getMemoVerificationStatus(verified, "2026/27"), MEMO_VERIFICATION_STATUS.CONFIRMED);
  assert.equal(getMemoVerificationStatus(verified, "2027/28"), MEMO_VERIFICATION_STATUS.NEEDS_REVIEW);
});

test("확인 뒤 요약이 바뀌면 확인일을 갱신하지 않고 다시 확인으로 표시한다", () => {
  const verified = verifyCommonMemoForCycle(createMemo(), "2026/27", "2026-08-05", NOW);
  const edited = createMemo({
    summary: "SOP 질문은 과정마다 다르며 지원서에서 확인",
    confirmationState: MEMO_CONFIRMATION_STATE.CONFIRMED,
    verificationByCycle: verified.verificationByCycle
  });
  assert.equal(edited.verificationByCycle["2026/27"].confirmedDate, "2026-08-05");
  assert.equal(getMemoVerificationStatus(edited, "2026/27"), MEMO_VERIFICATION_STATUS.CHANGED_AFTER_VERIFICATION);
});

test("사이트 키가 달라도 정규화된 대학명이 같으면 메모를 다시 찾는다", () => {
  const memo = createMemo();
  const found = resolveCommonMemos([memo], { siteKey: "kcl-new", universityName: "Kings College London" }, "sopGuideline");
  assert.deepEqual(found, [memo]);
});

test("schema 1 메모의 값과 학년도 확인 기록을 schema 2로 변환한다", () => {
  const migrated = migrateCommonMemoRecordV1({
    siteKey: "kcl",
    universityName: "King's College London",
    scopeType: "university",
    scopeLabel: "King's College London",
    fieldKey: "sopGuideline",
    value: "지원서에서 SOP 질문 확인",
    sourceUrl: "https://www.kcl.ac.uk/study",
    sourceLabel: "KCL",
    updatedAt: "2026-07-31T00:00:00.000Z",
    verificationByCycle: {
      "2026/27": {
        verifiedAt: "2026-07-31T00:00:00.000Z",
        verifiedValue: "지원서에서 SOP 질문 확인",
        sourceUrl: "https://www.kcl.ac.uk/study"
      }
    }
  });
  assert.equal(migrated.summary, "지원서에서 SOP 질문 확인");
  assert.equal(migrated.verificationByCycle["2026/27"].confirmedDate, "2026-07-31");
});
