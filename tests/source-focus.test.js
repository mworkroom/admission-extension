import test from "node:test";
import assert from "node:assert/strict";

import { focusSourceInPage } from "../content/focus-source.js";

class FakeElement {
  constructor(tagName, text = "", children = []) {
    this.tagName = tagName.toUpperCase();
    this.innerText = text;
    this.textContent = text;
    this.children = children;
    this.parentElement = null;
    this.attributes = new Map();
    for (const child of children) child.parentElement = this;
  }

  querySelectorAll() {
    return this.children.flatMap((child) => [child, ...child.querySelectorAll()]);
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  scrollIntoView(options) {
    this.scrollOptions = options;
  }

  focus(options) {
    this.focusOptions = options;
  }

  append() {}
}

test("근거 발췌문과 가장 가까운 페이지 요소로 이동하고 잠시 강조한다", () => {
  const heading = new FakeElement("h2", "Fees and funding");
  const tuitionRow = new FakeElement("tr", "Tuition fees (2026/27) £50,600");
  const deposit = new FakeElement(
    "p",
    "For flexible offer holders a £350 deposit will be charged."
  );
  const root = new FakeElement("main", "", [heading, tuitionRow, deposit]);
  const appended = [];
  const timers = [];
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  globalThis.document = {
    body: root,
    head: { append: (node) => appended.push(node) },
    documentElement: { append: (node) => appended.push(node) },
    querySelector: () => root,
    querySelectorAll: () =>
      root
        .querySelectorAll()
        .filter((node) => node.getAttribute("data-admission-source-focus") === "true"),
    getElementById: () => null,
    createElement: (tagName) => new FakeElement(tagName)
  };
  globalThis.window = {
    setTimeout: (callback) => timers.push(callback)
  };

  try {
    const result = focusSourceInPage({
      sectionLabel: "Tuition fees",
      excerpt: "International students Tuition fees (2026/27) £50,600"
    });

    assert.equal(result.found, true);
    assert.match(result.matchedText, /£50,600/);
    assert.deepEqual(tuitionRow.scrollOptions, {
      behavior: "smooth",
      block: "center",
      inline: "nearest"
    });
    assert.deepEqual(tuitionRow.focusOptions, { preventScroll: true });
    assert.equal(tuitionRow.getAttribute("data-admission-source-focus"), "true");
    assert.equal(appended.length, 1);

    timers[0]();
    assert.equal(tuitionRow.hasAttribute("data-admission-source-focus"), false);
    assert.equal(tuitionRow.hasAttribute("tabindex"), false);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test("근거 텍스트와 섹션을 모두 찾지 못하면 페이지를 임의 이동하지 않는다", () => {
  const paragraph = new FakeElement("p", "Completely unrelated course information");
  const root = new FakeElement("main", "", [paragraph]);
  const previousDocument = globalThis.document;
  globalThis.document = {
    body: root,
    querySelector: () => root,
    querySelectorAll: () => [],
    getElementById: () => null,
    createElement: (tagName) => new FakeElement(tagName),
    head: { append() {} },
    documentElement: { append() {} }
  };

  try {
    assert.deepEqual(
      focusSourceInPage({
        sectionLabel: "References",
        excerpt: "Two academic references are required."
      }),
      { found: false, reason: "source_element_not_found" }
    );
    assert.equal(paragraph.scrollOptions, undefined);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});
