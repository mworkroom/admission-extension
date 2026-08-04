import {
  COMMON_MEMO_SCHEMA_VERSION,
  isValidCommonMemoRecord,
  migrateCommonMemoRecordV1
} from "./common-memos.js";

export const COMMON_MEMO_STORAGE_KEY = "commonMemoStore";

export function createEmptyCommonMemoStore() {
  return { schemaVersion: COMMON_MEMO_SCHEMA_VERSION, records: [] };
}

export function isValidCommonMemoStore(value) {
  if (
    !value ||
    typeof value !== "object" ||
    value.schemaVersion !== COMMON_MEMO_SCHEMA_VERSION ||
    !Array.isArray(value.records)
  ) return false;
  const ids = new Set();
  return value.records.every((record) => {
    if (!isValidCommonMemoRecord(record) || ids.has(record.id)) return false;
    ids.add(record.id);
    return true;
  });
}

export function upsertCommonMemoRecord(store, record) {
  if (!isValidCommonMemoStore(store) || !isValidCommonMemoRecord(record)) {
    throw new TypeError("저장할 확인한 사항 형식이 올바르지 않습니다.");
  }
  const records = structuredClone(store.records);
  const index = records.findIndex((item) => item.id === record.id);
  if (index >= 0) records[index] = structuredClone(record);
  else records.push(structuredClone(record));
  return { schemaVersion: COMMON_MEMO_SCHEMA_VERSION, records };
}

export function deleteCommonMemoRecord(store, recordId) {
  if (!isValidCommonMemoStore(store) || !store.records.some((r) => r.id === recordId)) {
    throw new TypeError("삭제할 확인한 사항을 찾지 못했습니다.");
  }
  return {
    schemaVersion: COMMON_MEMO_SCHEMA_VERSION,
    records: store.records.filter((record) => record.id !== recordId).map(structuredClone)
  };
}

function recoverV2(raw) {
  const ids = new Set();
  const records = [];
  let invalidRecordCount = 0;
  for (const record of Array.isArray(raw.records) ? raw.records : []) {
    if (!isValidCommonMemoRecord(record) || ids.has(record.id)) {
      invalidRecordCount += 1;
      continue;
    }
    ids.add(record.id);
    records.push(structuredClone(record));
  }
  return { records, invalidRecordCount };
}

function migrateV1(raw) {
  const records = [];
  const ids = new Set();
  let invalidRecordCount = 0;
  for (const record of Array.isArray(raw.records) ? raw.records : []) {
    try {
      const migrated = migrateCommonMemoRecordV1(record);
      if (ids.has(migrated.id)) {
        invalidRecordCount += 1;
        continue;
      }
      ids.add(migrated.id);
      records.push(migrated);
    } catch {
      invalidRecordCount += 1;
    }
  }
  return { records, invalidRecordCount };
}

export async function loadCommonMemoState(storageArea = chrome.storage.local) {
  try {
    const stored = await storageArea.get(COMMON_MEMO_STORAGE_KEY);
    const raw = stored[COMMON_MEMO_STORAGE_KEY];
    if (raw === undefined) {
      return { store: createEmptyCommonMemoStore(), persisted: true, recovered: false, migrated: false, unsupportedSchema: false, invalidRecordCount: 0, error: null };
    }
    if (!raw || typeof raw !== "object" || !Number.isInteger(raw.schemaVersion)) {
      return { store: createEmptyCommonMemoStore(), persisted: true, recovered: true, migrated: false, unsupportedSchema: false, invalidRecordCount: 1, error: null };
    }
    if (![1, COMMON_MEMO_SCHEMA_VERSION].includes(raw.schemaVersion)) {
      return { store: createEmptyCommonMemoStore(), persisted: true, recovered: false, migrated: false, unsupportedSchema: true, invalidRecordCount: 0, error: null };
    }
    const recovered = raw.schemaVersion === 1 ? migrateV1(raw) : recoverV2(raw);
    const store = { schemaVersion: COMMON_MEMO_SCHEMA_VERSION, records: recovered.records };
    if (raw.schemaVersion === 1 && recovered.invalidRecordCount === 0) {
      await storageArea.set({ [COMMON_MEMO_STORAGE_KEY]: structuredClone(store) });
    }
    return {
      store,
      persisted: true,
      recovered: recovered.invalidRecordCount > 0,
      migrated: raw.schemaVersion === 1,
      unsupportedSchema: false,
      invalidRecordCount: recovered.invalidRecordCount,
      error: null
    };
  } catch (error) {
    return { store: createEmptyCommonMemoStore(), persisted: false, recovered: false, migrated: false, unsupportedSchema: false, invalidRecordCount: 0, error };
  }
}

export async function saveCommonMemoStore(store, storageArea = chrome.storage.local) {
  if (!isValidCommonMemoStore(store)) {
    throw new TypeError("저장할 확인한 사항 형식이 올바르지 않습니다.");
  }
  const safeStore = structuredClone(store);
  await storageArea.set({ [COMMON_MEMO_STORAGE_KEY]: safeStore });
  return safeStore;
}
