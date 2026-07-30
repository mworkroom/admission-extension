import test from "node:test";
import assert from "node:assert/strict";

import { createDefaultBasis } from "../shared/basis.js";
import { EXTRACTION_STATUS } from "../shared/extraction-status.js";
import {
  appendAnalysisEvent,
  loadAnalysisState,
  markAnalysisStale,
  MAX_ANALYSIS_EVENTS,
  saveAnalysis,
  STORAGE_KEYS
} from "../shared/storage.js";

const FIXED_DATE = new Date("2026-07-30T00:00:00.000Z");

function createAnalysis() {
  return {
    schemaVersion: 3,
    siteKey: "kcl",
    analyzedAt: FIXED_DATE.toISOString(),
    stale: false,
    basis: createDefaultBasis(FIXED_DATE),
    page: {
      title: "Nutrition - Entry Requirements",
      url: "https://www.kcl.ac.uk/study/postgraduate-taught/courses/nutrition-msc/requirements"
    },
    fields: [
      {
        key: "university",
        label: "University",
        status: EXTRACTION_STATUS.FOUND
      }
    ],
    summary: {
      total: 1,
      found: 1
    }
  };
}

function createMemoryStorage(initial = {}) {
  const values = { ...initial };
  return {
    values,
    async get(keys) {
      const requested = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(
        requested
          .filter((key) => Object.hasOwn(values, key))
          .map((key) => [key, values[key]])
      );
    },
    async set(next) {
      Object.assign(values, next);
    }
  };
}

test("마지막 분석 결과를 저장하고 다시 불러온다", async () => {
  const storage = createMemoryStorage();
  const analysis = createAnalysis();

  await saveAnalysis(analysis, storage);
  const loaded = await loadAnalysisState(storage);

  assert.deepEqual(loaded.analysis, analysis);
  assert.equal(loaded.persisted, true);
});

test("기준 변경 시 기존 결과를 지우지 않고 stale로 저장한다", async () => {
  const storage = createMemoryStorage();
  const stale = await markAnalysisStale(createAnalysis(), storage);

  assert.equal(stale.stale, true);
  assert.equal(storage.values[STORAGE_KEYS.analysis].stale, true);
  assert.equal(storage.values[STORAGE_KEYS.analysis].fields.length, 1);
});

test("분석 이벤트는 최근 100개만 보관하고 본문 전체를 저장하지 않는다", async () => {
  const oldEvents = Array.from(
    { length: MAX_ANALYSIS_EVENTS },
    (_, index) => ({
      type: "analysis_completed",
      fieldKey: "",
      detail: String(index),
      createdAt: new Date(FIXED_DATE.getTime() + index * 1000).toISOString()
    })
  );
  const storage = createMemoryStorage({
    [STORAGE_KEYS.events]: oldEvents
  });

  const events = await appendAnalysisEvent(
    {
      type: "copy_succeeded",
      fieldKey: "course",
      detail: "x".repeat(500)
    },
    storage,
    new Date("2026-07-30T01:00:00.000Z")
  );

  assert.equal(events.length, MAX_ANALYSIS_EVENTS);
  assert.equal(events[0].detail, "1");
  assert.equal(events.at(-1).type, "copy_succeeded");
  assert.equal(events.at(-1).detail.length, 300);
  assert.equal("html" in events.at(-1), false);
});

test("손상된 분석 결과는 복구 대상에서 제외한다", async () => {
  const storage = createMemoryStorage({
    [STORAGE_KEYS.analysis]: {
      schemaVersion: 1,
      analyzedAt: "invalid",
      fields: []
    },
    [STORAGE_KEYS.events]: [{ type: "bad" }]
  });

  const loaded = await loadAnalysisState(storage);

  assert.equal(loaded.analysis, null);
  assert.deepEqual(loaded.events, []);
});
