import {
  createEmptyCommonMemoStore,
  isValidCommonMemoStore
} from "./common-memo-storage.js";

export const COMMON_MEMO_BACKUP_FORMAT = "admission-common-memos-backup";
export const COMMON_MEMO_BACKUP_VERSION = 1;

function cloneStore(store) {
  return structuredClone(store);
}

export function serializeCommonMemoBackup(store, now = new Date()) {
  if (!isValidCommonMemoStore(store) || !Number.isFinite(now.getTime())) {
    throw new TypeError("백업할 메모 형식이 올바르지 않습니다.");
  }
  return JSON.stringify(
    {
      format: COMMON_MEMO_BACKUP_FORMAT,
      version: COMMON_MEMO_BACKUP_VERSION,
      exportedAt: now.toISOString(),
      recordCount: store.records.length,
      store: cloneStore(store)
    },
    null,
    2
  );
}

export function parseCommonMemoBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text ?? ""));
  } catch {
    throw new TypeError("메모 백업 JSON을 읽을 수 없습니다.");
  }
  if (
    parsed?.format !== COMMON_MEMO_BACKUP_FORMAT ||
    parsed?.version !== COMMON_MEMO_BACKUP_VERSION ||
    !isValidCommonMemoStore(parsed?.store)
  ) {
    throw new TypeError("지원하지 않거나 손상된 메모 백업 파일입니다.");
  }
  return cloneStore(parsed.store);
}

export function mergeCommonMemoStores(currentStore, importedStore) {
  if (
    !isValidCommonMemoStore(currentStore) ||
    !isValidCommonMemoStore(importedStore)
  ) {
    throw new TypeError("병합할 메모 형식이 올바르지 않습니다.");
  }

  const recordsById = new Map(
    currentStore.records.map((record) => [record.id, structuredClone(record)])
  );
  let added = 0;
  let updated = 0;
  let kept = 0;

  for (const imported of importedStore.records) {
    const current = recordsById.get(imported.id);
    if (!current) {
      recordsById.set(imported.id, structuredClone(imported));
      added += 1;
    } else if (Date.parse(imported.updatedAt) > Date.parse(current.updatedAt)) {
      recordsById.set(imported.id, structuredClone(imported));
      updated += 1;
    } else {
      kept += 1;
    }
  }

  const store = createEmptyCommonMemoStore();
  store.records = [...recordsById.values()];
  return { store, added, updated, kept };
}
