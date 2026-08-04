import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const htmlUrl = new URL("../sidepanel/sidepanel.html", import.meta.url);
const jsUrl = new URL("../sidepanel/sidepanel.js", import.meta.url);

test("문제 기록은 상시 하단 섹션이 아니라 도구 dialog에서 관리한다", async () => {
  const html = await readFile(htmlUrl, "utf8");
  assert.match(html, /id="open-issue-manager-button"/);
  assert.match(html, /<dialog[^>]+id="issue-dialog"/);
  assert.doesNotMatch(html, /<section[^>]+issue-section/);
});

test("미해결·해결됨 상태와 전체 JSON 내보내기를 제공한다", async () => {
  const [html, script] = await Promise.all([readFile(htmlUrl, "utf8"), readFile(jsUrl, "utf8")]);
  assert.match(html, /id="show-resolved-input"/);
  assert.match(html, /해결된 기록을 포함한 JSON/);
  assert.match(script, /setIssueNoteStatus/);
  assert.match(script, /serializeIssueNotesJson/);
  assert.match(script, /admission-issues-/);
  assert.doesNotMatch(script, /saveIssueNoteStoreWithActivity|WORK_ACTIVITY/);
});
