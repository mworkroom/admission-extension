import {
  MAX_WORK_ACTIVITY_EVENTS,
  WORK_ACTIVITY_STORAGE_KEY,
  isValidWorkActivityEvent
} from "./work-activity-log.js";

export const ISSUE_NOTE_STORAGE_KEY = "issueNoteStore";
export const ISSUE_NOTE_SCHEMA_VERSION = 1;
export const MAX_ISSUE_NOTES = 500;

function normalizeText(value, maxLength = 2000) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, maxLength);
}

function normalizeSingleLine(value, maxLength = 300) {
  return normalizeText(value, maxLength).replace(/\s+/g, " ");
}

function isValidTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isSafeHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
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

export function createDefaultIssueNoteStore() {
  return {
    schemaVersion: ISSUE_NOTE_SCHEMA_VERSION,
    records: []
  };
}

export function createIssueNoteRecord(input, now = new Date()) {
  const createdAt = now.toISOString();
  const record = {
    schemaVersion: ISSUE_NOTE_SCHEMA_VERSION,
    id: "",
    workId: normalizeSingleLine(input?.workId, 500),
    siteKey: normalizeSingleLine(input?.siteKey, 80).toLowerCase(),
    courseKey: normalizeSingleLine(input?.courseKey, 200).toLowerCase(),
    universityName: normalizeSingleLine(input?.universityName, 300),
    courseName: normalizeSingleLine(input?.courseName, 300),
    academicCycle: normalizeSingleLine(input?.academicCycle, 20),
    sourceUrl: normalizeSingleLine(input?.sourceUrl, 1000),
    note: normalizeText(input?.note),
    createdAt,
    updatedAt: createdAt
  };
  record.id = [
    "issue",
    record.siteKey,
    now.getTime(),
    shortHash(`${record.sourceUrl}\n${record.note}`)
  ].join("::");

  if (!isValidIssueNoteRecord(record)) {
    throw new TypeError("문제 기록 형식이 올바르지 않습니다.");
  }
  return record;
}

export function updateIssueNoteRecord(record, note, now = new Date()) {
  if (!isValidIssueNoteRecord(record)) {
    throw new TypeError("수정할 문제 기록 형식이 올바르지 않습니다.");
  }
  const next = {
    ...structuredClone(record),
    note: normalizeText(note),
    updatedAt: now.toISOString()
  };
  if (!isValidIssueNoteRecord(next)) {
    throw new TypeError("문제 기록 내용을 확인해주세요.");
  }
  return next;
}

export function isValidIssueNoteRecord(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      value.schemaVersion === ISSUE_NOTE_SCHEMA_VERSION &&
      typeof value.id === "string" &&
      value.id.startsWith("issue::") &&
      typeof value.workId === "string" &&
      /^[a-z0-9-]+$/.test(value.siteKey) &&
      typeof value.courseKey === "string" &&
      typeof value.universityName === "string" &&
      typeof value.courseName === "string" &&
      /^\d{4}\/\d{2}$/.test(value.academicCycle) &&
      isSafeHttpsUrl(value.sourceUrl) &&
      typeof value.note === "string" &&
      value.note.length > 0 &&
      value.note.length <= 2000 &&
      isValidTimestamp(value.createdAt) &&
      isValidTimestamp(value.updatedAt)
  );
}

export function isValidIssueNoteStore(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      value.schemaVersion === ISSUE_NOTE_SCHEMA_VERSION &&
      Array.isArray(value.records) &&
      value.records.length <= MAX_ISSUE_NOTES &&
      value.records.every(isValidIssueNoteRecord) &&
      new Set(value.records.map((record) => record.id)).size ===
        value.records.length
  );
}

export function upsertIssueNoteRecord(store, record) {
  if (!isValidIssueNoteStore(store) || !isValidIssueNoteRecord(record)) {
    throw new TypeError("저장할 문제 기록 형식이 올바르지 않습니다.");
  }
  const records = store.records.filter((item) => item.id !== record.id);
  records.push(structuredClone(record));
  return {
    schemaVersion: ISSUE_NOTE_SCHEMA_VERSION,
    records: records.slice(-MAX_ISSUE_NOTES)
  };
}

export function deleteIssueNoteRecord(store, recordId) {
  if (!isValidIssueNoteStore(store)) {
    throw new TypeError("삭제할 문제 기록 저장소 형식이 올바르지 않습니다.");
  }
  const normalizedId = normalizeSingleLine(recordId, 500);
  if (!store.records.some((record) => record.id === normalizedId)) {
    throw new TypeError("삭제할 문제 기록을 찾지 못했습니다.");
  }
  return {
    schemaVersion: ISSUE_NOTE_SCHEMA_VERSION,
    records: store.records
      .filter((record) => record.id !== normalizedId)
      .map((record) => structuredClone(record))
  };
}

export async function loadIssueNoteState(
  storageArea = chrome.storage.local
) {
  try {
    const stored = await storageArea.get(ISSUE_NOTE_STORAGE_KEY);
    const raw = stored[ISSUE_NOTE_STORAGE_KEY];
    if (raw === undefined) {
      return {
        store: createDefaultIssueNoteStore(),
        persisted: true,
        recovered: false,
        unsupportedSchema: false,
        invalidRecordCount: 0,
        error: null
      };
    }
    if (
      !raw ||
      typeof raw !== "object" ||
      raw.schemaVersion !== ISSUE_NOTE_SCHEMA_VERSION
    ) {
      return {
        store: createDefaultIssueNoteStore(),
        persisted: true,
        recovered: false,
        unsupportedSchema: true,
        invalidRecordCount: 0,
        error: null
      };
    }
    if (!Array.isArray(raw.records)) {
      return {
        store: createDefaultIssueNoteStore(),
        persisted: true,
        recovered: true,
        unsupportedSchema: false,
        invalidRecordCount: 1,
        error: null
      };
    }
    const uniqueIds = new Set();
    const safeRecords = [];
    for (const record of [...raw.records].reverse()) {
      if (!isValidIssueNoteRecord(record) || uniqueIds.has(record.id)) {
        continue;
      }
      uniqueIds.add(record.id);
      safeRecords.unshift(record);
    }
    const records = safeRecords.slice(-MAX_ISSUE_NOTES);
    const invalidRecordCount = raw.records.length - records.length;
    return {
      store: {
        schemaVersion: ISSUE_NOTE_SCHEMA_VERSION,
        records
      },
      persisted: true,
      recovered: invalidRecordCount > 0,
      unsupportedSchema: false,
      invalidRecordCount,
      error: null
    };
  } catch (error) {
    return {
      store: createDefaultIssueNoteStore(),
      persisted: false,
      recovered: false,
      unsupportedSchema: false,
      invalidRecordCount: 0,
      error
    };
  }
}

function getStoredActivityEventsForWrite(value) {
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

export async function saveIssueNoteStoreWithActivity(
  store,
  event,
  storageArea = chrome.storage.local
) {
  if (!isValidIssueNoteStore(store) || !isValidWorkActivityEvent(event)) {
    throw new TypeError("문제 기록 또는 실사용 기록 형식이 올바르지 않습니다.");
  }
  const stored = await storageArea.get([
    ISSUE_NOTE_STORAGE_KEY,
    WORK_ACTIVITY_STORAGE_KEY
  ]);
  const storedIssueNotes = stored[ISSUE_NOTE_STORAGE_KEY];
  if (
    storedIssueNotes !== undefined &&
    !isValidIssueNoteStore(storedIssueNotes)
  ) {
    throw new TypeError(
      "손상된 문제 기록이 있어 기존 저장값을 덮어쓰지 않습니다."
    );
  }
  const currentEvents = getStoredActivityEventsForWrite(
    stored[WORK_ACTIVITY_STORAGE_KEY]
  );
  const nextEvents = [...currentEvents, structuredClone(event)].slice(
    -MAX_WORK_ACTIVITY_EVENTS
  );
  const safeStore = structuredClone(store);
  await storageArea.set({
    [ISSUE_NOTE_STORAGE_KEY]: safeStore,
    [WORK_ACTIVITY_STORAGE_KEY]: nextEvents
  });
  return {
    store: safeStore,
    events: nextEvents
  };
}
