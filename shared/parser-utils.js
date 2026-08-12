import { COPY_STATE, EXTRACTION_STATUS } from "./extraction-status.js";
import { FIELDS } from "./fields.js";

export function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function sourceFor(snapshot, sectionLabel, excerpt, url = "") {
  if (!snapshot) {
    return null;
  }

  return {
    url: url || snapshot.url,
    pageTitle: snapshot.title,
    sectionLabel,
    excerpt: normalizeText(excerpt).slice(0, 700)
  };
}

export function makeResult(field, status, options = {}) {
  const value = normalizeText(options.value);
  const detail = normalizeText(options.detail);
  const copyText = Object.prototype.hasOwnProperty.call(options, "copyText")
    ? normalizeText(options.copyText)
    : value;

  return {
    key: field.key,
    label: field.label,
    order: field.order,
    status,
    reasonCode: normalizeText(options.reasonCode),
    value,
    detail,
    nextAction: normalizeText(options.nextAction),
    source: options.source ?? null,
    detailUrl: normalizeText(options.detailUrl),
    copyText,
    copyState: COPY_STATE.IDLE
  };
}

export function extractAmount(text) {
  const normalized = normalizeText(text);
  const currencyAmount = normalized.match(
    /(?:£\s*|GBP\s*)\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?/i
  );
  if (currencyAmount) {
    return currencyAmount[0]
      .replace(/^£\s*/, "£")
      .replace(/^GBP\s*/i, "GBP ");
  }

  const numericCandidates = normalized.match(/\b\d[\d,]*(?:\.\d+)?\b/g) ?? [];
  return (
    numericCandidates.find((candidate) => {
      const number = Number(candidate.replace(/,/g, ""));
      return (
        Number.isFinite(number) &&
        !(number >= 1900 && number <= 2100) &&
        !normalized.includes(`${candidate}/`)
      );
    }) ?? ""
  );
}

export function summarizeResults(fields) {
  return fields.reduce(
    (summary, field) => {
      summary.total += 1;
      summary[field.status] = (summary[field.status] ?? 0) + 1;
      return summary;
    },
    { total: 0 }
  );
}

export function getFieldsByKey() {
  return new Map(FIELDS.map((field) => [field.key, field]));
}

export function createAnalysis(snapshot, basis, fields, now = new Date()) {
  return {
    schemaVersion: 3,
    siteKey: snapshot.siteKey,
    analyzedAt: now.toISOString(),
    stale: false,
    basis: {
      academicCycle: basis.academicCycle,
      intakeMonth: basis.intakeMonth,
      intakeYear: basis.intakeYear,
      studyMode: basis.studyMode,
      feeStatus: basis.feeStatus
    },
    page: {
      title: snapshot.title ?? "",
      url: snapshot.url ?? ""
    },
    fields,
    summary: summarizeResults(fields)
  };
}

export { EXTRACTION_STATUS };
