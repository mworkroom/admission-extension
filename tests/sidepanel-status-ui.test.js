import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const htmlUrl = new URL("../sidepanel/sidepanel.html", import.meta.url);
const jsUrl = new URL("../sidepanel/sidepanel.js", import.meta.url);
const cssUrl = new URL("../sidepanel/sidepanel.css", import.meta.url);

test("9개 결과 항목을 요청한 순서의 두 그룹으로 모두 기본 표시한다", async () => {
  const [html, script] = await Promise.all([readFile(htmlUrl, "utf8"), readFile(jsUrl, "utf8")]);
  assert.match(html, /id="field-list"/);
  assert.match(html, /<hr class="field-group-divider" id="field-group-divider" aria-hidden="true">/);
  assert.match(html, /id="supporting-field-list"/);
  assert.doesNotMatch(html, /나머지 확인 항목/);
  assert.match(script, /const FIELD_GROUP_SEPARATOR_KEY = "reference"/);
  assert.match(script, /\.sort\(\(left, right\) => left\.order - right\.order\)/);
  assert.match(script, /fields\.findIndex\(\(field\) => field\.key === FIELD_GROUP_SEPARATOR_KEY\)/);
  assert.doesNotMatch(script, /CORE_FIELD_KEYS|hasMemo \|\| hasProblem/);
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

test("요구하지 않음 상태는 누락 주의 항목으로 다시 세지 않는다", async () => {
  const script = await readFile(jsUrl, "utf8");
  assert.match(script, /EXTRACTION_STATUS\.NOT_REQUIRED/);
  assert.match(script, /field\.status !== EXTRACTION_STATUS\.FOUND/);
});

test("패널 최초 열기와 탭·URL 변경에서 자동 분석하고 실패 때만 재시도 버튼을 보인다", async () => {
  const script = await readFile(jsUrl, "utf8");
  assert.match(script, /await refreshCurrentPage\(\{ autoAnalyze: true \}\)/);
  assert.match(script, /chrome\.tabs\.onActivated/);
  assert.match(script, /chrome\.tabs\.onUpdated/);
  assert.match(script, /const showRetry =[^;]+Boolean\(message\)/s);
});

test("근거 전문 없이 원문 보기와 영어 등급 세부 기준 액션을 제공한다", async () => {
  const [script, css] = await Promise.all([
    readFile(jsUrl, "utf8"),
    readFile(cssUrl, "utf8")
  ]);

  assert.match(script, /function canFocusSourceOnCurrentPage\(source\)/);
  assert.match(script, /func: focusSourceInPage/);
  assert.match(script, /button\.className = "source-view-button"/);
  assert.match(script, /button\.textContent = "원문 보기"/);
  assert.match(script, /detailLink\.textContent = "등급 세부 기준"/);
  assert.match(script, /const sourceUrl = source\?\.url \|\| ""/);
  assert.match(script, /sourceUrl && isSafeHttpUrl\(sourceUrl\)/);
  assert.match(script, /field\.detailUrl &&\s+isSafeHttpUrl\(field\.detailUrl\)/);
  assert.doesNotMatch(
    script.match(/function createSourceActions\(field\)[\s\S]*?return actions;/)?.[0] ?? "",
    /source\.url/
  );
  assert.doesNotMatch(script, /function createSourceDetails/);
  assert.doesNotMatch(script, /summary\.textContent = "근거"/);
  assert.match(css, /\.source-view-button:hover/);
  assert.match(css, /\.source-view-button--success/);
  assert.doesNotMatch(css, /\.source-details/);
});
