import {
  createDefaultBasis,
  isValidBasis,
  normalizeBasis
} from "./basis.js";
import { isExtractionStatus } from "./extraction-status.js";

export const STORAGE_KEYS = Object.freeze({
  basis: "appBasis",
  uiVersion: "uiVersion",
  analysis: "lastAnalysis",
  events: "analysisEvents",
  commonMemos: "commonMemoStore"
});

export const UI_VERSION = 4;
export const MAX_ANALYSIS_EVENTS = 100;

function isValidAnalysis(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      value.schemaVersion === 3 &&
      typeof value.siteKey === "string" &&
      typeof value.analyzedAt === "string" &&
      Number.isFinite(Date.parse(value.analyzedAt)) &&
      typeof value.page?.url === "string" &&
      Array.isArray(value.fields) &&
      value.fields.every(
        (field) =>
          typeof field?.key === "string" &&
          typeof field?.label === "string" &&
          isExtractionStatus(field?.status)
      )
  );
}

function normalizeEvents(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (event) =>
        event &&
        typeof event.type === "string" &&
        typeof event.createdAt === "string" &&
        Number.isFinite(Date.parse(event.createdAt))
    )
    .slice(-MAX_ANALYSIS_EVENTS);
}

export async function loadAppState(
  storageArea = chrome.storage.local,
  now = new Date()
) {
  const fallbackBasis = createDefaultBasis(now);
  let stored;

  try {
    stored = await storageArea.get([
      STORAGE_KEYS.basis,
      STORAGE_KEYS.uiVersion
    ]);
  } catch (error) {
    return {
      basis: fallbackBasis,
      recovered: false,
      persisted: false,
      error
    };
  }

  const hasStoredBasis = Object.prototype.hasOwnProperty.call(
    stored,
    STORAGE_KEYS.basis
  );
  const hasValidStoredBasis = isValidBasis(stored[STORAGE_KEYS.basis]);
  const basis = normalizeBasis(stored[STORAGE_KEYS.basis], now);
  const recovered = hasStoredBasis && !hasValidStoredBasis;
  const needsRepair =
    !hasValidStoredBasis || stored[STORAGE_KEYS.uiVersion] !== UI_VERSION;

  if (needsRepair) {
    try {
      await storageArea.set({
        [STORAGE_KEYS.basis]: basis,
        [STORAGE_KEYS.uiVersion]: UI_VERSION
      });
    } catch (error) {
      return {
        basis,
        recovered,
        persisted: false,
        error
      };
    }
  }

  return {
    basis,
    recovered,
    persisted: true,
    error: null
  };
}

export async function loadAnalysisState(storageArea = chrome.storage.local) {
  try {
    const stored = await storageArea.get([
      STORAGE_KEYS.analysis,
      STORAGE_KEYS.events
    ]);
    return {
      analysis: isValidAnalysis(stored[STORAGE_KEYS.analysis])
        ? stored[STORAGE_KEYS.analysis]
        : null,
      events: normalizeEvents(stored[STORAGE_KEYS.events]),
      persisted: true,
      error: null
    };
  } catch (error) {
    return {
      analysis: null,
      events: [],
      persisted: false,
      error
    };
  }
}

export async function saveBasis(basis, storageArea = chrome.storage.local) {
  if (!isValidBasis(basis)) {
    throw new TypeError("저장할 기준값의 형식이 올바르지 않습니다.");
  }

  await storageArea.set({
    [STORAGE_KEYS.basis]: basis,
    [STORAGE_KEYS.uiVersion]: UI_VERSION
  });

  return basis;
}

export async function saveAnalysis(
  analysis,
  storageArea = chrome.storage.local
) {
  if (!isValidAnalysis(analysis)) {
    throw new TypeError("저장할 분석 결과의 형식이 올바르지 않습니다.");
  }

  await storageArea.set({
    [STORAGE_KEYS.analysis]: analysis,
    [STORAGE_KEYS.uiVersion]: UI_VERSION
  });

  return analysis;
}

export async function markAnalysisStale(
  analysis,
  storageArea = chrome.storage.local
) {
  if (!analysis) {
    return null;
  }
  if (!isValidAnalysis(analysis)) {
    throw new TypeError("기존 분석 결과의 형식이 올바르지 않습니다.");
  }

  const staleAnalysis = { ...analysis, stale: true };
  await saveAnalysis(staleAnalysis, storageArea);
  return staleAnalysis;
}

export async function appendAnalysisEvent(
  event,
  storageArea = chrome.storage.local,
  now = new Date()
) {
  const stored = await storageArea.get(STORAGE_KEYS.events);
  const events = normalizeEvents(stored[STORAGE_KEYS.events]);
  const nextEvent = {
    type: String(event?.type ?? "unknown"),
    fieldKey: String(event?.fieldKey ?? ""),
    detail: String(event?.detail ?? "").slice(0, 300),
    createdAt: now.toISOString()
  };
  const nextEvents = [...events, nextEvent].slice(-MAX_ANALYSIS_EVENTS);

  await storageArea.set({
    [STORAGE_KEYS.events]: nextEvents
  });

  return nextEvents;
}
