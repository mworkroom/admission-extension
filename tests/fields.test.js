import test from "node:test";
import assert from "node:assert/strict";

import { FIELDS, NOT_ANALYZED_STATUS } from "../shared/fields.js";

test("11개 항목의 키, 이름, 순서, 초기 상태가 고정되어 있다", () => {
  assert.equal(FIELDS.length, 11);
  assert.deepEqual(
    FIELDS.map(({ key, label, order, status }) => ({
      key,
      label,
      order,
      status
    })),
    [
      { key: "university", label: "University", order: 1, status: NOT_ANALYZED_STATUS },
      { key: "course", label: "Course", order: 2, status: NOT_ANALYZED_STATUS },
      {
        key: "entryRequirements",
        label: "Entry Requirements",
        order: 3,
        status: NOT_ANALYZED_STATUS
      },
      {
        key: "koreanAcademicRequirements",
        label: "Korean Academic Requirements",
        order: 4,
        status: NOT_ANALYZED_STATUS
      },
      {
        key: "englishRequirements",
        label: "English Requirements",
        order: 5,
        status: NOT_ANALYZED_STATUS
      },
      { key: "tuitionFee", label: "Tuition Fee", order: 6, status: NOT_ANALYZED_STATUS },
      {
        key: "applicationFee",
        label: "Application Fee",
        order: 7,
        status: NOT_ANALYZED_STATUS
      },
      {
        key: "universityApplicationDeadline",
        label: "University Application Deadline",
        order: 8,
        status: NOT_ANALYZED_STATUS
      },
      { key: "reference", label: "Reference", order: 9, status: NOT_ANALYZED_STATUS },
      {
        key: "sopGuideline",
        label: "SOP Guideline",
        order: 10,
        status: NOT_ANALYZED_STATUS
      },
      { key: "cv", label: "CV", order: 11, status: NOT_ANALYZED_STATUS }
    ]
  );
});
