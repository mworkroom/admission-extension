import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { createBasis, createDefaultBasis } from "../shared/basis.js";
import {
  detectMinimumDegreeClass,
  parseCourseSnapshot
} from "../shared/course-parser.js";
import { EXTRACTION_STATUS } from "../shared/extraction-status.js";

const FIXED_DATE = new Date("2026-07-30T00:00:00.000Z");

async function fixture(name) {
  return JSON.parse(
    await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8")
  );
}

function byKey(analysis) {
  return Object.fromEntries(analysis.fields.map((field) => [field.key, field]));
}

test("SOAS는 South Korea 블록을 읽되 적용 학년 없는 학비는 확정하지 않는다", async () => {
  const analysis = parseCourseSnapshot(
    await fixture("soas-course-snapshot.json"),
    createDefaultBasis(FIXED_DATE),
    FIXED_DATE
  );
  const fields = byKey(analysis);

  assert.equal(analysis.schemaVersion, 3);
  assert.equal(analysis.siteKey, "soas");
  assert.equal(fields.university.value, "SOAS University of London");
  assert.equal(fields.course.value, "MSc Global Development");
  assert.match(fields.koreanAcademicRequirements.value, /GPA 2\.5\/4\.0/);
  assert.equal(
    fields.englishRequirements.value,
    "별도 English language requirements 페이지 확인"
  );
  assert.equal(fields.tuitionFee.status, EXTRACTION_STATUS.ACTION_REQUIRED);
  assert.equal(fields.tuitionFee.value, "£25,320");
  assert.equal(fields.tuitionFee.copyText, "");
  assert.equal(fields.reference.value, "Optional");
  assert.equal(
    fields.reference.detail,
    "References are optional, but can help build a stronger application if you fall below the 2:2 requirement or have non-traditional qualifications."
  );
  assert.equal(fields.reference.copyText, fields.reference.detail);
  assert.equal(fields.sopGuideline.status, EXTRACTION_STATUS.ACTION_REQUIRED);
  assert.equal(fields.cv.status, EXTRACTION_STATUS.NOT_FOUND);
});

test("Manchester는 과정·공통 안내의 11개 항목과 각 원문 출처를 합친다", async () => {
  const analysis = parseCourseSnapshot(
    await fixture("manchester-masters-snapshot.json"),
    createDefaultBasis(FIXED_DATE),
    FIXED_DATE
  );
  const fields = byKey(analysis);

  assert.equal(analysis.siteKey, "manchester");
  assert.equal(analysis.summary.found, 11);
  assert.equal(fields.university.value, "The University of Manchester");
  assert.equal(fields.course.value, "MSc Marketing");
  assert.match(fields.entryRequirements.value, /2:1, with 60% average/);
  assert.equal(
    fields.koreanAcademicRequirements.value,
    "We require a bachelor’s degree with minimum average of 3.3/4.3 or 3.5/4.5."
  );
  assert.equal(
    fields.englishRequirements.value,
    "IELTS 7.0 overall and no other element below 6.5"
  );
  assert.equal(fields.tuitionFee.value, "£33,100");
  assert.equal(fields.applicationFee.value, "£60");
  assert.equal(fields.universityApplicationDeadline.value, "5 July 2026");
  assert.equal(fields.reference.value, "Not required at application");
  assert.equal(fields.sopGuideline.value, "Required");
  assert.match(fields.sopGuideline.detail, /no more than one page/);
  assert.match(fields.cv.value, /more than two years/);
  assert.match(fields.tuitionFee.source.url, /msc-marketing\/overview/);
  assert.match(
    fields.koreanAcademicRequirements.source.url,
    /international-entry-requirements/
  );
  assert.match(fields.reference.source.url, /supporting-documents/);
});

test("미등록 대학 generic snapshot도 11개 항목과 실패 기록 대상으로 분석한다", async () => {
  const snapshot = await fixture("generic-university-snapshot.json");
  const analysis = parseCourseSnapshot(
    snapshot,
    createDefaultBasis(new Date("2026-07-31T12:00:00.000Z")),
    new Date("2026-07-31T12:00:00.000Z")
  );
  const fields = Object.fromEntries(
    analysis.fields.map((field) => [field.key, field])
  );

  assert.equal(analysis.siteKey, "bristol-ac-uk");
  assert.equal(analysis.fields.length, 11);
  assert.equal(analysis.summary.found, 7);
  assert.equal(fields.university.value, "University of Bristol");
  assert.equal(fields.course.value, "MSc Marketing");
  assert.equal(fields.englishRequirements.value, "IELTS 7.0 overall with no component below 6.5.");
  assert.equal(fields.tuitionFee.value, "£32,500");
  assert.equal(fields.applicationFee.status, EXTRACTION_STATUS.NOT_FOUND);
  assert.equal(fields.applicationFee.reasonCode, "not_present");
  assert.equal(
    fields.universityApplicationDeadline.value,
    "20 July 2026"
  );
  assert.equal(
    fields.reference.source.url,
    snapshot.url
  );
});

test("QMUL 2026 기준은 해당 intake 학비·마감일과 2:2 한국 GPA만 선택한다", async () => {
  const analysis = parseCourseSnapshot(
    await fixture("qmul-course-snapshot.json"),
    createDefaultBasis(FIXED_DATE),
    FIXED_DATE
  );
  const fields = byKey(analysis);

  assert.equal(analysis.siteKey, "qmul");
  assert.equal(fields.entryRequirements.value, "A 2:2 or above at undergraduate level in any subject.");
  assert.equal(
    fields.koreanAcademicRequirements.value,
    "UK 2:2 degree: GPA 3.0 out of 4.5; or GPA 2.8 out of 4.3; or GPA 2.5 out of 4.0"
  );
  assert.equal(fields.tuitionFee.value, "£35,250");
  assert.equal(fields.universityApplicationDeadline.value, "1st September 2026");
  assert.equal(fields.reference.value, "One referee");
  assert.equal(fields.sopGuideline.value, "Required");
  assert.equal(fields.cv.value, "Required");
});

test("QMUL 2:1과 upper second 표현은 한국 2:1 GPA 행으로 연결한다", async () => {
  for (const entryRequirements of [
    "A 2:1 or above at undergraduate level in any subject.",
    "An upper second-class honours degree is required.",
    "A first-class or upper second-class degree."
  ]) {
    const snapshot = await fixture("qmul-course-snapshot.json");
    snapshot.entryRequirements = entryRequirements;
    const fields = byKey(
      parseCourseSnapshot(
        snapshot,
        createDefaultBasis(FIXED_DATE),
        FIXED_DATE
      )
    );

    assert.equal(
      fields.koreanAcademicRequirements.value,
      "UK 2:1 degree: GPA 3.5 out of 4.5; or GPA 3.3 out of 4.3; or GPA 3.2 out of 4.0",
      entryRequirements
    );
    assert.equal(
      fields.koreanAcademicRequirements.reasonCode,
      "degree_class_upper_second"
    );
  }
});

test("과정 등급을 매칭하지 못하면 한국 조건 전문을 표시한다", async () => {
  const snapshot = await fixture("qmul-course-snapshot.json");
  snapshot.entryRequirements = "A good undergraduate degree is required.";
  const fields = byKey(
    parseCourseSnapshot(
      snapshot,
      createDefaultBasis(FIXED_DATE),
      FIXED_DATE
    )
  );

  assert.equal(
    fields.koreanAcademicRequirements.status,
    EXTRACTION_STATUS.ACTION_REQUIRED
  );
  assert.match(fields.koreanAcademicRequirements.value, /UK 1st class degree/);
  assert.match(fields.koreanAcademicRequirements.value, /UK 2:1 degree/);
  assert.match(fields.koreanAcademicRequirements.value, /UK 2:2 degree/);
  assert.equal(fields.koreanAcademicRequirements.copyText, "");
});

test("영국 학위 등급의 다섯 정규형을 판정한다", () => {
  assert.equal(detectMinimumDegreeClass("First-class degree"), "first");
  assert.equal(detectMinimumDegreeClass("Upper second-class degree"), "upper_second");
  assert.equal(detectMinimumDegreeClass("A 2.i degree"), "upper_second");
  assert.equal(detectMinimumDegreeClass("Lower second-class degree"), "lower_second");
  assert.equal(detectMinimumDegreeClass("A II.ii degree"), "lower_second");
  assert.equal(detectMinimumDegreeClass("Third-class degree"), "third");
  assert.equal(detectMinimumDegreeClass("Ordinary degree"), "pass");
});

test("QMUL 2027 기준은 2026 값을 재사용하지 않고 미발표 상태를 유지한다", async () => {
  const basis = createBasis({
    academicCycle: "2027/28",
    intakeMonth: 9,
    intakeYear: 2027,
    studyMode: "full-time",
    feeStatus: "international"
  });
  const analysis = parseCourseSnapshot(
    await fixture("qmul-course-snapshot.json"),
    basis,
    FIXED_DATE
  );
  const fields = byKey(analysis);

  assert.equal(fields.tuitionFee.status, EXTRACTION_STATUS.ACTION_REQUIRED);
  assert.equal(fields.tuitionFee.reasonCode, "fee_unpublished");
  assert.equal(fields.tuitionFee.copyText, "");
  assert.equal(
    fields.universityApplicationDeadline.status,
    EXTRACTION_STATUS.ACTION_REQUIRED
  );
  assert.equal(
    fields.universityApplicationDeadline.reasonCode,
    "deadline_unpublished"
  );
  assert.equal(fields.universityApplicationDeadline.copyText, "");
});
