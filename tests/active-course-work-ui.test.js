import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sidepanelHtmlUrl = new URL("../sidepanel/sidepanel.html", import.meta.url);
const sidepanelJsUrl = new URL("../sidepanel/sidepanel.js", import.meta.url);
const harnessUrl = new URL("./ui-harness.html", import.meta.url);

test("분석 결과 안에 활성 과정 작업 상태와 추가 버튼을 제공한다", async () => {
  const html = await readFile(sidepanelHtmlUrl, "utf8");

  assert.match(html, /id="active-work-panel"/);
  assert.match(html, /id="active-work-name"/);
  assert.match(html, /id="active-work-meta"/);
  assert.match(html, /id="active-work-conflict"/);
  assert.match(html, /id="add-to-active-work-button"/);
  assert.match(html, /이 분석으로 작업 시작|현재 페이지를 먼저 분석/);
});

test("다른 과정·기준은 native dialog에서 비교한 뒤에만 교체한다", async () => {
  const [html, script] = await Promise.all([
    readFile(sidepanelHtmlUrl, "utf8"),
    readFile(sidepanelJsUrl, "utf8")
  ]);

  assert.match(
    html,
    /<dialog[^>]+id="active-work-replace-dialog"[^>]+aria-labelledby="active-work-replace-dialog-title"/s
  );
  assert.match(html, /id="current-active-work-name"/);
  assert.match(html, /id="next-active-work-name"/);
  assert.match(html, /기존 작업은 자동 복구할 수 없습니다/);
  assert.match(script, /currentWork\.id !== candidate\.work\.id && !replace/);
  assert.match(script, /elements\.activeWorkReplaceDialog\.showModal\(\)/);
  assert.match(script, /elements\.cancelActiveWorkReplaceButton\.focus\(\)/);
  assert.match(
    script,
    /persistCurrentAnalysisToActiveWork\(\{ replace: true \}\)/
  );
});

test("현재 분석을 활성 작업 저장 계층에 연결하고 충돌 개수를 표시한다", async () => {
  const script = await readFile(sidepanelJsUrl, "utf8");

  assert.match(script, /loadActiveCourseWorkState\(\)/);
  assert.match(script, /createActiveCourseWorkFromAnalysis\(currentAnalysis\)/);
  assert.match(
    script,
    /mergeAnalysisIntoActiveCourseWork\(currentWork, currentAnalysis\)/
  );
  assert.match(script, /saveActiveCourseWork\(result\.work\)/);
  assert.match(script, /summary\.conflictFieldKeys\.length/);
  assert.match(script, /충돌 \$\{result\.conflictFieldKeys\.length\}개 보존/);
});

test("430px harness가 다른 활성 작업과 저장 실패를 재현한다", async () => {
  const harness = await readFile(harnessUrl, "utf8");

  assert.match(harness, /searchParams\.get\("activeWork"\) === "different"/);
  assert.match(harness, /createActiveCourseWork/);
  assert.match(harness, /searchParams\.get\("workSet"\) === "fail"/);
  assert.match(harness, /Object\.hasOwn\(next, "activeCourseWork"\)/);
  assert.match(harness, /globalThis\.__harnessValues = values/);
  assert.match(harness, /manchester-masters-snapshot\.json/);
  assert.match(harness, /generic-university-snapshot\.json/);
});

test("항목 카드에서 활성 작업 값을 직접 입력·수정·복사한다", async () => {
  const [html, script] = await Promise.all([
    readFile(sidepanelHtmlUrl, "utf8"),
    readFile(sidepanelJsUrl, "utf8")
  ]);

  assert.match(html, /id="work-value-dialog"/);
  assert.match(html, /id="work-value-input"/);
  assert.match(html, /페이지 분석값은 보존하고/);
  assert.match(script, /createWorkFieldPanel\(field\)/);
  assert.match(script, /addManualValueToActiveCourseWork\(context\.work/);
  assert.match(script, /saveActiveCourseWorkWithActivity/);
  assert.match(script, /직접 입력값을 수정하고 기록했습니다/);
  assert.match(script, /copySelectedWorkValue/);
});

test("추출과 복사를 항목별 실사용 기록에 연결하고 실패 분류를 표시한다", async () => {
  const script = await readFile(sidepanelJsUrl, "utf8");

  assert.match(script, /createExtractionActivityEvents\(analysis, matchingWork\)/);
  assert.match(script, /WORK_ACTIVITY_TYPES\.COPY_SUCCEEDED/);
  assert.match(script, /WORK_ACTIVITY_TYPES\.COPY_FAILED/);
  assert.match(script, /사이트 구조에서 찾지 못함/);
  assert.match(script, /별도 페이지 확인 필요/);
  assert.match(script, /지원서 확인 필요/);
  assert.match(script, /reason: \$\{classification\.reasonCode\}/);
});

test("430px harness가 직접 입력과 실사용 기록 저장 실패를 재현한다", async () => {
  const harness = await readFile(harnessUrl, "utf8");

  assert.match(harness, /searchParams\.get\("manualSet"\) === "fail"/);
  assert.match(harness, /searchParams\.get\("activitySet"\) === "fail"/);
  assert.match(harness, /Object\.hasOwn\(next, "activeCourseWorkEvents"\)/);
  assert.match(harness, /id="work-value-dialog"/);
});

test("활성 작업 JSON과 실사용 기록 CSV 내보내기 UI를 제공한다", async () => {
  const [html, script] = await Promise.all([
    readFile(sidepanelHtmlUrl, "utf8"),
    readFile(sidepanelJsUrl, "utf8")
  ]);

  assert.match(html, /id="export-active-work-json-button"/);
  assert.match(html, /id="export-work-activity-csv-button"/);
  assert.match(html, /id="work-failure-summary-list"/);
  assert.match(script, /serializeActiveCourseWorkJson/);
  assert.match(script, /serializeWorkActivityCsv/);
  assert.match(script, /new Blob\(\[text\]/);
  assert.match(script, /link\.download = fileName/);
  assert.match(script, /URL\.revokeObjectURL/);
});

test("반복 실패 요약과 adapter 후보를 기록 state에서 렌더링한다", async () => {
  const [script, harness] = await Promise.all([
    readFile(sidepanelJsUrl, "utf8"),
    readFile(harnessUrl, "utf8")
  ]);

  assert.match(script, /summarizeWorkActivityFailures\(events\)/);
  assert.match(script, /다음 adapter 개선 후보/);
  assert.match(script, /사이트 구조 실패가 3회 이상/);
  assert.match(harness, /searchParams\.get\("activitySummary"\) === "repeated"/);
  assert.match(harness, /globalThis\.__harnessDownloads = harnessDownloads/);
});
