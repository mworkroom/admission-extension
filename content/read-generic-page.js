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
  if (options.expandEnglishAccordion) {
    const englishButton = Array.from(root?.querySelectorAll("button") ?? []).find(
      (button) => /English language requirements?/i.test(textOf(button))
    );
    if (englishButton && typeof englishButton.click === "function") {
      englishButton.click();
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  const slug = (value) =>
    normalize(value)
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const headingLevel = (node) =>
    /^H[1-6]$/.test(node?.tagName) ? Number(node.tagName.slice(1)) : null;
  const limit = (value, max = 1800) => normalize(value).slice(0, max);
  const getHeadings = () =>
    Array.from(root?.querySelectorAll("h1,h2,h3,h4,h5,h6") ?? []);
  const baseContentNodes = [
    ...Array.from(root?.querySelectorAll("p,li,dd,tr") ?? []),
    ...Array.from(root?.querySelectorAll("[role='alert']") ?? [])
  ].filter((node, index, all) => all.indexOf(node) === index);
  let additionalContentNodes = [];
  if (normalize(options.additionalContentSelector)) {
    try {
      additionalContentNodes = Array.from(
        root?.querySelectorAll(options.additionalContentSelector) ?? []
      );
    } catch {
      // Ignore an invalid site-specific selector and keep the generic reader usable.
    }
  }
  const contentBlocks = [
    ...baseContentNodes
      .map((node) => textOf(node))
      .filter((text) => text.length >= 12 && text.length <= 1600),
    ...additionalContentNodes
      .map((node) => textOf(node))
      .filter((text) => text.length >= 12 && text.length <= 4000)
  ]
    .filter((text, index, all) => all.indexOf(text) === index);

  const academicHeadingPattern =
    /^(?:qualifications?|academic(?:\s+entry)?\s+(?:requirements?|qualification(?:\s+overview)?)|standard\s+requirements|programme\s+specific\s+requirements|minimum(?:\s+entry)?\s+requirements?|entry\s+criteria|admission\s+criteria|entry\s+requirements\s+for\s+united\s+kingdom)$/i;
  const academicStopPattern =
    /\b(?:supporting\s+your\s+application|english\s+language(?:\s+requirements?|\s+level)?|equivalent\s+qualifications|international\s+qualifications|other\s+requirements|pathway\s+programme|about\s+this\s+degree|fees(?:\s+and\s+funding)?|tuition\s+fees|application\s+(?:process|and\s+selection)|how\s+to\s+apply|next\s+steps)\b/i;
  const trimAcademicText = (value) => {
    const text = normalize(value);
    const boundary = text.search(academicStopPattern);
    if (boundary === -1) return text;
    const prefix = text.slice(0, boundary).trim();
    return /^(?:we\s+also\s+consider\s+a\s+wide\s+range\s+of|find|view|see)$/i.test(
      prefix
    )
      ? ""
      : prefix;
  };

  const collectAcademicBlocks = (container) => {
    const academicHeadings = Array.from(
      container?.querySelectorAll("h3,h4,h5,h6") ?? []
    ).filter((node) => academicHeadingPattern.test(textOf(node)));
    if (academicHeadings.length === 0) {
      return "";
    }

    const qualificationHeading = academicHeadings.find((node) =>
      /^qualifications?$/i.test(textOf(node))
    );
    const selectedHeadings = qualificationHeading
      ? [qualificationHeading]
      : academicHeadings.slice(0, 2);

    return selectedHeadings
      .map((heading) => {
        const card = heading.closest(
          "div.card, section, article, [role='group']"
        );
        const cardText = textOf(card);
        if (cardText) {
          return trimAcademicText(cardText.replace(textOf(heading), "").trim());
        }

        const blocks = [];
        let node = heading.nextElementSibling;
        const startLevel = headingLevel(heading);
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
        return trimAcademicText(blocks.join(" "));
      })
      .map(normalize)
      .filter(Boolean)
      .filter((text, index, all) => all.indexOf(text) === index)
      .join(" ");
  };

  const collectSection = (pattern, options = {}) => {
    const heading = getHeadings().find((node) => pattern.test(textOf(node)));
    if (!heading) {
      return "";
    }

    if (options.preferAcademicBlocks) {
      const academicText = collectAcademicBlocks(heading.nextElementSibling);
      if (academicText) {
        return limit(academicText);
      }
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
      if (
        /^we\s+also\s+consider\s+a\s+wide\s+range\s+of\s+international\s+qualifications?\b/i.test(
          text
        )
      ) {
        break;
      }
      const academicText = trimAcademicText(text);
      if (academicText) {
        blocks.push(academicText);
      }
      if (academicText !== text) {
        break;
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

  const entryHeadingPattern =
    /^(?:(?:academic|general)\s+)?(?:entry|admission|admissions)\s+(?:requirements?|criteria|qualifications?)(?:\s+overview)?$/i;
  const entryBlockStopPattern =
    /^(?:english\s+language|english\s+presessional|international\s+(?:entry\s+requirements|qualifications)|entry\s+requirements\s+for\s+international\s+students|admissions\s+statement|how\s+to\s+apply|fees?(?:\s+and\s+funding)?|supporting\s+documents?|please\s+also\s+see\s+our\s+guidance\s+on\s+essential\s+documentation)\b/i;
  const entryInlineStopPattern =
    /\b(?:English\s+language\s+requirements?|International\s+entry\s+requirements|Entry\s+requirements\s+for\s+international\s+students|Admissions\s+Statement|Please\s+also\s+see\s+our\s+guidance\s+on\s+essential\s+documentation|required\s+for\s+an\s+initial\s+decision|If\s+you\s+have\s+at\s+least\s+one\s+of\s+the\s+following,?\s+please\s+include\s+your\s+CV)\b/i;

  const nodeContains = (container, target) => {
    if (!container || !target) return false;
    if (container === target) return true;
    if (typeof container.contains === "function") {
      return container.contains(target);
    }
    return Array.from(container.children ?? []).some((child) =>
      nodeContains(child, target)
    );
  };

  const textWithoutControls = (node) => {
    let text = textOf(node);
    for (const control of Array.from(
      node?.querySelectorAll?.("select") ?? []
    )) {
      const controlText = textOf(control);
      if (controlText && text.includes(controlText)) {
        text = normalize(text.replace(controlText, " "));
      }
    }
    return text;
  };

  const findEntryContainer = (heading) => {
    let sectionFallback = null;
    let node = heading?.parentElement;
    while (node && node !== root) {
      const identity = normalize(
        (node.id || "") +
          " " +
          (typeof node.className === "string" ? node.className : "")
      );
      const textLength = textOf(node).length;
      if (/entry/i.test(identity) && textLength >= 80 && textLength <= 8000) {
        return node;
      }
      if (
        !sectionFallback &&
        /^(?:SECTION|ARTICLE)$/.test(node.tagName) &&
        textLength >= 80 &&
        textLength <= 8000
      ) {
        sectionFallback = node;
      }
      node = node.parentElement;
    }
    return sectionFallback;
  };

  const trimEntryBlock = (value) => {
    const text = normalize(value);
    const boundary = text.search(entryInlineStopPattern);
    return boundary === -1 ? text : text.slice(0, boundary).trim();
  };

  const collectEntryContainerCandidate = (heading) => {
    const container = findEntryContainer(heading);
    if (!container) return "";

    let scope = container;
    let headingHolder = null;
    for (let depth = 0; scope && depth < 6; depth += 1) {
      const children = Array.from(scope.children ?? []);
      headingHolder = children.find((child) => nodeContains(child, heading));
      const holderIndex = children.indexOf(headingHolder);
      if (
        holderIndex >= 0 &&
        children.slice(holderIndex + 1).some((child) => textOf(child))
      ) {
        break;
      }
      if (!headingHolder || headingHolder === heading) {
        break;
      }
      scope = headingHolder;
    }

    const children = Array.from(scope?.children ?? []);
    const holderIndex = children.indexOf(headingHolder);
    if (holderIndex === -1) return "";

    const blocks = [];
    for (const node of children.slice(holderIndex + 1)) {
      const text = textWithoutControls(node);
      if (!text) continue;
      if (entryBlockStopPattern.test(text)) break;
      const trimmed = trimEntryBlock(text);
      if (trimmed) blocks.push(trimmed);
      if (trimmed !== text || blocks.join(" ").length >= 1800) break;
    }
    return limit(blocks.join(" "));
  };

  const scoreEntryCandidate = (value) => {
    const text = normalize(value);
    if (!text) return -100;

    let score = 0;
    if (
      /\b(?:2\s*:\s*[12]|first[- ]class|second[- ]class|honours?\s+degree|bachelor(?:'s)?\s+degree|undergraduate\s+degree|postgraduate\s+diploma|degree\s+with\s+honours)\b/i.test(
        text
      )
    ) {
      score += 12;
    }
    if (/\b(?:equivalent|entry\s+requirement|academic)\b/i.test(text)) {
      score += 3;
    }

    const negativePatterns = [
      /English\s+language/i,
      /Admissions\s+Statement/i,
      /How\s+to\s+apply/i,
      /\bCV\b|curriculum\s+vitae/i,
      /Fees?\s+and\s+funding/i,
      /supporting\s+documents?/i,
      /students\s+who\s+have\s+studied\s+in\s+China/i,
      /essential\s+documentation\s+required/i
    ];
    score -= negativePatterns.filter((pattern) => pattern.test(text)).length * 6;

    const countryHits =
      text.match(
        /\b(?:Afghanistan|Albania|Australia|Bangladesh|Canada|China|France|Germany|India|Japan|South\s+Korea|Spain|Vietnam|Zimbabwe)\b/gi
      )?.length || 0;
    if (countryHits >= 6) score -= 30;
    score -= Math.max(0, text.length - 900) / 150;
    return score;
  };

  const collectEntryRequirements = () => {
    const heading = getHeadings().find((node) =>
      entryHeadingPattern.test(textOf(node))
    );
    if (!heading) return "";

    const candidates = [
      collectSection(entryHeadingPattern, { preferAcademicBlocks: true }),
      collectEntryContainerCandidate(heading)
    ]
      .map(normalize)
      .filter(Boolean)
      .filter((text, index, all) => all.indexOf(text) === index);

    return (
      candidates
        .map((text, index) => ({
          text,
          index,
          score: scoreEntryCandidate(text)
        }))
        .sort((left, right) => right.score - left.score || left.index - right.index)
        .at(0)?.text || ""
    );
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
  const courseCode =
    textOf(root).match(
      /\bcourse\s+code\s*:?\s*([A-Z0-9]+(?:-[A-Z0-9]+)+)\b/i
    )?.[1] || "";
  const siteKey =
    slug(options.siteKey) ||
    slug(hostname) ||
    "generic-site";

  const amountPattern =
    /(?:£\s*|GBP\s*)(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?/i;
  const amountGlobalPattern =
    /(?:£\s*|GBP\s*)(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?/gi;
  const academicCycleFrom = (text) => {
    const direct = text.match(/\b(20\d{2})\s*[/-]\s*(\d{1,4})\b/);
    if (direct) {
      const startYear = Number(direct[1]);
      const suffix = direct[2];
      return `${direct[1]}/${
        suffix.length === 1 ? String(startYear + 1).slice(-2) : suffix.slice(-2)
      }`;
    }
    const year = Number(
      text.match(
        /(?:academic year|year of entry|entry in)[^\d]{0,40}(20\d{2})/i
      )?.[1]
    );
    if (Number.isInteger(year)) {
      return `${year}/${String(year + 1).slice(-2)}`;
    }
    const monthYear = text.match(
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i
    );
    if (
      monthYear &&
      /\b(?:entry|start(?:ing|s)?|intake|fees?|academic\s+year)\b/i.test(text)
    ) {
      const monthNumber = [
        "january",
        "february",
        "march",
        "april",
        "may",
        "june",
        "july",
        "august",
        "september",
        "october",
        "november",
        "december"
      ].indexOf(monthYear[1].toLowerCase()) + 1;
      const intakeYear = Number(monthYear[2]);
      const startYear = monthNumber >= 9 ? intakeYear : intakeYear - 1;
      return `${startYear}/${String(startYear + 1).slice(-2)}`;
    }
    return "";
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

  const academicCyclesFrom = (text) => {
    const cycles = [];
    for (const match of text.matchAll(/\b(20\d{2})\s*[/-]\s*(\d{1,4})\b/g)) {
      const startYear = Number(match[1]);
      const suffix = match[2];
      const cycle = `${match[1]}/${
        suffix.length === 1 ? String(startYear + 1).slice(-2) : suffix.slice(-2)
      }`;
      if (!cycles.includes(cycle)) cycles.push(cycle);
    }
    if (/\b(?:entry|start(?:ing|s)?|intake|fees?|academic\s+year)\b/i.test(text)) {
      const monthNumbers = {
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
      for (const match of text.matchAll(
        /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/gi
      )) {
        const intakeYear = Number(match[2]);
        const startYear = monthNumbers[match[1].toLowerCase()] >= 9
          ? intakeYear
          : intakeYear - 1;
        const cycle = `${startYear}/${String(startYear + 1).slice(-2)}`;
        if (!cycles.includes(cycle)) cycles.push(cycle);
      }
    }
    const inferred = academicCycleFrom(text);
    if (inferred && !cycles.includes(inferred)) cycles.push(inferred);
    return cycles;
  };
  const pageAcademicCycleSources = [
    normalize(document.title),
    ...getHeadings().map(textOf),
    ...contentBlocks.filter((text) =>
      /\b(?:academic\s+(?:year|session)|year\s+of\s+entry|entry|start(?:ing)?|intake|fees?\s+for)\b/i.test(
        text
      )
    )
  ];
  try {
    const pageUrl = new URL(sourceUrl);
    const queryYear = Number(pageUrl.searchParams.get("year"));
    if (Number.isInteger(queryYear) && queryYear >= 2000) {
      pageAcademicCycleSources.push(`${queryYear}/${String(queryYear + 1).slice(-2)}`);
    }
    const pathYear = Number(pageUrl.pathname.match(/\/(20\d{2})(?:\/|$)/)?.[1]);
    if (Number.isInteger(pathYear)) {
      pageAcademicCycleSources.push(`${pathYear}/${String(pathYear + 1).slice(-2)}`);
    }
  } catch {
    // The page URL was already supplied by Chrome; keep extraction usable if malformed.
  }
  const pageAcademicCycles = pageAcademicCycleSources
    .flatMap(academicCyclesFrom)
    .filter((cycle, index, all) => all.indexOf(cycle) === index);
  const singlePageAcademicCycle =
    pageAcademicCycles.length === 1 ? pageAcademicCycles[0] : "";

  const moneyCategoryPatterns = [
    {
      category: "application_fee",
      pattern: /\bapplication\s+(?:processing\s+|assessment\s+)?fees?\b/gi,
      priority: 5
    },
    {
      category: "deposit",
      pattern: /\b(?:tuition\s+fee\s+)?deposits?\b|\bCAS\b/gi,
      priority: 4
    },
    {
      category: "scholarship",
      pattern: /\b(?:scholarships?|bursar(?:y|ies)|awards?|grants?|discounts?|funding|student\s+support)\b/gi,
      priority: 3
    },
    {
      category: "other",
      pattern: /\b(?:living\s+costs?|cost\s+of\s+living|accommodation|equipment|travel|oyster|salar(?:y|ies)|earnings?|investment|facilities|additional\s+(?:programme\s+)?costs?|programme\s+costs?)\b/gi,
      priority: 2
    },
    {
      category: "tuition",
      pattern: /\b(?:tuition|course|programme)\s+fees?\b|\b(?:UK|home|international|overseas|EU)\s+fees?\b|\bfees?\s+(?:per\s+year|for\s+(?:20\d{2}|September|January))|\bannual\s+tuition\s+fee\b/gi,
      priority: 1
    }
  ];
  const keywordCategoryForAmount = (text, start, end, fallbackCategory = "") => {
    const matches = [];
    for (const definition of moneyCategoryPatterns) {
      definition.pattern.lastIndex = 0;
      for (const match of text.matchAll(definition.pattern)) {
        const matchEnd = match.index + match[0].length;
        const distance = matchEnd <= start
          ? start - matchEnd
          : match.index >= end
            ? match.index - end + 24
            : 0;
        if (distance <= 220) {
          matches.push({
            category: definition.category,
            distance,
            priority: definition.priority
          });
        }
      }
    }
    return matches.sort(
      (left, right) =>
        left.distance - right.distance || right.priority - left.priority
    )[0]?.category || fallbackCategory || "other";
  };
  const nearestFeeStatus = (text, start, end) => {
    const statuses = [];
    const statusPattern =
      /\b(?:international|overseas|non[- ]?uk|EU|home|UK|Ireland|Scotland|rest\s+of\s+UK|South\s+Korea)\b/gi;
    for (const match of text.matchAll(statusPattern)) {
      const matchEnd = match.index + match[0].length;
      const distance = matchEnd <= start
        ? start - matchEnd
        : match.index >= end
          ? match.index - end + 18
          : 0;
      if (distance > 160) continue;
      const label = match[0];
      statuses.push({
        value: /international|overseas|non[- ]?uk|\bEU\b|South\s+Korea/i.test(label)
          ? "international"
          : "home",
        distance
      });
    }
    return statuses.sort((left, right) => left.distance - right.distance)[0]
      ?.value || "";
  };
  const nearestAcademicCycle = (text, amountIndex) => {
    const matches = [];
    for (const match of text.matchAll(/\b(20\d{2})\s*[/-]\s*(\d{1,4})\b/g)) {
      const startYear = Number(match[1]);
      const suffix = match[2];
      matches.push({
        cycle: `${match[1]}/${
          suffix.length === 1 ? String(startYear + 1).slice(-2) : suffix.slice(-2)
        }`,
        distance: Math.abs(amountIndex - match.index)
      });
    }
    return matches.sort((left, right) => left.distance - right.distance)[0]
      ?.cycle || academicCycleFrom(text) || singlePageAcademicCycle;
  };
  const classifyMoneyAmounts = (
    rawText,
    candidateSourceUrl = sourceUrl,
    fallbackCategory = "",
    sourceRank = 20
  ) => {
    const text = normalize(rawText);
    const candidates = [];
    amountGlobalPattern.lastIndex = 0;
    for (const match of text.matchAll(amountGlobalPattern)) {
      const start = match.index;
      const end = start + match[0].length;
      const category = keywordCategoryForAmount(
        text,
        start,
        end,
        fallbackCategory
      );
      let feeStatus = nearestFeeStatus(text, start, end);
      if (!feeStatus && category === "tuition") {
        feeStatus = normalize(options.basis?.feeStatus) || "international";
      }
      const intake = intakeFrom(text);
      candidates.push({
        category,
        value: match[0],
        academicCycle: nearestAcademicCycle(text, start),
        intakeMonth: intake.intakeMonth,
        intakeYear: intake.intakeYear,
        studyMode: /\bpart[- ]?time\b/i.test(text)
          ? "part-time"
          : /\bfull[- ]?time\b/i.test(text)
            ? "full-time"
            : "",
        feeStatus,
        rawText: limit(text, 900),
        sourceUrl: candidateSourceUrl,
        publicationStatus: "published",
        sourceRank
      });
    }
    return candidates;
  };

  const tuitionLinkPattern =
    /\b(?:tuition|course|programme)\s+fees?\b|\bfees?\s+by\b/i;
  const tuitionFeeLinks = Array.from(root?.querySelectorAll("a[href]") ?? [])
    .map((link) => {
      try {
        const url = new URL(link.href, sourceUrl);
        return {
          label: normalize(link.textContent || link.innerText),
          url: url.href
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter((link) => {
      try {
        return (
          new URL(link.url).origin === new URL(sourceUrl).origin &&
          link.url !== sourceUrl &&
          (tuitionLinkPattern.test(link.label) ||
            /(?:tuition|programme[-_ ]?fees?)/i.test(link.url))
        );
      } catch {
        return false;
      }
    })
    .filter(
      (link, index, all) =>
        all.findIndex((candidate) => candidate.url === link.url) === index
    )
    .slice(0, 3);

  const relatedPageLinks = Array.from(root?.querySelectorAll("a[href]") ?? [])
    .map((link) => {
      try {
        const url = new URL(link.href, sourceUrl);
        return {
          label: normalize(link.textContent || link.innerText),
          url: url.href
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter((link) => {
      try {
        return (
          new URL(link.url).origin === new URL(sourceUrl).origin &&
          link.url !== sourceUrl
        );
      } catch {
        return false;
      }
    })
    .filter(
      (link, index, all) =>
        all.findIndex((candidate) => candidate.url === link.url) === index
    );
  const findRelatedLink = (pattern) =>
    relatedPageLinks.find((link) => pattern.test(`${link.label} ${link.url}`)) ||
    null;
  const configuredLink = (url, label) => {
    const configuredUrl = normalize(url);
    if (!configuredUrl) return null;
    try {
      const resolved = new URL(configuredUrl, sourceUrl);
      return resolved.origin === new URL(sourceUrl).origin
        ? { label, url: resolved.href }
        : null;
    } catch {
      return null;
    }
  };
  const koreanAcademicRequirementsLink =
    configuredLink(
      options.koreanAcademicRequirementsUrl,
      "South Korea qualifications"
    ) ||
    findRelatedLink(
      /international\s+(?:entry\s+)?requirements?|international\s+qualifications?|equivalent\s+qualifications?/i
    );
  const applicationFeeLink =
    configuredLink(options.applicationFeeUrl, "Application fee") ||
    findRelatedLink(
      /application\s+fee|application\s+process|how\s+to\s+apply|next\s+steps/i
    );
  const applicationDeadlineLink =
    configuredLink(options.applicationDeadlineUrl, "Application deadline") ||
    findRelatedLink(
      /application\s+(?:deadline|dates?|process)|how\s+to\s+apply|next\s+steps/i
    );
  const configuredCvLink = configuredLink(
    options.cvGuidelineUrl,
    "Curriculum vitae (CV)/resume"
  );
  const supportingDocumentLinks = {
    reference: findRelatedLink(
      /references?|referees?|application\s+process|how\s+to\s+apply|next\s+steps/i
    ),
    sopGuideline: findRelatedLink(
      /statement\s+of\s+purpose|personal\s+statement|supporting\s+statement|application\s+process|how\s+to\s+apply|next\s+steps/i
    ),
    cv:
      configuredCvLink ||
      findRelatedLink(
        /\bcv\b|curriculum\s+vitae|application\s+(?:process|guidance)|how\s+to\s+apply|next\s+steps|\/prospective-students\/graduate\/apply\b/i
      )
  };
  const linkedDocumentCache = new Map();
  const readLinkedDocument = async (link) => {
    if (!link?.url) return null;
    const cacheKey = link.url.split("#")[0];
    if (linkedDocumentCache.has(cacheKey)) {
      return linkedDocumentCache.get(cacheKey);
    }

    const pending = (async () => {
      let timeoutId;
      try {
        const response = await Promise.race([
          fetch(cacheKey, { credentials: "same-origin" }),
          new Promise((_, reject) => {
            timeoutId = setTimeout(
              () => reject(new Error("linked_page_timeout")),
              5000
            );
          })
        ]);
        if (!response.ok) return null;
        const parsed = new DOMParser().parseFromString(
          await response.text(),
          "text/html"
        );
        return {
          root:
            parsed.querySelector?.("main, [role='main']") ||
            parsed.body ||
            null,
          sourceUrl: link.url
        };
      } catch {
        return null;
      } finally {
        clearTimeout(timeoutId);
      }
    })();
    linkedDocumentCache.set(cacheKey, pending);
    return pending;
  };
  const isSouthKoreaLabel = (value) =>
    [
      "south korea",
      "republic of korea",
      "korea republic of",
      "korea (republic of)",
      "korea (south)",
      "korea south"
    ].includes(
      normalize(value)
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[,.]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    );
  const findKoreanAcademicRequirementSelection = () =>
    Array.from(root?.querySelectorAll("select") ?? [])
      .map((select) => {
        const options = Array.from(select.querySelectorAll("option"))
          .map((option) => ({
            label: normalize(option.textContent || option.innerText),
            value: option.value || ""
          }))
          .filter((option) => isSouthKoreaLabel(option.label));
        return options.length === 1
          ? {
              optionLabel: options[0].label,
              optionValue: options[0].value,
              selectLabel:
                normalize(select.getAttribute("aria-label")) ||
                normalize(select.getAttribute("name")) ||
                "국가별 학력 요건 선택"
            }
          : null;
      })
      .find(Boolean) || null;
  let koreanAcademicRequirementSelection =
    findKoreanAcademicRequirementSelection();
  const koreanAcademicHeadingPattern =
    /^(?:(?:equivalent\s+qualifications?|international\s+qualifications?)\s+for\s+)?(?:South Korea|Republic of Korea|Korea,\s*South|Korea\s*\(\s*South\s*\))$/i;
  const readConfiguredKoreanAcademicResult = () => {
    const selector = normalize(options.koreanAcademicResultSelector);
    if (!selector || typeof root?.querySelector !== "function") return "";
    try {
      return textOf(root.querySelector(selector));
    } catch {
      return "";
    }
  };
  const readKoreanAcademicRequirements = () =>
    collectSection(koreanAcademicHeadingPattern) ||
    readConfiguredKoreanAcademicResult();

  if (options.autoSelectCountry) {
    const optionDeadline = Date.now() + 4000;
    while (!koreanAcademicRequirementSelection && Date.now() < optionDeadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      koreanAcademicRequirementSelection =
        findKoreanAcademicRequirementSelection();
    }

    const countrySelect = Array.from(root?.querySelectorAll("select") ?? []).find(
      (select) =>
        Array.from(select.querySelectorAll("option") ?? []).some(
          (option) =>
            option.value === koreanAcademicRequirementSelection?.optionValue
        )
    );
    if (countrySelect && koreanAcademicRequirementSelection) {
      if (
        countrySelect.value !== koreanAcademicRequirementSelection.optionValue
      ) {
        countrySelect.value = koreanAcademicRequirementSelection.optionValue;
        if (typeof countrySelect.dispatchEvent === "function") {
          countrySelect.dispatchEvent(new Event("input", { bubbles: true }));
          countrySelect.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }

      const deadline = Date.now() + 4000;
      while (!readKoreanAcademicRequirements() && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }

  const entryRequirements = collectEntryRequirements();
  const readLinkedKoreanAcademicRequirements = async () => {
    if (!normalize(options.koreanAcademicRequirementsUrl)) {
      return { text: "", candidates: [] };
    }
    const linked = await readLinkedDocument(koreanAcademicRequirementsLink);
    const headings = Array.from(
      linked?.root?.querySelectorAll("h1,h2,h3,h4,h5,h6") ?? []
    );
    const heading = headings.find((node) =>
      /^(?:Postgraduate Taught Programmes?|PG master['’]s courses)\b/i.test(
        textOf(node)
      )
    );
    if (!heading) return { text: "", candidates: [] };
    const blocks = [];
    let node = heading.nextElementSibling;
    while (node) {
      const level = headingLevel(node);
      if (level !== null && level <= 2) break;
      const text = textOf(node);
      if (text) blocks.push(text);
      node = node.nextElementSibling;
    }
    let candidates = Array.from(
      linked?.root?.querySelectorAll("tr") ?? []
    )
      .map((row) => {
        const cells = Array.from(row.querySelectorAll("th,td") ?? []).map(
          textOf
        );
        const classification = cells[1] || textOf(row);
        const value = cells[2] || "";
        const degreeClass = /\bfirst\s+class/i.test(classification)
          ? "first"
          : /\b(?:2\s*:\s*1|upper\s+second)/i.test(classification)
            ? "upper_second"
            : /\b(?:2\s*:\s*2|lower\s+second)/i.test(classification)
              ? "lower_second"
              : "";
        return degreeClass && value ? { degreeClass, value } : null;
      })
      .filter(Boolean);
    if (
      candidates.length === 0 &&
      normalize(options.koreanAcademicDefaultDegreeClass)
    ) {
      const values = [];
      const gpaPattern =
        /minimum\s+GPA\s+(?:of\s+)?(\d+(?:\.\d+)?)\s+(?:out\s+of|\/)\s+(\d+(?:\.\d+)?)/gi;
      const rawText = blocks.join(" ");
      for (const match of rawText.matchAll(gpaPattern)) {
        const value = `GPA ${match[1]}/${match[2]}`;
        if (!values.includes(value)) values.push(value);
      }
      if (values.length > 0) {
        candidates = [
          {
            degreeClass: normalize(options.koreanAcademicDefaultDegreeClass),
            value: values.join(" or ")
          }
        ];
      }
    }
    return { text: limit(blocks.join(" "), 2400), candidates };
  };
  const directKoreanAcademicRequirements = readKoreanAcademicRequirements();
  const linkedKoreanAcademicRequirements = directKoreanAcademicRequirements
    ? { text: "", candidates: [] }
    : await readLinkedKoreanAcademicRequirements();
  const koreanAcademicRequirements =
    directKoreanAcademicRequirements || linkedKoreanAcademicRequirements.text;
  const koreanAcademicRequirementCandidates =
    linkedKoreanAcademicRequirements.candidates;
  const englishBlock =
    findBlocks(
      /\b(?:IELTS|English\s+language|Level\s+(?:B[12]|[A-Z]|\d+)|Band\s+(?:B[12]|[A-Z]|\d+)|CEFR\s*(?:level\s*)?(?:B[12]|[ABC][12]?))\b/i,
      /\b(?:overall|minimum|score|band|component|element|level)\b.*\d|\d.*\b(?:overall|minimum|score|band|component|element|level)\b|\b(?:Level|Band)\s+(?:B[12]|[A-Z]|\d+)\b|\bCEFR\s*(?:level\s*)?(?:B[12]|[ABC][12]?)\b/i,
      1
    )[0] || "";
  const levelCategory = englishBlock.match(
    /\b(Level)\s*:?\s*(B[12]|[A-Z]|\d+)\b/i
  );
  const namedBandCategory = englishBlock.match(
    /\b(Band)\s*:?\s*(B[12]|[A-Z])\b/i
  );
  const numberedBandCategory = englishBlock.match(
    /\b(Band)\s*:?\s*(\d+)\b(?=\s*:)/i
  );
  const cefrCategory = englishBlock.match(
    /\bCEFR\s*(?:level\s*)?:?\s*(B[12]|[ABC][12]?)\b/i
  );
  const category =
    levelCategory || namedBandCategory || numberedBandCategory;
  const englishRequirement = category
    ? `${category[1][0].toUpperCase()}${category[1].slice(1).toLowerCase()} ${category[2].toUpperCase()}`
    : cefrCategory
      ? cefrCategory[1].toUpperCase()
      : englishBlock;
  const englishRequirementUrl =
    Array.from(root?.querySelectorAll("a[href]") ?? []).find((link) =>
      /\bEnglish language requirements?\b/i.test(textOf(link))
    )?.href || "";

  const amountFromCell = (text) =>
    text.match(amountPattern)?.[0] || "";

  const readLinkedTuitionCandidates = async (link) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(link.url, {
        credentials: "same-origin",
        signal: controller.signal
      });
      if (!response.ok) {
        return [];
      }
      const html = await response.text();
      const linkedDocument = new DOMParser().parseFromString(html, "text/html");
      const linkedRoot =
        linkedDocument.querySelector("main, [role='main']") ||
        linkedDocument.body;
      const tables = Array.from(linkedRoot?.querySelectorAll("table") ?? []);
      const feeStatusPattern =
        normalize(options.basis?.feeStatus).toLowerCase() === "home"
          ? /\b(?:home|scotland|rest\s+of\s+uk|uk)\b/i
          : /\b(?:international|overseas|non[- ]?uk|eu)\b/i;
      const selectedCycle = normalize(options.basis?.academicCycle);
      const selectedStudyMode = normalize(options.basis?.studyMode).toLowerCase();
      let foundCourseFeeCatalogue = false;

      for (const table of tables) {
        const rows = Array.from(table.querySelectorAll("tr"));
        const headerRow = rows.find(
          (row) => row.querySelectorAll("th").length >= 2
        );
        if (!headerRow) {
          continue;
        }
        const headers = Array.from(headerRow.querySelectorAll("th")).map(
          textOf
        );
        const courseCodeIndex = headers.findIndex((header) =>
          /^course\s+code$/i.test(header)
        );
        const feeStatusIndex = headers.findIndex((header) =>
          /^fee\s+status$/i.test(header)
        );
        const intensityIndex = headers.findIndex((header) =>
          /^(?:course\s+)?(?:intensity|study\s+mode)$/i.test(header)
        );
        const cycleIndex = headers.findIndex(
          (header) => academicCycleFrom(header) === selectedCycle
        );
        const isCourseFeeCatalogue =
          courseCodeIndex !== -1 &&
          feeStatusIndex !== -1 &&
          headers.some((header) => Boolean(academicCycleFrom(header)));

        if (isCourseFeeCatalogue) {
          foundCourseFeeCatalogue = true;
          if (!courseCode || cycleIndex === -1) {
            continue;
          }

          const headerIndex = rows.indexOf(headerRow);
          for (const row of rows.slice(headerIndex + 1)) {
            const cells = Array.from(row.querySelectorAll("th,td")).map(textOf);
            if (
              normalize(cells[courseCodeIndex]).toLowerCase() !==
              courseCode.toLowerCase()
            ) {
              continue;
            }
            const feeStatus = cells[feeStatusIndex] || "";
            if (!feeStatusPattern.test(feeStatus) && !/^all$/i.test(feeStatus)) {
              continue;
            }
            const intensity = cells[intensityIndex] || "";
            if (
              selectedStudyMode === "full-time" &&
              !/\bfull[- ]?time\b/i.test(intensity)
            ) {
              continue;
            }
            if (
              selectedStudyMode === "part-time" &&
              !/\bpart[- ]?time\b/i.test(intensity)
            ) {
              continue;
            }
            const feeCell = cells[cycleIndex] || "";
            const value = amountFromCell(feeCell);
            if (!value && !/\bTBA\b/i.test(feeCell)) {
              continue;
            }
            return [
              {
                academicCycle: academicCycleFrom(headers[cycleIndex]),
                intakeMonth: 0,
                intakeYear: 0,
                studyMode: /\bpart[- ]?time\b/i.test(intensity)
                  ? "part-time"
                  : /\bfull[- ]?time\b/i.test(intensity)
                    ? "full-time"
                    : "",
                feeStatus:
                  normalize(options.basis?.feeStatus) || "international",
                value: value || "TBA",
                rawText: limit(
                  `${headers.join(" ")} ${cells.join(" ")}`,
                  900
                ),
                sourceUrl: link.url,
                publicationStatus: value ? "published" : "unpublished"
              }
            ];
          }
          continue;
        }

        const feeIndex = headers.findIndex((header) =>
          feeStatusPattern.test(header)
        );
        if (feeIndex === -1) {
          continue;
        }
        const sessionIndex = headers.findIndex((header) =>
          /academic\s+(?:session|year)|year\s+of\s+entry/i.test(header)
        );
        const headerIndex = rows.indexOf(headerRow);
        for (const row of rows.slice(headerIndex + 1)) {
          const cells = Array.from(row.querySelectorAll("th,td")).map(textOf);
          const value = amountFromCell(cells[feeIndex] || "");
          if (!value) {
            continue;
          }
          const session = cells[sessionIndex] || "";
          const academicCycle = academicCycleFrom(session);
          if (
            selectedCycle &&
            academicCycle &&
            academicCycle !== selectedCycle
          ) {
            continue;
          }
          return [
            {
              academicCycle,
              intakeMonth: 0,
              intakeYear: 0,
              studyMode: /\bfull[- ]?time\b/i.test(link.label)
                ? "full-time"
                : "",
              feeStatus: normalize(options.basis?.feeStatus) || "international",
              value,
              rawText: limit(
                `${headers.join(" ")} ${cells.join(" ")}`,
                900
              ),
              sourceUrl: link.url,
              publicationStatus: "published"
            }
          ];
        }
      }

      if (foundCourseFeeCatalogue) {
        return [];
      }

      const linkedBlocks = Array.from(
        linkedRoot?.querySelectorAll("p,li,dd,tr") ?? []
      )
        .map(textOf)
        .filter((text) => amountFromCell(text));
      return linkedBlocks
        .flatMap((rawText) =>
          classifyMoneyAmounts(rawText, link.url, "tuition", 15)
        )
        .filter((candidate) => candidate.category === "tuition")
        .filter(
          (candidate) =>
            !candidate.feeStatus ||
            candidate.feeStatus ===
              (normalize(options.basis?.feeStatus) || "international")
        )
        .filter(
          (candidate) =>
            !selectedCycle ||
            !candidate.academicCycle ||
            candidate.academicCycle === selectedCycle
        )
        .map((candidate) => ({
          ...candidate,
          studyMode: candidate.studyMode ||
            (/\bfull[- ]?time\b/i.test(link.label) ? "full-time" : "")
        }));
    } catch {
      return [];
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const feeSection = collectSection(/^Fees?(?:\s+and\s+funding)?$/i);
  const directMoneyCandidates = [
    ...contentBlocks.flatMap((rawText) =>
      classifyMoneyAmounts(rawText, sourceUrl, "", 20)
    ),
    ...(feeSection
      ? classifyMoneyAmounts(feeSection, sourceUrl, "tuition", 10)
      : [])
  ];
  const moneyCandidates = directMoneyCandidates.filter(
    (candidate, index, all) =>
      all.findIndex(
        (item) =>
          item.category === candidate.category &&
          item.value === candidate.value &&
          item.academicCycle === candidate.academicCycle &&
          item.feeStatus === candidate.feeStatus &&
          item.sourceUrl === candidate.sourceUrl
      ) === index
  );
  const directTuitionFeeCandidates = moneyCandidates
    .filter((candidate) => candidate.category === "tuition")
    .sort((left, right) => {
      const score = (candidate) =>
        candidate.sourceRank +
        (candidate.academicCycle === normalize(options.basis?.academicCycle)
          ? 40
          : candidate.academicCycle
            ? 0
            : 10) +
        (candidate.feeStatus === normalize(options.basis?.feeStatus)
          ? 30
          : candidate.feeStatus
            ? 0
            : 5) +
        (candidate.studyMode === normalize(options.basis?.studyMode)
          ? 10
          : 0);
      return score(right) - score(left);
    })
    .map(({ category, sourceRank, ...candidate }) => candidate);
  const linkedTuitionFeeCandidates = directTuitionFeeCandidates.length === 0
    ? (
        await Promise.all(tuitionFeeLinks.map(readLinkedTuitionCandidates))
      ).flat()
    : [];
  const tuitionFeeCandidates = [
    ...directTuitionFeeCandidates,
    ...linkedTuitionFeeCandidates
  ].filter(
    (candidate, index, all) =>
      all.findIndex(
        (item) =>
          item.value === candidate.value &&
          item.rawText === candidate.rawText &&
          item.sourceUrl === candidate.sourceUrl
      ) === index
  );

  const directApplicationFeeCandidates = moneyCandidates
    .filter((candidate) => candidate.category === "application_fee")
    .map((candidate) => ({
      value: candidate.value,
      rawText: candidate.rawText,
      sourceUrl: candidate.sourceUrl
    }));
  const directNoApplicationFee = contentBlocks.find((text) =>
    /\b(?:there\s+is\s+no|we\s+do\s+not\s+charge\s+an?|no)\s+application\s+fee\b/i.test(
      text
    )
  );
  if (directNoApplicationFee) {
    directApplicationFeeCandidates.unshift({
      value: "No application fee",
      rawText: limit(directNoApplicationFee, 900),
      sourceUrl
    });
  }
  const readLinkedApplicationFeeCandidates = async () => {
    if (!normalize(options.applicationFeeUrl)) return [];
    const linked = await readLinkedDocument(applicationFeeLink);
    const rawText = Array.from(
      linked?.root?.querySelectorAll("p,li,dd,tr") ?? []
    )
      .map(textOf)
      .find((text) =>
        /\b(?:there\s+is\s+no|we\s+do\s+not\s+charge\s+an?|no)\s+application\s+fee\b/i.test(
          text
        )
      );
    return rawText
      ? [
          {
            value: "No application fee",
            rawText: limit(rawText, 900),
            sourceUrl: linked.sourceUrl
          }
        ]
      : [];
  };
  const applicationFeeCandidates = directApplicationFeeCandidates.length
    ? directApplicationFeeCandidates
    : await readLinkedApplicationFeeCandidates();

  const monthNameSource =
    "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
  const datePattern = new RegExp(
    `\\b(?:\\d{1,2}\\s+${monthNameSource}|${monthNameSource}\\s+\\d{1,2},?)\\s+20\\d{2}\\b`,
    "i"
  );
  const basis = options.basis || {};
  const directApplicationDeadlines = findBlocks(
    /\b(?:deadline|closing date|applications? close)\b/i,
    datePattern,
    5
  )
    .filter(
      (rawText) =>
        !/\b(?:roll\s+your\s+application\s+forward|selection\s+deadlines?|staged\s+admissions?)\b/i.test(
          rawText
        )
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
  const visaRequiredDeadlinePattern = new RegExp(
    `^Applicants who require a visa:[\\s\\S]{0,120}?\\d{1,2}\\s+${monthNameSource}\\s+20\\d{2}\\s*[–—-]\\s*(\\d{1,2}\\s+${monthNameSource}\\s+20\\d{2})`,
    "i"
  );
  const visaRequiredDeadlineCandidates = options.captureVisaRequiredDeadline
    ? Array.from(root?.querySelectorAll("div") ?? [])
        .map((node) => textOf(node))
        .filter((text) => /^Applicants who require a visa:/i.test(text))
        .filter((text) => text.length <= 500)
        .map((rawText) => {
          const match = rawText.match(visaRequiredDeadlinePattern);
          return match
            ? {
                academicCycle: normalize(basis.academicCycle),
                intakeMonth: Number(basis.intakeMonth) || 0,
                intakeYear: Number(basis.intakeYear) || 0,
                feeStatus: normalize(basis.feeStatus) || "international",
                applicantCategory: "visa_required",
                value: match[1],
                rawText: limit(rawText, 900),
                sourceUrl,
                publicationStatus: "published"
              }
            : null;
        })
        .filter(Boolean)
    : [];
  const readLinkedApplicationDeadlines = async () => {
    if (!normalize(options.applicationDeadlineUrl)) return [];
    const linked = await readLinkedDocument(applicationDeadlineLink);
    const targetYear = Number(basis.intakeYear) || 0;
    const row = Array.from(linked?.root?.querySelectorAll("tr") ?? []).find(
      (candidate) => {
        const text = textOf(candidate);
        return (
          /last\s+date\s+to\s+apply/i.test(text) &&
          /need\s+a\s+visa|visa\s+to\s+study/i.test(text) &&
          (!targetYear || text.includes(String(targetYear)))
        );
      }
    );
    const rawText = textOf(row);
    const value = rawText.match(datePattern)?.[0] || "";
    return value
      ? [
          {
            academicCycle: normalize(basis.academicCycle),
            intakeMonth: Number(basis.intakeMonth) || 0,
            intakeYear: targetYear,
            feeStatus: normalize(basis.feeStatus) || "international",
            applicantCategory: "visa_required",
            value,
            rawText: limit(rawText, 900),
            sourceUrl: linked.sourceUrl,
            publicationStatus: "published"
          }
        ]
      : [];
  };
  const linkedApplicationDeadlines =
    directApplicationDeadlines.length === 0 &&
    visaRequiredDeadlineCandidates.length === 0
      ? await readLinkedApplicationDeadlines()
      : [];
  const applicationDeadlines = [
    ...directApplicationDeadlines,
    ...visaRequiredDeadlineCandidates,
    ...linkedApplicationDeadlines
  ].filter(
    (candidate, index, all) =>
      all.findIndex(
        (item) =>
          item.value === candidate.value &&
          item.applicantCategory === candidate.applicantCategory
      ) === index
  );

  const applicationDeadlineModes = findBlocks(
    /\b(?:rolling\s+basis|applications?\s+(?:are\s+)?considered\s+on\s+a\s+rolling\s+basis|staged\s+admissions?|staged\s+entry)\b/i,
    null,
    5
  )
    .map((rawText) => ({
      kind: /rolling\s+basis|considered\s+on\s+a\s+rolling\s+basis/i.test(rawText)
        ? "rolling"
        : "staged",
      value: /rolling\s+basis|considered\s+on\s+a\s+rolling\s+basis/i.test(rawText)
        ? "Rolling basis"
        : "Staged admission",
      rawText: limit(rawText, 900),
      sourceUrl
    }))
    .filter(
      (candidate, index, all) =>
        all.findIndex((item) => item.kind === candidate.kind) === index
    );

  const notRequiredDocumentItem = (documentPattern) => {
    const negativePattern =
      /\b(?:not\s+required|not\s+needed|do\s+not\s+require|does\s+not\s+require|will\s+not\s+ask|won['’]t\s+ask|no\s+[^.]{0,80}\s+required)\b/i;
    const rawText = contentBlocks.find(
      (text) => documentPattern.test(text) && negativePattern.test(text)
    );
    return rawText
      ? {
          status: "not_required",
          reasonCode: "not_required",
          value: "Not required",
          detail: limit(rawText, 1000),
          rawText: limit(rawText, 1000),
          sourceUrl
        }
      : null;
  };

  const documentItem = (pattern, fallbackPattern = null) => {
    const notRequired = notRequiredDocumentItem(fallbackPattern || pattern);
    if (notRequired) {
      return notRequired;
    }
    const rawText =
      collectSection(pattern) ||
      (fallbackPattern
        ? findBlocks(
            fallbackPattern,
            /\b(?:required|requires?|need(?:ed|s)?|include(?:d|s)?|submit(?:ted|s)?|upload(?:ed|s)?|optional|not required)\b/i,
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
  const courseStatementGuideline = () => {
    const intro = Array.from(root?.querySelectorAll("p") ?? []).find((node) =>
      /when we assess your application we would like to learn/i.test(textOf(node))
    );
    if (!intro) {
      return null;
    }
    let list = intro.nextElementSibling;
    while (list && !/^(?:UL|OL)$/.test(list.tagName)) {
      if (headingLevel(list) !== null || textOf(list)) {
        return null;
      }
      list = list.nextElementSibling;
    }
    const bullets = Array.from(list?.querySelectorAll("li") ?? [])
      .map(textOf)
      .filter(Boolean);
    if (bullets.length === 0) {
      return null;
    }
    const statementContext =
      contentBlocks.find(
        (text) =>
          /personal statement/i.test(text) &&
          /opportunity|reasons? for applying|programme/i.test(text)
      ) || "";
    const rawText = limit(
      [textOf(intro), ...bullets.map((text) => `• ${text}`), statementContext]
        .filter(Boolean)
        .join(" "),
      1400
    );
    return {
      status: "found",
      value: "Required",
      detail: rawText,
      rawText,
      sourceUrl
    };
  };
  const readLinkedCvDocument = async () => {
    if (!normalize(options.cvGuidelineUrl)) return null;
    const linked = await readLinkedDocument(supportingDocumentLinks.cv);
    const anchors = Array.from(
      linked?.root?.querySelectorAll("a[href]") ?? []
    );
    const anchor = anchors.find((node) =>
      /\bcurriculum\s+vitae\b|\bCV\s*\/?\s*resume\b/i.test(textOf(node))
    );
    const term = anchor?.closest?.("dt") || anchor?.parentElement || null;
    const rawText = textOf(term?.nextElementSibling);
    if (!rawText) return null;
    return {
      status: "found",
      value: /\bmay\s+(?:also\s+)?wish\s+to\s+supply\b|\boptional\b/i.test(
        rawText
      )
        ? "Optional"
        : limit(rawText, 1000),
      detail: limit(rawText, 1000),
      rawText: limit(rawText, 1000),
      sourceUrl: linked.sourceUrl
    };
  };
  const conditionalCvRawText = contentBlocks.find((text) =>
    /\b(?:a\s+)?CV\s+if\s+you\s+graduated\s+more\s+than\s+three\s+years\s+ago\b/i.test(
      text
    )
  );
  const conditionalCvDocument = conditionalCvRawText
    ? {
        status: "found",
        value: "Required if graduated more than three years ago",
        detail: limit(conditionalCvRawText, 1000),
        rawText: limit(conditionalCvRawText, 1000),
        sourceUrl
      }
    : null;
  const cvDocument =
    conditionalCvDocument ||
    documentItem(
      /^(?:CV|curriculum vitae|résumé|resume)$/i,
      /\b(?:CV|curriculum vitae|résumé|resume)\b/i
    ) || (await readLinkedCvDocument());

  return {
    schemaVersion: 3,
    siteKey,
    title: document.title,
    url: sourceUrl,
    universityName,
    courseName,
    entryRequirements,
    koreanAcademicRequirements,
    koreanAcademicRequirementCandidates,
    englishRequirement,
    englishRequirementUrl,
    englishRequirementSourceUrl: englishRequirement ? sourceUrl : "",
    englishRequirementSourceText: englishBlock,
    englishRequirementDetailUrl: englishRequirement
      ? englishRequirementUrl
      : "",
    koreanAcademicRequirementsUrl: koreanAcademicRequirementsLink?.url || "",
    koreanAcademicRequirementSelection,
    applicationFeeLinks: applicationFeeLink ? [applicationFeeLink] : [],
    applicationDeadlineLinks: applicationDeadlineLink
      ? [applicationDeadlineLink]
      : [],
    supportingDocumentLinks,
    tuitionFeeLinks,
    pageAcademicCycles,
    moneyCandidates: moneyCandidates.map(({ sourceRank, ...candidate }) =>
      candidate
    ),
    tuitionFeeCandidates,
    applicationFeeCandidates,
    applicationDeadlines,
    applicationDeadlineModes,
    supportingDocuments: {
      reference: documentItem(
        /^(?:academic\s+)?references?(?:\s+and\s+referees?)?$|^referees?$/i,
        /\b(?:academic\s+)?references?|referees?\b/i
      ),
      sopGuideline:
        courseStatementGuideline() ||
        documentItem(
          /^(?:statement of purpose|personal statement|supporting statement)$/i,
          /\b(?:statement of purpose|personal statements?|supporting statements?)\b/i
        ),
      cv: cvDocument
    }
  };
}
