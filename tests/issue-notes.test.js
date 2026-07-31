import test from "node:test";
import assert from "node:assert/strict";

import {
  ISSUE_NOTE_STORAGE_KEY,
  createDefaultIssueNoteStore,
  createIssueNoteRecord,
  deleteIssueNoteRecord,
  loadIssueNoteState,
  saveIssueNoteStoreWithActivity,
  updateIssueNoteRecord,
  upsertIssueNoteRecord
} from "../shared/issue-notes.js";
import {
  WORK_ACTIVITY_STORAGE_KEY,
  WORK_ACTIVITY_TYPES,
  createWorkActivityEvent
} from "../shared/work-activity-log.js";

const NOW = new Date("2026-07-31T15:00:00.000Z");
const URL =
  "https://www.alliancembs.manchester.ac.uk/study/masters/how-to-apply/";

function createMemoryStorage(initial = {}, options = {}) {
  const values = structuredClone(initial);
  return {
    values,
    async get(keys) {
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

function createRecord(note = "여러 마감일 중 첫 날짜만 추출됨.") {
  return createIssueNoteRecord(
    {
      siteKey: "manchester",
      courseKey: "",
      universityName: "The University of Manchester",
      courseName: "How to apply",
      academicCycle: "2026/27",
      sourceUrl: URL,
      note
    },
    NOW
  );
}

function createActivity(type, record, previousValueSnapshot = "") {
  return createWorkActivityEvent(
    {
      type,
      siteKey: record.siteKey,
      courseKey: record.courseKey,
      fieldKey: "",
      reasonCode: "user_reported_issue",
      valueOrigin: "user",
      sourceUrl: record.sourceUrl,
      valueSnapshot:
        type === WORK_ACTIVITY_TYPES.ISSUE_DELETED ? "" : record.note,
      previousValueSnapshot:
        type === WORK_ACTIVITY_TYPES.ISSUE_DELETED
          ? record.note
          : previousValueSnapshot,
      detail: `${record.academicCycle} · ${record.courseName}`
    },
    new Date("2026-07-31T15:05:00.000Z")
  );
}

test("자유 형식 문제 기록에 현재 페이지와 학년도 문맥을 보존한다", () => {
  const record = createRecord();

  assert.equal(record.siteKey, "manchester");
  assert.equal(record.courseKey, "");
  assert.equal(record.academicCycle, "2026/27");
  assert.equal(record.sourceUrl, URL);
  assert.equal(record.note, "여러 마감일 중 첫 날짜만 추출됨.");
});

test("문제 기록을 같은 id로 수정하고 선택한 기록만 삭제한다", () => {
  const first = createRecord();
  const second = createIssueNoteRecord(
    {
      ...first,
      note: "지원비가 잘못 추출됨."
    },
    new Date("2026-07-31T15:01:00.000Z")
  );
  const initial = upsertIssueNoteRecord(
    upsertIssueNoteRecord(createDefaultIssueNoteStore(), first),
    second
  );
  const updated = updateIssueNoteRecord(
    first,
    "여러 마감일 표 전체가 누락됨.",
    new Date("2026-07-31T15:02:00.000Z")
  );
  const changed = upsertIssueNoteRecord(initial, updated);
  const deleted = deleteIssueNoteRecord(changed, updated.id);

  assert.equal(changed.records.length, 2);
  assert.equal(
    changed.records.find((record) => record.id === first.id).note,
    "여러 마감일 표 전체가 누락됨."
  );
  assert.equal(deleted.records.length, 1);
  assert.equal(deleted.records[0].id, second.id);
});

test("생성 기록과 CSV 활동 이벤트를 한 번의 storage set으로 저장한다", async () => {
  const record = createRecord();
  const store = upsertIssueNoteRecord(
    createDefaultIssueNoteStore(),
    record
  );
  const event = createActivity(WORK_ACTIVITY_TYPES.ISSUE_CREATED, record);
  const storage = createMemoryStorage();

  const saved = await saveIssueNoteStoreWithActivity(
    store,
    event,
    storage
  );

  assert.deepEqual(storage.values[ISSUE_NOTE_STORAGE_KEY], store);
  assert.equal(
    storage.values[WORK_ACTIVITY_STORAGE_KEY][0].type,
    WORK_ACTIVITY_TYPES.ISSUE_CREATED
  );
  assert.equal(saved.events[0].valueSnapshot, record.note);
});

test("문제 기록 통합 저장 실패 시 기존 기록과 활동 로그를 유지한다", async () => {
  const original = createRecord("기존 문제");
  const originalStore = upsertIssueNoteRecord(
    createDefaultIssueNoteStore(),
    original
  );
  const changed = updateIssueNoteRecord(
    original,
    "수정한 문제",
    new Date("2026-07-31T15:03:00.000Z")
  );
  const changedStore = upsertIssueNoteRecord(originalStore, changed);
  const event = createActivity(
    WORK_ACTIVITY_TYPES.ISSUE_UPDATED,
    changed,
    original.note
  );
  const storage = createMemoryStorage(
    {
      [ISSUE_NOTE_STORAGE_KEY]: originalStore,
      [WORK_ACTIVITY_STORAGE_KEY]: []
    },
    { failSet: true }
  );

  await assert.rejects(
    () => saveIssueNoteStoreWithActivity(changedStore, event, storage),
    /set failed/
  );
  assert.deepEqual(storage.values[ISSUE_NOTE_STORAGE_KEY], originalStore);
  assert.deepEqual(storage.values[WORK_ACTIVITY_STORAGE_KEY], []);
});

test("손상된 문제 기록은 격리하고 원본 저장소를 덮어쓰지 않는다", async () => {
  const damaged = {
    schemaVersion: 1,
    records: [{ id: "broken" }]
  };
  const storage = createMemoryStorage({
    [ISSUE_NOTE_STORAGE_KEY]: damaged
  });
  const state = await loadIssueNoteState(storage);

  assert.equal(state.invalidRecordCount, 1);
  assert.equal(state.recovered, true);
  assert.deepEqual(state.store.records, []);

  const record = createRecord();
  const store = upsertIssueNoteRecord(
    createDefaultIssueNoteStore(),
    record
  );
  const event = createActivity(WORK_ACTIVITY_TYPES.ISSUE_CREATED, record);
  await assert.rejects(
    () => saveIssueNoteStoreWithActivity(store, event, storage),
    /손상된 문제 기록/
  );
  assert.deepEqual(storage.values[ISSUE_NOTE_STORAGE_KEY], damaged);
});
