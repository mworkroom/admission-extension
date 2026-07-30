import test from "node:test";
import assert from "node:assert/strict";

import {
  createCommonMemoRecord,
  verifyCommonMemoForCycle
} from "../shared/common-memos.js";
import {
  COMMON_MEMO_STORAGE_KEY,
  createEmptyCommonMemoStore,
  deleteCommonMemoRecord,
  isValidCommonMemoStore,
  loadCommonMemoState,
  saveCommonMemoStore,
  upsertCommonMemoRecord
} from "../shared/common-memo-storage.js";

const FIXED_DATE = new Date("2026-07-31T00:00:00.000Z");

function createMemo(overrides = {}) {
  return createCommonMemoRecord(
    {
      siteKey: "qmul",
      universityName: "Queen Mary University of London",
      scopeType: "university",
      scopeLabel: "Queen Mary University of London",
      fieldKey: "englishRequirements",
      value: "Band 4",
      sourceUrl: "https://www.qmul.ac.uk/english",
      sourceLabel: "English language requirements",
      ...overrides
    },
    FIXED_DATE
  );
}

function createMemoryStorage(initial = {}, options = {}) {
  const values = structuredClone(initial);
  return {
    values,
    async get(keys) {
      if (options.failGet) {
        throw new Error("get failed");
      }
      const requested = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(
        requested
          .filter((key) => Object.hasOwn(values, key))
          .map((key) => [key, structuredClone(values[key])])
      );
    },
    async set(next) {
      if (options.failSet) {
        throw new Error("set failed");
      }
      Object.assign(values, structuredClone(next));
    }
  };
}

test("저장값이 없으면 쓰기 없이 빈 schema 1 store를 반환한다", async () => {
  const storage = createMemoryStorage();
  const state = await loadCommonMemoState(storage);

  assert.deepEqual(state.store, createEmptyCommonMemoStore());
  assert.equal(state.persisted, true);
  assert.equal(state.recovered, false);
  assert.equal(state.invalidRecordCount, 0);
  assert.equal(COMMON_MEMO_STORAGE_KEY in storage.values, false);
});

test("유효한 공통 메모 store를 저장하고 다시 불러온다", async () => {
  const storage = createMemoryStorage();
  const store = {
    schemaVersion: 1,
    records: [createMemo()]
  };

  const saved = await saveCommonMemoStore(store, storage);
  const loaded = await loadCommonMemoState(storage);

  assert.deepEqual(saved, store);
  assert.deepEqual(loaded.store, store);
  assert.equal(loaded.recovered, false);
  assert.equal(isValidCommonMemoStore(loaded.store), true);
});

test("같은 id는 새 항목을 만들지 않고 기존 공통 메모를 수정한다", () => {
  const original = createMemo();
  const deadline = createMemo({
    fieldKey: "universityApplicationDeadline",
    value: "1 September 2026"
  });
  const updated = createMemo({
    value: "Band 4: IELTS 6.5",
    verificationByCycle: original.verificationByCycle
  });
  const store = {
    schemaVersion: 1,
    records: [original, deadline]
  };

  const nextStore = upsertCommonMemoRecord(store, updated);

  assert.equal(nextStore.records.length, 2);
  assert.equal(nextStore.records[0].value, "Band 4: IELTS 6.5");
  assert.deepEqual(nextStore.records[1], deadline);
  assert.equal(store.records[0].value, "Band 4");
});

test("삭제는 대상 메모와 모든 학년도 확인 기록만 제거한다", () => {
  const verified = verifyCommonMemoForCycle(
    createMemo(),
    "2026/27",
    FIXED_DATE
  );
  const deadline = createMemo({
    fieldKey: "universityApplicationDeadline",
    value: "1 September 2026"
  });
  const store = {
    schemaVersion: 1,
    records: [verified, deadline]
  };

  const nextStore = deleteCommonMemoRecord(store, verified.id);

  assert.deepEqual(nextStore.records, [deadline]);
  assert.equal(
    nextStore.records.some((record) => record.id === verified.id),
    false
  );
  assert.deepEqual(
    store.records[0].verificationByCycle["2026/27"],
    verified.verificationByCycle["2026/27"]
  );
});

test("존재하지 않는 메모 삭제는 기존 store를 바꾸지 않고 거부한다", () => {
  const store = {
    schemaVersion: 1,
    records: [createMemo()]
  };
  const before = structuredClone(store);

  assert.throws(
    () => deleteCommonMemoRecord(store, "qmul::university::qmul::reference"),
    /찾지 못했습니다/
  );
  assert.deepEqual(store, before);
});

test("손상 record와 중복 id만 격리하고 유효 record는 유지한다", async () => {
  const valid = createMemo();
  const duplicate = structuredClone(valid);
  const invalid = { ...createMemo(), sourceUrl: "javascript:alert(1)" };
  const storage = createMemoryStorage({
    [COMMON_MEMO_STORAGE_KEY]: {
      schemaVersion: 1,
      records: [valid, duplicate, invalid]
    }
  });

  const state = await loadCommonMemoState(storage);

  assert.deepEqual(state.store.records, [valid]);
  assert.equal(state.invalidRecordCount, 2);
  assert.equal(state.recovered, true);
  assert.equal(state.persisted, true);
});

test("알 수 없는 상위 schema는 자동 변환하거나 덮어쓰지 않는다", async () => {
  const original = {
    schemaVersion: 2,
    records: [createMemo()]
  };
  const storage = createMemoryStorage({
    [COMMON_MEMO_STORAGE_KEY]: original
  });

  const state = await loadCommonMemoState(storage);

  assert.deepEqual(state.store, createEmptyCommonMemoStore());
  assert.equal(state.unsupportedSchema, true);
  assert.deepEqual(storage.values[COMMON_MEMO_STORAGE_KEY], original);
});

test("저장 형식이 잘못되면 storage를 호출하기 전에 거부한다", async () => {
  const storage = createMemoryStorage({
    [COMMON_MEMO_STORAGE_KEY]: {
      schemaVersion: 1,
      records: [createMemo()]
    }
  });
  const before = structuredClone(storage.values);

  await assert.rejects(
    () =>
      saveCommonMemoStore(
        {
          schemaVersion: 1,
          records: [createMemo(), createMemo()]
        },
        storage
      ),
    /형식이 올바르지/
  );
  assert.deepEqual(storage.values, before);
});

test("storage 쓰기 실패 시 기존 store를 유지하고 오류를 전달한다", async () => {
  const original = {
    schemaVersion: 1,
    records: [createMemo()]
  };
  const storage = createMemoryStorage(
    { [COMMON_MEMO_STORAGE_KEY]: original },
    { failSet: true }
  );

  await assert.rejects(
    () =>
      saveCommonMemoStore(
        {
          schemaVersion: 1,
          records: [
            createMemo({
              scopeType: "school",
              scopeLabel: "School of Economics and Finance"
            })
          ]
        },
        storage
      ),
    /set failed/
  );
  assert.deepEqual(storage.values[COMMON_MEMO_STORAGE_KEY], original);
});

test("storage 읽기 실패는 빈 store와 실패 상태를 반환한다", async () => {
  const state = await loadCommonMemoState(
    createMemoryStorage({}, { failGet: true })
  );

  assert.deepEqual(state.store, createEmptyCommonMemoStore());
  assert.equal(state.persisted, false);
  assert.match(state.error.message, /get failed/);
});
