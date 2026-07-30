import { EXTRACTION_STATUS } from "./extraction-status.js";

export const NOT_ANALYZED_STATUS = EXTRACTION_STATUS.NOT_ANALYZED;

const FIELD_DEFINITIONS = [
  ["university", "University"],
  ["course", "Course"],
  ["entryRequirements", "Entry Requirements"],
  ["koreanAcademicRequirements", "Korean Academic Requirements"],
  ["englishRequirements", "English Requirements"],
  ["tuitionFee", "Tuition Fee"],
  ["applicationFee", "Application Fee"],
  ["universityApplicationDeadline", "University Application Deadline"],
  ["reference", "Reference"],
  ["sopGuideline", "SOP Guideline"],
  ["cv", "CV"]
];

export const FIELDS = Object.freeze(
  FIELD_DEFINITIONS.map(([key, label], index) =>
    Object.freeze({
      key,
      label,
      order: index + 1,
      status: NOT_ANALYZED_STATUS
    })
  )
);
