import test from "node:test";
import assert from "node:assert/strict";

import {
  getSupportedSite,
  isSupportedCourseUrl
} from "../shared/site-registry.js";

test("알려진 과정 URL은 정밀 adapter로, 그 밖의 HTTPS 페이지는 generic reader로 연결한다", () => {
  assert.equal(
    getSupportedSite(
      "https://www.kcl.ac.uk/study/postgraduate-taught/courses/nutrition-msc/requirements"
    )?.readerKey,
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
    getSupportedSite(
      "https://www.alliancembs.manchester.ac.uk/study/masters/msc-marketing/entry-requirements/#course-profile"
    )?.readerKey,
    "manchester"
  );

  const knownHostGeneric = getSupportedSite(
    "https://www.alliancembs.manchester.ac.uk/study/masters/masters-entry-requirements/"
  );
  assert.equal(knownHostGeneric?.key, "manchester");
  assert.equal(knownHostGeneric?.readerKey, "generic");
  assert.equal(knownHostGeneric?.generic, true);

  const unknownUniversity = getSupportedSite(
    "https://www.bristol.ac.uk/study/postgraduate/taught/msc-marketing/entry-requirements/"
  );
  assert.equal(unknownUniversity?.key, "bristol-ac-uk");
  assert.equal(unknownUniversity?.readerKey, "generic");
  assert.equal(unknownUniversity?.label, "bristol.ac.uk");
  assert.equal(
    isSupportedCourseUrl(
      "https://www.bristol.ac.uk/study/postgraduate/taught/msc-marketing/"
    ),
    true
  );
  assert.equal(isSupportedCourseUrl("http://example.ac.uk/course"), false);
  assert.equal(isSupportedCourseUrl("chrome://extensions"), false);
});
