import test from "node:test";
import assert from "node:assert/strict";

import { createDefaultBasis } from "../shared/basis.js";
import { EXTRACTION_STATUS } from "../shared/extraction-status.js";
import { FIELDS } from "../shared/fields.js";
import { createActiveCourseWorkFromAnalysis } from "../shared/active-course-work.js";
import {
  EXTRACTION_FAILURE_CATEGORIES,
  WORK_ACTIVITY_TYPES,
  createWorkActivityEvent
} from "../shared/work-activity-log.js";
import {
  ACTIVE_WORK_EXPORT_FORMAT,
  createExportFilename,
  serializeActiveCourseWorkJson,
  serializeWorkActivityCsv,
  summarizeWorkActivityFailures
} from "../shared/work-export.js";

const NOW = new Date("2026-07-31T14:00:00.000Z");
const QMUL_URL =
  "https://www.qmul.ac.uk/postgraduate/taught/coursefinder/courses/corporate-finance-msc/";

function createAnalysis() {
  return {
    schemaVersion: 3,
    siteKey: "qmul",
    analyzedAt: NOW.toISOString(),
    stale: false,
    basis: createDefaultBasis(NOW),
    page: {
      title: "Corporate Finance MSc",
      url: QMUL_URL
    },
    fields: FIELDS.map((field) => ({
      ...field,
      status: EXTRACTION_STATUS.FOUND,
      value:
        field.key === "university"
          ? "Queen Mary University of London"
          : field.key === "course"
            ? "Corporate Finance MSc"
            : `${field.label} value`,
      detail: "",
      nextAction: "",
      reasonCode: "",
      source: {
        url: QMUL_URL,
        pageTitle: "Corporate Finance MSc",
        sectionLabel: field.label,
        excerpt: `${field.label} source`
      },
      copyText: "",
      copyState: "idle"
    })),
    summary: {
      total: 11,
      found: 11
    }
  };
}

function createFailure({
  siteKey = "qmul",
  courseKey,
  fieldKey = "applicationFee",
  category = EXTRACTION_FAILURE_CATEGORIES.SITE_STRUCTURE,
  reasonCode = "not_present",
  createdAt
}) {
  return createWorkActivityEvent(
    {
      type: WORK_ACTIVITY_TYPES.EXTRACTION_FAILED,
      siteKey,
      courseKey,
      fieldKey,
      status: EXTRACTION_STATUS.NOT_FOUND,
      reasonCode,
      failureCategory: category,
      valueOrigin: "analysis",
      sourceUrl: "https://www.qmul.ac.uk/postgraduate/",
      detail: '값, "원문" 확인 필요'
    },
    new Date(createdAt)
  );
}

test("활성 과정 작업을 버전 있는 JSON wrapper로 내보낸다", () => {
  const work = createActiveCourseWorkFromAnalysis(createAnalysis(), NOW).work;
  const json = serializeActiveCourseWorkJson(work, NOW);
  const exported = JSON.parse(json);

  assert.equal(exported.exportFormat, ACTIVE_WORK_EXPORT_FORMAT);
  assert.equal(exported.exportSchemaVersion, 1);
  assert.equal(exported.exportedAt, NOW.toISOString());
  assert.deepEqual(exported.activeCourseWork, work);
  assert.equal(json.endsWith("\n"), true);
});

test("실사용 기록 CSV는 BOM, 고정 열과 따옴표 escaping을 사용한다", () => {
  const event = createFailure({
    courseKey: "corporate-finance-msc",
    createdAt: "2026-07-31T14:01:00.000Z"
  });
  const csv = serializeWorkActivityCsv([event]);

  assert.equal(csv.startsWith("\uFEFFcreatedAt,type,siteKey"), true);
  assert.match(csv, /"extraction_failed"/);
  assert.match(csv, /"값, ""원문"" 확인 필요"/);
  assert.equal(csv.endsWith("\r\n"), true);
});

test("자유 형식 문제 생성·수정·삭제 이력을 같은 CSV에 포함한다", () => {
  const issueEvents = [
    createWorkActivityEvent(
      {
        type: WORK_ACTIVITY_TYPES.ISSUE_CREATED,
        siteKey: "manchester",
        courseKey: "",
        fieldKey: "",
        reasonCode: "user_reported_issue",
        valueOrigin: "user",
        sourceUrl:
          "https://www.alliancembs.manchester.ac.uk/study/masters/how-to-apply/",
        valueSnapshot: "여러 마감일 중 첫 날짜만 추출됨."
      },
      new Date("2026-07-31T15:00:00.000Z")
    ),
    createWorkActivityEvent(
      {
        type: WORK_ACTIVITY_TYPES.ISSUE_UPDATED,
        siteKey: "manchester",
        courseKey: "",
        fieldKey: "",
        reasonCode: "user_reported_issue",
        valueOrigin: "user",
        sourceUrl:
          "https://www.alliancembs.manchester.ac.uk/study/masters/how-to-apply/",
        valueSnapshot: "여러 마감일 표 전체가 누락됨.",
        previousValueSnapshot: "여러 마감일 중 첫 날짜만 추출됨."
      },
      new Date("2026-07-31T15:01:00.000Z")
    ),
    createWorkActivityEvent(
      {
        type: WORK_ACTIVITY_TYPES.ISSUE_DELETED,
        siteKey: "manchester",
        courseKey: "",
        fieldKey: "",
        reasonCode: "user_reported_issue",
        valueOrigin: "user",
        sourceUrl:
          "https://www.alliancembs.manchester.ac.uk/study/masters/how-to-apply/",
        previousValueSnapshot: "여러 마감일 표 전체가 누락됨."
      },
      new Date("2026-07-31T15:02:00.000Z")
    )
  ];
  const csv = serializeWorkActivityCsv(issueEvents);

  assert.match(csv, /"user_issue_created"/);
  assert.match(csv, /"user_issue_updated"/);
  assert.match(csv, /"user_issue_deleted"/);
  assert.match(csv, /"여러 마감일 표 전체가 누락됨\."/);
});

test("사이트·항목별 실패를 합치고 반복 site_structure만 개선 후보로 정한다", () => {
  const events = [
    createFailure({
      courseKey: "corporate-finance-msc",
      createdAt: "2026-07-31T14:01:00.000Z"
    }),
    createFailure({
      courseKey: "banking-finance-msc",
      createdAt: "2026-07-31T14:02:00.000Z"
    }),
    createFailure({
      courseKey: "accounting-finance-msc",
      createdAt: "2026-07-31T14:03:00.000Z"
    }),
    createFailure({
      siteKey: "soas",
      courseKey: "msc-global-development",
      fieldKey: "sopGuideline",
      category: EXTRACTION_FAILURE_CATEGORIES.APPLICATION_CHECK,
      reasonCode: "guideline_not_provided",
      createdAt: "2026-07-31T14:04:00.000Z"
    })
  ];
  const summary = summarizeWorkActivityFailures(events);

  assert.equal(summary.failureEventCount, 4);
  assert.equal(summary.failureGroups.length, 2);
  assert.equal(summary.adapterCandidates.length, 1);
  assert.deepEqual(
    {
      siteKey: summary.adapterCandidates[0].siteKey,
      fieldKey: summary.adapterCandidates[0].fieldKey,
      failureCount: summary.adapterCandidates[0].failureCount,
      courseCount: summary.adapterCandidates[0].courseCount
    },
    {
      siteKey: "qmul",
      fieldKey: "applicationFee",
      failureCount: 3,
      courseCount: 3
    }
  );
});

test("같은 과정의 반복과 별도 페이지 실패는 adapter 후보로 올리지 않는다", () => {
  const sameCourse = [1, 2, 3].map((minute) =>
    createFailure({
      siteKey: "soas",
      courseKey: "msc-global-development",
      fieldKey: "englishRequirements",
      category: EXTRACTION_FAILURE_CATEGORIES.SEPARATE_PAGE,
      reasonCode: "separate_page_required",
      createdAt: `2026-07-31T14:0${minute}:00.000Z`
    })
  );
  const summary = summarizeWorkActivityFailures(sameCourse);

  assert.equal(summary.failureGroups[0].failureCount, 3);
  assert.equal(summary.failureGroups[0].courseCount, 1);
  assert.equal(summary.adapterCandidates.length, 0);
});

test("파일 이름은 안전한 slug와 내보낸 날짜를 사용한다", () => {
  assert.equal(
    createExportFilename(
      "QMUL Corporate Finance MSc 2026/27",
      "json",
      NOW
    ),
    "qmul-corporate-finance-msc-2026-27-2026-07-31.json"
  );
});
