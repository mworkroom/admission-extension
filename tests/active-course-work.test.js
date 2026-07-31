import test from "node:test";
import assert from "node:assert/strict";

import { createDefaultBasis } from "../shared/basis.js";
import { EXTRACTION_STATUS } from "../shared/extraction-status.js";
import { FIELDS } from "../shared/fields.js";
import {
  ACTIVE_COURSE_WORK_STORAGE_KEY,
  addManualValueToActiveCourseWork,
  buildActiveCourseWorkId,
  createActiveCourseWork,
  createActiveCourseWorkFromAnalysis,
  createWorkValueEntry,
  deriveCourseKeyFromUrl,
  getSelectedWorkValueEntry,
  isValidActiveCourseWork,
  loadActiveCourseWorkState,
  mergeAnalysisIntoActiveCourseWork,
  saveActiveCourseWork,
  summarizeActiveCourseWork,
  WORK_VALUE_ORIGINS
} from "../shared/active-course-work.js";

const FIXED_DATE = new Date("2026-07-31T12:00:00.000Z");
const QMUL_URL =
  "https://www.qmul.ac.uk/postgraduate/taught/coursefinder/courses/corporate-finance-msc/";
const KCL_REQUIREMENTS_URL =
  "https://www.kcl.ac.uk/study/postgraduate-taught/courses/nutrition-msc/requirements";
const KCL_FEES_URL =
  "https://www.kcl.ac.uk/study/postgraduate-taught/courses/nutrition-msc/fees";

function createWork() {
  return createActiveCourseWork(
    {
      siteKey: "qmul",
      universityName: "Queen Mary University of London",
      courseName: "Corporate Finance MSc",
      primaryCourseUrl: QMUL_URL,
      pageTitle: "Corporate Finance MSc",
      basis: createDefaultBasis(FIXED_DATE)
    },
    FIXED_DATE
  );
}

function createAnalysis(overrides = {}) {
  const siteKey = overrides.siteKey ?? "kcl";
  const pageUrl = overrides.pageUrl ?? KCL_REQUIREMENTS_URL;
  const courseName = overrides.courseName ?? "Nutrition MSc";
  const tuitionFee = overrides.tuitionFee ?? "£35,800";
  const fields = FIELDS.map((field) => ({
    key: field.key,
    label: field.label,
    order: field.order,
    status: EXTRACTION_STATUS.FOUND,
    reasonCode: "",
    value:
      field.key === "university"
        ? siteKey === "kcl"
          ? "King's College London"
          : "Queen Mary University of London"
        : field.key === "course"
          ? courseName
          : field.key === "tuitionFee"
            ? tuitionFee
            : `${field.label} value`,
    detail: "",
    nextAction: "",
    source: {
      url: pageUrl,
      pageTitle: overrides.pageTitle ?? courseName,
      sectionLabel: field.label,
      excerpt: `${field.label} source`
    },
    copyText: "",
    copyState: "idle"
  }));

  return {
    schemaVersion: 3,
    siteKey,
    analyzedAt: (overrides.analyzedAt ?? FIXED_DATE).toISOString(),
    stale: false,
    basis: {
      academicCycle: "2026/27",
      intakeMonth: 9,
      intakeYear: 2026,
      studyMode: "full-time",
      feeStatus: "international"
    },
    page: {
      title: overrides.pageTitle ?? courseName,
      url: pageUrl
    },
    fields,
    summary: {
      total: 11,
      found: 11
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
      return Object.hasOwn(values, key) ? { [key]: structuredClone(values[key]) } : {};
    },
    async set(next) {
      if (options.failSet) {
        throw new Error("set failed");
      }
      Object.assign(values, structuredClone(next));
    }
  };
}

test("정밀 adapter와 generic 대학 URL에서 안정적인 과정 키를 분리한다", () => {
  assert.equal(
    deriveCourseKeyFromUrl(
      "kcl",
      "https://www.kcl.ac.uk/study/postgraduate-taught/courses/nutrition-msc/requirements"
    ),
    "nutrition-msc"
  );
  assert.equal(
    deriveCourseKeyFromUrl(
      "kcl",
      "https://www.kcl.ac.uk/study/postgraduate-taught/courses/nutrition-msc/fees"
    ),
    "nutrition-msc"
  );
  assert.equal(
    deriveCourseKeyFromUrl(
      "soas",
      "https://www.soas.ac.uk/study/find-course/msc-global-development"
    ),
    "msc-global-development"
  );
  assert.equal(deriveCourseKeyFromUrl("qmul", QMUL_URL), "corporate-finance-msc");
  assert.equal(
    deriveCourseKeyFromUrl(
      "manchester",
      "https://www.alliancembs.manchester.ac.uk/study/masters/msc-marketing/entry-requirements/"
    ),
    "msc-marketing"
  );
  assert.equal(
    deriveCourseKeyFromUrl(
      "manchester",
      "https://www.alliancembs.manchester.ac.uk/study/masters/masters-entry-requirements/"
    ),
    "masters-entry-requirements"
  );
  assert.equal(
    deriveCourseKeyFromUrl("qmul", "https://example.com/corporate-finance-msc"),
    ""
  );
  assert.equal(
    deriveCourseKeyFromUrl(
      "bristol-ac-uk",
      "https://www.bristol.ac.uk/study/postgraduate/taught/msc-marketing/entry-requirements/"
    ),
    "msc-marketing"
  );
  assert.equal(
    deriveCourseKeyFromUrl(
      "bristol-ac-uk",
      "https://www.bristol.ac.uk/study/postgraduate/taught/msc-marketing/fees/"
    ),
    "msc-marketing"
  );
  assert.equal(
    deriveCourseKeyFromUrl(
      "different-ac-uk",
      "https://www.bristol.ac.uk/study/postgraduate/taught/msc-marketing/"
    ),
    ""
  );
});

test("한 활성 작업에 과정·기준·출처와 11개 항목 상태를 만든다", () => {
  const work = createWork();

  assert.equal(work.schemaVersion, 1);
  assert.equal(work.siteKey, "qmul");
  assert.equal(work.courseKey, "corporate-finance-msc");
  assert.equal(work.courseName, "Corporate Finance MSc");
  assert.equal(work.basis.academicCycle, "2026/27");
  assert.equal(work.basis.intakeMonth, 9);
  assert.deepEqual(work.sourcePages, [
    {
      url: QMUL_URL,
      title: "Corporate Finance MSc",
      kind: "course",
      addedAt: FIXED_DATE.toISOString(),
      lastAnalyzedAt: null
    }
  ]);
  assert.deepEqual(
    work.fieldStates.map((field) => field.fieldKey),
    FIELDS.map((field) => field.key)
  );
  assert.equal(work.fieldStates.every((field) => field.entries.length === 0), true);
  assert.equal(work.id, buildActiveCourseWorkId(work));
  assert.equal(isValidActiveCourseWork(work), true);
});

test("분석값과 수동값을 origin과 출처로 명확히 구분한다", () => {
  const analysisEntry = createWorkValueEntry(
    {
      fieldKey: "tuitionFee",
      origin: WORK_VALUE_ORIGINS.ANALYSIS,
      status: EXTRACTION_STATUS.FOUND,
      value: "£35,250",
      sourcePageUrl: QMUL_URL,
      sourceLabel: "Tuition fees",
      sourceExcerpt: "Overseas: £35,250"
    },
    FIXED_DATE
  );
  const manualEntry = createWorkValueEntry(
    {
      fieldKey: "tuitionFee",
      origin: WORK_VALUE_ORIGINS.MANUAL,
      value: "£35,500",
      detail: "지원서에서 직접 확인"
    },
    new Date("2026-07-31T12:01:00.000Z")
  );

  assert.equal(analysisEntry.origin, "analysis");
  assert.deepEqual(analysisEntry.sourceRefs, [
    {
      pageUrl: QMUL_URL,
      sourceLabel: "Tuition fees",
      sourceExcerpt: "Overseas: £35,250"
    }
  ]);
  assert.equal(manualEntry.origin, "manual");
  assert.equal(manualEntry.status, EXTRACTION_STATUS.FOUND);
  assert.deepEqual(manualEntry.sourceRefs, []);
  assert.notEqual(analysisEntry.id, manualEntry.id);

  const work = createWork();
  const tuitionState = work.fieldStates.find(
    (field) => field.fieldKey === "tuitionFee"
  );
  tuitionState.entries = [analysisEntry, manualEntry];
  tuitionState.selectedEntryId = manualEntry.id;
  assert.equal(isValidActiveCourseWork(work), true);

  analysisEntry.sourceRefs[0].pageUrl = "https://fees.example.com/unrelated";
  assert.equal(isValidActiveCourseWork(work), false);
});

test("분석값에는 공식 https 출처를 요구하고 수동값에는 실제 값을 요구한다", () => {
  assert.throws(
    () =>
      createWorkValueEntry(
        {
          fieldKey: "tuitionFee",
          origin: WORK_VALUE_ORIGINS.ANALYSIS,
          status: EXTRACTION_STATUS.FOUND,
          value: "£35,250",
          sourcePageUrl: ""
        },
        FIXED_DATE
      ),
    /형식이 올바르지/
  );
  assert.throws(
    () =>
      createWorkValueEntry(
        {
          fieldKey: "tuitionFee",
          origin: WORK_VALUE_ORIGINS.MANUAL,
          value: ""
        },
        FIXED_DATE
      ),
    /형식이 올바르지/
  );
});

test("유효한 활성 작업을 저장하고 복제된 값으로 다시 불러온다", async () => {
  const storage = createMemoryStorage();
  const work = createWork();

  const saved = await saveActiveCourseWork(work, storage);
  saved.courseName = "changed outside storage";
  const state = await loadActiveCourseWorkState(storage);

  assert.equal(state.work.courseName, "Corporate Finance MSc");
  assert.equal(state.persisted, true);
  assert.equal(state.recovered, false);
  assert.equal(state.quarantined, false);
});

test("손상된 활성 작업은 격리하고 저장 원본을 덮어쓰지 않는다", async () => {
  const damaged = {
    ...createWork(),
    sourcePages: []
  };
  const storage = createMemoryStorage({
    [ACTIVE_COURSE_WORK_STORAGE_KEY]: damaged
  });

  const state = await loadActiveCourseWorkState(storage);

  assert.equal(state.work, null);
  assert.equal(state.recovered, true);
  assert.equal(state.quarantined, true);
  assert.deepEqual(storage.values[ACTIVE_COURSE_WORK_STORAGE_KEY], damaged);
});

test("알 수 없는 상위 schema는 자동 변환하거나 덮어쓰지 않는다", async () => {
  const future = {
    ...createWork(),
    schemaVersion: 2
  };
  const storage = createMemoryStorage({
    [ACTIVE_COURSE_WORK_STORAGE_KEY]: future
  });

  const state = await loadActiveCourseWorkState(storage);

  assert.equal(state.work, null);
  assert.equal(state.unsupportedSchema, true);
  assert.equal(state.recovered, false);
  assert.deepEqual(storage.values[ACTIVE_COURSE_WORK_STORAGE_KEY], future);
});

test("잘못된 저장과 storage 실패는 기존 활성 작업을 유지한다", async () => {
  const original = createWork();
  const invalid = {
    ...original,
    fieldStates: original.fieldStates.slice(1)
  };
  const invalidStorage = createMemoryStorage({
    [ACTIVE_COURSE_WORK_STORAGE_KEY]: original
  });

  await assert.rejects(
    () => saveActiveCourseWork(invalid, invalidStorage),
    /형식이 올바르지/
  );
  assert.deepEqual(
    invalidStorage.values[ACTIVE_COURSE_WORK_STORAGE_KEY],
    original
  );

  const failingStorage = createMemoryStorage(
    { [ACTIVE_COURSE_WORK_STORAGE_KEY]: original },
    { failSet: true }
  );
  await assert.rejects(
    () => saveActiveCourseWork(createWork(), failingStorage),
    /set failed/
  );
  assert.deepEqual(
    failingStorage.values[ACTIVE_COURSE_WORK_STORAGE_KEY],
    original
  );
});

test("저장소 읽기 실패는 빈 작업과 실패 상태를 반환한다", async () => {
  const state = await loadActiveCourseWorkState(
    createMemoryStorage({}, { failGet: true })
  );

  assert.equal(state.work, null);
  assert.equal(state.persisted, false);
  assert.match(state.error.message, /get failed/);
});

test("현재 분석으로 활성 작업을 시작하고 11개 값을 출처와 함께 저장한다", () => {
  const result = createActiveCourseWorkFromAnalysis(
    createAnalysis(),
    FIXED_DATE
  );
  const summary = summarizeActiveCourseWork(result.work);

  assert.equal(result.addedEntryCount, 11);
  assert.equal(result.addedSourcePageCount, 0);
  assert.equal(summary.sourcePageCount, 1);
  assert.equal(summary.capturedEntryCount, 11);
  assert.deepEqual(summary.conflictFieldKeys, []);
  assert.equal(
    result.work.fieldStates.every(
      (fieldState) =>
        fieldState.entries.length === 1 &&
        fieldState.selectedEntryId === fieldState.entries[0].id
    ),
    true
  );
});

test("같은 값은 중복하지 않고 다른 공식 페이지 출처만 합친다", () => {
  const initial = createActiveCourseWorkFromAnalysis(
    createAnalysis(),
    FIXED_DATE
  ).work;
  const feesAnalysis = createAnalysis({
    pageUrl: KCL_FEES_URL,
    pageTitle: "Nutrition MSc Fees",
    analyzedAt: new Date("2026-07-31T12:05:00.000Z")
  });

  const result = mergeAnalysisIntoActiveCourseWork(
    initial,
    feesAnalysis,
    new Date("2026-07-31T12:05:00.000Z")
  );

  assert.equal(result.addedSourcePageCount, 1);
  assert.equal(result.addedEntryCount, 0);
  assert.equal(result.mergedSourceRefCount, 11);
  assert.equal(summarizeActiveCourseWork(result.work).capturedEntryCount, 11);
  assert.deepEqual(
    result.work.fieldStates.find(
      (fieldState) => fieldState.fieldKey === "tuitionFee"
    ).entries[0].sourceRefs.map((sourceRef) => sourceRef.pageUrl),
    [KCL_REQUIREMENTS_URL, KCL_FEES_URL]
  );
});

test("다른 실제 값은 덮어쓰지 않고 충돌 후보로 모두 보존한다", () => {
  const initial = createActiveCourseWorkFromAnalysis(
    createAnalysis(),
    FIXED_DATE
  ).work;
  const changed = createAnalysis({
    tuitionFee: "£36,200",
    analyzedAt: new Date("2026-07-31T12:10:00.000Z")
  });

  const result = mergeAnalysisIntoActiveCourseWork(
    initial,
    changed,
    new Date("2026-07-31T12:10:00.000Z")
  );
  const tuitionState = result.work.fieldStates.find(
    (fieldState) => fieldState.fieldKey === "tuitionFee"
  );

  assert.equal(result.addedEntryCount, 1);
  assert.deepEqual(result.conflictFieldKeys, ["tuitionFee"]);
  assert.deepEqual(
    tuitionState.entries.map((entry) => entry.value),
    ["£35,800", "£36,200"]
  );
  assert.equal(tuitionState.selectedEntryId, null);
});

test("직접 입력값은 분석값을 보존한 새 manual entry로 선택한다", () => {
  const initial = createActiveCourseWorkFromAnalysis(
    createAnalysis(),
    FIXED_DATE
  ).work;
  const result = addManualValueToActiveCourseWork(
    initial,
    {
      fieldKey: "tuitionFee",
      value: "£36,500",
      sourceUrl: KCL_FEES_URL,
      sourceLabel: "Fees page"
    },
    new Date("2026-07-31T12:20:00.000Z")
  );
  const fieldState = result.work.fieldStates.find(
    (state) => state.fieldKey === "tuitionFee"
  );

  assert.equal(result.mode, "created");
  assert.equal(fieldState.entries.length, 2);
  assert.equal(fieldState.entries[0].value, "£35,800");
  assert.equal(getSelectedWorkValueEntry(result.work, "tuitionFee").value, "£36,500");
  assert.equal(getSelectedWorkValueEntry(result.work, "tuitionFee").origin, "manual");
});

test("직접 입력값 수정은 이전 manual entry를 보존하고 새 값을 선택한다", () => {
  const initial = createActiveCourseWorkFromAnalysis(
    createAnalysis(),
    FIXED_DATE
  ).work;
  const created = addManualValueToActiveCourseWork(
    initial,
    {
      fieldKey: "reference",
      value: "One academic reference"
    },
    new Date("2026-07-31T12:20:00.000Z")
  );
  const updated = addManualValueToActiveCourseWork(
    created.work,
    {
      fieldKey: "reference",
      value: "Two references, one academic"
    },
    new Date("2026-07-31T12:25:00.000Z")
  );

  assert.equal(updated.mode, "updated");
  assert.equal(updated.previousEntry.value, "One academic reference");
  assert.equal(
    getSelectedWorkValueEntry(updated.work, "reference").value,
    "Two references, one academic"
  );
  assert.equal(
    updated.work.fieldStates.find((state) => state.fieldKey === "reference")
      .entries.length,
    3
  );
});

test("다른 과정 또는 입학 기준은 기존 활성 작업에 병합하지 않는다", () => {
  const initial = createActiveCourseWorkFromAnalysis(
    createAnalysis(),
    FIXED_DATE
  ).work;
  const otherCourse = createAnalysis({
    pageUrl:
      "https://www.kcl.ac.uk/study/postgraduate-taught/courses/dietetics-msc/requirements",
    courseName: "Dietetics MSc"
  });

  assert.throws(
    () =>
      mergeAnalysisIntoActiveCourseWork(
        initial,
        otherCourse,
        new Date("2026-07-31T12:15:00.000Z")
      ),
    /다른 과정 또는 입학 기준/
  );
});
