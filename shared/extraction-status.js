export const EXTRACTION_STATUS = Object.freeze({
  NOT_ANALYZED: "not_analyzed",
  ANALYZING: "analyzing",
  FOUND: "found",
  ACTION_REQUIRED: "action_required",
  NOT_FOUND: "not_found",
  MULTIPLE_CANDIDATES: "multiple_candidates",
  SOURCE_ERROR: "source_error"
});

export const COPY_STATE = Object.freeze({
  IDLE: "idle",
  COPIED: "copied",
  FAILED: "failed"
});

export const STATUS_META = Object.freeze({
  [EXTRACTION_STATUS.NOT_ANALYZED]: Object.freeze({
    label: "분석 전",
    symbol: "○"
  }),
  [EXTRACTION_STATUS.ANALYZING]: Object.freeze({
    label: "분석 중",
    symbol: "…"
  }),
  [EXTRACTION_STATUS.FOUND]: Object.freeze({
    label: "확인됨",
    symbol: "✓"
  }),
  [EXTRACTION_STATUS.ACTION_REQUIRED]: Object.freeze({
    label: "선택 필요",
    symbol: "!"
  }),
  [EXTRACTION_STATUS.NOT_FOUND]: Object.freeze({
    label: "찾지 못함",
    symbol: "–"
  }),
  [EXTRACTION_STATUS.MULTIPLE_CANDIDATES]: Object.freeze({
    label: "후보 확인 필요",
    symbol: "≋"
  }),
  [EXTRACTION_STATUS.SOURCE_ERROR]: Object.freeze({
    label: "출처 오류",
    symbol: "×"
  })
});

export function isExtractionStatus(value) {
  return Object.values(EXTRACTION_STATUS).includes(value);
}
