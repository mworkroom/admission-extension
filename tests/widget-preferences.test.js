import test from "node:test";
import assert from "node:assert/strict";

import {
  WIDGET_PREFERENCES_STORAGE_KEY,
  createDefaultWidgetPreferences,
  isValidWidgetPreferences,
  loadWidgetPreferences,
  saveWidgetPreferences
} from "../shared/widget-preferences.js";

function createStorage(initial = {}, options = {}) {
  const values = structuredClone(initial);
  return {
    values,
    async get(key) {
      if (options.failGet) {
        throw new Error("get failed");
      }
      return Object.hasOwn(values, key) ? { [key]: values[key] } : {};
    },
    async set(next) {
      if (options.failSet) {
        throw new Error("set failed");
      }
      Object.assign(values, structuredClone(next));
    }
  };
}

test("상담 위젯 숨김은 새 사용자에게 기본으로 켜진다", () => {
  const preferences = createDefaultWidgetPreferences();

  assert.deepEqual(preferences, {
    schemaVersion: 1,
    hideKnownWidgets: true
  });
  assert.equal(isValidWidgetPreferences(preferences), true);
});

test("저장값이 없거나 손상되면 기본 설정을 복구해 저장한다", async () => {
  const emptyStorage = createStorage();
  const emptyState = await loadWidgetPreferences(emptyStorage);

  assert.equal(emptyState.preferences.hideKnownWidgets, true);
  assert.equal(emptyState.recovered, false);
  assert.equal(emptyState.persisted, true);
  assert.deepEqual(
    emptyStorage.values[WIDGET_PREFERENCES_STORAGE_KEY],
    createDefaultWidgetPreferences()
  );

  const damagedStorage = createStorage({
    [WIDGET_PREFERENCES_STORAGE_KEY]: { hideKnownWidgets: "yes" }
  });
  const damagedState = await loadWidgetPreferences(damagedStorage);

  assert.equal(damagedState.preferences.hideKnownWidgets, true);
  assert.equal(damagedState.recovered, true);
  assert.equal(damagedState.persisted, true);
});

test("숨김 설정을 저장하고 저장 실패는 호출자에게 전달한다", async () => {
  const storage = createStorage();
  const disabled = {
    schemaVersion: 1,
    hideKnownWidgets: false
  };

  await saveWidgetPreferences(disabled, storage);
  assert.deepEqual(storage.values[WIDGET_PREFERENCES_STORAGE_KEY], disabled);

  await assert.rejects(
    saveWidgetPreferences(disabled, createStorage({}, { failSet: true })),
    /set failed/
  );
  await assert.rejects(
    saveWidgetPreferences({ hideKnownWidgets: true }, storage),
    /형식이 올바르지 않습니다/
  );
});

test("저장소를 읽지 못하면 기본 설정을 메모리에서만 사용한다", async () => {
  const state = await loadWidgetPreferences(
    createStorage({}, { failGet: true })
  );

  assert.equal(state.preferences.hideKnownWidgets, true);
  assert.equal(state.persisted, false);
  assert.ok(state.error);
});
