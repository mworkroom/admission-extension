import {
  ACTIVE_COURSE_WORK_STORAGE_KEY,
  deriveCourseKeyFromUrl,
  isValidActiveCourseWork
} from "./active-course-work.js";
import { EXTRACTION_STATUS, isExtractionStatus } from "./extraction-status.js";
import { FIELDS } from "./fields.js";

export const WORK_ACTIVITY_STORAGE_KEY = "activeCourseWorkEvents";
export const WORK_ACTIVITY_SCHEMA_VERSION = 1;
export const MAX_WORK_ACTIVITY_EVENTS = 1000;

export const WORK_ACTIVITY_TYPES = Object.freeze({
  EXTRACTION_SUCCEEDED: "extraction_succeeded",
  EXTRACTION_FAILED: "extraction_failed",
  MANUAL_VALUE_CREATED: "manual_value_created",
  MANUAL_VALUE_UPDATED: "manual_value_updated",
  COPY_SUCCEEDED: "field_copy_succeeded",
  COPY_FAILED: "field_copy_failed"
});

export const EXTRACTION_FAILURE_CATEGORIES = Object.freeze({
  SITE_STRUCTURE: "site_structure",
  SEPARATE_PAGE: "separate_page",
  APPLICATION_CHECK: "application_check"
});

const ACTIVITY_TYPE_VALUES = Object.freeze(
  Object.values(WORK_ACTIVITY_TYPES)
);
const FAILURE_CATEGORY_VALUES = Object.freeze(
  Object.values(EXTRACTION_FAILURE_CATEGORIES)
);
const FIELD_KEYS = Object.freeze(FIELDS.map((field) => field.key));

function normalizeText(value, maxLength = 1000) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function isValidTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isSafeOptionalUrl(value) {
  if (!value) {
    return true;
  }
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function shortHash(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function classifyExtractionResult(field) {
  const followUpSignal = normalizeText(
    [
      field?.value,
      field?.nextAction,
      field?.reasonCode
    ].join(" ")
  );

  if (/별도.*페이지|separate.*page/i.test(followUpSignal)) {
    return {
      succeeded: false,
      failureCategory: EXTRACTION_FAILURE_CATEGORIES.SEPARATE_PAGE,
      reasonCode: normalizeText(field?.reasonCode, 120) ||
        "separate_page_required"
    };
  }
  if (field?.status === EXTRACTION_STATUS.FOUND) {
    return {
      succeeded: true,
      failureCategory: "",
      reasonCode: normalizeText(field?.reasonCode, 120)
    };
  }
  const unresolvedSignal = normalizeText(
    [
      field?.value,
      field?.detail,
      field?.nextAction,
      field?.reasonCode
    ].join(" ")
  );
  if (
    /지원서|application form|application portal|online application/i.test(
      unresolvedSignal
    )
  ) {
    return {
      succeeded: false,
      failureCategory: EXTRACTION_FAILURE_CATEGORIES.APPLICATION_CHECK,
      reasonCode: normalizeText(field?.reasonCode, 120) ||
        "application_check_required"
    };
  }
  return {
    succeeded: false,
    failureCategory: EXTRACTION_FAILURE_CATEGORIES.SITE_STRUCTURE,
    reasonCode: normalizeText(field?.reasonCode, 120) ||
      "site_structure_not_found"
  };
}

export function createWorkActivityEvent(input, now = new Date()) {
  const createdAt = now.toISOString();
  const event = {
    schemaVersion: WORK_ACTIVITY_SCHEMA_VERSION,
    id: "",
    type: normalizeText(input?.type, 80),
    workId: normalizeText(input?.workId, 500),
    siteKey: normalizeText(input?.siteKey, 80).toLowerCase(),
    courseKey: normalizeText(input?.courseKey, 200).toLowerCase(),
    fieldKey: normalizeText(input?.fieldKey, 120),
    status: normalizeText(input?.status, 80),
    reasonCode: normalizeText(input?.reasonCode, 120),
    failureCategory: normalizeText(input?.failureCategory, 80),
    valueOrigin: normalizeText(input?.valueOrigin, 80),
    sourceUrl: normalizeText(input?.sourceUrl, 1000),
    valueSnapshot: normalizeText(input?.valueSnapshot),
    previousValueSnapshot: normalizeText(input?.previousValueSnapshot),
    detail: normalizeText(input?.detail, 300),
    createdAt
  };
  event.id = [
    event.type,
    now.getTime(),
    shortHash(JSON.stringify(event))
  ].join("::");

  if (!isValidWorkActivityEvent(event)) {
    throw new TypeError("실사용 기록 형식이 올바르지 않습니다.");
  }
  return event;
}

export function isValidWorkActivityEvent(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      value.schemaVersion === WORK_ACTIVITY_SCHEMA_VERSION &&
      typeof value.id === "string" &&
      value.id.length > 0 &&
      ACTIVITY_TYPE_VALUES.includes(value.type) &&
      /^[a-z0-9-]+$/.test(value.siteKey) &&
      typeof value.courseKey === "string" &&
      FIELD_KEYS.includes(value.fieldKey) &&
      (value.status === "" || isExtractionStatus(value.status)) &&
      typeof value.reasonCode === "string" &&
      (value.failureCategory === "" ||
        FAILURE_CATEGORY_VALUES.includes(value.failureCategory)) &&
      typeof value.workId === "string" &&
      typeof value.valueOrigin === "string" &&
      isSafeOptionalUrl(value.sourceUrl) &&
      typeof value.valueSnapshot === "string" &&
      typeof value.previousValueSnapshot === "string" &&
      typeof value.detail === "string" &&
      isValidTimestamp(value.createdAt)
  );
}

export function createExtractionActivityEvents(
  analysis,
  work = null,
  now = new Date()
) {
  const siteKey = normalizeText(analysis?.siteKey, 80).toLowerCase();
  const pageUrl = normalizeText(analysis?.page?.url, 1000);
  const courseKey =
    work?.courseKey || deriveCourseKeyFromUrl(siteKey, pageUrl);
  if (
    !/^[a-z0-9-]+$/.test(siteKey) ||
    !courseKey ||
    !Array.isArray(analysis?.fields)
  ) {
    throw new TypeError("추출 실사용 기록을 만들 분석 결과가 올바르지 않습니다.");
  }

  return analysis.fields.map((field) => {
    const classification = classifyExtractionResult(field);
    return createWorkActivityEvent(
      {
        type: classification.succeeded
          ? WORK_ACTIVITY_TYPES.EXTRACTION_SUCCEEDED
          : WORK_ACTIVITY_TYPES.EXTRACTION_FAILED,
        workId: work?.id || "",
        siteKey,
        courseKey,
        fieldKey: field.key,
        status: field.status,
        reasonCode: classification.reasonCode,
        failureCategory: classification.failureCategory,
        valueOrigin: "analysis",
        sourceUrl: field.source?.url || pageUrl,
        valueSnapshot: field.value,
        detail: field.detail || field.nextAction
      },
      now
    );
  });
}

function normalizeStoredEvents(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(isValidWorkActivityEvent)
    .slice(-MAX_WORK_ACTIVITY_EVENTS);
}

function getStoredEventsForWrite(value) {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || !value.every(isValidWorkActivityEvent)) {
    throw new TypeError(
      "손상된 실사용 기록이 있어 기존 저장값을 덮어쓰지 않습니다."
    );
  }
  return value.slice(-MAX_WORK_ACTIVITY_EVENTS);
}

export async function loadWorkActivityLog(
  storageArea = chrome.storage.local
) {
  try {
    const stored = await storageArea.get(WORK_ACTIVITY_STORAGE_KEY);
    const raw = stored[WORK_ACTIVITY_STORAGE_KEY];
    const events = normalizeStoredEvents(raw);
    return {
      events,
      recovered:
        raw !== undefined &&
        (!Array.isArray(raw) ||
          raw.some((event) => !isValidWorkActivityEvent(event))),
      persisted: true,
      error: null
    };
  } catch (error) {
    return {
      events: [],
      recovered: false,
      persisted: false,
      error
    };
  }
}

export async function appendWorkActivityEvents(
  input,
  storageArea = chrome.storage.local
) {
  const events = Array.isArray(input) ? input : [input];
  if (events.length === 0 || !events.every(isValidWorkActivityEvent)) {
    throw new TypeError("추가할 실사용 기록 형식이 올바르지 않습니다.");
  }
  const stored = await storageArea.get(WORK_ACTIVITY_STORAGE_KEY);
  const current = getStoredEventsForWrite(
    stored[WORK_ACTIVITY_STORAGE_KEY]
  );
  const next = [...current, ...structuredClone(events)].slice(
    -MAX_WORK_ACTIVITY_EVENTS
  );
  await storageArea.set({ [WORK_ACTIVITY_STORAGE_KEY]: next });
  return next;
}

export async function saveActiveCourseWorkWithActivity(
  work,
  event,
  storageArea = chrome.storage.local
) {
  if (!isValidActiveCourseWork(work) || !isValidWorkActivityEvent(event)) {
    throw new TypeError("활성 작업 또는 실사용 기록 형식이 올바르지 않습니다.");
  }
  const stored = await storageArea.get(WORK_ACTIVITY_STORAGE_KEY);
  const current = getStoredEventsForWrite(
    stored[WORK_ACTIVITY_STORAGE_KEY]
  );
  const nextEvents = [...current, structuredClone(event)].slice(
    -MAX_WORK_ACTIVITY_EVENTS
  );
  const safeWork = structuredClone(work);
  await storageArea.set({
    [ACTIVE_COURSE_WORK_STORAGE_KEY]: safeWork,
    [WORK_ACTIVITY_STORAGE_KEY]: nextEvents
  });
  return { work: safeWork, events: nextEvents };
}
