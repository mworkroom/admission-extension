import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCommonMemoId,
  COMMON_MEMO_FIELD_KEYS,
  comparePageValueToMemo,
  createCommonMemoRecord,
  getMemoVerificationStatus,
  isValidCommonMemoRecord,
  MEMO_COMPARISON_STATUS,
  MEMO_VERIFICATION_STATUS,
  normalizeMemoScopeKey,
  resolveCommonMemos,
  shouldHideMissingPageResultForConfirmedMemo,
  verifyCommonMemoForCycle
} from "../shared/common-memos.js";

const FIXED_DATE = new Date("2026-07-31T00:00:00.000Z");

function createMemo(overrides = {}) {
  return createCommonMemoRecord(
    {
      siteKey: "qmul",
      universityName: "Queen Mary University of London",
      scopeType: "university",
      scopeLabel: "Queen Mary University of London",
      fieldKey: "englishRequirements",
      value: "Band 4",
      sourceUrl: "https://www.qmul.ac.uk/english",
      sourceLabel: "English language requirements",
      ...overrides
    },
    FIXED_DATE
  );
}

test("University 메모는 siteKey를 범위 키로 사용해 안정적인 id를 만든다", () => {
  const record = createMemo();

  assert.equal(
    record.id,
    "qmul::university::qmul::englishRequirements"
  );
  assert.equal(record.scopeKey, "qmul");
  assert.equal(record.scopeLabel, "Queen Mary University of London");
  assert.equal(buildCommonMemoId(record), record.id);
  assert.equal(isValidCommonMemoRecord(record), true);
});

test("School·Faculty 이름을 명시적인 범위 키로 정규화한다", () => {
  const record = createMemo({
    scopeType: "school",
    scopeLabel: "School of Economics & Finance"
  });

  assert.equal(record.scopeKey, "school-of-economics-and-finance");
  assert.equal(
    normalizeMemoScopeKey("King's Business School"),
    "kings-business-school"
  );
});

test("지원하지 않는 항목과 안전하지 않은 출처 URL은 거부한다", () => {
  assert.deepEqual(COMMON_MEMO_FIELD_KEYS, [
    "englishRequirements",
    "applicationFee",
    "universityApplicationDeadline",
    "reference",
    "sopGuideline"
  ]);
  for (const fieldKey of COMMON_MEMO_FIELD_KEYS) {
    assert.equal(
      isValidCommonMemoRecord(createMemo({ fieldKey })),
      true,
      `${fieldKey} 메모가 유효해야 합니다.`
    );
  }
  assert.throws(
    () => createMemo({ fieldKey: "tuitionFee" }),
    /형식이 올바르지/
  );
  assert.throws(
    () => createMemo({ sourceUrl: "javascript:alert(1)" }),
    /형식이 올바르지/
  );
});

test("확인 전·현재 학년도 확인·새 학년도·확인 후 변경을 구분한다", () => {
  const unverified = createMemo();
  assert.equal(
    getMemoVerificationStatus(unverified, "2026/27"),
    MEMO_VERIFICATION_STATUS.UNVERIFIED
  );

  const confirmed = verifyCommonMemoForCycle(
    unverified,
    "2026/27",
    FIXED_DATE
  );
  assert.equal(
    getMemoVerificationStatus(confirmed, "2026/27"),
    MEMO_VERIFICATION_STATUS.CONFIRMED
  );
  assert.equal(
    getMemoVerificationStatus(confirmed, "2027/28"),
    MEMO_VERIFICATION_STATUS.NEEDS_REVIEW
  );

  const changed = { ...confirmed, value: "Band 5" };
  assert.equal(
    getMemoVerificationStatus(changed, "2026/27"),
    MEMO_VERIFICATION_STATUS.CHANGED_AFTER_VERIFICATION
  );
  assert.equal(confirmed.verificationByCycle["2026/27"].verifiedValue, "Band 4");
});

test("새 학년도 확인은 이전 학년도 기록을 보존하고 현재 값을 기록한다", () => {
  const firstVerification = verifyCommonMemoForCycle(
    createMemo(),
    "2026/27",
    FIXED_DATE
  );
  const changed = {
    ...firstVerification,
    value: "Band 5",
    sourceUrl: "https://www.qmul.ac.uk/english/2027"
  };
  const secondVerification = verifyCommonMemoForCycle(
    changed,
    "2027/28",
    new Date("2027-07-31T00:00:00.000Z")
  );

  assert.deepEqual(
    secondVerification.verificationByCycle["2026/27"],
    firstVerification.verificationByCycle["2026/27"]
  );
  assert.equal(
    secondVerification.verificationByCycle["2027/28"].verifiedValue,
    "Band 5"
  );
  assert.equal(
    secondVerification.verificationByCycle["2027/28"].sourceUrl,
    "https://www.qmul.ac.uk/english/2027"
  );
  assert.equal(
    getMemoVerificationStatus(secondVerification, "2027/28"),
    MEMO_VERIFICATION_STATUS.CONFIRMED
  );
});

test("정확한 School·Faculty 메모를 대학 메모보다 먼저 반환한다", () => {
  const university = createMemo();
  const school = createMemo({
    scopeType: "school",
    scopeLabel: "School of Economics and Finance",
    value: "Band 4: IELTS 6.5"
  });
  const otherUniversity = createMemo({
    siteKey: "kcl",
    universityName: "King's College London"
  });

  const resolved = resolveCommonMemos(
    [university, school, otherUniversity],
    {
      siteKey: "qmul",
      scopeType: "school",
      scopeKey: "school-of-economics-and-finance"
    },
    "englishRequirements"
  );

  assert.deepEqual(
    resolved.map((record) => record.scopeType),
    ["school", "university"]
  );
  assert.equal(resolved.includes(otherUniversity), false);
});

test("조직 범위를 모르면 대학 메모만 연결하고 모호한 범위를 추정하지 않는다", () => {
  const university = createMemo();
  const school = createMemo({
    scopeType: "school",
    scopeLabel: "School of Economics and Finance"
  });

  const resolved = resolveCommonMemos(
    [school, university],
    { siteKey: "qmul" },
    "englishRequirements"
  );

  assert.deepEqual(resolved, [university]);
});

test("페이지와 메모 값은 공백만 정규화해 비교한다", () => {
  assert.equal(
    comparePageValueToMemo("Band 4: IELTS 6.5", "Band 4:   IELTS 6.5"),
    MEMO_COMPARISON_STATUS.SAME
  );
  assert.equal(
    comparePageValueToMemo("Band 4", "IELTS 6.5"),
    MEMO_COMPARISON_STATUS.DIFFERENT
  );
  assert.equal(
    comparePageValueToMemo("", "Band 4"),
    MEMO_COMPARISON_STATUS.PAGE_MISSING
  );
  assert.equal(
    comparePageValueToMemo("Band 4", ""),
    MEMO_COMPARISON_STATUS.MEMO_MISSING
  );
});

test("현재 학년도 확정 메모는 페이지 값 없음 안내만 대체한다", () => {
  const confirmed = verifyCommonMemoForCycle(
    createMemo({ fieldKey: "applicationFee", value: "No application fee" }),
    "2026/27",
    FIXED_DATE
  );

  assert.equal(
    shouldHideMissingPageResultForConfirmedMemo(
      [confirmed],
      "2026/27",
      ""
    ),
    true
  );
  assert.equal(
    shouldHideMissingPageResultForConfirmedMemo(
      [confirmed],
      "2027/28",
      ""
    ),
    false
  );
  assert.equal(
    shouldHideMissingPageResultForConfirmedMemo(
      [confirmed],
      "2026/27",
      "£80"
    ),
    false
  );
});
