import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const fieldsUrl = new URL("../shared/fields.js", import.meta.url);
const sidepanelJsUrl = new URL("../sidepanel/sidepanel.js", import.meta.url);
const sidepanelCssUrl = new URL("../sidepanel/sidepanel.css", import.meta.url);

test("긴 체크리스트 항목명은 화면용 짧은 제목을 사용한다", async () => {
  const fields = await readFile(fieldsUrl, "utf8");

  assert.match(fields, /\["koreanAcademicRequirements", "Korean Equivalent"\]/);
  assert.match(fields, /\["universityApplicationDeadline", "Application Deadline"\]/);
  assert.doesNotMatch(fields, /Korean Academic Requirements/);
  assert.doesNotMatch(fields, /University Application Deadline/);
});

test("상태 뱃지는 기호만 표시하고 상태명은 접근성 이름으로 보존한다", async () => {
  const script = await readFile(sidepanelJsUrl, "utf8");

  assert.match(script, /badge\.setAttribute\("aria-label", meta\.label\)/g);
  assert.match(script, /badge\.title = meta\.label/g);
  assert.doesNotMatch(script, /badge\.append\(symbol, label\)/);
  assert.match(script, /badge\.append\(symbol\)/g);
});

test("카드 제목과 상태 기호는 좁은 화면에서도 같은 헤더 안에 둔다", async () => {
  const css = await readFile(sidepanelCssUrl, "utf8");
  const headerRule = css.match(/\.field-card__header\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
  const narrowMedia = css.match(/@media \(max-width: 370px\)\s*\{([\s\S]*)/)?.[1] ?? "";

  assert.match(headerRule, /justify-content:\s*flex-start/);
  assert.match(headerRule, /gap:\s*8px/);
  assert.match(css, /\.field-card__title\s*\{[\s\S]*?min-width:\s*0/);
  assert.doesNotMatch(narrowMedia, /\.field-card__header/);
});
