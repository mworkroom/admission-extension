export async function readGenericPage(options = {}) {
  const normalize = (value) =>
    String(value ?? "").replace(/\s+/g, " ").trim();
  const textOf = (node) =>
    normalize(
      typeof node?.innerText === "string" ? node.innerText : node?.textContent
    );
  const root =
    document.querySelector("main, [role='main']") ||
    document.body;
  const sourceUrl = location.href;
  const hostname = location.hostname.toLowerCase().replace(/^www\./, "");
  const slug = (value) =>
    normalize(value)
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const headingLevel = (node) =>
    /^H[1-6]$/.test(node?.tagName) ? Number(node.tagName.slice(1)) : null;
  const limit = (value, max = 1800) => normalize(value).slice(0, max);
  const headings = Array.from(
    root?.querySelectorAll("h1,h2,h3,h4,h5,h6") ?? []
  );
  const contentBlocks = Array.from(
    root?.querySelectorAll("p,li,dd,tr") ?? []
  )
    .map((node) => textOf(node))
    .filter((text) => text.length >= 12 && text.length <= 1600);

  const collectSection = (pattern) => {
    const heading = headings.find((node) => pattern.test(textOf(node)));
    if (!heading) {
      return "";
    }

    const startLevel = headingLevel(heading);
    const blocks = [];
    let node = heading.nextElementSibling;
    while (node && blocks.join(" ").length < 1800) {
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
    if (blocks.length > 0) {
      return limit(blocks.join(" "));
    }

    const container = heading.closest(
      "section,article,details,[class*='accordion'],[class*='toggle']"
    );
    const containerText = textOf(container);
    return containerText
      ? limit(containerText.replace(textOf(heading), "").trim())
      : "";
  };

  const findBlocks = (pattern, requiredPattern = null, max = 4) => {
    const matches = [];
    for (const text of contentBlocks) {
      if (
        pattern.test(text) &&
        (!requiredPattern || requiredPattern.test(text)) &&
        !matches.includes(text)
      ) {
        matches.push(text);
      }
      if (matches.length >= max) {
        break;
      }
    }
    return matches;
  };

  const findJsonLdOrganization = () => {
    const candidates = [];
    const visit = (value) => {
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      if (!value || typeof value !== "object") {
        return;
      }
      const types = Array.isArray(value["@type"])
        ? value["@type"]
        : [value["@type"]];
      if (
        types.some((type) =>
          /^(?:CollegeOrUniversity|EducationalOrganization|Organization)$/i.test(
            String(type ?? "")
          )
        ) &&
        normalize(value.name)
      ) {
        candidates.push(normalize(value.name));
      }
      if (value["@graph"]) {
        visit(value["@graph"]);
      }
    };

    for (const script of document.querySelectorAll(
      "script[type='application/ld+json']"
    )) {
      try {
        visit(JSON.parse(script.textContent));
      } catch {
        // Ignore malformed third-party metadata and continue with visible DOM.
      }
    }
    return candidates[0] || "";
  };

  const metaContent = (selector) =>
    normalize(document.querySelector(selector)?.getAttribute("content"));
  const titleOrganization =
    normalize(document.title)
      .split("|")
      .map(normalize)
      .find((part) => /\b(?:University|College|School)\b/i.test(part)) || "";
  const universityName =
    normalize(options.universityName) ||
    metaContent("meta[property='og:site_name']") ||
    findJsonLdOrganization() ||
    titleOrganization ||
    hostname;
  let pathCourseName = "";
  try {
    pathCourseName = decodeURIComponent(
      location.pathname.split("/").filter(Boolean).at(-1) || ""
    );
  } catch {
    pathCourseName =
      location.pathname.split("/").filter(Boolean).at(-1) || "";
  }
  const courseName =
    textOf(root?.querySelector("h1")) ||
    metaContent("meta[property='og:title']") ||
    normalize(document.title) ||
    pathCourseName ||
    hostname;
  const siteKey =
    slug(options.siteKey) ||
    slug(hostname) ||
    "generic-site";

  const entryRequirements = collectSection(
    /^(?:academic\s+)?(?:entry|admission|admissions)\s+(?:requirements?|criteria|qualifications?)(?:\s+overview)?$/i
  );
  const koreanAcademicRequirements = collectSection(
    /^(?:South Korea|Republic of Korea|Korea,\s*South)$/i
  );
  const englishRequirement =
    findBlocks(
      /\bIELTS\b/i,
      /\b(?:overall|minimum|score|band|component|element)\b.*\d|\d.*\b(?:overall|minimum|score|band|component|element)\b/i,
      1
    )[0] || "";
  const englishRequirementUrl =
    Array.from(root?.querySelectorAll("a[href]") ?? []).find((link) =>
      /\bEnglish language requirements?\b/i.test(textOf(link))
    )?.href || "";

  const amountPattern = /(?:£\s*|GBP\s*)\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?/i;
  const amountNearInternational = (text) =>
    text.match(
      /(?:international|overseas|non[- ]?uk)[^£]{0,160}((?:£\s*|GBP\s*)\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/i
    )?.[1] ||
    text.match(
      /((?:£\s*|GBP\s*)\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)[^£]{0,160}(?:international|overseas|non[- ]?uk)/i
    )?.[1] ||
    "";
  const academicCycleFrom = (text) => {
    const direct = text.match(/\b(20\d{2})\s*\/\s*(\d{2,4})\b/);
    if (direct) {
      return `${direct[1]}/${direct[2].slice(-2)}`;
    }
    const year = Number(
      text.match(
        /(?:academic year|year of entry|entry in)[^\d]{0,40}(20\d{2})/i
      )?.[1]
    );
    return Number.isInteger(year)
      ? `${year}/${String(year + 1).slice(-2)}`
      : "";
  };
  const intakeFrom = (text) => {
    const months = {
      january: 1,
      february: 2,
      march: 3,
      april: 4,
      may: 5,
      june: 6,
      july: 7,
      august: 8,
      september: 9,
      october: 10,
      november: 11,
      december: 12
    };
    const match = text.match(
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i
    );
    return match
      ? {
          intakeMonth: months[match[1].toLowerCase()],
          intakeYear: Number(match[2])
        }
      : { intakeMonth: 0, intakeYear: 0 };
  };

  const feeSection = collectSection(/^Fees?(?:\s+and\s+funding)?$/i);
  const tuitionSourceBlocks = [
    ...findBlocks(
      /(?:tuition|course)\s+fees?|fees?\s+(?:for|per)/i,
      /(?:international|overseas|non[- ]?uk)/i,
      5
    ),
    ...(feeSection &&
    /(?:international|overseas|non[- ]?uk)/i.test(feeSection)
      ? [feeSection]
      : [])
  ].filter((text, index, all) => all.indexOf(text) === index);
  const tuitionFeeCandidates = tuitionSourceBlocks
    .map((rawText) => {
      const value = amountNearInternational(rawText);
      const intake = intakeFrom(rawText);
      return value
        ? {
            academicCycle: academicCycleFrom(rawText),
            intakeMonth: intake.intakeMonth,
            intakeYear: intake.intakeYear,
            studyMode: /\bfull[- ]?time\b/i.test(rawText)
              ? "full-time"
              : "",
            feeStatus: "international",
            value,
            rawText: limit(rawText, 900),
            sourceUrl,
            publicationStatus: "published"
          }
        : null;
    })
    .filter(Boolean)
    .filter(
      (candidate, index, all) =>
        all.findIndex(
          (item) =>
            item.value === candidate.value &&
            item.rawText === candidate.rawText
        ) === index
    );

  const applicationFeeCandidates = findBlocks(
    /\bapplication\s+fee\b/i,
    amountPattern,
    3
  ).map((rawText) => ({
    value: rawText.match(amountPattern)?.[0] || "",
    rawText: limit(rawText, 900),
    sourceUrl
  }));

  const datePattern =
    /\b(?:\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?)\s+20\d{2}\b/i;
  const basis = options.basis || {};
  const applicationDeadlines = findBlocks(
    /\b(?:deadline|closing date|applications? close)\b/i,
    datePattern,
    5
  )
    .map((rawText) => {
      const value = rawText.match(datePattern)?.[0] || "";
      const intake = intakeFrom(rawText);
      const academicCycle = academicCycleFrom(rawText);
      const matchesSelectedCycle =
        academicCycle &&
        academicCycle === normalize(basis.academicCycle);
      return value && (intake.intakeMonth || matchesSelectedCycle)
        ? {
            academicCycle,
            intakeMonth:
              intake.intakeMonth || Number(basis.intakeMonth) || 0,
            intakeYear:
              intake.intakeYear || Number(basis.intakeYear) || 0,
            feeStatus: normalize(basis.feeStatus) || "international",
            value,
            rawText: limit(rawText, 900),
            sourceUrl,
            publicationStatus: "published"
          }
        : null;
    })
    .filter(Boolean);

  const documentItem = (pattern, fallbackPattern = null) => {
    const rawText =
      collectSection(pattern) ||
      (fallbackPattern
        ? findBlocks(
            fallbackPattern,
            /\b(?:required|need|include|submit|upload|optional|not required)\b/i,
            1
          )[0] || ""
        : "");
    return rawText
      ? {
          status: "found",
          value: limit(rawText, 1000),
          detail: "",
          rawText: limit(rawText, 1000),
          sourceUrl
        }
      : null;
  };

  return {
    schemaVersion: 3,
    siteKey,
    title: document.title,
    url: sourceUrl,
    universityName,
    courseName,
    entryRequirements,
    koreanAcademicRequirements,
    englishRequirement,
    englishRequirementUrl,
    tuitionFeeCandidates,
    applicationFeeCandidates,
    applicationDeadlines,
    supportingDocuments: {
      reference: documentItem(
        /^(?:academic\s+)?references?(?:\s+and\s+referees?)?$|^referees?$/i,
        /\b(?:academic\s+)?references?|referees?\b/i
      ),
      sopGuideline: documentItem(
        /^(?:statement of purpose|personal statement|supporting statement)$/i,
        /\b(?:statement of purpose|personal statement|supporting statement)\b/i
      ),
      cv: documentItem(
        /^(?:CV|curriculum vitae|résumé|resume)$/i,
        /\b(?:CV|curriculum vitae|résumé|resume)\b/i
      )
    }
  };
}
