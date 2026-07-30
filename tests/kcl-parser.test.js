import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { createDefaultBasis, createBasis } from "../shared/basis.js";
import { EXTRACTION_STATUS } from "../shared/extraction-status.js";
import {
  isKclRequirementsUrl,
  isTrustedKclFeesLink,
  parseKclSnapshot
} from "../shared/kcl-parser.js";

const FIXED_DATE = new Date("2026-07-30T00:00:00.000Z");

async function readFixture(name) {
  return JSON.parse(
    await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8")
  );
}

async function createPayload() {
  return {
    requirements: await readFixture("kcl-requirements-snapshot.json"),
    fees: await readFixture("kcl-fees-snapshot.json"),
    feeError: null
  };
}

test("지원 URL과 실제 같은 과정 Fees 링크만 허용한다", () => {
  const requirements =
    "https://www.kcl.ac.uk/study/postgraduate-taught/courses/nutrition-msc/requirements";

  assert.equal(isKclRequirementsUrl(requirements), true);
  assert.equal(
    isKclRequirementsUrl("https://www.kcl.ac.uk/study/postgraduate-taught/courses/nutrition-msc/fees"),
    false
  );
  assert.equal(
    isTrustedKclFeesLink(
      requirements,
      "https://www.kcl.ac.uk/study/postgraduate-taught/courses/nutrition-msc/fees"
    ),
    true
  );
  assert.equal(
    isTrustedKclFeesLink(requirements, "https://example.com/fees"),
    false
  );
  assert.equal(
    isTrustedKclFeesLink(
      requirements,
      "https://www.kcl.ac.uk/study/postgraduate-taught/courses/another-course/fees"
    ),
    false
  );
});

test("South Korea와 기본 기준에서 11개 항목을 추출한다", async () => {
  const analysis = parseKclSnapshot(
    await createPayload(),
    createDefaultBasis(FIXED_DATE),
    FIXED_DATE
  );

  assert.equal(analysis.fields.length, 11);
  assert.equal(analysis.summary.found, 11);
  assert.equal(analysis.stale, false);

  const byKey = Object.fromEntries(
    analysis.fields.map((field) => [field.key, field])
  );
  assert.equal(byKey.university.value, "King's College London");
  assert.equal(byKey.course.value, "Nutrition MSc");
  assert.equal(byKey.university.source, null);
  assert.equal(byKey.university.copyText, "");
  assert.equal(byKey.course.source, null);
  assert.equal(byKey.course.copyText, "");
  assert.match(byKey.koreanAcademicRequirements.value, /score of 85%/);
  assert.equal(byKey.englishRequirements.value, "English language band: B");
  assert.equal(byKey.englishRequirements.detail, "");
  assert.equal(byKey.tuitionFee.value, "£38,300");
  assert.equal(byKey.tuitionFee.detail, "");
  assert.equal(byKey.applicationFee.value, "£85");
  assert.equal(byKey.applicationFee.detail, "");
  assert.equal(
    byKey.universityApplicationDeadline.value,
    "25 July 2026 (23:59 UK time)"
  );
  assert.equal(byKey.reference.value, "Yes");
  assert.equal(byKey.sopGuideline.value, "Yes");
  assert.equal(byKey.cv.value, "Optional");
  assert.ok(
    analysis.fields
      .filter((field) => !["university", "course"].includes(field.key))
      .every((field) => field.source?.url)
  );
  assert.equal(
    byKey.universityApplicationDeadline.copyText,
    "Overseas (international) fee status: 25 July 2026 (23:59 UK time)"
  );
  assert.equal(byKey.applicationFee.copyText, "£85");
  assert.equal(
    byKey.reference.copyText,
    "Two references are required with at least one academic. Professional references will be accepted if you have completed your qualifications over five years ago."
  );
});

test("국가 미선택 상태에서는 한국 학력 요건을 추정하지 않고 선택을 요청한다", async () => {
  const payload = await createPayload();
  payload.requirements.selectedCountry = "";
  payload.requirements.sections.equivalentInternationalQualifications = "";

  const analysis = parseKclSnapshot(
    payload,
    createDefaultBasis(FIXED_DATE),
    FIXED_DATE
  );
  const korean = analysis.fields.find(
    (field) => field.key === "koreanAcademicRequirements"
  );

  assert.equal(korean.status, EXTRACTION_STATUS.ACTION_REQUIRED);
  assert.match(korean.nextAction, /South Korea/);
});

test("Home 기준은 UK 학비와 Home 지원 마감일을 선택한다", async () => {
  const homeBasis = createBasis(
    {
      academicCycle: "2026/27",
      intakeMonth: 9,
      intakeYear: 2026,
      studyMode: "full-time",
      feeStatus: "home"
    },
    FIXED_DATE
  );
  const analysis = parseKclSnapshot(
    await createPayload(),
    homeBasis,
    FIXED_DATE
  );
  const byKey = Object.fromEntries(
    analysis.fields.map((field) => [field.key, field])
  );

  assert.equal(byKey.tuitionFee.value, "£18,150");
  assert.equal(
    byKey.universityApplicationDeadline.value,
    "25 August 2026 (23:59 UK time)"
  );
});

test("기준과 일치하는 학비가 없으면 다른 후보를 임의 선택하지 않는다", async () => {
  const partTimeBasis = createBasis(
    {
      academicCycle: "2026/27",
      intakeMonth: 9,
      intakeYear: 2026,
      studyMode: "part-time",
      feeStatus: "international"
    },
    FIXED_DATE
  );
  const analysis = parseKclSnapshot(
    await createPayload(),
    partTimeBasis,
    FIXED_DATE
  );
  const tuition = analysis.fields.find((field) => field.key === "tuitionFee");

  assert.equal(tuition.status, EXTRACTION_STATUS.NOT_FOUND);
  assert.equal(tuition.value, "");
  assert.match(tuition.nextAction, /part-time/);
});

test("Fees 요청 실패는 Tuition Fee만 source_error로 격리한다", async () => {
  const payload = await createPayload();
  payload.fees = null;
  payload.feeError = {
    code: "fees_fetch_failed",
    message: "network unavailable"
  };

  const analysis = parseKclSnapshot(
    payload,
    createDefaultBasis(FIXED_DATE),
    FIXED_DATE
  );
  const tuition = analysis.fields.find((field) => field.key === "tuitionFee");

  assert.equal(tuition.status, EXTRACTION_STATUS.SOURCE_ERROR);
  assert.equal(analysis.summary.found, 10);
  assert.equal(analysis.summary.source_error, 1);
});

test("IELTS 조건은 점수 문장 하나만 표시하고 안내 문구는 붙이지 않는다", async () => {
  const payload = await createPayload();
  payload.requirements.sections.englishLanguageRequirements =
    "IELTS 7.0 overall and no other element below 6.5 General information about studying in English.";
  payload.requirements.englishLanguageRequirementItems = [
    "IELTS 7.0 overall and no other element below 6.5",
    "General information about studying in English."
  ];
  payload.requirements.englishLanguageLinks = [];

  const analysis = parseKclSnapshot(
    payload,
    createDefaultBasis(FIXED_DATE),
    FIXED_DATE
  );
  const english = analysis.fields.find(
    (field) => field.key === "englishRequirements"
  );

  assert.equal(
    english.value,
    "IELTS 7.0 overall and no other element below 6.5"
  );
  assert.equal(english.detail, "");
  assert.equal(english.copyText, english.value);
});

test("영어 점수나 band 없이 링크만 있으면 별도 페이지 확인으로 표시한다", async () => {
  const payload = await createPayload();
  payload.requirements.sections.englishLanguageRequirements =
    "Please see our English language requirements page.";
  payload.requirements.englishLanguageRequirementItems = [
    "Please see our English language requirements page."
  ];
  payload.requirements.englishLanguageLinks = [
    {
      text: "English language requirements page",
      href: "https://www.kcl.ac.uk/english-requirements"
    }
  ];

  const analysis = parseKclSnapshot(
    payload,
    createDefaultBasis(FIXED_DATE),
    FIXED_DATE
  );
  const english = analysis.fields.find(
    (field) => field.key === "englishRequirements"
  );

  assert.equal(english.status, EXTRACTION_STATUS.FOUND);
  assert.equal(
    english.value,
    "별도 페이지 확인: English language requirements page"
  );
  assert.equal(english.source.url, "https://www.kcl.ac.uk/english-requirements");
});

test("숫자 English language band도 조건 한 줄로 표시한다", async () => {
  const payload = await createPayload();
  payload.requirements.sections.englishLanguageRequirements =
    "English language band: 1 Please read the general guidance.";
  payload.requirements.englishLanguageRequirementItems = [
    "English language band: 1",
    "Please read the general guidance."
  ];

  const analysis = parseKclSnapshot(
    payload,
    createDefaultBasis(FIXED_DATE),
    FIXED_DATE
  );
  const english = analysis.fields.find(
    (field) => field.key === "englishRequirements"
  );

  assert.equal(english.value, "English language band: 1");
  assert.equal(english.detail, "");
});

test("파운드 표시가 없는 비용도 숫자만 추출한다", async () => {
  const payload = await createPayload();
  payload.fees.tuitionFeeCandidates[1].value = "38,300 per year (2026/27)";
  payload.requirements.sections.selectionProcess =
    "A non-refundable application fee of 85 applies.";

  const analysis = parseKclSnapshot(
    payload,
    createDefaultBasis(FIXED_DATE),
    FIXED_DATE
  );
  const byKey = Object.fromEntries(
    analysis.fields.map((field) => [field.key, field])
  );

  assert.equal(byKey.tuitionFee.value, "38,300");
  assert.equal(byKey.applicationFee.value, "85");
});
