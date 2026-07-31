import test from "node:test";
import assert from "node:assert/strict";

import { createDefaultBasis } from "../shared/basis.js";
import { EXTRACTION_STATUS } from "../shared/extraction-status.js";
import { FIELDS } from "../shared/fields.js";
import {
  addManualValueToActiveCourseWork,
  createActiveCourseWorkFromAnalysis
} from "../shared/active-course-work.js";
import {
  EXTRACTION_FAILURE_CATEGORIES,
  WORK_ACTIVITY_STORAGE_KEY,
  WORK_ACTIVITY_TYPES,
  appendWorkActivityEvents,
  classifyExtractionResult,
  createExtractionActivityEvents,
  createWorkActivityEvent,
  loadWorkActivityLog,
  saveActiveCourseWorkWithActivity
} from "../shared/work-activity-log.js";

const NOW = new Date("2026-07-31T13:00:00.000Z");
const URL =
  "https://www.soas.ac.uk/study/find-course/msc-global-development";

function createAnalysis() {
  const basis = createDefaultBasis(NOW);
  return {
    schemaVersion: 3,
    siteKey: "soas",
    analyzedAt: NOW.toISOString(),
    stale: false,
    basis,
    page: {
      title: "MSc Global Development",
      url: URL
    },
    fields: FIELDS.map((field) => {
      const result = {
        ...field,
        status: EXTRACTION_STATUS.FOUND,
        value:
          field.key === "university"
            ? "SOAS University of London"
            : field.key === "course"
              ? "MSc Global Development"
              : `${field.label} value`,
        detail: "",
        nextAction: "",
        reasonCode: "",
        source: {
          url: URL,
          pageTitle: "MSc Global Development",
          sectionLabel: field.label,
          excerpt: `${field.label} source`
        },
        copyText: "",
        copyState: "idle"
      };
      if (field.key === "englishRequirements") {
        result.value = "별도 English language requirements 페이지 확인";
      }
      if (field.key === "sopGuideline") {
        result.status = EXTRACTION_STATUS.ACTION_REQUIRED;
        result.value = "Supporting statement";
        result.reasonCode = "guideline_not_provided";
        result.nextAction = "지원서의 supporting statement 안내를 직접 확인하세요.";
      }
      if (field.key === "applicationFee") {
        result.status = EXTRACTION_STATUS.NOT_FOUND;
        result.value = "";
        result.reasonCode = "not_present";
        result.detail = "과정 페이지에서 application fee를 찾지 못했습니다.";
      }
      return result;
    }),
    summary: {
      total: 11,
      found: 8
    }
  };
}

function createMemoryStorage(initial = {}, options = {}) {
  const values = structuredClone(initial);
  return {
    values,
    async get(key) {
      if (options.failGet) {
        throw new Error("get failed");
      }
      return Object.hasOwn(values, key)
        ? { [key]: structuredClone(values[key]) }
        : {};
    },
    async set(next) {
      if (options.failSet) {
        throw new Error("set failed");
      }
      Object.assign(values, structuredClone(next));
    }
  };
}

test("추출 결과를 성공과 세 가지 실패 분류로 구분한다", () => {
  const analysis = createAnalysis();
  const byKey = Object.fromEntries(
    analysis.fields.map((field) => [
      field.key,
      classifyExtractionResult(field)
    ])
  );

  assert.equal(byKey.tuitionFee.succeeded, true);
  assert.equal(
    byKey.englishRequirements.failureCategory,
    EXTRACTION_FAILURE_CATEGORIES.SEPARATE_PAGE
  );
  assert.equal(
    byKey.sopGuideline.failureCategory,
    EXTRACTION_FAILURE_CATEGORIES.APPLICATION_CHECK
  );
  assert.equal(
    byKey.applicationFee.failureCategory,
    EXTRACTION_FAILURE_CATEGORIES.SITE_STRUCTURE
  );
});

test("확인된 KCL SOP의 제출 방법 설명은 지원서 확인 실패로 분류하지 않는다", () => {
  const classification = classifyExtractionResult({
    status: EXTRACTION_STATUS.FOUND,
    value: "Yes",
    detail:
      "A personal statement is required. This can be entered directly into the online application form (maximum 4,000 characters) or uploaded as an attachment to the online application form (maximum 2 pages).",
    nextAction: "",
    reasonCode: ""
  });

  assert.deepEqual(classification, {
    succeeded: true,
    failureCategory: "",
    reasonCode: ""
  });
});

test("분석 한 번에서 11개 항목별 추출 기록과 reason code를 만든다", () => {
  const analysis = createAnalysis();
  const work = createActiveCourseWorkFromAnalysis(analysis, NOW).work;
  const events = createExtractionActivityEvents(analysis, work, NOW);

  assert.equal(events.length, 11);
  assert.equal(events.every((event) => event.workId === work.id), true);
  assert.equal(
    events.find((event) => event.fieldKey === "englishRequirements").reasonCode,
    "separate_page_required"
  );
  assert.equal(
    events.find((event) => event.fieldKey === "sopGuideline").type,
    WORK_ACTIVITY_TYPES.EXTRACTION_FAILED
  );
});

test("항목별 복사 성공·실패 기록을 로컬 로그에 누적한다", async () => {
  const storage = createMemoryStorage();
  const success = createWorkActivityEvent(
    {
      type: WORK_ACTIVITY_TYPES.COPY_SUCCEEDED,
      workId: "soas::msc-global-development",
      siteKey: "soas",
      courseKey: "msc-global-development",
      fieldKey: "reference",
      status: EXTRACTION_STATUS.FOUND,
      valueOrigin: "analysis",
      sourceUrl: URL,
      valueSnapshot: "Optional"
    },
    NOW
  );
  const failed = createWorkActivityEvent(
    {
      type: WORK_ACTIVITY_TYPES.COPY_FAILED,
      workId: "soas::msc-global-development",
      siteKey: "soas",
      courseKey: "msc-global-development",
      fieldKey: "reference",
      valueOrigin: "analysis",
      sourceUrl: URL,
      valueSnapshot: "Optional",
      detail: "clipboard denied"
    },
    new Date("2026-07-31T13:01:00.000Z")
  );

  await appendWorkActivityEvents([success, failed], storage);
  const state = await loadWorkActivityLog(storage);

  assert.equal(state.events.length, 2);
  assert.deepEqual(
    state.events.map((event) => event.type),
    [WORK_ACTIVITY_TYPES.COPY_SUCCEEDED, WORK_ACTIVITY_TYPES.COPY_FAILED]
  );
});

test("직접 입력값과 생성 기록은 한 번의 storage set으로 함께 저장한다", async () => {
  const analysis = createAnalysis();
  const initial = createActiveCourseWorkFromAnalysis(analysis, NOW).work;
  const manual = addManualValueToActiveCourseWork(
    initial,
    {
      fieldKey: "applicationFee",
      value: "No application fee",
      sourceUrl: "https://www.soas.ac.uk/admissions/apply/"
    },
    new Date("2026-07-31T13:02:00.000Z")
  );
  const event = createWorkActivityEvent(
    {
      type: WORK_ACTIVITY_TYPES.MANUAL_VALUE_CREATED,
      workId: manual.work.id,
      siteKey: manual.work.siteKey,
      courseKey: manual.work.courseKey,
      fieldKey: "applicationFee",
      status: EXTRACTION_STATUS.FOUND,
      valueOrigin: "manual",
      sourceUrl: "https://www.soas.ac.uk/admissions/apply/",
      valueSnapshot: "No application fee"
    },
    new Date("2026-07-31T13:02:00.000Z")
  );
  const storage = createMemoryStorage();

  await saveActiveCourseWorkWithActivity(manual.work, event, storage);

  assert.equal(storage.values.activeCourseWork.id, manual.work.id);
  assert.equal(
    storage.values[WORK_ACTIVITY_STORAGE_KEY][0].type,
    WORK_ACTIVITY_TYPES.MANUAL_VALUE_CREATED
  );
});

test("직접 입력 통합 저장 실패 시 기존 작업과 기록을 유지한다", async () => {
  const analysis = createAnalysis();
  const original = createActiveCourseWorkFromAnalysis(analysis, NOW).work;
  const manual = addManualValueToActiveCourseWork(
    original,
    { fieldKey: "cv", value: "Not required" },
    new Date("2026-07-31T13:03:00.000Z")
  );
  const event = createWorkActivityEvent(
    {
      type: WORK_ACTIVITY_TYPES.MANUAL_VALUE_CREATED,
      workId: manual.work.id,
      siteKey: manual.work.siteKey,
      courseKey: manual.work.courseKey,
      fieldKey: "cv",
      status: EXTRACTION_STATUS.FOUND,
      valueOrigin: "manual",
      valueSnapshot: "Not required"
    },
    new Date("2026-07-31T13:03:00.000Z")
  );
  const storage = createMemoryStorage(
    {
      activeCourseWork: original,
      [WORK_ACTIVITY_STORAGE_KEY]: []
    },
    { failSet: true }
  );

  await assert.rejects(
    () => saveActiveCourseWorkWithActivity(manual.work, event, storage),
    /set failed/
  );
  assert.deepEqual(storage.values.activeCourseWork, original);
  assert.deepEqual(storage.values[WORK_ACTIVITY_STORAGE_KEY], []);
});

test("손상된 실사용 기록은 격리하고 새 저장으로 덮어쓰지 않는다", async () => {
  const damaged = [{ type: "unknown", createdAt: "not-a-date" }];
  const storage = createMemoryStorage({
    [WORK_ACTIVITY_STORAGE_KEY]: damaged
  });
  const event = createWorkActivityEvent(
    {
      type: WORK_ACTIVITY_TYPES.COPY_SUCCEEDED,
      siteKey: "soas",
      courseKey: "msc-global-development",
      fieldKey: "reference",
      status: EXTRACTION_STATUS.FOUND,
      valueOrigin: "analysis",
      valueSnapshot: "Optional"
    },
    NOW
  );

  const state = await loadWorkActivityLog(storage);
  assert.equal(state.recovered, true);
  assert.deepEqual(state.events, []);
  await assert.rejects(
    () => appendWorkActivityEvents(event, storage),
    /손상된 실사용 기록/
  );
  assert.deepEqual(storage.values[WORK_ACTIVITY_STORAGE_KEY], damaged);
});
