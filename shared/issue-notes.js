export const ISSUE_NOTE_STORAGE_KEY = "issueNoteStore";
export const ISSUE_NOTE_SCHEMA_VERSION = 2;
export const MAX_ISSUE_NOTES = 500;

export const ISSUE_STATUS = Object.freeze({
  OPEN: "open",
  RESOLVED: "resolved"
});

function normalizeText(value, maxLength = 2000) {
  return String(value ?? "").replace(/\r\n?/g, "\n").trim().slice(0, maxLength);
}

function normalizeSingleLine(value, maxLength = 500) {
  return normalizeText(value, maxLength).replace(/\s+/g, " ");
}

function isValidTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isSafeHttpsUrl(value) {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
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
  return { schemaVersion: ISSUE_NOTE_SCHEMA_VERSION, records: [] };
}

export function createIssueNoteRecord(input, now = new Date()) {
  const createdAt = now.toISOString();
  const record = {
    schemaVersion: ISSUE_NOTE_SCHEMA_VERSION,
    id: "",
    siteKey: normalizeSingleLine(input?.siteKey, 100).toLowerCase(),
    courseKey: normalizeSingleLine(input?.courseKey, 300).toLowerCase(),
    universityName: normalizeSingleLine(input?.universityName, 300),
    courseName: normalizeSingleLine(input?.courseName, 300),
    academicCycle: normalizeSingleLine(input?.academicCycle, 20),
    sourceUrl: normalizeSingleLine(input?.sourceUrl, 1500),
    note: normalizeText(input?.note),
    status: ISSUE_STATUS.OPEN,
    resolvedAt: "",
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
  const next = { ...structuredClone(record), note: normalizeText(note), updatedAt: now.toISOString() };
  if (!isValidIssueNoteRecord(next)) throw new TypeError("문제 기록 내용을 확인해주세요.");
  return next;
}

export function setIssueNoteStatus(record, status, now = new Date()) {
  if (!isValidIssueNoteRecord(record) || !Object.values(ISSUE_STATUS).includes(status)) {
    throw new TypeError("변경할 문제 기록 상태가 올바르지 않습니다.");
  }
  const next = {
    ...structuredClone(record),
    status,
    resolvedAt: status === ISSUE_STATUS.RESOLVED ? now.toISOString() : "",
    updatedAt: now.toISOString()
  };
  if (!isValidIssueNoteRecord(next)) throw new TypeError("문제 기록 상태를 변경하지 못했습니다.");
  return next;
}

export function isValidIssueNoteRecord(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      value.schemaVersion === ISSUE_NOTE_SCHEMA_VERSION &&
      typeof value.id === "string" && value.id.startsWith("issue::") &&
      /^[a-z0-9-]+$/.test(value.siteKey) &&
      typeof value.courseKey === "string" &&
      typeof value.universityName === "string" &&
      typeof value.courseName === "string" &&
      /^\d{4}\/\d{2}$/.test(value.academicCycle) &&
      isSafeHttpsUrl(value.sourceUrl) &&
      typeof value.note === "string" && value.note.length > 0 && value.note.length <= 2000 &&
      Object.values(ISSUE_STATUS).includes(value.status) &&
      (value.resolvedAt === "" || isValidTimestamp(value.resolvedAt)) &&
      (value.status === ISSUE_STATUS.OPEN ? value.resolvedAt === "" : isValidTimestamp(value.resolvedAt)) &&
      isValidTimestamp(value.createdAt) && isValidTimestamp(value.updatedAt)
  );
}

export function isValidIssueNoteStore(value) {
  return Boolean(
    value && typeof value === "object" &&
      value.schemaVersion === ISSUE_NOTE_SCHEMA_VERSION &&
      Array.isArray(value.records) && value.records.length <= MAX_ISSUE_NOTES &&
      value.records.every(isValidIssueNoteRecord) &&
      new Set(value.records.map((record) => record.id)).size === value.records.length
  );
}

export function upsertIssueNoteRecord(store, record) {
  if (!isValidIssueNoteStore(store) || !isValidIssueNoteRecord(record)) {
    throw new TypeError("저장할 문제 기록 형식이 올바르지 않습니다.");
  }
  const records = store.records.filter((item) => item.id !== record.id);
  records.push(structuredClone(record));
  return { schemaVersion: ISSUE_NOTE_SCHEMA_VERSION, records: records.slice(-MAX_ISSUE_NOTES) };
}

export function deleteIssueNoteRecord(store, recordId) {
  if (!isValidIssueNoteStore(store) || !store.records.some((record) => record.id === recordId)) {
    throw new TypeError("삭제할 문제 기록을 찾지 못했습니다.");
  }
  return {
    schemaVersion: ISSUE_NOTE_SCHEMA_VERSION,
    records: store.records.filter((record) => record.id !== recordId).map(structuredClone)
  };
}

function migrateV1Record(record) {
  const migrated = {
    schemaVersion: ISSUE_NOTE_SCHEMA_VERSION,
    id: record?.id,
    siteKey: normalizeSingleLine(record?.siteKey, 100).toLowerCase(),
    courseKey: normalizeSingleLine(record?.courseKey, 300).toLowerCase(),
    universityName: normalizeSingleLine(record?.universityName, 300),
    courseName: normalizeSingleLine(record?.courseName, 300),
    academicCycle: normalizeSingleLine(record?.academicCycle, 20),
    sourceUrl: normalizeSingleLine(record?.sourceUrl, 1500),
    note: normalizeText(record?.note),
    status: ISSUE_STATUS.OPEN,
    resolvedAt: "",
    createdAt: record?.createdAt,
    updatedAt: record?.updatedAt
  };
  if (!isValidIssueNoteRecord(migrated)) throw new TypeError("기존 문제 기록을 변환하지 못했습니다.");
  return migrated;
}

export async function loadIssueNoteState(storageArea = chrome.storage.local) {
  try {
    const stored = await storageArea.get(ISSUE_NOTE_STORAGE_KEY);
    const raw = stored[ISSUE_NOTE_STORAGE_KEY];
    if (raw === undefined) {
      return { store: createDefaultIssueNoteStore(), persisted: true, recovered: false, migrated: false, unsupportedSchema: false, invalidRecordCount: 0, error: null };
    }
    if (!raw || typeof raw !== "object" || ![1, ISSUE_NOTE_SCHEMA_VERSION].includes(raw.schemaVersion)) {
      return { store: createDefaultIssueNoteStore(), persisted: true, recovered: false, migrated: false, unsupportedSchema: true, invalidRecordCount: 0, error: null };
    }
    const records = [];
    const ids = new Set();
    let invalidRecordCount = 0;
    for (const record of Array.isArray(raw.records) ? raw.records : []) {
      try {
        const safe = raw.schemaVersion === 1 ? migrateV1Record(record) : structuredClone(record);
        if (!isValidIssueNoteRecord(safe) || ids.has(safe.id)) throw new TypeError();
        ids.add(safe.id);
        records.push(safe);
      } catch { invalidRecordCount += 1; }
    }
    const store = { schemaVersion: ISSUE_NOTE_SCHEMA_VERSION, records: records.slice(-MAX_ISSUE_NOTES) };
    if (raw.schemaVersion === 1 && invalidRecordCount === 0) {
      await storageArea.set({ [ISSUE_NOTE_STORAGE_KEY]: structuredClone(store) });
    }
    return {
      store,
      persisted: true,
      recovered: invalidRecordCount > 0,
      migrated: raw.schemaVersion === 1,
      unsupportedSchema: false,
      invalidRecordCount,
      error: null
    };
  } catch (error) {
    return { store: createDefaultIssueNoteStore(), persisted: false, recovered: false, migrated: false, unsupportedSchema: false, invalidRecordCount: 0, error };
  }
}

export async function saveIssueNoteStore(store, storageArea = chrome.storage.local) {
  if (!isValidIssueNoteStore(store)) throw new TypeError("저장할 문제 기록 형식이 올바르지 않습니다.");
  const stored = await storageArea.get(ISSUE_NOTE_STORAGE_KEY);
  const current = stored[ISSUE_NOTE_STORAGE_KEY];
  if (current !== undefined && !isValidIssueNoteStore(current)) {
    throw new TypeError("손상된 문제 기록이 있어 기존 저장값을 덮어쓰지 않습니다.");
  }
  const safeStore = structuredClone(store);
  await storageArea.set({ [ISSUE_NOTE_STORAGE_KEY]: safeStore });
  return safeStore;
}

export function serializeIssueNotesJson(store, exportedAt = new Date()) {
  if (!isValidIssueNoteStore(store)) throw new TypeError("내보낼 문제 기록 형식이 올바르지 않습니다.");
  return JSON.stringify(
    {
      schemaVersion: ISSUE_NOTE_SCHEMA_VERSION,
      exportedAt: exportedAt.toISOString(),
      summary: {
        total: store.records.length,
        open: store.records.filter((record) => record.status === ISSUE_STATUS.OPEN).length,
        resolved: store.records.filter((record) => record.status === ISSUE_STATUS.RESOLVED).length
      },
      records: [...store.records].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    },
    null,
    2
  );
}
