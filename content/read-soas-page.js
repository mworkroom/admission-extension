export async function readSoasPage() {
  const normalize = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
  const textOf = (node, includeHidden = false) =>
    normalize(includeHidden ? node?.textContent : node?.innerText);
  const getDefinition = (label) => {
    const term = Array.from(document.querySelectorAll("main dt")).find(
      (node) => textOf(node).toLowerCase() === label.toLowerCase()
    );
    return term?.nextElementSibling ?? null;
  };
  const amountFor = (text, label) => {
    const match = text.match(
      new RegExp(`${label}\\s*:\\s*((?:£\\s*|GBP\\s*)?\\d[\\d,]*(?:\\.\\d+)?)`, "i")
    );
    return normalize(match?.[1]);
  };

  const entryNode = getDefinition("Entry requirements");
  const feesNode = getDefinition("Fees");
  const feesText = textOf(feesNode);
  const entryRequirements =
    textOf(entryNode?.querySelector(":scope > p")) || textOf(entryNode);
  const applicationContext = Array.from(document.querySelectorAll("main p")).find(
    (node) =>
      /supporting statement/i.test(textOf(node)) &&
      /references are optional/i.test(textOf(node))
  );
  const applicationContextText = textOf(applicationContext);
  const referenceText =
    applicationContextText.match(/References are optional.*?(?:\.|$)/i)?.[0] ||
    applicationContextText;
  const koreaNode = Array.from(
    document.querySelectorAll("main dd, main [class*='hidden']")
  ).find((node) => {
    const text = textOf(node, true);
    return /^South Korea\s*:/i.test(text) && /Equivalent to 2:ii/i.test(text);
  });
  const koreaText = textOf(koreaNode, true)
    .replace(/Information for prospective students from South Korea.*$/i, "")
    .replace(/(?<=[a-z)])(?=Equivalent to)/i, " ")
    .trim();
  const englishLink = Array.from(
    entryNode?.parentElement?.querySelectorAll("a") ?? document.querySelectorAll("main a")
  ).find((link) => /english language requirements/i.test(textOf(link)));

  return {
    schemaVersion: 3,
    siteKey: "soas",
    title: document.title,
    url: location.href,
    universityName: "SOAS University of London",
    courseName: textOf(document.querySelector("main h1")),
    entryRequirements,
    koreanAcademicRequirements: koreaText.replace(/^South Korea\s*:\s*/i, ""),
    englishRequirement: "",
    englishRequirementUrl: englishLink?.href || "",
    tuitionFeeCandidates: ["home", "international"]
      .map((feeStatus) => {
        const label = feeStatus === "home" ? "Home" : "International";
        const value = amountFor(feesText, label);
        return value
          ? {
              academicCycle: "",
              intakeMonth: 9,
              intakeYear: 0,
              studyMode: "full-time",
              feeStatus,
              value,
              rawText: feesText,
              publicationStatus: "published"
            }
          : null;
      })
      .filter(Boolean),
    applicationFeeCandidates: [],
    applicationDeadlines: [],
    supportingDocuments: {
      reference: applicationContext
        ? {
            status: "found",
            value: "Optional",
            detail: referenceText,
            rawText: referenceText
          }
        : null,
      sopGuideline: applicationContext
        ? {
            status: "action_required",
            reasonCode: "guideline_not_provided",
            value: "Supporting statement",
            detail: "제출 언급은 있지만 과정 페이지에 분량·질문 등 작성 지침은 없습니다.",
            nextAction: "지원서의 supporting statement 안내를 직접 확인하세요.",
            rawText: applicationContextText
          }
        : null,
      cv: null
    }
  };
}
