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

test("지정 항목은 드롭다운을 쓰고 출처 이름 입력 없이 확인 정보를 받는다", async () => {
  const [html, script] = await Promise.all([readFile(htmlUrl, "utf8"), readFile(jsUrl, "utf8")]);
  assert.match(html, /id="memo-summary-select"/);
  assert.match(html, /id="memo-summary-input"/);
  assert.match(html, /id="memo-details-input"/);
  assert.match(html, /id="memo-source-url-input"/);
  assert.doesNotMatch(html, /id="memo-source-label-input"|출처 이름/);
  assert.match(html, /id="memo-unverified-input"/);
  assert.match(html, /id="memo-confirmed-input"/);
  assert.match(html, /id="memo-confirmed-date-input"/);
  assert.match(html, /id="memo-today-button"[^>]+type="button">오늘/);
  assert.match(script, /getCommonMemoSummaryOptions\(fieldKey\)/);
  assert.match(script, /확인 내용을 선택해주세요/);
});

test("메모는 입력 순서대로 항상 펼치고 출처와 날짜 포함 확인 상태를 표시한다", async () => {
  const [script, css] = await Promise.all([readFile(jsUrl, "utf8"), readFile(cssUrl, "utf8")]);
  assert.match(script, /function createMemoLine/);
  const createMemoLine = script.match(/function createMemoLine\(record\)[\s\S]*?return box;\n}/)?.[0] ?? "";
  assert.doesNotMatch(createMemoLine, /createElement\("details"\)|createElement\("summary"\)/);
  assert.match(createMemoLine, /source\.textContent = "출처"/);
  assert.match(script, /function formatMemoDate/);
  assert.match(script, /`\$\{formatMemoDate\(current\.confirmedDate\)\} 확인됨`/);
  assert.match(css, /\.memo-line/);
  assert.match(css, /\.memo-line__details/);
  assert.match(css, /\.memo-line__source/);
  assert.doesNotMatch(script, /copyCommonMemo|메모 복사/);
});

test("수동 기록이 있으면 같은 카드의 자동 분석 문구와 상태를 숨긴다", async () => {
  const script = await readFile(jsUrl, "utf8");
  const createFieldCard = script.match(/function createFieldCard\(field\)[\s\S]*?return card;\n}/)?.[0] ?? "";
  assert.match(createFieldCard, /if \(!memoRecord\) header\.append\(createStatusBadge\(field\.status\)\)/);
  assert.match(createFieldCard, /if \(memoRecord\) \{\s*card\.append\(createMemoLine\(memoRecord\)\)/);
  assert.match(createFieldCard, /else \{\s*card\.append\(body\)/);
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
