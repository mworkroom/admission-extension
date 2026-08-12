export async function readManchesterPage() {
  const normalize = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
  const textOf = (node) => normalize(node?.textContent);
  const headingLevel = (node) =>
    /^H[1-6]$/.test(node?.tagName) ? Number(node.tagName.slice(1)) : null;
  const collectSection = (doc, headingPattern) => {
    const root = doc?.querySelector("main") || doc?.body;
    if (!root) {
      return "";
    }
    const heading = Array.from(
      root.querySelectorAll("h1,h2,h3,h4,h5,h6")
    ).find((node) => headingPattern.test(textOf(node)));
    if (!heading) {
      return "";
    }

    const startLevel = headingLevel(heading);
    const blocks = [];
    let node = heading.nextElementSibling;
    while (node) {
      const level = headingLevel(node);
      if (level !== null && level <= startLevel) {
        break;
      }
      const text = textOf(node);
      if (text) {
        blocks.push(text);
      }
      node = node.nextElementSibling;
    }
    return normalize(blocks.join(" "));
  };
  const fetchDocument = async (url) => {
    if (
      new URL(url).pathname.replace(/\/$/, "") ===
      location.pathname.replace(/\/$/, "")
    ) {
      return document;
    }
    try {
      const response = await fetch(url, { credentials: "same-origin" });
      if (!response.ok) {
        return null;
      }
      const html = await response.text();
      return new DOMParser().parseFromString(html, "text/html");
    } catch {
      return null;
    }
  };
  const amountFrom = (value) =>
    normalize(value).match(/£\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?/)?.[0]
      ?.replace(/\s+/g, "") || "";
  const currentUrl = new URL(location.href);
  const courseMatch = currentUrl.pathname.match(
    /^\/study\/masters\/([^/]+)\/(?:overview|entry-requirements|application-and-selection|course-details|careers)\/?$/
  );
  if (!courseMatch) {
    return null;
  }

  const courseBase =
    `${currentUrl.origin}/study/masters/${courseMatch[1]}`;
  const urls = {
    overview: `${courseBase}/overview/`,
    entry: `${courseBase}/entry-requirements/`,
    application: `${courseBase}/application-and-selection/`,
    generalEntry:
      `${currentUrl.origin}/study/masters/masters-entry-requirements/`,
    international:
      `${currentUrl.origin}/study/masters/masters-entry-requirements/international-entry-requirements/`,
    howToApply:
      `${currentUrl.origin}/study/masters/how-to-apply/`,
    supportingDocuments:
      `${currentUrl.origin}/study/masters/how-to-apply/supporting-documents/`
  };
  const [
    overviewDoc,
    entryDoc,
    applicationDoc,
    generalEntryDoc,
    internationalDoc,
    howToApplyDoc,
    supportingDoc
  ] = await Promise.all([
    fetchDocument(urls.overview),
    fetchDocument(urls.entry),
    fetchDocument(urls.application),
    fetchDocument(urls.generalEntry),
    fetchDocument(urls.international),
    fetchDocument(urls.howToApply),
    fetchDocument(urls.supportingDocuments)
  ]);

  const courseHeading =
    textOf((entryDoc || document).querySelector("main h1")) ||
    textOf(document.querySelector("main h1"));
  const courseName = courseHeading
    .replace(
      /\s*\/\s*(?:Overview|Entry requirements|Application and selection|Course details|Careers).*$/i,
      ""
    )
    .trim();
  const entryRequirements = collectSection(
    entryDoc,
    /^Academic entry qualification overview$/i
  );
  const koreanAcademicRequirements = collectSection(
    internationalDoc,
    /^South Korea$/i
  )
    .replace(
      /You will also need to meet our English Language Requirements.*$/i,
      ""
    )
    .trim();
  const englishMain = textOf(generalEntryDoc?.querySelector("main"));
  const englishRequirement =
    englishMain.match(
      /IELTS\s*(?:>>)?\s*7\.0 overall and no other element below 6\.5/i
    )?.[0]
      ?.replace(/\s*>>\s*/, " ") || "";
  const overviewText = textOf(overviewDoc?.querySelector("main"));
  const applicationText = textOf(applicationDoc?.querySelector("main"));
  const howToApplyText = textOf(howToApplyDoc?.querySelector("main"));
  const yearOfEntry = Number(
    (
      textOf(entryDoc?.querySelector("main")) ||
      overviewText ||
      applicationText
    ).match(/Year of entry:\s*(20\d{2})/i)?.[1]
  );
  const academicCycle = Number.isInteger(yearOfEntry)
    ? `${yearOfEntry}/${String(yearOfEntry + 1).slice(-2)}`
    : "";
  const internationalFeeContext =
    overviewText.match(
      /For entry in the academic year beginning September 20\d{2}.*?International,\s*including EU,\s*students \(per annum\):\s*£\s*[\d,]+/i
    )?.[0] || "";
  const applicationFeeContext =
    applicationText.match(
      /non-refundable application fee of £\s*[\d,]+.*?(?:application fee|paid the application fee)\./i
    )?.[0] || "";
  const deadlineContext =
    howToApplyText.match(
      /final application deadline for the 20\d{2}\/\d{2} academic year is \d{1,2} [A-Za-z]+ 20\d{2}/i
    )?.[0] || "";
  const deadlineValue =
    deadlineContext.match(/\d{1,2} [A-Za-z]+ 20\d{2}/)?.[0] || "";
  const courseSop = collectSection(applicationDoc, /^Advice to applicants$/i);
  const commonSop = collectSection(supportingDoc, /^Statement of purpose$/i);
  const referenceText = collectSection(
    supportingDoc,
    /^Academic references$/i
  );
  const cvText = collectSection(supportingDoc, /^CV$/i);
  const sopText = normalize([courseSop, commonSop].filter(Boolean).join(" "));

  return {
    schemaVersion: 3,
    siteKey: "manchester",
    title: document.title,
    url: location.href,
    universityName: "The University of Manchester",
    courseName,
    entryRequirements,
    entryRequirementsUrl: urls.entry,
    koreanAcademicRequirements,
    koreanAcademicRequirementsUrl: urls.international,
    englishRequirement,
    englishRequirementUrl: urls.generalEntry,
    englishRequirementSourceUrl: urls.generalEntry,
    englishRequirementSourceText: englishRequirement,
    tuitionFeeCandidates: internationalFeeContext
      ? [
          {
            academicCycle,
            intakeMonth: 9,
            intakeYear: yearOfEntry || 0,
            studyMode: "full-time",
            feeStatus: "international",
            value: amountFrom(internationalFeeContext),
            rawText: internationalFeeContext,
            sourceUrl: urls.overview,
            publicationStatus: "published"
          }
        ]
      : [],
    applicationFeeCandidates: applicationFeeContext
      ? [
          {
            value: amountFrom(applicationFeeContext),
            rawText: applicationFeeContext,
            sourceUrl: urls.application
          }
        ]
      : [],
    applicationDeadlines: deadlineValue
      ? [
          {
            academicCycle,
            intakeMonth: 9,
            intakeYear: yearOfEntry || 0,
            feeStatus: "international",
            value: deadlineValue,
            rawText: deadlineContext,
            sourceUrl: urls.howToApply,
            publicationStatus: "published"
          }
        ]
      : [],
    supportingDocuments: {
      reference: referenceText
        ? {
            status: "found",
            value: "Not required at application",
            detail: referenceText,
            rawText: referenceText,
            sourceUrl: urls.supportingDocuments
          }
        : null,
      sopGuideline: sopText
        ? {
            status: "found",
            value: "Required",
            detail: sopText,
            rawText: sopText,
            sourceUrl: urls.application
          }
        : null,
      cv: cvText
        ? {
            status: "found",
            value: "Required with more than two years' postgraduate work experience",
            detail: cvText,
            rawText: cvText,
            sourceUrl: urls.supportingDocuments
          }
        : null
    }
  };
}
