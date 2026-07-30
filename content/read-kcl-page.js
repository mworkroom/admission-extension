export async function readKclPage(options = {}) {
  const normalize = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
  const headingLevel = (node) =>
    /^H[1-6]$/.test(node?.tagName) ? Number(node.tagName.slice(1)) : null;

  const getSemanticNodes = (doc) =>
    Array.from(
      (doc.querySelector("main") || doc.body).querySelectorAll(
        "h1,h2,h3,h4,h5,h6,p,li"
      )
    );

  const findHeading = (doc, label) =>
    getSemanticNodes(doc).find(
      (node) =>
        headingLevel(node) !== null &&
        normalize(node.textContent).toLowerCase() === label.toLowerCase()
    );

  const collectSection = (doc, label) => {
    const nodes = getSemanticNodes(doc);
    const headingIndex = nodes.findIndex(
      (node) =>
        headingLevel(node) !== null &&
        normalize(node.textContent).toLowerCase() === label.toLowerCase()
    );

    if (headingIndex < 0) {
      return "";
    }

    const startLevel = headingLevel(nodes[headingIndex]);
    const texts = [];

    for (let index = headingIndex + 1; index < nodes.length; index += 1) {
      const node = nodes[index];
      const level = headingLevel(node);
      if (level !== null && level <= startLevel) {
        break;
      }

      if (
        level === null &&
        !node.closest("table") &&
        !node.querySelector("p,li")
      ) {
        const text = normalize(node.textContent);
        if (text) {
          texts.push(text);
        }
      }

      if (level !== null) {
        const text = normalize(node.textContent);
        if (text) {
          texts.push(text);
        }
      }
    }

    return normalize(texts.join(" "));
  };

  const collectSectionItems = (doc, label) => {
    const nodes = getSemanticNodes(doc);
    const headingIndex = nodes.findIndex(
      (node) =>
        headingLevel(node) !== null &&
        normalize(node.textContent).toLowerCase() === label.toLowerCase()
    );

    if (headingIndex < 0) {
      return [];
    }

    const startLevel = headingLevel(nodes[headingIndex]);
    const items = [];
    for (let index = headingIndex + 1; index < nodes.length; index += 1) {
      const node = nodes[index];
      const level = headingLevel(node);
      if (level !== null && level <= startLevel) {
        break;
      }
      if (
        (level !== null || (!node.closest("table") && !node.querySelector("p,li"))) &&
        normalize(node.textContent)
      ) {
        items.push(normalize(node.textContent));
      }
    }
    return items;
  };

  const collectSectionLinks = (doc, label) => {
    const root = doc.querySelector("main") || doc.body;
    const heading = findHeading(doc, label);
    if (!heading) {
      return [];
    }

    const nodes = Array.from(root.querySelectorAll("*"));
    const headingIndex = nodes.indexOf(heading);
    const startLevel = headingLevel(heading);
    const links = [];
    for (let index = headingIndex + 1; index < nodes.length; index += 1) {
      const node = nodes[index];
      const level = headingLevel(node);
      if (level !== null && level <= startLevel) {
        break;
      }
      if (node.tagName === "A" && node.href) {
        links.push({
          text: normalize(node.textContent),
          href: node.href
        });
      }
    }
    return links;
  };

  const collectRows = (doc) =>
    Array.from((doc.querySelector("main") || doc.body).querySelectorAll("table tr"))
      .map((row) => {
        const cells = Array.from(row.children).map((cell) =>
          normalize(cell.textContent)
        );
        return {
          label: cells[0] ?? "",
          requirement: cells[1] ?? "",
          details: cells.slice(2).join(" ")
        };
      })
      .filter((row) => row.label && (row.requirement || row.details));

  const collectDeadlines = (doc) => {
    const nodes = getSemanticNodes(doc);
    const headingIndex = nodes.findIndex(
      (node) =>
        headingLevel(node) !== null &&
        normalize(node.textContent).toLowerCase() ===
          "application closing date guidance"
    );
    if (headingIndex < 0) {
      return [];
    }

    const startLevel = headingLevel(nodes[headingIndex]);
    const deadlines = [];
    for (let index = headingIndex + 1; index < nodes.length; index += 1) {
      const node = nodes[index];
      const level = headingLevel(node);
      if (level !== null && level <= startLevel) {
        break;
      }
      const text = normalize(node.textContent);
      if (
        node.tagName === "LI" &&
        /(?:overseas|international|home).*fee status/i.test(text)
      ) {
        deadlines.push(text);
      }
    }
    return deadlines;
  };

  const getCourseBase = (url) =>
    new URL(url).pathname.replace(/\/requirements\/?$/, "");

  const findTrustedFeesUrl = (doc) => {
    const courseBase = getCourseBase(location.href);
    for (const anchor of doc.querySelectorAll("a[href]")) {
      if (normalize(anchor.textContent).toLowerCase() !== "fees") {
        continue;
      }
      try {
        const candidate = new URL(anchor.href, location.href);
        if (
          candidate.protocol === "https:" &&
          candidate.origin === location.origin &&
          candidate.pathname.replace(/\/$/, "") === `${courseBase}/fees`
        ) {
          return candidate.href;
        }
      } catch {
        // 잘못된 링크 후보는 무시하고 다음 실제 링크를 확인한다.
      }
    }
    return "";
  };

  const getCourseName = (doc, pageUrl) => {
    const visibleName =
      normalize(doc.querySelector(".course-name")?.textContent) ||
      normalize(
        Array.from(doc.querySelectorAll("main h1")).find((heading) =>
          /MSc|MA|MBA|LLM|MRes|MPhil|PGDip|PGCert/i.test(
            normalize(heading.textContent)
          )
        )?.textContent
      );
    if (visibleName) {
      return visibleName;
    }

    const metadataTitle =
      normalize(
        doc.querySelector('meta[property="og:title"]')?.getAttribute("content")
      ) ||
      normalize(
        doc.querySelector('meta[name="twitter:title"]')?.getAttribute("content")
      ) ||
      normalize(doc.title);
    const baseName = metadataTitle
      .replace(/\s*\|\s*King'?s College London.*$/i, "")
      .replace(/\s*-\s*(?:Entry Requirements|Fees).*$/i, "")
      .trim();
    if (!baseName) {
      return "";
    }

    let degreeSuffix = "";
    try {
      const slug = new URL(pageUrl).pathname
        .replace(/\/(?:requirements|fees)\/?$/, "")
        .split("/")
        .filter(Boolean)
        .at(-1);
      const degree = slug?.match(
        /-(msc|ma|mba|llm|mres|mphil|pgdip|pgcert)$/i
      )?.[1];
      const degreeNames = {
        msc: "MSc",
        ma: "MA",
        mba: "MBA",
        llm: "LLM",
        mres: "MRes",
        mphil: "MPhil",
        pgdip: "PGDip",
        pgcert: "PGCert"
      };
      degreeSuffix = degreeNames[degree?.toLowerCase()] ?? "";
    } catch {
      degreeSuffix = "";
    }

    return degreeSuffix &&
      !new RegExp(`\\b${degreeSuffix}\\b`, "i").test(baseName)
      ? `${baseName} ${degreeSuffix}`
      : baseName;
  };

  const waitForHydration = async () => {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const ready =
        findTrustedFeesUrl(document) &&
        collectRows(document).length >= 3 &&
        collectDeadlines(document).length >= 2 &&
        findHeading(document, "English language requirements");
      if (ready) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 160));
    }
  };

  const normalizeCountryLabel = (value) =>
    normalize(String(value ?? "").normalize("NFKC"))
      .toLowerCase()
      .replace(/[,.]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const southKoreaAliases = [
    "south korea",
    "republic of korea",
    "korea republic of",
    "korea (republic of)",
    "korea south"
  ];
  const isSouthKorea = (value) =>
    southKoreaAliases.includes(normalizeCountryLabel(value));
  const clickNode = (node) => {
    const event = document.createEvent("MouseEvents");
    event.initMouseEvent(
      "click",
      true,
      true,
      window,
      1,
      0,
      0,
      0,
      0,
      false,
      false,
      false,
      false,
      0,
      null
    );
    node.dispatchEvent(event);
  };
  const ensureSouthKorea = async () => {
    const currentControl = document.querySelector(
      "#country-qualifications-select"
    );
    if (
      isSouthKorea(currentControl?.textContent) &&
      /south korea/i.test(
        collectSection(document, "Equivalent International qualifications")
      )
    ) {
      return true;
    }

    const candidates = Array.from(document.querySelectorAll("select"))
      .flatMap((select) =>
        Array.from(select.options).map((option) => ({ select, option }))
      )
      .filter(({ option }) => isSouthKorea(option.textContent));

    if (candidates.length === 1) {
      const { select, option } = candidates[0];
      if (!isSouthKorea(select.selectedOptions?.[0]?.textContent)) {
        select.value = option.value;
        option.selected = true;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    } else if (candidates.length === 0) {
      const control = document.querySelector("#country-qualifications-select");
      const findCustomOptions = () =>
        Array.from(
          document.querySelectorAll(
            "button,[role='option'],[role='menuitem'],li"
          )
        ).filter((node) => isSouthKorea(node.textContent));
      let customOptions = findCustomOptions();
      if (customOptions.length === 0 && control instanceof HTMLElement) {
        clickNode(control);
        const optionDeadline = Date.now() + 2500;
        while (Date.now() < optionDeadline && customOptions.length === 0) {
          await new Promise((resolve) => setTimeout(resolve, 80));
          customOptions = findCustomOptions();
        }
      }
      if (customOptions.length !== 1) {
        return false;
      }
      clickNode(customOptions[0]);
    } else {
      return false;
    }

    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const selected =
        document.querySelector("#country-qualifications-select")
          ?.textContent ||
        candidates[0]?.select?.selectedOptions?.[0]?.textContent;
      const rendered = collectSection(
        document,
        "Equivalent International qualifications"
      );
      if (isSouthKorea(selected) && /south korea/i.test(rendered)) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    return false;
  };

  const parseFeeCandidate = (heading, doc) => {
    const label = normalize(heading.textContent);
    let node = heading.nextElementSibling;
    let value = "";

    while (node) {
      if (/^H[1-4]$/.test(node.tagName)) {
        break;
      }
      const text = normalize(node.textContent);
      if (/£\s?[\d,]+/.test(text) && /\(\d{4}\/\d{2}\)/.test(text)) {
        value = text;
        break;
      }
      node = node.nextElementSibling;
    }

    const cycle = value.match(/\((\d{4}\/\d{2})\)/)?.[1] ?? "";
    const studyMode = /part[\s-]?time/i.test(label) ? "part-time" : "full-time";
    const feeStatus = /\binternational\b/i.test(label)
      ? "international"
      : /\bUK\b|\bhome\b/i.test(label)
        ? "home"
        : "";

    return { label, value, academicCycle: cycle, studyMode, feeStatus };
  };

  const parseFeesDocument = (doc, url) => {
    const courseName = getCourseName(doc, url);
    const candidates = Array.from(
      (doc.querySelector("main") || doc.body).querySelectorAll("h4")
    )
      .filter((heading) => /tuition fees/i.test(normalize(heading.textContent)))
      .map((heading) => parseFeeCandidate(heading, doc))
      .filter(
        (candidate) =>
          candidate.value &&
          candidate.academicCycle &&
          candidate.studyMode &&
          candidate.feeStatus
      );

    return {
      kind: "fees",
      title: doc.title,
      url,
      courseName,
      tuitionFeeCandidates: candidates
    };
  };

  await waitForHydration();
  if (!options.skipCountrySelection) {
    await ensureSouthKorea();
  }

  const countryElement = document.querySelector("#country-qualifications-select");
  const countrySelect =
    countryElement?.tagName === "SELECT"
      ? countryElement
      : countryElement?.querySelector("select") ||
        Array.from(document.querySelectorAll("select")).find((select) =>
          Array.from(select.options).some((option) =>
            isSouthKorea(option.textContent)
          )
        );
  const selectedCountryText = normalize(
    countrySelect?.selectedOptions?.[0]?.textContent ||
      countryElement?.textContent
  );
  const selectedCountry =
    selectedCountryText && isSouthKorea(selectedCountryText)
      ? selectedCountryText
      : "";
  const feesUrl = findTrustedFeesUrl(document);
  const courseName = getCourseName(document, location.href);

  const requirements = {
    kind: "requirements",
    title: document.title,
    url: location.href,
    siteName: "King's College London",
    courseName,
    selectedCountry,
    feesUrl,
    sections: {
      standardRequirements: collectSection(document, "Standard requirements"),
      programmeSpecificRequirements: collectSection(
        document,
        "Programme specific requirements"
      ),
      equivalentInternationalQualifications: collectSection(
        document,
        "Equivalent International qualifications"
      ),
      englishLanguageRequirements: collectSection(
        document,
        "English language requirements"
      ),
      selectionProcess: collectSection(document, "Selection Process"),
      applicationClosingDateGuidance: collectSection(
        document,
        "Application closing date guidance"
      )
    },
    supportingInformationRows: collectRows(document),
    applicationDeadlines: collectDeadlines(document),
    englishLanguageRequirementItems: collectSectionItems(
      document,
      "English language requirements"
    ),
    englishLanguageLinks: collectSectionLinks(
      document,
      "English language requirements"
    )
  };

  if (!feesUrl) {
    return {
      requirements,
      fees: null,
      feeError: {
        code: "fees_link_missing",
        message: "과정 메뉴에서 Fees 링크를 찾지 못했습니다."
      }
    };
  }

  try {
    const response = await fetch(feesUrl, { credentials: "same-origin" });
    if (!response.ok) {
      return {
        requirements,
        fees: null,
        feeError: {
          code: "fees_http_error",
          message: `Fees 페이지 응답: HTTP ${response.status}`
        }
      };
    }

    const html = await response.text();
    const feesDocument = new DOMParser().parseFromString(html, "text/html");
    const fees = parseFeesDocument(feesDocument, feesUrl);
    return {
      requirements,
      fees,
      feeError: null
    };
  } catch (error) {
    return {
      requirements,
      fees: null,
      feeError: {
        code: "fees_fetch_failed",
        message: normalize(error?.message || "Fees 페이지 요청 실패")
      }
    };
  }
}
