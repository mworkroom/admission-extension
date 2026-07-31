import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sidepanelHtmlUrl = new URL("../sidepanel/sidepanel.html", import.meta.url);
const sidepanelJsUrl = new URL("../sidepanel/sidepanel.js", import.meta.url);
const harnessUrl = new URL("./ui-harness.html", import.meta.url);

test("현재 페이지에 상담 위젯 숨김 설정을 제공한다", async () => {
  const html = await readFile(sidepanelHtmlUrl, "utf8");

  assert.match(html, /id="hide-known-widgets-input"/);
  assert.match(html, /상담 위젯 숨기기/);
  assert.match(html, /Unibuddy 등 확인된 팝업/);
  assert.match(html, /id="widget-control-status"/);
});

test("Unibuddy의 안정적인 식별자만 현재 탭 CSS 규칙으로 숨긴다", async () => {
  const script = await readFile(sidepanelJsUrl, "utf8");

  assert.match(script, /#unibuddy-popcard-wrapper/);
  assert.match(script, /#unibuddy-popcard-iframe/);
  assert.match(script, /popcard\.unibuddy\.co/);
  assert.match(script, /iframe\[title="Unibuddy Popcard"\]/);
  assert.match(script, /chrome\.scripting\.insertCSS\(injection\)/);
  assert.match(script, /chrome\.scripting\.removeCSS\(injection\)/);
  assert.doesNotMatch(script, /position:\s*fixed/);
});

test("상담 위젯 설정은 저장 후 현재 탭에 즉시 적용한다", async () => {
  const script = await readFile(sidepanelJsUrl, "utf8");

  assert.match(script, /loadWidgetPreferences\(\)/);
  assert.match(script, /saveWidgetPreferences\(nextPreferences\)/);
  assert.match(script, /await applyKnownWidgetPreference\(currentTab\)/);
  assert.match(
    script,
    /elements\.hideKnownWidgetsInput\.addEventListener\("change"/
  );
});

test("430px harness는 Unibuddy 표시와 CSS 주입·해제를 재현한다", async () => {
  const harness = await readFile(harnessUrl, "utf8");

  assert.match(harness, /searchParams\.get\("widget"\) === "unibuddy"/);
  assert.match(harness, /id = "unibuddy-popcard-wrapper"/);
  assert.match(harness, /async insertCSS\(\{ css \}\)/);
  assert.match(harness, /async removeCSS\(\)/);
});
