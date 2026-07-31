import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sidepanelHtmlUrl = new URL(
  "../sidepanel/sidepanel.html",
  import.meta.url
);
const sidepanelJsUrl = new URL("../sidepanel/sidepanel.js", import.meta.url);
const sidepanelCssUrl = new URL("../sidepanel/sidepanel.css", import.meta.url);

test("공통 메모를 별도 전용 섹션으로 분리하지 않는다", async () => {
  const html = await readFile(sidepanelHtmlUrl, "utf8");

  assert.doesNotMatch(html, /id="memo-title"/);
  assert.doesNotMatch(html, /id="memo-list"/);
});

test("확인한 사항 추가·수정 dialog 입력 계약이 고정되어 있다", async () => {
  const html = await readFile(sidepanelHtmlUrl, "utf8");

  assert.match(html, /id="memo-dialog"/);
  assert.match(html, /id="memo-form"/);
  assert.match(html, /id="memo-value-input"/);
  assert.match(html, /id="memo-source-url-input"/);
  assert.match(html, /id="memo-source-label-input"/);
  assert.match(html, /대학 전체 범위로만 저장/);
});

test("확인한 사항 삭제는 별도 확인 dialog와 복구 불가 안내를 사용한다", async () => {
  const html = await readFile(sidepanelHtmlUrl, "utf8");

  assert.match(html, /id="memo-delete-dialog"/);
  assert.match(html, /id="memo-delete-form"/);
  assert.match(html, /id="memo-delete-field-label"/);
  assert.match(html, /id="memo-delete-scope-label"/);
  assert.match(html, /id="memo-delete-value"/);
  assert.match(html, /id="memo-delete-verification-summary"/);
  assert.match(html, /삭제 후 자동 복구할 수 없습니다/);
});

test("확인한 사항 dialog는 키보드 접근 가능한 native dialog 계약을 유지한다", async () => {
  const [html, script] = await Promise.all([
    readFile(sidepanelHtmlUrl, "utf8"),
    readFile(sidepanelJsUrl, "utf8")
  ]);

  assert.match(
    html,
    /<dialog[^>]+id="memo-dialog"[^>]+aria-labelledby="memo-dialog-title"/s
  );
  assert.match(
    html,
    /<dialog[^>]+id="memo-delete-dialog"[^>]+aria-labelledby="memo-delete-dialog-title"/s
  );
  assert.match(
    html,
    /id="close-memo-dialog-button"[\s\S]+?type="button"[\s\S]+?aria-label="확인한 사항 창 닫기"/
  );
  assert.match(
    html,
    /id="close-memo-delete-dialog-button"[\s\S]+?type="button"[\s\S]+?aria-label="삭제 확인 창 닫기"/
  );
  assert.match(
    html,
    /id="cancel-memo-dialog-button"[^>]+type="button"/
  );
  assert.match(
    html,
    /id="cancel-memo-delete-dialog-button"[\s\S]+?type="button"/
  );
  assert.match(script, /elements\.memoDialog\.showModal\(\)/);
  assert.match(script, /elements\.memoValueInput\.focus\(\)/);
  assert.match(script, /elements\.memoDeleteDialog\.showModal\(\)/);
  assert.match(script, /elements\.cancelMemoDeleteDialogButton\.focus\(\)/);
  assert.match(
    script,
    /elements\.cancelMemoDialogButton\.addEventListener\("click", closeMemoDialog\)/
  );
  assert.match(
    script,
    /elements\.cancelMemoDeleteDialogButton\.addEventListener\([\s\S]+?"click",[\s\S]+?closeMemoDeleteDialog[\s\S]+?\)/
  );
});

test("확인한 사항은 해당 분석 항목 카드 안에 연결된다", async () => {
  const script = await readFile(sidepanelJsUrl, "utf8");

  assert.match(script, /loadCommonMemoState\(\)/);
  assert.match(script, /resolveCommonMemos\(/);
  assert.match(script, /getMemoVerificationStatus\(/);
  assert.match(script, /comparePageValueToMemo\(/);
  assert.match(script, /createInlineMemo\(/);
  assert.match(script, /title\.textContent = "확인한 사항"/);
  assert.match(script, /card\.append\(createInlineMemo\(record, field\)\)/);
  assert.match(script, /createDirectFieldLink\(field\)/);
  assert.match(script, /createMemoAddButton\(/);
  assert.match(script, /showMemoDialog\(/);
  assert.match(script, /saveCommonMemoStore\(/);
  assert.match(script, /verifyCommonMemoForCycle\(/);
  assert.match(script, /verifyCommonMemoForCurrentCycle\(/);
  assert.match(script, /verifyButton\.textContent = "이번 학년도 확인 완료"/);
  assert.match(script, /verificationStatus !== MEMO_VERIFICATION_STATUS\.CONFIRMED/);
  assert.match(script, /deleteCommonMemoRecord\(/);
  assert.match(script, /showMemoDeleteDialog\(/);
  assert.match(script, /persistMemoDeletion\(/);
  assert.match(script, /deleteButton\.textContent = "삭제"/);
  assert.match(script, /applicationFee: "Application Fee"/);
  assert.match(script, /reference: "Reference"/);
  assert.match(script, /sopGuideline: "SOP Guideline"/);
  assert.match(script, /MEMO_VALUE_PLACEHOLDERS/);
});

test("확정 메모는 페이지 값 없음 안내를 숨기고 실제 페이지 값 비교는 유지한다", async () => {
  const script = await readFile(sidepanelJsUrl, "utf8");

  assert.match(script, /shouldHideMissingPageResultForConfirmedMemo\(/);
  assert.match(
    script,
    /verificationStatus === MEMO_VERIFICATION_STATUS\.CONFIRMED[\s\S]+?comparisonStatus === MEMO_COMPARISON_STATUS\.PAGE_MISSING/
  );
  assert.match(script, /if \(!hideMissingPageComparison\)/);
  assert.match(script, /if \(!hideMissingPageResult\)/);
  assert.match(script, /!options\.analyzing[\s\S]+?shouldHideMissingPageResultForConfirmedMemo\(/);
});

test("현재 분석 기준 헤더는 화면 상단에 고정하지 않는다", async () => {
  const css = await readFile(sidepanelCssUrl, "utf8");
  const basisPanelRule = css.match(/\.basis-panel\s*\{([\s\S]*?)\}/)?.[1] ?? "";

  assert.doesNotMatch(basisPanelRule, /position:\s*sticky/);
  assert.doesNotMatch(basisPanelRule, /\btop\s*:/);
});

test("색상과 모서리 값은 최상단 디자인 토큰으로 관리한다", async () => {
  const css = await readFile(sidepanelCssUrl, "utf8");
  const rootRule = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[0] ?? "";
  const componentRules = css.slice(rootRule.length);

  assert.match(rootRule, /--color-brand:\s*#173f73/);
  assert.match(rootRule, /--color-success-text:\s*#1d6242/);
  assert.match(rootRule, /--radius-sm:\s*8px/);
  assert.match(rootRule, /--radius-dialog:\s*8px/);
  assert.doesNotMatch(componentRules, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(componentRules, /\brgb\(/i);
  assert.doesNotMatch(
    componentRules,
    /border-radius:\s*(?:\d+(?:\.\d+)?(?:px|rem|em)|50%)/
  );
});

test("기준 저장 직후 학년도 의존 UI를 후속 저장보다 먼저 갱신한다", async () => {
  const script = await readFile(sidepanelJsUrl, "utf8");
  const persistBasis = script.match(
    /async function persistBasis\([\s\S]+?\n\}/
  )?.[0] ?? "";

  assert.ok(persistBasis.indexOf("renderAnalysis();") >= 0);
  assert.ok(persistBasis.indexOf("await markAnalysisStale") >= 0);
  assert.ok(
    persistBasis.indexOf("renderAnalysis();") <
      persistBasis.indexOf("await markAnalysisStale")
  );
});
