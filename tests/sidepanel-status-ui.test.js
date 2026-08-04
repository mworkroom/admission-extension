import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const htmlUrl = new URL("../sidepanel/sidepanel.html", import.meta.url);
const jsUrl = new URL("../sidepanel/sidepanel.js", import.meta.url);

test("핵심 네 항목과 문제·메모 항목만 기본 결과로 승격한다", async () => {
  const [html, script] = await Promise.all([readFile(htmlUrl, "utf8"), readFile(jsUrl, "utf8")]);
  assert.match(html, /id="priority-field-list"/);
  assert.match(html, /나머지 확인 항목/);
  assert.match(script, /CORE_FIELD_KEYS/);
  assert.match(script, /hasMemo \|\| hasProblem/);
});

test("복사는 Entry Requirements·Tuition Fee·Application Fee에만 허용한다", async () => {
  const script = await readFile(jsUrl, "utf8");
  const copySet = script.match(/const COPY_FIELD_KEYS = new Set\(([\s\S]*?)\);/)?.[1] ?? "";
  assert.match(copySet, /entryRequirements/);
  assert.match(copySet, /tuitionFee/);
  assert.match(copySet, /applicationFee/);
  assert.doesNotMatch(copySet, /englishRequirements|sopGuideline|reference/);
  assert.match(script, /copyButton\.textContent = "복사"/);
});

test("University와 Course는 카드가 아니라 상단 작업 문맥으로 표시한다", async () => {
  const [html, script] = await Promise.all([readFile(htmlUrl, "utf8"), readFile(jsUrl, "utf8")]);
  assert.match(html, /id="university-name"/);
  assert.match(html, /id="course-name"/);
  assert.match(script, /IDENTITY_FIELD_KEYS/);
});

test("상태 기호는 접근성 이름을 보존한다", async () => {
  const script = await readFile(jsUrl, "utf8");
  assert.match(script, /badge\.setAttribute\("aria-label", meta\.label\)/);
  assert.match(script, /badge\.title = meta\.label/);
});

test("패널 최초 열기와 탭·URL 변경에서 자동 분석하고 실패 때만 재시도 버튼을 보인다", async () => {
  const script = await readFile(jsUrl, "utf8");
  assert.match(script, /await refreshCurrentPage\(\{ autoAnalyze: true \}\)/);
  assert.match(script, /chrome\.tabs\.onActivated/);
  assert.match(script, /chrome\.tabs\.onUpdated/);
  assert.match(script, /const showRetry =[^;]+Boolean\(message\)/s);
});
