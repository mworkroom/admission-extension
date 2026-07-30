import {
  COMMON_MEMO_SCHEMA_VERSION,
  isValidCommonMemoRecord
} from "./common-memos.js";

export const COMMON_MEMO_STORAGE_KEY = "commonMemoStore";

export function createEmptyCommonMemoStore() {
  return {
    schemaVersion: COMMON_MEMO_SCHEMA_VERSION,
    records: []
  };
}

function cloneStore(store) {
  return {
    schemaVersion: store.schemaVersion,
    records: structuredClone(store.records)
  };
}

export function isValidCommonMemoStore(value) {
  if (
    !value ||
    typeof value !== "object" ||
    value.schemaVersion !== COMMON_MEMO_SCHEMA_VERSION ||
    !Array.isArray(value.records)
  ) {
    return false;
  }

  const ids = new Set();
  return value.records.every((record) => {
    if (!isValidCommonMemoRecord(record) || ids.has(record.id)) {
      return false;
    }
    ids.add(record.id);
    return true;
  });
}

export function upsertCommonMemoRecord(store, record) {
  if (!isValidCommonMemoStore(store) || !isValidCommonMemoRecord(record)) {
    throw new TypeError("저장할 공통 메모 형식이 올바르지 않습니다.");
  }

  const records = structuredClone(store.records);
  const existingIndex = records.findIndex((item) => item.id === record.id);
  if (existingIndex >= 0) {
    records[existingIndex] = structuredClone(record);
  } else {
    records.push(structuredClone(record));
  }

  return {
    schemaVersion: store.schemaVersion,
    records
  };
}

export function deleteCommonMemoRecord(store, recordId) {
  if (
    !isValidCommonMemoStore(store) ||
    typeof recordId !== "string" ||
    !recordId
  ) {
    throw new TypeError("삭제할 공통 메모 형식이 올바르지 않습니다.");
  }

  const existingIndex = store.records.findIndex(
    (record) => record.id === recordId
  );
  if (existingIndex < 0) {
    throw new TypeError("삭제할 공통 메모를 찾지 못했습니다.");
  }

  return {
    schemaVersion: store.schemaVersion,
    records: store.records
      .filter((record) => record.id !== recordId)
      .map((record) => structuredClone(record))
  };
}

function recoverCommonMemoStore(value) {
  if (value === undefined) {
    return {
      store: createEmptyCommonMemoStore(),
      invalidRecordCount: 0,
      recovered: false,
      unsupportedSchema: false
    };
  }

  if (
    !value ||
    typeof value !== "object" ||
    !Number.isInteger(value.schemaVersion)
  ) {
    return {
      store: createEmptyCommonMemoStore(),
      invalidRecordCount: 0,
      recovered: true,
      unsupportedSchema: false
    };
  }

  if (value.schemaVersion !== COMMON_MEMO_SCHEMA_VERSION) {
    return {
      store: createEmptyCommonMemoStore(),
      invalidRecordCount: 0,
      recovered: false,
      unsupportedSchema: true
    };
  }

  if (!Array.isArray(value.records)) {
    return {
      store: createEmptyCommonMemoStore(),
      invalidRecordCount: 0,
      recovered: true,
      unsupportedSchema: false
    };
  }

  const records = [];
  const ids = new Set();
  let invalidRecordCount = 0;

  for (const record of value.records) {
    if (!isValidCommonMemoRecord(record) || ids.has(record.id)) {
      invalidRecordCount += 1;
      continue;
    }
    ids.add(record.id);
    records.push(structuredClone(record));
  }

  return {
    store: {
      schemaVersion: COMMON_MEMO_SCHEMA_VERSION,
      records
    },
    invalidRecordCount,
    recovered: invalidRecordCount > 0,
    unsupportedSchema: false
  };
}

export async function loadCommonMemoState(
  storageArea = chrome.storage.local
) {
  try {
    const stored = await storageArea.get(COMMON_MEMO_STORAGE_KEY);
    const recovered = recoverCommonMemoStore(
      stored[COMMON_MEMO_STORAGE_KEY]
    );
    return {
      ...recovered,
      persisted: true,
      error: null
    };
  } catch (error) {
    return {
      store: createEmptyCommonMemoStore(),
      invalidRecordCount: 0,
      recovered: false,
      unsupportedSchema: false,
      persisted: false,
      error
    };
  }
}

export async function saveCommonMemoStore(
  store,
  storageArea = chrome.storage.local
) {
  if (!isValidCommonMemoStore(store)) {
    throw new TypeError("저장할 공통 메모 형식이 올바르지 않습니다.");
  }

  const safeStore = cloneStore(store);
  await storageArea.set({
    [COMMON_MEMO_STORAGE_KEY]: safeStore
  });
  return safeStore;
}
