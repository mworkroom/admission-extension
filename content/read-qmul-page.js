export async function readQmulPage() {
  const normalize = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
  const textOf = (node, includeHidden = false) =>
    normalize(includeHidden ? node?.textContent : node?.innerText);
  const findHeading = (label, tag = "h3") =>
    Array.from(document.querySelectorAll(`main ${tag}`)).find(
      (node) => textOf(node).toLowerCase() === label.toLowerCase()
    );
  const monthNumber = (name) =>
    ({
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
    })[String(name).toLowerCase()] ?? 0;
  const academicCycleFor = (year) => `${year}/${String(year + 1).slice(-2)}`;
  const amountFor = (text, label) => {
    const match = text.match(
      new RegExp(`${label}\\s*:\\s*((?:£\\s*|GBP\\s*)?\\d[\\d,]*(?:\\.\\d+)?)`, "i")
    );
    return normalize(match?.[1]);
  };
  const deadlineFor = (text, label) => {
    const match = text.match(
      new RegExp(`Deadline\\s+Home\\s*:\\s*(.*?)\\s+Overseas\\s*:\\s*(.*?)(?:$|\\s{2,})`, "i")
    );
    if (!match) {
      const simpler = text.match(
        new RegExp(`${label}\\s*:\\s*((?:\\d{1,2}(?:st|nd|rd|th)?\\s+)?[A-Za-z]+\\s+\\d{4}|To be confirmed)`, "i")
      );
      return normalize(simpler?.[1]);
    }
    return normalize(label === "Home" ? match[1] : match[2]);
  };

  const entryRequirements = textOf(
    Array.from(document.querySelectorAll("main p")).find((node) =>
      /(?:\b(?:1st|2:1|2:2|3rd)\b|first[- ]class|upper second|lower second|third[- ]class|ordinary degree|pass degree)/i.test(
        textOf(node)
      )
    )
  );
  const koreaBlock =
    document.querySelector("#KOR") ||
    Array.from(document.querySelectorAll("main [id]")).find((node) =>
      /^South Korea/i.test(textOf(node, true))
    );
  const koreanAcademicRequirements = textOf(koreaBlock, true)
    .replace(/^South Korea\s*/i, "")
    .trim();
  const koreanAcademicRequirementCandidates = [];
  const candidatePattern =
    /UK\s+(1st(?:\s+class)?|2:1|2:2|3rd(?:\s+class)?|ordinary|pass)\s+degree\s*:\s*(.*?)(?=UK\s+(?:1st(?:\s+class)?|2:1|2:2|3rd(?:\s+class)?|ordinary|pass)\s+degree\s*:|$)/gi;
  for (const match of koreanAcademicRequirements.matchAll(candidatePattern)) {
    const label = normalize(match[1]);
    const degreeClass =
      /^1st/i.test(label)
        ? "first"
        : label === "2:1"
          ? "upper_second"
          : label === "2:2"
            ? "lower_second"
            : /^3rd/i.test(label)
              ? "third"
              : "pass";
    koreanAcademicRequirementCandidates.push({
      degreeClass,
      label: `UK ${label} degree`,
      value: `UK ${label} degree: ${normalize(match[2])}`
    });
  }
  const englishHeading = findHeading("English language requirements");
  const englishText = textOf(englishHeading?.parentElement);
  const englishRequirement =
    englishText.match(
      /Band\s*\d+\s*:\s*IELTS\s*\(Academic\).*?(?=We accept|See all|$)/i
    )?.[0] ?? "";
  const englishLink = Array.from(
    englishHeading?.parentElement?.querySelectorAll("a") ?? []
  ).find((link) => /accepted English tests/i.test(textOf(link)));

  const intakeBlocks = Array.from(document.querySelectorAll("main dt"))
    .filter((node) => /^Starting in$/i.test(textOf(node)))
    .map((node) => {
      const rawText = textOf(node.parentElement);
      const intake = rawText.match(/Starting in\s*([A-Za-z]+)\s*(20\d{2})/i);
      return {
        rawText,
        intakeMonth: monthNumber(intake?.[1]),
        intakeYear: Number(intake?.[2] ?? 0)
      };
    })
    .filter((item) => item.intakeMonth && item.intakeYear);

  const tuitionFeeCandidates = [];
  const applicationDeadlines = [];
  for (const block of intakeBlocks) {
    for (const feeStatus of ["home", "international"]) {
      const label = feeStatus === "home" ? "Home" : "Overseas";
      const amount = amountFor(block.rawText, label);
      const unpublished =
        new RegExp(`${label}\\s*:\\s*Fees will be announced`, "i").test(
          block.rawText
        );
      if (amount || unpublished) {
        tuitionFeeCandidates.push({
          academicCycle: academicCycleFor(block.intakeYear),
          intakeMonth: block.intakeMonth,
          intakeYear: block.intakeYear,
          studyMode: "full-time",
          feeStatus,
          value: amount || "Fees will be announced",
          rawText: block.rawText,
          publicationStatus: unpublished ? "unpublished" : "published"
        });
      }

      const deadline = deadlineFor(block.rawText, label);
      if (deadline) {
        const isUnpublished = /to be confirmed/i.test(deadline);
        applicationDeadlines.push({
          intakeMonth: block.intakeMonth,
          intakeYear: block.intakeYear,
          feeStatus,
          value: deadline,
          rawText: `${label}: ${deadline}`,
          publicationStatus: isUnpublished ? "unpublished" : "published"
        });
      }
    }
  }

  const documentItems = Array.from(
    document.querySelectorAll("main li")
  ).map((node) => textOf(node));
  const referenceText = documentItems.find((text) =>
    /one referee|reference letters/i.test(text)
  );
  const sopText = documentItems.find((text) =>
    /^Statement of purpose$/i.test(text)
  );
  const cvText = documentItems.find((text) =>
    /Curriculum Vitae.*(?:CV|Resume)/i.test(text)
  );

  return {
    schemaVersion: 3,
    siteKey: "qmul",
    title: document.title,
    url: location.href,
    universityName: "Queen Mary University of London",
    courseName: textOf(document.querySelector("main h1")),
    entryRequirements,
    koreanAcademicRequirements,
    koreanAcademicRequirementCandidates,
    englishRequirement: normalize(englishRequirement),
    englishRequirementUrl: englishLink?.href || "",
    tuitionFeeCandidates,
    applicationFeeCandidates: [],
    applicationDeadlines,
    supportingDocuments: {
      reference: referenceText
        ? {
            status: "found",
            value: "One referee",
            detail: referenceText,
            rawText: referenceText
          }
        : null,
      sopGuideline: sopText
        ? {
            status: "found",
            value: "Required",
            detail: sopText,
            rawText: sopText
          }
        : null,
      cv: cvText
        ? {
            status: "found",
            value: "Required",
            detail: cvText,
            rawText: cvText
          }
        : null
    }
  };
}
