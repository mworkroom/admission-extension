import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sidepanelHtmlUrl = new URL("../sidepanel/sidepanel.html", import.meta.url);
const sidepanelJsUrl = new URL("../sidepanel/sidepanel.js", import.meta.url);

test("현재 페이지에 상담 위젯 숨김 설정을 제공한다", async () => {
  const html = await readFile(sidepanelHtmlUrl, "utf8");

  assert.match(html, /id="hide-known-widgets-input"/);
  assert.match(html, /상담 위젯 숨기기/);
  assert.match(html, /id="tools-dialog"/);
  assert.match(html, /id="tools-status"/);
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
  assert.match(script, /saveWidgetPreferences\(currentWidgetPreferences\)/);
  assert.match(script, /await applyKnownWidgetPreference\(\)/);
  assert.match(
    script,
    /elements\.hideKnownWidgetsInput\.addEventListener\("change"/
  );
});
