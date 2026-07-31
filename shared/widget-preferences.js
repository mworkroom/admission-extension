export const WIDGET_PREFERENCES_STORAGE_KEY = "widgetPreferences";
export const WIDGET_PREFERENCES_SCHEMA_VERSION = 1;

export function createDefaultWidgetPreferences() {
  return {
    schemaVersion: WIDGET_PREFERENCES_SCHEMA_VERSION,
    hideKnownWidgets: true
  };
}

export function isValidWidgetPreferences(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      value.schemaVersion === WIDGET_PREFERENCES_SCHEMA_VERSION &&
      typeof value.hideKnownWidgets === "boolean"
  );
}

export async function loadWidgetPreferences(
  storageArea = chrome.storage.local
) {
  const fallback = createDefaultWidgetPreferences();

  try {
    const stored = await storageArea.get(WIDGET_PREFERENCES_STORAGE_KEY);
    const value = stored[WIDGET_PREFERENCES_STORAGE_KEY];
    if (isValidWidgetPreferences(value)) {
      return {
        preferences: value,
        recovered: false,
        persisted: true,
        error: null
      };
    }

    await storageArea.set({
      [WIDGET_PREFERENCES_STORAGE_KEY]: fallback
    });
    return {
      preferences: fallback,
      recovered: value !== undefined,
      persisted: true,
      error: null
    };
  } catch (error) {
    return {
      preferences: fallback,
      recovered: false,
      persisted: false,
      error
    };
  }
}

export async function saveWidgetPreferences(
  preferences,
  storageArea = chrome.storage.local
) {
  if (!isValidWidgetPreferences(preferences)) {
    throw new TypeError("저장할 상담 위젯 설정의 형식이 올바르지 않습니다.");
  }

  await storageArea.set({
    [WIDGET_PREFERENCES_STORAGE_KEY]: preferences
  });
  return preferences;
}
