import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sidepanelHtmlUrl = new URL(
  "../sidepanel/sidepanel.html",
  import.meta.url
);
const sidepanelJsUrl = new URL(
  "../sidepanel/sidepanel.js",
  import.meta.url
);
const harnessUrl = new URL("./ui-harness.html", import.meta.url);

test("Side Panel 하단에 자유 형식 문제 기록과 최근 기록 목록을 제공한다", async () => {
  const html = await readFile(sidepanelHtmlUrl, "utf8");

  assert.match(html, /id="issue-title">문제 기록/);
  assert.match(html, /id="issue-note-input"/);
  assert.match(html, /여러 마감일 중 첫 날짜만 추출됨/);
  assert.match(html, /id="save-issue-button"/);
  assert.match(html, /id="issue-note-list"/);
  assert.match(html, /id="issue-delete-dialog"/);
});

test("문제 생성·수정·삭제를 활동 CSV와 같은 저장 작업으로 연결한다", async () => {
  const script = await readFile(sidepanelJsUrl, "utf8");

  assert.match(script, /saveIssueNoteStoreWithActivity/);
  assert.match(script, /WORK_ACTIVITY_TYPES\.ISSUE_CREATED/);
  assert.match(script, /WORK_ACTIVITY_TYPES\.ISSUE_UPDATED/);
  assert.match(script, /WORK_ACTIVITY_TYPES\.ISSUE_DELETED/);
  assert.match(script, /문제 기록을 저장하고 CSV 이력에 남겼습니다/);
  assert.match(script, /문제 기록을 수정하고 CSV 이력에 남겼습니다/);
  assert.match(script, /문제 기록을 삭제하고 CSV 이력에 남겼습니다/);
});

test("문제 기록은 활성 작업 없이 현재 페이지 문맥을 사용하고 저장 실패를 재현한다", async () => {
  const [script, harness] = await Promise.all([
    readFile(sidepanelJsUrl, "utf8"),
    readFile(harnessUrl, "utf8")
  ]);

  assert.match(script, /function getCurrentIssueContext/);
  assert.match(script, /workId: activeWork\?\.id \?\? ""/);
  assert.match(harness, /searchParams\.get\("issueSet"\) === "fail"/);
  assert.match(harness, /Object\.hasOwn\(next, "issueNoteStore"\)/);
  assert.match(harness, /searchParams\.get\("issueNote"\) === "sample"/);
});
