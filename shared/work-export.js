import { isValidActiveCourseWork } from "./active-course-work.js";
import {
  EXTRACTION_FAILURE_CATEGORIES,
  WORK_ACTIVITY_TYPES,
  isValidWorkActivityEvent
} from "./work-activity-log.js";

export const ACTIVE_WORK_EXPORT_SCHEMA_VERSION = 1;
export const ACTIVE_WORK_EXPORT_FORMAT = "admission-active-course-work";

const CSV_HEADERS = Object.freeze([
  "createdAt",
  "type",
  "siteKey",
  "courseKey",
  "workId",
  "fieldKey",
  "status",
  "reasonCode",
  "failureCategory",
  "valueOrigin",
  "sourceUrl",
  "valueSnapshot",
  "previousValueSnapshot",
  "detail"
]);

function toCsvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function compareSummaryGroups(left, right) {
  return (
    right.failureCount - left.failureCount ||
    right.courseCount - left.courseCount ||
    left.siteKey.localeCompare(right.siteKey) ||
    left.fieldKey.localeCompare(right.fieldKey)
  );
}

export function createActiveCourseWorkExport(
  work,
  exportedAt = new Date()
) {
  if (
    !isValidActiveCourseWork(work) ||
    !(exportedAt instanceof Date) ||
    !Number.isFinite(exportedAt.getTime())
  ) {
    throw new TypeError("내보낼 활성 과정 작업 형식이 올바르지 않습니다.");
  }

  return {
    exportFormat: ACTIVE_WORK_EXPORT_FORMAT,
    exportSchemaVersion: ACTIVE_WORK_EXPORT_SCHEMA_VERSION,
    exportedAt: exportedAt.toISOString(),
    activeCourseWork: structuredClone(work)
  };
}

export function serializeActiveCourseWorkJson(
  work,
  exportedAt = new Date()
) {
  return `${JSON.stringify(
    createActiveCourseWorkExport(work, exportedAt),
    null,
    2
  )}\n`;
}

export function serializeWorkActivityCsv(events) {
  if (!Array.isArray(events) || !events.every(isValidWorkActivityEvent)) {
    throw new TypeError("내보낼 실사용 기록 형식이 올바르지 않습니다.");
  }

  const rows = events.map((event) =>
    CSV_HEADERS.map((header) => toCsvCell(event[header])).join(",")
  );
  return `\uFEFF${CSV_HEADERS.join(",")}\r\n${rows.join("\r\n")}${
    rows.length > 0 ? "\r\n" : ""
  }`;
}

export function summarizeWorkActivityFailures(events) {
  if (!Array.isArray(events) || !events.every(isValidWorkActivityEvent)) {
    throw new TypeError("요약할 실사용 기록 형식이 올바르지 않습니다.");
  }

  const failures = events.filter(
    (event) => event.type === WORK_ACTIVITY_TYPES.EXTRACTION_FAILED
  );
  const groups = new Map();

  for (const event of failures) {
    const key = `${event.siteKey}::${event.fieldKey}`;
    const group = groups.get(key) ?? {
      siteKey: event.siteKey,
      fieldKey: event.fieldKey,
      failureCount: 0,
      courseKeys: new Set(),
      categoryCounts: {},
      reasonCodeCounts: {},
      lastFailedAt: event.createdAt
    };
    group.failureCount += 1;
    if (event.courseKey) {
      group.courseKeys.add(event.courseKey);
    }
    group.categoryCounts[event.failureCategory] =
      (group.categoryCounts[event.failureCategory] ?? 0) + 1;
    group.reasonCodeCounts[event.reasonCode] =
      (group.reasonCodeCounts[event.reasonCode] ?? 0) + 1;
    if (Date.parse(event.createdAt) > Date.parse(group.lastFailedAt)) {
      group.lastFailedAt = event.createdAt;
    }
    groups.set(key, group);
  }

  const failureGroups = [...groups.values()]
    .map((group) => {
      const courseCount = group.courseKeys.size;
      const siteStructureFailureCount =
        group.categoryCounts[
          EXTRACTION_FAILURE_CATEGORIES.SITE_STRUCTURE
        ] ?? 0;
      return {
        siteKey: group.siteKey,
        fieldKey: group.fieldKey,
        failureCount: group.failureCount,
        courseCount,
        categoryCounts: { ...group.categoryCounts },
        reasonCodeCounts: { ...group.reasonCodeCounts },
        lastFailedAt: group.lastFailedAt,
        adapterCandidate:
          siteStructureFailureCount >= 3 && courseCount >= 2
      };
    })
    .sort(compareSummaryGroups);

  return {
    totalEventCount: events.length,
    failureEventCount: failures.length,
    failureGroups,
    adapterCandidates: failureGroups.filter(
      (group) => group.adapterCandidate
    )
  };
}

export function createExportFilename(prefix, extension, now = new Date()) {
  const safePrefix = String(prefix ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "admission-work";
  const date = now.toISOString().slice(0, 10);
  return `${safePrefix}-${date}.${extension}`;
}
