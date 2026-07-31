import { isValidBasis } from "./basis.js";
import { isExtractionStatus, EXTRACTION_STATUS } from "./extraction-status.js";
import { FIELDS } from "./fields.js";

export const ACTIVE_COURSE_WORK_STORAGE_KEY = "activeCourseWork";
export const ACTIVE_COURSE_WORK_SCHEMA_VERSION = 1;

export const WORK_VALUE_ORIGINS = Object.freeze({
  ANALYSIS: "analysis",
  MANUAL: "manual"
});

export const WORK_SOURCE_PAGE_KINDS = Object.freeze([
  "course",
  "fees",
  "requirements",
  "supporting",
  "other_official"
]);

const WORK_VALUE_ORIGIN_VALUES = Object.freeze(
  Object.values(WORK_VALUE_ORIGINS)
);
const FIELD_KEYS = Object.freeze(FIELDS.map((field) => field.key));

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isValidTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isSafeOfficialUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeCourseKey(value) {
  return normalizeText(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeWorkBasis(value, now) {
  return {
    academicCycle: normalizeText(value?.academicCycle),
    intakeMonth: Number(value?.intakeMonth),
    intakeYear: Number(value?.intakeYear),
    studyMode: normalizeText(value?.studyMode),
    feeStatus: normalizeText(value?.feeStatus),
    updatedAt: isValidTimestamp(value?.updatedAt)
      ? value.updatedAt
      : now.toISOString()
  };
}

function shortHash(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function normalizeSourceRef(value) {
  return {
    pageUrl: normalizeText(value?.pageUrl),
    sourceLabel: normalizeText(value?.sourceLabel),
    sourceExcerpt: normalizeText(value?.sourceExcerpt).slice(0, 700)
  };
}

function isValidSourceRef(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      isSafeOfficialUrl(value.pageUrl) &&
      typeof value.sourceLabel === "string" &&
      typeof value.sourceExcerpt === "string" &&
      value.sourceExcerpt.length <= 700
  );
}

function getSourceRefKey(value) {
  return [
    value.pageUrl,
    value.sourceLabel,
    value.sourceExcerpt
  ].join("\n");
}

export function deriveCourseKeyFromUrl(siteKey, value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      return "";
    }

    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    const definitions = {
      kcl: {
        hostname: "kcl.ac.uk",
        pattern:
          /^\/study\/postgraduate-taught\/courses\/([^/]+)\/(?:requirements|fees)\/?$/
      },
      soas: {
        hostname: "soas.ac.uk",
        pattern: /^\/study\/find-course\/([^/]+)\/?$/
      },
      qmul: {
        hostname: "qmul.ac.uk",
        pattern:
          /^\/postgraduate\/taught\/coursefinder\/courses\/([^/]+)\/?$/
      },
      manchester: {
        hostname: "alliancembs.manchester.ac.uk",
        pattern:
          /^\/study\/masters\/([^/]+)\/(?:overview|entry-requirements|application-and-selection|course-details|careers)\/?$/
      }
    };
    const normalizedSiteKey = normalizeText(siteKey).toLowerCase();
    const definition = definitions[normalizedSiteKey];
    if (definition) {
      if (hostname !== definition.hostname) {
        return "";
      }
      const match = definition.pattern.exec(url.pathname);
      return match ? normalizeCourseKey(match[1]) : "";
    }

    const hostnameSiteKey = normalizeCourseKey(hostname);
    if (normalizedSiteKey !== hostnameSiteKey) {
      return "";
    }

    const genericLeafSegments = new Set([
      "admission-requirements",
      "admissions",
      "application-and-selection",
      "apply",
      "careers",
      "course-details",
      "entry-requirements",
      "fees",
      "fees-and-funding",
      "funding",
      "how-to-apply",
      "index",
      "modules",
      "overview",
      "requirements",
      "structure",
      "tuition-fees"
    ]);
    const segments = url.pathname
      .split("/")
      .map((segment) => normalizeCourseKey(segment))
      .filter(Boolean);
    while (
      segments.length > 1 &&
      genericLeafSegments.has(segments.at(-1))
    ) {
      segments.pop();
    }
    const candidate = segments.at(-1);
    return candidate || `page-${shortHash(`${url.origin}${url.pathname}`)}`;
  } catch {
    return "";
  }
}

export function buildActiveCourseWorkId(value) {
  const basis = value?.basis ?? {};
  return [
    normalizeText(value?.siteKey).toLowerCase(),
    normalizeCourseKey(value?.courseKey),
    normalizeText(basis.academicCycle),
    `${basis.intakeYear}-${String(basis.intakeMonth).padStart(2, "0")}`,
    normalizeText(basis.studyMode),
    normalizeText(basis.feeStatus)
  ].join("::");
}

export function createWorkValueEntry(input, now = new Date()) {
  const fieldKey = normalizeText(input?.fieldKey);
  const origin = normalizeText(input?.origin);
  const value = normalizeText(input?.value);
  const status =
    origin === WORK_VALUE_ORIGINS.MANUAL
      ? EXTRACTION_STATUS.FOUND
      : normalizeText(input?.status);
  const sourceRefs = Array.isArray(input?.sourceRefs)
    ? input.sourceRefs.map(normalizeSourceRef)
    : input?.sourcePageUrl
      ? [
          normalizeSourceRef({
            pageUrl: input.sourcePageUrl,
            sourceLabel: input.sourceLabel,
            sourceExcerpt: input.sourceExcerpt
          })
        ]
      : [];
  const recordedAt = now.toISOString();
  const fingerprint = [
    fieldKey,
    origin,
    value,
    status,
    ...sourceRefs.map(getSourceRefKey),
    normalizeText(input?.detail),
    normalizeText(input?.reasonCode),
    recordedAt
  ].join("\n");
  const entry = {
    id: `${fieldKey}::${origin}::${now.getTime()}::${shortHash(fingerprint)}`,
    fieldKey,
    origin,
    status,
    value,
    detail: normalizeText(input?.detail),
    reasonCode: normalizeText(input?.reasonCode),
    sourceRefs,
    recordedAt
  };

  if (!isValidWorkValueEntry(entry)) {
    throw new TypeError("활성 과정 작업의 항목 값 형식이 올바르지 않습니다.");
  }
  return entry;
}

export function isValidWorkValueEntry(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  const isManual = value.origin === WORK_VALUE_ORIGINS.MANUAL;
  const sourceKeys = new Set();
  const hasValidSources =
    Array.isArray(value.sourceRefs) &&
    value.sourceRefs.every((sourceRef) => {
      const key = getSourceRefKey(sourceRef);
      if (!isValidSourceRef(sourceRef) || sourceKeys.has(key)) {
        return false;
      }
      sourceKeys.add(key);
      return true;
    }) &&
    (isManual || value.sourceRefs.length > 0);

  return Boolean(
    typeof value.id === "string" &&
      value.id.length > 0 &&
      FIELD_KEYS.includes(value.fieldKey) &&
      WORK_VALUE_ORIGIN_VALUES.includes(value.origin) &&
      isExtractionStatus(value.status) &&
      (!isManual || value.status === EXTRACTION_STATUS.FOUND) &&
      (!isManual || normalizeText(value.value).length > 0) &&
      typeof value.value === "string" &&
      typeof value.detail === "string" &&
      typeof value.reasonCode === "string" &&
      hasValidSources &&
      isValidTimestamp(value.recordedAt)
  );
}

function isValidSourcePage(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      isSafeOfficialUrl(value.url) &&
      typeof value.title === "string" &&
      WORK_SOURCE_PAGE_KINDS.includes(value.kind) &&
      isValidTimestamp(value.addedAt) &&
      (value.lastAnalyzedAt === null ||
        isValidTimestamp(value.lastAnalyzedAt))
  );
}

function isValidFieldState(value) {
  if (
    !value ||
    typeof value !== "object" ||
    !FIELD_KEYS.includes(value.fieldKey) ||
    !Array.isArray(value.entries)
  ) {
    return false;
  }

  const entryIds = new Set();
  const entriesAreValid = value.entries.every((entry) => {
    if (
      !isValidWorkValueEntry(entry) ||
      entry.fieldKey !== value.fieldKey ||
      entryIds.has(entry.id)
    ) {
      return false;
    }
    entryIds.add(entry.id);
    return true;
  });

  return (
    entriesAreValid &&
    (value.selectedEntryId === null ||
      (typeof value.selectedEntryId === "string" &&
        entryIds.has(value.selectedEntryId)))
  );
}

export function isValidActiveCourseWork(value) {
  if (
    !value ||
    typeof value !== "object" ||
    value.schemaVersion !== ACTIVE_COURSE_WORK_SCHEMA_VERSION ||
    !/^[a-z0-9-]+$/.test(value.siteKey) ||
    normalizeText(value.universityName).length === 0 ||
    normalizeText(value.courseName).length === 0 ||
    !/^[a-z0-9-]+$/.test(value.courseKey) ||
    !isSafeOfficialUrl(value.primaryCourseUrl) ||
    !isValidBasis(value.basis) ||
    !Array.isArray(value.sourcePages) ||
    !Array.isArray(value.fieldStates) ||
    !isValidTimestamp(value.createdAt) ||
    !isValidTimestamp(value.updatedAt)
  ) {
    return false;
  }

  if (
    deriveCourseKeyFromUrl(value.siteKey, value.primaryCourseUrl) !==
      value.courseKey ||
    buildActiveCourseWorkId(value) !== value.id
  ) {
    return false;
  }

  const sourceUrls = new Set();
  if (
    !value.sourcePages.every((page) => {
      if (!isValidSourcePage(page) || sourceUrls.has(page.url)) {
        return false;
      }
      sourceUrls.add(page.url);
      return true;
    }) ||
    !sourceUrls.has(value.primaryCourseUrl)
  ) {
    return false;
  }

  const fieldKeys = new Set();
  if (
    !value.fieldStates.every((fieldState) => {
      if (
        !isValidFieldState(fieldState) ||
        fieldKeys.has(fieldState.fieldKey) ||
        fieldState.entries.some(
          (entry) =>
            entry.origin === WORK_VALUE_ORIGINS.ANALYSIS &&
            entry.sourceRefs.some(
              (sourceRef) => !sourceUrls.has(sourceRef.pageUrl)
            )
        )
      ) {
        return false;
      }
      fieldKeys.add(fieldState.fieldKey);
      return true;
    })
  ) {
    return false;
  }

  return (
    fieldKeys.size === FIELD_KEYS.length &&
    FIELD_KEYS.every((fieldKey) => fieldKeys.has(fieldKey))
  );
}

export function createActiveCourseWork(input, now = new Date()) {
  const siteKey = normalizeText(input?.siteKey).toLowerCase();
  const primaryCourseUrl = normalizeText(input?.primaryCourseUrl);
  const courseKey = deriveCourseKeyFromUrl(siteKey, primaryCourseUrl);
  const basis = normalizeWorkBasis(input?.basis, now);
  const createdAt = now.toISOString();
  const work = {
    schemaVersion: ACTIVE_COURSE_WORK_SCHEMA_VERSION,
    id: "",
    siteKey,
    universityName: normalizeText(input?.universityName),
    courseName: normalizeText(input?.courseName),
    courseKey,
    primaryCourseUrl,
    basis,
    sourcePages: [
      {
        url: primaryCourseUrl,
        title: normalizeText(input?.pageTitle),
        kind: "course",
        addedAt: createdAt,
        lastAnalyzedAt: null
      }
    ],
    fieldStates: FIELDS.map((field) => ({
      fieldKey: field.key,
      entries: [],
      selectedEntryId: null
    })),
    createdAt,
    updatedAt: createdAt
  };
  work.id = buildActiveCourseWorkId(work);

  if (!isValidActiveCourseWork(work)) {
    throw new TypeError("활성 과정 작업 형식이 올바르지 않습니다.");
  }
  return work;
}

function getAnalysisField(analysis, fieldKey) {
  return (
    analysis?.fields?.find((field) => field?.key === fieldKey) ?? null
  );
}

function isValidAnalysisForActiveWork(value) {
  if (
    !value ||
    typeof value !== "object" ||
    value.schemaVersion !== 3 ||
    !/^[a-z0-9-]+$/.test(value.siteKey) ||
    !isValidTimestamp(value.analyzedAt) ||
    !isSafeOfficialUrl(value.page?.url) ||
    !Array.isArray(value.fields) ||
    !value.fields.every(
      (field) =>
        FIELD_KEYS.includes(field?.key) &&
        isExtractionStatus(field?.status) &&
        typeof field?.value === "string" &&
        typeof field?.detail === "string" &&
        typeof field?.reasonCode === "string"
    )
  ) {
    return false;
  }

  const fieldKeys = new Set(value.fields.map((field) => field.key));
  return (
    fieldKeys.size === FIELD_KEYS.length &&
    FIELD_KEYS.every((fieldKey) => fieldKeys.has(fieldKey)) &&
    normalizeText(getAnalysisField(value, "university")?.value).length > 0 &&
    normalizeText(getAnalysisField(value, "course")?.value).length > 0
  );
}

function inferSourcePageKind(url, primaryCourseUrl) {
  if (url === primaryCourseUrl) {
    return "course";
  }
  if (/\/fees\/?$/i.test(new URL(url).pathname)) {
    return "fees";
  }
  if (/requirements?/i.test(new URL(url).pathname)) {
    return "requirements";
  }
  return "other_official";
}

function addOrUpdateSourcePage(work, source, analysis, now) {
  const existing = work.sourcePages.find((page) => page.url === source.url);
  if (existing) {
    existing.title = existing.title || source.title;
    existing.lastAnalyzedAt = analysis.analyzedAt;
    return false;
  }

  work.sourcePages.push({
    url: source.url,
    title: source.title,
    kind: inferSourcePageKind(source.url, work.primaryCourseUrl),
    addedAt: now.toISOString(),
    lastAnalyzedAt: analysis.analyzedAt
  });
  return true;
}

function getAnalysisSources(analysis) {
  const sources = new Map([
    [
      analysis.page.url,
      {
        url: analysis.page.url,
        title: normalizeText(analysis.page.title)
      }
    ]
  ]);

  for (const field of analysis.fields) {
    const url = normalizeText(field.source?.url);
    if (isSafeOfficialUrl(url) && !sources.has(url)) {
      sources.set(url, {
        url,
        title: normalizeText(field.source?.pageTitle)
      });
    }
  }
  return [...sources.values()];
}

function getFieldSourceRefs(field, analysis) {
  const sourceUrl = isSafeOfficialUrl(field.source?.url)
    ? field.source.url
    : analysis.page.url;
  return [
    normalizeSourceRef({
      pageUrl: sourceUrl,
      sourceLabel: field.source?.sectionLabel || field.label,
      sourceExcerpt: field.source?.excerpt || field.value || field.detail
    })
  ];
}

function isSameAnalysisValue(entry, field) {
  const nextValue = normalizeText(field.value);
  if (entry.value || nextValue) {
    return entry.value === nextValue;
  }
  return (
    entry.status === field.status &&
    entry.reasonCode === normalizeText(field.reasonCode) &&
    entry.detail === normalizeText(field.detail)
  );
}

function mergeSourceRefs(existing, incoming) {
  const keys = new Set(existing.map(getSourceRefKey));
  let addedCount = 0;
  for (const sourceRef of incoming) {
    const key = getSourceRefKey(sourceRef);
    if (!keys.has(key)) {
      existing.push(structuredClone(sourceRef));
      keys.add(key);
      addedCount += 1;
    }
  }
  return addedCount;
}

function getConflictFieldKeys(work) {
  return work.fieldStates
    .filter((fieldState) => {
      const values = new Set(
        fieldState.entries
          .filter(
            (entry) =>
              entry.origin === WORK_VALUE_ORIGINS.ANALYSIS && entry.value
          )
          .map((entry) => entry.value)
      );
      return values.size > 1;
    })
    .map((fieldState) => fieldState.fieldKey);
}

export function mergeAnalysisIntoActiveCourseWork(
  work,
  analysis,
  now = new Date()
) {
  if (!isValidActiveCourseWork(work) || !isValidAnalysisForActiveWork(analysis)) {
    throw new TypeError("병합할 활성 과정 작업 또는 분석 결과가 올바르지 않습니다.");
  }

  const expectedWork = createActiveCourseWork(
    {
      siteKey: analysis.siteKey,
      universityName: getAnalysisField(analysis, "university").value,
      courseName: getAnalysisField(analysis, "course").value,
      primaryCourseUrl: analysis.page.url,
      pageTitle: analysis.page.title,
      basis: analysis.basis
    },
    now
  );
  if (expectedWork.id !== work.id) {
    throw new TypeError("다른 과정 또는 입학 기준의 분석 결과는 병합할 수 없습니다.");
  }

  const nextWork = structuredClone(work);
  let addedSourcePageCount = 0;
  let addedEntryCount = 0;
  let mergedSourceRefCount = 0;

  for (const source of getAnalysisSources(analysis)) {
    if (addOrUpdateSourcePage(nextWork, source, analysis, now)) {
      addedSourcePageCount += 1;
    }
  }

  for (const field of analysis.fields) {
    const fieldState = nextWork.fieldStates.find(
      (state) => state.fieldKey === field.key
    );
    const sourceRefs = getFieldSourceRefs(field, analysis);
    const existingEntry = fieldState.entries.find(
      (entry) =>
        entry.origin === WORK_VALUE_ORIGINS.ANALYSIS &&
        isSameAnalysisValue(entry, field)
    );

    if (existingEntry) {
      mergedSourceRefCount += mergeSourceRefs(
        existingEntry.sourceRefs,
        sourceRefs
      );
      continue;
    }

    const entry = createWorkValueEntry(
      {
        fieldKey: field.key,
        origin: WORK_VALUE_ORIGINS.ANALYSIS,
        status: field.status,
        value: field.value,
        detail: field.detail,
        reasonCode: field.reasonCode,
        sourceRefs
      },
      now
    );
    fieldState.entries.push(entry);
    fieldState.selectedEntryId =
      fieldState.entries.length === 1 ? entry.id : null;
    addedEntryCount += 1;
  }

  const conflictFieldKeys = getConflictFieldKeys(nextWork);
  for (const fieldState of nextWork.fieldStates) {
    if (conflictFieldKeys.includes(fieldState.fieldKey)) {
      fieldState.selectedEntryId = null;
    }
  }
  nextWork.updatedAt = now.toISOString();

  if (!isValidActiveCourseWork(nextWork)) {
    throw new TypeError("분석 결과를 병합한 활성 과정 작업이 올바르지 않습니다.");
  }

  return {
    work: nextWork,
    addedSourcePageCount,
    addedEntryCount,
    mergedSourceRefCount,
    conflictFieldKeys
  };
}

export function createActiveCourseWorkFromAnalysis(
  analysis,
  now = new Date()
) {
  if (!isValidAnalysisForActiveWork(analysis)) {
    throw new TypeError("활성 작업을 시작할 분석 결과가 올바르지 않습니다.");
  }

  const work = createActiveCourseWork(
    {
      siteKey: analysis.siteKey,
      universityName: getAnalysisField(analysis, "university").value,
      courseName: getAnalysisField(analysis, "course").value,
      primaryCourseUrl: analysis.page.url,
      pageTitle: analysis.page.title,
      basis: analysis.basis
    },
    now
  );
  return mergeAnalysisIntoActiveCourseWork(work, analysis, now);
}

export function addManualValueToActiveCourseWork(
  work,
  input,
  now = new Date()
) {
  if (!isValidActiveCourseWork(work)) {
    throw new TypeError("직접 입력값을 추가할 활성 과정 작업이 올바르지 않습니다.");
  }

  const fieldKey = normalizeText(input?.fieldKey);
  const fieldState = work.fieldStates.find(
    (state) => state.fieldKey === fieldKey
  );
  if (!fieldState) {
    throw new TypeError("직접 입력값을 추가할 항목을 찾지 못했습니다.");
  }

  const sourceUrl = normalizeText(input?.sourceUrl);
  const sourceRefs = sourceUrl
    ? [
        {
          pageUrl: sourceUrl,
          sourceLabel: normalizeText(input?.sourceLabel),
          sourceExcerpt: normalizeText(input?.sourceExcerpt || input?.value)
        }
      ]
    : [];
  const entry = createWorkValueEntry(
    {
      fieldKey,
      origin: WORK_VALUE_ORIGINS.MANUAL,
      value: input?.value,
      detail: input?.detail,
      reasonCode: "",
      sourceRefs
    },
    now
  );
  const nextWork = structuredClone(work);
  const nextFieldState = nextWork.fieldStates.find(
    (state) => state.fieldKey === fieldKey
  );
  const previousEntry =
    nextFieldState.entries.find(
      (candidate) => candidate.id === nextFieldState.selectedEntryId
    ) ?? null;
  nextFieldState.entries.push(entry);
  nextFieldState.selectedEntryId = entry.id;
  nextWork.updatedAt = now.toISOString();

  if (!isValidActiveCourseWork(nextWork)) {
    throw new TypeError("직접 입력값을 추가한 활성 과정 작업이 올바르지 않습니다.");
  }

  return {
    work: nextWork,
    entry,
    previousEntry,
    mode:
      previousEntry?.origin === WORK_VALUE_ORIGINS.MANUAL
        ? "updated"
        : "created"
  };
}

export function getSelectedWorkValueEntry(work, fieldKey) {
  if (!isValidActiveCourseWork(work)) {
    return null;
  }
  const fieldState = work.fieldStates.find(
    (state) => state.fieldKey === fieldKey
  );
  return (
    fieldState?.entries.find(
      (entry) => entry.id === fieldState.selectedEntryId
    ) ?? null
  );
}

export function summarizeActiveCourseWork(work) {
  if (!isValidActiveCourseWork(work)) {
    return {
      sourcePageCount: 0,
      capturedEntryCount: 0,
      conflictFieldKeys: []
    };
  }

  return {
    sourcePageCount: work.sourcePages.length,
    capturedEntryCount: work.fieldStates.reduce(
      (total, fieldState) => total + fieldState.entries.length,
      0
    ),
    conflictFieldKeys: getConflictFieldKeys(work)
  };
}

export async function loadActiveCourseWorkState(
  storageArea = chrome.storage.local
) {
  try {
    const stored = await storageArea.get(ACTIVE_COURSE_WORK_STORAGE_KEY);
    const value = stored[ACTIVE_COURSE_WORK_STORAGE_KEY];

    if (value === undefined) {
      return {
        work: null,
        recovered: false,
        quarantined: false,
        unsupportedSchema: false,
        persisted: true,
        error: null
      };
    }

    if (
      value &&
      typeof value === "object" &&
      Number.isInteger(value.schemaVersion) &&
      value.schemaVersion !== ACTIVE_COURSE_WORK_SCHEMA_VERSION
    ) {
      return {
        work: null,
        recovered: false,
        quarantined: false,
        unsupportedSchema: true,
        persisted: true,
        error: null
      };
    }

    if (!isValidActiveCourseWork(value)) {
      return {
        work: null,
        recovered: true,
        quarantined: true,
        unsupportedSchema: false,
        persisted: true,
        error: null
      };
    }

    return {
      work: structuredClone(value),
      recovered: false,
      quarantined: false,
      unsupportedSchema: false,
      persisted: true,
      error: null
    };
  } catch (error) {
    return {
      work: null,
      recovered: false,
      quarantined: false,
      unsupportedSchema: false,
      persisted: false,
      error
    };
  }
}

export async function saveActiveCourseWork(
  work,
  storageArea = chrome.storage.local
) {
  if (!isValidActiveCourseWork(work)) {
    throw new TypeError("저장할 활성 과정 작업 형식이 올바르지 않습니다.");
  }

  const safeWork = structuredClone(work);
  await storageArea.set({
    [ACTIVE_COURSE_WORK_STORAGE_KEY]: safeWork
  });
  return safeWork;
}
