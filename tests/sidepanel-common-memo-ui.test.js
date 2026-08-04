import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const htmlUrl = new URL("../sidepanel/sidepanel.html", import.meta.url);
const jsUrl = new URL("../sidepanel/sidepanel.js", import.meta.url);
const cssUrl = new URL("../sidepanel/sidepanel.css", import.meta.url);

test("대학 전체와 항목 메모는 작은 연필 버튼으로 편집한다", async () => {
  const [html, script] = await Promise.all([readFile(htmlUrl, "utf8"), readFile(jsUrl, "utf8")]);
  assert.match(html, /id="edit-university-memo-button"/);
  assert.match(script, /function createPencilButton/);
  assert.match(script, /aria-label.*확인한 사항 편집/);
  assert.doesNotMatch(html, /<button[^>]*>확인한 사항 추가<\/button>/);
});

test("메모 입력은 한 줄 요약·선택 상세/출처·명시적 확인일 계약을 사용한다", async () => {
  const html = await readFile(htmlUrl, "utf8");
  assert.match(html, /id="memo-summary-input"/);
  assert.match(html, /id="memo-details-input"/);
  assert.match(html, /id="memo-source-url-input"/);
  assert.match(html, /id="memo-unverified-input"/);
  assert.match(html, /id="memo-confirmed-input"/);
  assert.match(html, /id="memo-confirmed-date-input"/);
  assert.match(html, /id="memo-today-button"[^>]+type="button">오늘/);
});

test("메모는 한 줄을 먼저 보이고 상세와 출처는 펼쳐서 표시한다", async () => {
  const [script, css] = await Promise.all([readFile(jsUrl, "utf8"), readFile(cssUrl, "utf8")]);
  assert.match(script, /function createMemoLine/);
  assert.match(script, /summary\.textContent = "상세"/);
  assert.match(script, /label: "다시 확인"/);
  assert.match(script, /label: "미확인"/);
  assert.match(css, /\.memo-line/);
  assert.doesNotMatch(script, /copyCommonMemo|메모 복사/);
});

test("확인일은 선택값이 달라진 경우에만 학년도 확인 기록을 갱신한다", async () => {
  const script = await readFile(jsUrl, "utf8");
  assert.match(script, /confirmedDate !== previousDate/);
  assert.match(script, /verifyCommonMemoForCycle\(record, currentBasis\.academicCycle, confirmedDate\)/);
});

test("색상과 모서리는 최상단 토큰으로 관리한다", async () => {
  const css = await readFile(cssUrl, "utf8");
  const root = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[0] ?? "";
  const components = css.slice(root.length);
  assert.match(root, /--color-brand:\s*#173f73/);
  assert.match(root, /--radius-sm:\s*8px/);
  assert.doesNotMatch(components, /#[0-9a-f]{3,8}\b/i);
});
