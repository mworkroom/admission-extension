import test from "node:test";
import assert from "node:assert/strict";
import {
  ISSUE_NOTE_STORAGE_KEY,
  ISSUE_STATUS,
  createDefaultIssueNoteStore,
  createIssueNoteRecord,
  loadIssueNoteState,
  saveIssueNoteStore,
  serializeIssueNotesJson,
  setIssueNoteStatus,
  updateIssueNoteRecord,
  upsertIssueNoteRecord
} from "../shared/issue-notes.js";

const NOW = new Date("2026-08-05T03:00:00.000Z");
const SOURCE = "https://www.manchester.ac.uk/study/masters/courses/list/";

function record() {
  return createIssueNoteRecord({
    siteKey: "manchester",
    courseKey: "masters-courses-list",
    universityName: "The University of Manchester",
    courseName: "MSc Finance",
    academicCycle: "2026/27",
    sourceUrl: SOURCE,
    note: "상담 위젯 숫자를 지원비로 가져옴"
  }, NOW);
}

function memoryStorage(initial = {}, failSet = false) {
  const values = structuredClone(initial);
  return {
    values,
    async get(key) { return Object.hasOwn(values, key) ? { [key]: structuredClone(values[key]) } : {}; },
    async set(next) { if (failSet) throw new Error("set failed"); Object.assign(values, structuredClone(next)); }
  };
}

test("새 문제는 활성 작업 없이 페이지 문맥과 미해결 상태로 생성한다", () => {
  const created = record();
  assert.equal(created.status, ISSUE_STATUS.OPEN);
  assert.equal(created.resolvedAt, "");
  assert.equal(Object.hasOwn(created, "workId"), false);
});

test("문제 수정과 해결·다시 열기를 같은 id로 보존한다", () => {
  const original = record();
  const edited = updateIssueNoteRecord(original, "다른 위젯 숫자를 지원비로 가져옴", new Date("2026-08-05T04:00:00Z"));
  const resolved = setIssueNoteStatus(edited, ISSUE_STATUS.RESOLVED, new Date("2026-08-05T05:00:00Z"));
  const reopened = setIssueNoteStatus(resolved, ISSUE_STATUS.OPEN, new Date("2026-08-05T06:00:00Z"));
  assert.equal(edited.id, original.id);
  assert.equal(resolved.status, ISSUE_STATUS.RESOLVED);
  assert.ok(resolved.resolvedAt);
  assert.equal(reopened.resolvedAt, "");
});

test("schema 1 문제 기록은 모두 미해결인 schema 2로 변환한다", async () => {
  const old = { ...record(), schemaVersion: 1, workId: "legacy-work" };
  delete old.status;
  delete old.resolvedAt;
  const storage = memoryStorage({ [ISSUE_NOTE_STORAGE_KEY]: { schemaVersion: 1, records: [old] } });
  const state = await loadIssueNoteState(storage);
  assert.equal(state.migrated, true);
  assert.equal(state.store.records[0].status, ISSUE_STATUS.OPEN);
  assert.equal(storage.values[ISSUE_NOTE_STORAGE_KEY].schemaVersion, 2);
});

test("문제 기록은 활동 로그 없이 단독 저장하며 실패 시 원본을 유지한다", async () => {
  const originalStore = upsertIssueNoteRecord(createDefaultIssueNoteStore(), record());
  const changedStore = upsertIssueNoteRecord(originalStore, updateIssueNoteRecord(record(), "수정"));
  const storage = memoryStorage({ [ISSUE_NOTE_STORAGE_KEY]: originalStore }, true);
  await assert.rejects(() => saveIssueNoteStore(changedStore, storage), /set failed/);
  assert.deepEqual(storage.values[ISSUE_NOTE_STORAGE_KEY], originalStore);
  assert.equal(Object.hasOwn(storage.values, "activeCourseWorkEvents"), false);
});

test("JSON 내보내기는 해결된 기록을 포함하고 상태별 개수를 제공한다", () => {
  const open = record();
  const resolved = setIssueNoteStatus(
    createIssueNoteRecord({ ...open, note: "해결한 문제" }, new Date("2026-08-05T03:01:00Z")),
    ISSUE_STATUS.RESOLVED,
    new Date("2026-08-05T05:00:00Z")
  );
  const store = upsertIssueNoteRecord(upsertIssueNoteRecord(createDefaultIssueNoteStore(), open), resolved);
  const exported = JSON.parse(serializeIssueNotesJson(store, NOW));
  assert.deepEqual(exported.summary, { total: 2, open: 1, resolved: 1 });
  assert.equal(exported.records.length, 2);
});
