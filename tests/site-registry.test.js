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
  const ucl = getSupportedSite(
    "https://www.ucl.ac.uk/prospective-students/graduate/taught-degrees/computational-finance-msc"
  );
  assert.equal(ucl?.key, "ucl");
  assert.equal(ucl?.readerKey, "generic");
  assert.equal(ucl?.autoSelectCountry, true);
  assert.equal(ucl?.expandEnglishAccordion, true);
  assert.equal(ucl?.captureVisaRequiredDeadline, true);
  const warwick = getSupportedSite(
    "https://warwick.ac.uk/study/postgraduate/courses/msc-marketing-strategy/"
  );
  assert.equal(warwick?.key, "warwick");
  assert.equal(warwick?.readerKey, "generic");
  assert.equal(warwick?.autoSelectCountry, true);
  assert.equal(
    warwick?.koreanAcademicResultSelector,
    "#international-content"
  );
  const sheffield = getSupportedSite(
    "https://sheffield.ac.uk/postgraduate/taught/courses/2026/real-estate-msc#entry-req"
  );
  assert.equal(sheffield?.key, "sheffield");
  assert.equal(sheffield?.readerKey, "generic");
  assert.equal(sheffield?.universityName, "University of Sheffield");
  assert.match(sheffield?.koreanAcademicRequirementsUrl, /south-korea$/);
  assert.match(sheffield?.applicationDeadlineUrl, /September2026entry$/);
  assert.equal(
    getSupportedSite(
      "https://www.alliancembs.manchester.ac.uk/study/masters/msc-marketing/entry-requirements/#course-profile"
    )?.readerKey,
    "manchester"
  );
  const manchesterMain = getSupportedSite(
    "https://www.manchester.ac.uk/study/masters/courses/list/04342/msc-mechanical-engineering-design/"
  );
  assert.equal(manchesterMain?.key, "manchester");
  assert.equal(manchesterMain?.readerKey, "generic");
  assert.equal(manchesterMain?.generic, false);
  assert.equal(
    manchesterMain?.koreanAcademicDefaultDegreeClass,
    "upper_second"
  );
  assert.equal(manchesterMain?.additionalContentSelector, "div.text");
  assert.match(
    manchesterMain?.koreanAcademicRequirementsUrl,
    /south-korea\/entry-requirements/
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
