import test from "node:test";
import assert from "node:assert/strict";

import {
  mergeCommonMemoStores,
  parseCommonMemoBackup,
  serializeCommonMemoBackup
} from "../shared/common-memo-backup.js";
import {
  createEmptyCommonMemoStore,
  upsertCommonMemoRecord
} from "../shared/common-memo-storage.js";
import { createCommonMemoRecord } from "../shared/common-memos.js";

function memo(summary, updatedAt) {
  return createCommonMemoRecord(
    {
      siteKey: "ucl",
      universityName: "University College London",
      fieldKey: "cv",
      summary,
      details: "지원서 기준",
      sourceUrl: "https://www.ucl.ac.uk/",
      sourceLabel: ""
    },
    new Date(updatedAt)
  );
}

test("메모 저장소를 독립 JSON으로 내보내고 다시 읽는다", () => {
  const store = upsertCommonMemoRecord(
    createEmptyCommonMemoStore(),
    memo("선택 사항", "2026-08-21T00:00:00.000Z")
  );
  const text = serializeCommonMemoBackup(
    store,
    new Date("2026-08-21T03:00:00.000Z")
  );
  const restored = parseCommonMemoBackup(text);

  assert.deepEqual(restored, store);
  assert.match(text, /admission-common-memos-backup/);
});

test("손상되거나 다른 형식의 JSON은 현재 메모에 적용하지 않는다", () => {
  assert.throws(() => parseCommonMemoBackup("not json"), /JSON을 읽을 수 없습니다/);
  assert.throws(
    () => parseCommonMemoBackup('{"format":"other","version":1,"store":{}}'),
    /지원하지 않거나 손상된/
  );
});

test("가져오기는 현재 메모를 지우지 않고 더 최신인 같은 항목만 갱신한다", () => {
  const current = upsertCommonMemoRecord(
    createEmptyCommonMemoStore(),
    memo("현재 기록", "2026-08-21T02:00:00.000Z")
  );
  const olderImport = upsertCommonMemoRecord(
    createEmptyCommonMemoStore(),
    memo("오래된 백업", "2026-08-20T02:00:00.000Z")
  );
  const kept = mergeCommonMemoStores(current, olderImport);
  assert.equal(kept.store.records[0].summary, "현재 기록");
  assert.deepEqual(
    { added: kept.added, updated: kept.updated, kept: kept.kept },
    { added: 0, updated: 0, kept: 1 }
  );

  const newerImport = upsertCommonMemoRecord(
    createEmptyCommonMemoStore(),
    memo("복원된 최신 기록", "2026-08-22T02:00:00.000Z")
  );
  const updated = mergeCommonMemoStores(current, newerImport);
  assert.equal(updated.store.records[0].summary, "복원된 최신 기록");
  assert.equal(updated.updated, 1);
});
