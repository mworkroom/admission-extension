import test from "node:test";
import assert from "node:assert/strict";
import { createCommonMemoRecord } from "../shared/common-memos.js";
import {
  COMMON_MEMO_STORAGE_KEY,
  createEmptyCommonMemoStore,
  deleteCommonMemoRecord,
  loadCommonMemoState,
  saveCommonMemoStore,
  upsertCommonMemoRecord
} from "../shared/common-memo-storage.js";

function memoryStorage(initial = {}, failSet = false) {
  const values = structuredClone(initial);
  return {
    values,
    async get(key) { return Object.hasOwn(values, key) ? { [key]: structuredClone(values[key]) } : {}; },
    async set(next) { if (failSet) throw new Error("set failed"); Object.assign(values, structuredClone(next)); }
  };
}

function memo(summary = "학과마다 다름") {
  return createCommonMemoRecord({ siteKey: "aston", universityName: "Aston University", fieldKey: "englishRequirements", summary, sourceUrl: "" });
}

test("저장값이 없으면 schema 2 빈 저장소를 반환한다", async () => {
  const state = await loadCommonMemoState(memoryStorage());
  assert.deepEqual(state.store, createEmptyCommonMemoStore());
  assert.equal(state.store.schemaVersion, 2);
});

test("schema 1 메모를 읽을 때 내용 보존 후 schema 2로 저장한다", async () => {
  const storage = memoryStorage({
    [COMMON_MEMO_STORAGE_KEY]: {
      schemaVersion: 1,
      records: [{
        id: "aston::university::aston::englishRequirements",
        siteKey: "aston", universityName: "Aston University", scopeType: "university", scopeKey: "aston", scopeLabel: "Aston University",
        fieldKey: "englishRequirements", value: "학과마다 다름", sourceUrl: "https://www.aston.ac.uk/", sourceLabel: "Aston", updatedAt: "2026-07-31T00:00:00.000Z", verificationByCycle: {}
      }]
    }
  });
  const state = await loadCommonMemoState(storage);
  assert.equal(state.migrated, true);
  assert.equal(state.store.records[0].summary, "학과마다 다름");
  assert.equal(storage.values[COMMON_MEMO_STORAGE_KEY].schemaVersion, 2);
});

test("추가·수정·삭제와 저장 실패에서 원본 보존을 지원한다", async () => {
  const original = memo();
  const store = upsertCommonMemoRecord(createEmptyCommonMemoStore(), original);
  const updated = memo("영어 조건은 학과마다 다름");
  const next = upsertCommonMemoRecord(store, updated);
  assert.equal(next.records.length, 1);
  assert.equal(next.records[0].summary, "영어 조건은 학과마다 다름");
  assert.equal(deleteCommonMemoRecord(next, updated.id).records.length, 0);
  const storage = memoryStorage({ [COMMON_MEMO_STORAGE_KEY]: store }, true);
  await assert.rejects(() => saveCommonMemoStore(next, storage), /set failed/);
  assert.deepEqual(storage.values[COMMON_MEMO_STORAGE_KEY], store);
});

test("더 높은 schema는 덮어쓰지 않는다", async () => {
  const raw = { schemaVersion: 99, records: [] };
  const storage = memoryStorage({ [COMMON_MEMO_STORAGE_KEY]: raw });
  const state = await loadCommonMemoState(storage);
  assert.equal(state.unsupportedSchema, true);
  assert.deepEqual(storage.values[COMMON_MEMO_STORAGE_KEY], raw);
});
