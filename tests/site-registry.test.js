import test from "node:test";
import assert from "node:assert/strict";

import {
  getSupportedSite,
  isSupportedCourseUrl
} from "../shared/site-registry.js";

test("KCL·SOAS·QMUL 과정 URL만 해당 어댑터로 연결한다", () => {
  assert.equal(
    getSupportedSite(
      "https://www.kcl.ac.uk/study/postgraduate-taught/courses/nutrition-msc/requirements"
    )?.key,
    "kcl"
  );
  assert.equal(
    getSupportedSite(
      "https://www.soas.ac.uk/study/find-course/msc-global-development"
    )?.key,
    "soas"
  );
  assert.equal(
    getSupportedSite(
      "https://www.qmul.ac.uk/postgraduate/taught/coursefinder/courses/corporate-finance-msc/"
    )?.key,
    "qmul"
  );
  assert.equal(
    isSupportedCourseUrl("https://www.manchester.ac.uk/study/masters/"),
    false
  );
  assert.equal(isSupportedCourseUrl("chrome://extensions"), false);
});
