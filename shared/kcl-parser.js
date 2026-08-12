import { FIELDS } from "./fields.js";
import { EXTRACTION_STATUS, COPY_STATE } from "./extraction-status.js";

const KCL_HOSTS = new Set(["www.kcl.ac.uk", "kcl.ac.uk"]);

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function sourceFor(snapshot, sectionLabel, excerpt) {
  if (!snapshot) {
    return null;
  }

  return {
    url: snapshot.url,
    pageTitle: snapshot.title,
    sectionLabel,
    excerpt: normalizeText(excerpt).slice(0, 700)
  };
}

function result(field, status, options = {}) {
  const value = normalizeText(options.value);
  const detail = normalizeText(options.detail);
  const copyText = Object.prototype.hasOwnProperty.call(options, "copyText")
    ? normalizeText(options.copyText)
    : value;

  return {
    key: field.key,
    label: field.label,
    order: field.order,
    status,
    value,
    detail,
    nextAction: normalizeText(options.nextAction),
    source: options.source ?? null,
    detailUrl: normalizeText(options.detailUrl),
    copyText,
    copyState: COPY_STATE.IDLE
  };
}

function findRow(rows, label) {
  const normalizedLabel = label.toLowerCase();
  return (rows ?? []).find(
    (row) => normalizeText(row.label).toLowerCase() === normalizedLabel
  );
}

function foundFromRow(field, requirements, label, sectionLabel) {
  const row = findRow(requirements?.supportingInformationRows, label);

  if (!row) {
    return result(field, EXTRACTION_STATUS.NOT_FOUND, {
      detail: `${label} 행을 찾지 못했습니다.`,
      nextAction: "원문 표를 직접 확인하세요.",
      source: sourceFor(requirements, sectionLabel, "")
    });
  }

  const value = normalizeText(row.requirement);
  const detail = normalizeText(row.details);
  return result(field, EXTRACTION_STATUS.FOUND, {
    value,
    detail,
    source: sourceFor(requirements, sectionLabel, `${label} ${value} ${detail}`),
    copyText: detail || value
  });
}

function extractAmount(text) {
  const normalized = normalizeText(text);
  const currencyAmount = normalized.match(
    /(?:£\s*|GBP\s*)\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?/i
  );
  if (currencyAmount) {
    return currencyAmount[0]
      .replace(/^£\s*/, "£")
      .replace(/^GBP\s*/i, "GBP ");
  }

  const numericCandidates = normalized.match(/\b\d[\d,]*(?:\.\d+)?\b/g) ?? [];
  const amount = numericCandidates.find((candidate) => {
    const plain = candidate.replace(/,/g, "");
    const number = Number(plain);
    return (
      Number.isFinite(number) &&
      !(number >= 1900 && number <= 2100) &&
      !normalized.includes(`${candidate}/`)
    );
  });

  return amount ?? "";
}

function parseMoneySentence(text, phrase) {
  const sentences = String(text ?? "")
    .split(/(?<=[.!?])\s+/)
    .map(normalizeText)
    .filter(Boolean);
  const lowerPhrase = phrase.toLowerCase();
  return sentences.find(
    (sentence) =>
      sentence.toLowerCase().includes(lowerPhrase) &&
      extractAmount(sentence)
  );
}

function parseDeadlineYear(text) {
  const match = normalizeText(text).match(/\b(20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

export function isKclRequirementsUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      KCL_HOSTS.has(url.hostname.toLowerCase()) &&
      /^\/study\/postgraduate-taught\/courses\/[^/]+\/requirements\/?$/.test(
        url.pathname
      )
    );
  } catch {
    return false;
  }
}

export function isTrustedKclFeesLink(requirementsUrl, candidateUrl) {
  try {
    const requirements = new URL(requirementsUrl);
    const candidate = new URL(candidateUrl, requirements);
    const courseBase = requirements.pathname.replace(/\/requirements\/?$/, "");

    return (
      requirements.protocol === "https:" &&
      candidate.protocol === "https:" &&
      candidate.origin === requirements.origin &&
      candidate.pathname.replace(/\/$/, "") === `${courseBase}/fees`
    );
  } catch {
    return false;
  }
}

function parseUniversity(field, requirements) {
  if (!requirements || !isKclRequirementsUrl(requirements.url)) {
    return result(field, EXTRACTION_STATUS.SOURCE_ERROR, {
      detail: "지원하는 KCL 과정 Requirements 페이지가 아닙니다.",
      nextAction: "KCL 과정의 Entry requirements 탭에서 다시 분석하세요."
    });
  }

  const siteName = normalizeText(requirements.siteName);
  if (!/king(?:'|’)?s college london/i.test(siteName)) {
    return result(field, EXTRACTION_STATUS.NOT_FOUND, {
      detail: "페이지에서 대학명을 확인하지 못했습니다.",
      source: sourceFor(requirements, "Page identity", siteName)
    });
  }

  return result(field, EXTRACTION_STATUS.FOUND, {
    value: "King's College London",
    source: null,
    copyText: ""
  });
}

function parseCourse(field, requirements, fees) {
  const requirementsCourseName = normalizeText(requirements?.courseName);
  const feesCourseName = normalizeText(fees?.courseName);
  const courseName = requirementsCourseName || feesCourseName;
  if (!courseName) {
    return result(field, EXTRACTION_STATUS.NOT_FOUND, {
      detail: "과정 제목을 찾지 못했습니다.",
      nextAction: "페이지 상단 과정명을 직접 확인하세요.",
      source: sourceFor(requirements, "Course header", "")
    });
  }

  return result(field, EXTRACTION_STATUS.FOUND, {
    value: courseName,
    source: null,
    copyText: ""
  });
}

function parseEntryRequirements(field, requirements) {
  const standard = normalizeText(requirements?.sections?.standardRequirements);
  const programme = normalizeText(
    requirements?.sections?.programmeSpecificRequirements
  );

  if (!standard && !programme) {
    return result(field, EXTRACTION_STATUS.NOT_FOUND, {
      detail: "Standard 또는 Programme specific requirements를 찾지 못했습니다.",
      nextAction: "Entry Requirements 원문을 직접 확인하세요.",
      source: sourceFor(requirements, "Entry Requirements", "")
    });
  }

  const parts = [];
  if (standard) {
    parts.push(`Standard: ${standard}`);
  }
  if (programme) {
    parts.push(`Programme specific: ${programme}`);
  }

  return result(field, EXTRACTION_STATUS.FOUND, {
    value: programme || standard,
    detail: parts.join("\n"),
    source: sourceFor(requirements, "Entry Requirements", parts.join(" ")),
    copyText: parts.join("\n")
  });
}

function parseKoreanRequirements(field, requirements) {
  const selectedCountry = normalizeText(requirements?.selectedCountry);
  const equivalent = normalizeText(
    requirements?.sections?.equivalentInternationalQualifications
  );

  if (!selectedCountry) {
    return result(field, EXTRACTION_STATUS.ACTION_REQUIRED, {
      detail: "국가가 선택되지 않아 한국 학력 요건을 확정할 수 없습니다.",
      nextAction:
        "페이지의 Equivalent International qualifications에서 South Korea를 선택한 뒤 다시 분석하세요.",
      source: sourceFor(
        requirements,
        "Equivalent International qualifications",
        equivalent
      )
    });
  }

  if (selectedCountry.toLowerCase() !== "south korea") {
    return result(field, EXTRACTION_STATUS.ACTION_REQUIRED, {
      detail: `현재 선택된 국가는 ${selectedCountry}입니다.`,
      nextAction: "South Korea를 선택한 뒤 다시 분석하세요.",
      source: sourceFor(
        requirements,
        "Equivalent International qualifications",
        equivalent
      )
    });
  }

  const cleaned = equivalent
    .replace(/^south korea\s*:\s*/i, "")
    .replace(/^select a country\s*/i, "")
    .trim();

  if (!cleaned) {
    return result(field, EXTRACTION_STATUS.NOT_FOUND, {
      detail: "South Korea 선택은 확인했지만 학력 요건 본문을 찾지 못했습니다.",
      nextAction: "국가 선택 영역의 원문을 직접 확인하세요.",
      source: sourceFor(
        requirements,
        "Equivalent International qualifications",
        equivalent
      )
    });
  }

  return result(field, EXTRACTION_STATUS.FOUND, {
    value: cleaned,
    source: sourceFor(
      requirements,
      "Equivalent International qualifications",
      equivalent
    )
  });
}

function parseEnglishRequirements(field, requirements) {
  const text = normalizeText(requirements?.sections?.englishLanguageRequirements);
  const items = (
    requirements?.englishLanguageRequirementItems?.length
      ? requirements.englishLanguageRequirementItems
      : String(requirements?.sections?.englishLanguageRequirements ?? "").split(
          /(?<=[.!?])\s+/
        )
  )
    .map(normalizeText)
    .filter(Boolean);
  const bandMatch = text.match(/english language band\s*:?\s*([a-z0-9]+)/i);
  const englishLink = (requirements?.englishLanguageLinks ?? []).find(
    (link) =>
      /english|language|requirement/i.test(
        `${normalizeText(link?.text)} ${normalizeText(link?.href)}`
      )
  );

  if (bandMatch) {
    const level = bandMatch[1].toUpperCase();
    const value = `English language band: ${level}`;
    return result(field, EXTRACTION_STATUS.FOUND, {
      value,
      detailUrl: englishLink?.href,
      source: sourceFor(requirements, "English language requirements", text)
    });
  }

  const scoreCondition = items.find(
    (item) =>
      /\b(?:IELTS|TOEFL|PTE(?:\s+Academic)?|Cambridge English)\b/i.test(item) &&
      /\d/.test(item)
  );

  if (scoreCondition) {
    return result(field, EXTRACTION_STATUS.FOUND, {
      value: scoreCondition,
      source: sourceFor(
        requirements,
        "English language requirements",
        scoreCondition
      )
    });
  }

  if (englishLink) {
    const linkText = normalizeText(englishLink.text);
    return result(field, EXTRACTION_STATUS.FOUND, {
      value: linkText
        ? `별도 페이지 확인: ${linkText}`
        : "별도 English language requirements 페이지 확인",
      source: sourceFor(
        {
          ...requirements,
          url: englishLink.href || requirements?.url
        },
        "English language requirements",
        linkText || text
      )
    });
  }

  return result(field, EXTRACTION_STATUS.NOT_FOUND, {
    detail: "영어 점수, band 또는 별도 안내 링크를 찾지 못했습니다.",
    nextAction: "English language requirements 원문을 직접 확인하세요.",
    source: sourceFor(requirements, "English language requirements", text)
  });
}

function parseTuitionFee(field, requirements, fees, feeError, basis) {
  if (feeError) {
    return result(field, EXTRACTION_STATUS.SOURCE_ERROR, {
      detail: `Fees 페이지를 읽지 못했습니다: ${normalizeText(feeError.message || feeError.code)}`,
      nextAction: "Fees 탭을 직접 열어 학비를 확인하세요.",
      source: sourceFor(requirements, "Fees link", requirements?.feesUrl ?? "")
    });
  }

  if (!fees || !isTrustedKclFeesLink(requirements?.url, fees.url)) {
    return result(field, EXTRACTION_STATUS.SOURCE_ERROR, {
      detail: "같은 과정의 신뢰할 수 있는 Fees 페이지를 확인하지 못했습니다.",
      nextAction: "과정 메뉴의 Fees 링크를 직접 확인하세요.",
      source: sourceFor(requirements, "Fees link", requirements?.feesUrl ?? "")
    });
  }

  const candidates = (fees.tuitionFeeCandidates ?? []).filter(
    (candidate) =>
      candidate.academicCycle === basis.academicCycle &&
      candidate.studyMode === basis.studyMode &&
      candidate.feeStatus === basis.feeStatus
  );

  if (candidates.length > 1) {
    return result(field, EXTRACTION_STATUS.MULTIPLE_CANDIDATES, {
      detail: candidates.map((candidate) => candidate.value).join(" / "),
      nextAction: "Fees 원문에서 해당 기준의 금액을 직접 선택하세요.",
      source: sourceFor(
        fees,
        "Tuition fees",
        candidates.map((candidate) => `${candidate.label} ${candidate.value}`).join(" ")
      )
    });
  }

  if (candidates.length === 0) {
    const available = (fees.tuitionFeeCandidates ?? [])
      .map(
        (candidate) =>
          `${candidate.academicCycle} · ${candidate.studyMode} · ${candidate.feeStatus}`
      )
      .join(", ");
    return result(field, EXTRACTION_STATUS.NOT_FOUND, {
      detail: available
        ? `현재 페이지의 후보: ${available}`
        : "학비 후보를 찾지 못했습니다.",
      nextAction: `${basis.academicCycle} · ${basis.studyMode} · ${basis.feeStatus} 기준을 Fees 원문에서 확인하세요.`,
      source: sourceFor(fees, "Tuition fees", available)
    });
  }

  const candidate = candidates[0];
  const amount = extractAmount(candidate.value);
  if (!amount) {
    return result(field, EXTRACTION_STATUS.NOT_FOUND, {
      detail: "학비 후보는 찾았지만 금액을 분리하지 못했습니다.",
      nextAction: "Fees 원문의 금액 표시를 직접 확인하세요.",
      source: sourceFor(fees, "Tuition fees", `${candidate.label} ${candidate.value}`)
    });
  }

  return result(field, EXTRACTION_STATUS.FOUND, {
    value: amount,
    source: sourceFor(fees, "Tuition fees", `${candidate.label} ${candidate.value}`)
  });
}

function parseApplicationFee(field, requirements) {
  const selectionProcess = normalizeText(
    requirements?.sections?.selectionProcess
  );
  const sentence = parseMoneySentence(selectionProcess, "application fee");

  if (!sentence) {
    return result(field, EXTRACTION_STATUS.NOT_FOUND, {
      detail: "Selection Process에서 application fee를 찾지 못했습니다.",
      nextAction: "Selection Process 원문을 직접 확인하세요.",
      source: sourceFor(requirements, "Selection Process", selectionProcess)
    });
  }

  const amount = extractAmount(sentence);
  if (!amount) {
    return result(field, EXTRACTION_STATUS.NOT_FOUND, {
      detail: "Application Fee 문구는 찾았지만 금액을 분리하지 못했습니다.",
      nextAction: "Selection Process 원문을 직접 확인하세요.",
      source: sourceFor(requirements, "Selection Process", sentence)
    });
  }

  return result(field, EXTRACTION_STATUS.FOUND, {
    value: amount,
    source: sourceFor(requirements, "Selection Process", sentence)
  });
}

function parseDeadline(field, requirements, basis) {
  const statusPattern =
    basis.feeStatus === "international"
      ? /overseas\s*\(international\)\s*fee status/i
      : /home\s*fee status/i;
  const candidates = (requirements?.applicationDeadlines ?? []).filter((item) =>
    statusPattern.test(item)
  );

  if (candidates.length > 1) {
    return result(field, EXTRACTION_STATUS.MULTIPLE_CANDIDATES, {
      detail: candidates.join(" / "),
      nextAction: "마감일 원문에서 해당 fee status의 날짜를 직접 선택하세요.",
      source: sourceFor(
        requirements,
        "Application closing date guidance",
        candidates.join(" ")
      )
    });
  }

  if (candidates.length === 0) {
    return result(field, EXTRACTION_STATUS.NOT_FOUND, {
      detail: `${basis.feeStatus} fee status의 지원 마감일을 찾지 못했습니다.`,
      nextAction: "Application closing date guidance를 직접 확인하세요.",
      source: sourceFor(
        requirements,
        "Application closing date guidance",
        (requirements?.applicationDeadlines ?? []).join(" ")
      )
    });
  }

  const deadline = normalizeText(candidates[0]);
  const deadlineYear = parseDeadlineYear(deadline);
  if (deadlineYear && deadlineYear !== basis.intakeYear) {
    return result(field, EXTRACTION_STATUS.ACTION_REQUIRED, {
      detail: `페이지의 마감일 연도 ${deadlineYear}와 입학 기준 연도 ${basis.intakeYear}가 다릅니다.`,
      nextAction: "과정 연도와 입학 기준을 확인한 뒤 다시 분석하세요.",
      source: sourceFor(
        requirements,
        "Application closing date guidance",
        deadline
      )
    });
  }

  const value = deadline.replace(/^.*?fee status\s*:\s*/i, "");
  return result(field, EXTRACTION_STATUS.FOUND, {
    value,
    copyText: deadline,
    source: sourceFor(
      requirements,
      "Application closing date guidance",
      deadline
    )
  });
}

function parseCv(field, requirements) {
  const row = findRow(requirements?.supportingInformationRows, "Other");
  if (!row || !/\bCV\b|resume/i.test(normalizeText(row.details))) {
    return result(field, EXTRACTION_STATUS.NOT_FOUND, {
      detail: "지원 서류 표에서 CV 안내를 찾지 못했습니다.",
      nextAction: "Personal statement and supporting information 표를 직접 확인하세요.",
      source: sourceFor(
        requirements,
        "Personal statement and supporting information",
        ""
      )
    });
  }

  return result(field, EXTRACTION_STATUS.FOUND, {
    value: normalizeText(row.requirement),
    detail: normalizeText(row.details),
    source: sourceFor(
      requirements,
      "Personal statement and supporting information",
      `Other ${row.requirement} ${row.details}`
    ),
    copyText: normalizeText(row.details) || normalizeText(row.requirement)
  });
}

export function summarizeResults(fields) {
  return fields.reduce(
    (summary, field) => {
      summary.total += 1;
      summary[field.status] = (summary[field.status] ?? 0) + 1;
      return summary;
    },
    { total: 0 }
  );
}

export function parseKclSnapshot(payload, basis, now = new Date()) {
  const requirements = payload?.requirements ?? null;
  const fees = payload?.fees ?? null;
  const feeError = payload?.feeError ?? null;
  const fieldsByKey = new Map(FIELDS.map((field) => [field.key, field]));

  const parsedFields = [
    parseUniversity(fieldsByKey.get("university"), requirements),
    parseCourse(fieldsByKey.get("course"), requirements, fees),
    parseEntryRequirements(fieldsByKey.get("entryRequirements"), requirements),
    parseKoreanRequirements(
      fieldsByKey.get("koreanAcademicRequirements"),
      requirements
    ),
    parseEnglishRequirements(fieldsByKey.get("englishRequirements"), requirements),
    parseTuitionFee(
      fieldsByKey.get("tuitionFee"),
      requirements,
      fees,
      feeError,
      basis
    ),
    parseApplicationFee(fieldsByKey.get("applicationFee"), requirements),
    parseDeadline(
      fieldsByKey.get("universityApplicationDeadline"),
      requirements,
      basis
    ),
    foundFromRow(
      fieldsByKey.get("reference"),
      requirements,
      "References",
      "Personal statement and supporting information"
    ),
    foundFromRow(
      fieldsByKey.get("sopGuideline"),
      requirements,
      "Personal Statement",
      "Personal statement and supporting information"
    ),
    parseCv(fieldsByKey.get("cv"), requirements)
  ];

  return {
    schemaVersion: 3,
    siteKey: "kcl",
    analyzedAt: now.toISOString(),
    stale: false,
    basis: {
      academicCycle: basis.academicCycle,
      intakeMonth: basis.intakeMonth,
      intakeYear: basis.intakeYear,
      studyMode: basis.studyMode,
      feeStatus: basis.feeStatus
    },
    page: {
      title: requirements?.title ?? "",
      url: requirements?.url ?? ""
    },
    fields: parsedFields,
    summary: summarizeResults(parsedFields)
  };
}
