import {
  createAnalysis,
  extractAmount,
  EXTRACTION_STATUS,
  getFieldsByKey,
  makeResult,
  normalizeText,
  sourceFor
} from "./parser-utils.js";

function missing(field, snapshot, sectionLabel, detail, nextAction) {
  return makeResult(field, EXTRACTION_STATUS.NOT_FOUND, {
    reasonCode: "not_present",
    detail,
    nextAction,
    source: sourceFor(snapshot, sectionLabel, "")
  });
}

function parseIdentity(field, value) {
  return value
    ? makeResult(field, EXTRACTION_STATUS.FOUND, {
        value,
        source: null,
        copyText: ""
      })
    : makeResult(field, EXTRACTION_STATUS.NOT_FOUND, {
        reasonCode: "identity_missing",
        detail: `${field.label}을 페이지에서 확인하지 못했습니다.`,
        copyText: ""
      });
}

function parseTextField(field, snapshot, key, sectionLabel, nextAction) {
  const value = normalizeText(snapshot[key]);
  return value
    ? makeResult(field, EXTRACTION_STATUS.FOUND, {
        value,
        source: sourceFor(
          snapshot,
          sectionLabel,
          value,
          snapshot[`${key}Url`]
        )
      })
    : missing(
        field,
        snapshot,
        sectionLabel,
        `${sectionLabel} 본문을 찾지 못했습니다.`,
        nextAction
      );
}

const DEGREE_CLASS_PATTERNS = Object.freeze({
  first: [
    /\b1st(?:\s+class)?\b/i,
    /\bfirst[-\s]?class\b/i,
    /\b1:1\b/i
  ],
  upper_second: [
    /\b2:1\b/i,
    /\b(?:2|ii)[.]i\b/i,
    /\bupper[-\s]?second(?:[-\s]?class)?\b/i,
    /\bsecond[-\s]?class(?:\s+honours?)?\s+upper\s+division\b/i
  ],
  lower_second: [
    /\b2:2\b/i,
    /\b(?:2|ii)[.]ii\b/i,
    /\blower[-\s]?second(?:[-\s]?class)?\b/i,
    /\bsecond[-\s]?class(?:\s+honours?)?\s+lower\s+division\b/i
  ],
  third: [/\b3rd(?:\s+class)?\b/i, /\bthird[-\s]?class\b/i],
  pass: [/\bordinary\s+degree\b/i, /\bpass\s+degree\b/i]
});

const DEGREE_CLASS_ORDER = Object.freeze([
  "first",
  "upper_second",
  "lower_second",
  "third",
  "pass"
]);

export function detectMinimumDegreeClass(value) {
  const text = normalizeText(value);
  const matches = DEGREE_CLASS_ORDER.filter((degreeClass) =>
    DEGREE_CLASS_PATTERNS[degreeClass].some((pattern) => pattern.test(text))
  );
  return matches.at(-1) ?? "";
}

function parseKoreanRequirements(field, snapshot) {
  const fullText = normalizeText(snapshot.koreanAcademicRequirements);
  const candidates = snapshot.koreanAcademicRequirementCandidates ?? [];
  if (!fullText) {
    return missing(
      field,
      snapshot,
      "South Korea qualifications",
      "South Korea qualifications 본문을 찾지 못했습니다.",
      "국가별 입학 조건에서 South Korea를 직접 확인하세요."
    );
  }

  if (candidates.length === 0) {
    return makeResult(field, EXTRACTION_STATUS.FOUND, {
      value: fullText,
      source: sourceFor(
        snapshot,
        "South Korea qualifications",
        fullText,
        snapshot.koreanAcademicRequirementsUrl
      )
    });
  }

  const degreeClass = detectMinimumDegreeClass(snapshot.entryRequirements);
  const matches = candidates.filter(
    (candidate) => candidate.degreeClass === degreeClass
  );
  if (degreeClass && matches.length === 1) {
    return makeResult(field, EXTRACTION_STATUS.FOUND, {
      reasonCode: `degree_class_${degreeClass}`,
      value: matches[0].value,
      source: sourceFor(
        snapshot,
        "South Korea qualifications",
        fullText,
        snapshot.koreanAcademicRequirementsUrl
      )
    });
  }

  return makeResult(field, EXTRACTION_STATUS.ACTION_REQUIRED, {
    reasonCode: degreeClass
      ? "degree_class_candidate_missing"
      : "degree_class_unmatched",
    value: fullText,
    detail:
      "과정의 요구 등급과 한국 동등 기준을 하나로 확정하지 못해 전문을 표시합니다.",
    nextAction: "과정 기본 조건과 같은 UK degree 행을 직접 확인하세요.",
    source: sourceFor(
      snapshot,
      "South Korea qualifications",
      fullText,
      snapshot.koreanAcademicRequirementsUrl
    ),
    copyText: ""
  });
}

function parseEnglish(field, snapshot) {
  const value = normalizeText(snapshot.englishRequirement);
  if (value) {
    return makeResult(field, EXTRACTION_STATUS.FOUND, {
      value,
      source: sourceFor(
        snapshot,
        "English language requirements",
        value,
        snapshot.englishRequirementUrl
      )
    });
  }

  if (snapshot.englishRequirementUrl) {
    return makeResult(field, EXTRACTION_STATUS.FOUND, {
      value: "별도 English language requirements 페이지 확인",
      source: sourceFor(
        snapshot,
        "English language requirements",
        "별도 페이지에서 영어 조건 확인",
        snapshot.englishRequirementUrl
      )
    });
  }

  return missing(
    field,
    snapshot,
    "English language requirements",
    "영어 점수, band 또는 별도 안내 링크를 찾지 못했습니다.",
    "English language requirements 원문을 직접 확인하세요."
  );
}

function matchesBasis(candidate, basis) {
  return (
    (!candidate.academicCycle ||
      candidate.academicCycle === basis.academicCycle) &&
    (!candidate.intakeMonth || candidate.intakeMonth === basis.intakeMonth) &&
    (!candidate.intakeYear || candidate.intakeYear === basis.intakeYear) &&
    (!candidate.studyMode || candidate.studyMode === basis.studyMode) &&
    candidate.feeStatus === basis.feeStatus
  );
}

function parseTuition(field, snapshot, basis) {
  const candidates = (snapshot.tuitionFeeCandidates ?? []).filter((candidate) =>
    matchesBasis(candidate, basis)
  );

  if (candidates.length > 1) {
    return makeResult(field, EXTRACTION_STATUS.MULTIPLE_CANDIDATES, {
      reasonCode: "multiple_basis_matches",
      detail: candidates.map((candidate) => candidate.value).join(" / "),
      nextAction: "현재 입학 기준에 맞는 학비를 원문에서 직접 선택하세요.",
      source: sourceFor(
        snapshot,
        "Tuition fees",
        candidates.map((candidate) => candidate.rawText).join(" "),
        candidates[0]?.sourceUrl
      ),
      copyText: ""
    });
  }

  if (candidates.length === 0) {
    return missing(
      field,
      snapshot,
      "Tuition fees",
      "현재 입학 기준과 일치하는 학비를 찾지 못했습니다.",
      `${basis.academicCycle} · ${basis.studyMode} · ${basis.feeStatus} 기준을 원문에서 확인하세요.`
    );
  }

  const candidate = candidates[0];
  const amount = extractAmount(candidate.value);
  if (candidate.publicationStatus === "unpublished") {
    return makeResult(field, EXTRACTION_STATUS.ACTION_REQUIRED, {
      reasonCode: "fee_unpublished",
      value: normalizeText(candidate.value),
      detail: "이 입학연도의 학비는 아직 발표되지 않았습니다.",
      nextAction: "학교가 안내한 발표 시점 이후 다시 확인하세요.",
      source: sourceFor(
        snapshot,
        "Tuition fees",
        candidate.rawText,
        candidate.sourceUrl
      ),
      copyText: ""
    });
  }
  if (!candidate.academicCycle) {
    return makeResult(field, EXTRACTION_STATUS.ACTION_REQUIRED, {
      reasonCode: "academic_cycle_missing",
      value: amount,
      detail: "페이지에 학비 적용 학년이 표시되지 않아 현재 기준과의 일치를 확정할 수 없습니다.",
      nextAction: "과정 페이지의 적용 학년을 직접 확인하세요.",
      source: sourceFor(
        snapshot,
        "Tuition fees",
        candidate.rawText,
        candidate.sourceUrl
      ),
      copyText: ""
    });
  }
  if (!amount) {
    return missing(
      field,
      snapshot,
      "Tuition fees",
      "학비 문구는 찾았지만 금액을 분리하지 못했습니다.",
      "학비 원문을 직접 확인하세요."
    );
  }

  return makeResult(field, EXTRACTION_STATUS.FOUND, {
    value: amount,
    source: sourceFor(
      snapshot,
      "Tuition fees",
      candidate.rawText,
      candidate.sourceUrl
    )
  });
}

function parseApplicationFee(field, snapshot) {
  const candidate = snapshot.applicationFeeCandidates?.[0];
  if (!candidate) {
    return missing(
      field,
      snapshot,
      "Application fee",
      "과정 페이지에서 application fee를 찾지 못했습니다.",
      "학교 지원 안내에서 별도 비용이 있는지 확인하세요."
    );
  }
  const amount = extractAmount(candidate.value);
  return amount
    ? makeResult(field, EXTRACTION_STATUS.FOUND, {
        value: amount,
        source: sourceFor(
          snapshot,
          "Application fee",
          candidate.rawText,
          candidate.sourceUrl
        )
      })
    : missing(
        field,
        snapshot,
        "Application fee",
        "Application fee 문구는 찾았지만 금액을 분리하지 못했습니다.",
        "원문을 직접 확인하세요."
      );
}

function parseDeadline(field, snapshot, basis) {
  const candidates = (snapshot.applicationDeadlines ?? []).filter(
    (candidate) =>
      candidate.intakeMonth === basis.intakeMonth &&
      candidate.intakeYear === basis.intakeYear &&
      candidate.feeStatus === basis.feeStatus
  );
  if (candidates.length !== 1) {
    return missing(
      field,
      snapshot,
      "Application deadline",
      candidates.length
        ? "현재 기준에 맞는 마감일 후보가 여러 개입니다."
        : "현재 기준에 맞는 지원 마감일을 찾지 못했습니다.",
      "지원 일정 원문을 직접 확인하세요."
    );
  }

  const candidate = candidates[0];
  if (candidate.publicationStatus === "unpublished") {
    return makeResult(field, EXTRACTION_STATUS.ACTION_REQUIRED, {
      reasonCode: "deadline_unpublished",
      value: normalizeText(candidate.value),
      detail: "이 입학연도의 지원 마감일은 아직 확정되지 않았습니다.",
      nextAction: "학교가 마감일을 발표한 뒤 다시 확인하세요.",
      source: sourceFor(
        snapshot,
        "Application deadline",
        candidate.rawText,
        candidate.sourceUrl
      ),
      copyText: ""
    });
  }
  return makeResult(field, EXTRACTION_STATUS.FOUND, {
    value: normalizeText(candidate.value),
    copyText: normalizeText(candidate.rawText || candidate.value),
    source: sourceFor(
      snapshot,
      "Application deadline",
      candidate.rawText,
      candidate.sourceUrl
    )
  });
}

function parseDocument(field, snapshot, documentKey, sectionLabel) {
  const item = snapshot.supportingDocuments?.[documentKey];
  if (!item) {
    return missing(
      field,
      snapshot,
      sectionLabel,
      `${sectionLabel} 안내를 찾지 못했습니다.`,
      "지원 서류 원문을 직접 확인하세요."
    );
  }

  const status =
    item.status === "action_required"
      ? EXTRACTION_STATUS.ACTION_REQUIRED
      : EXTRACTION_STATUS.FOUND;
  return makeResult(field, status, {
    reasonCode: item.reasonCode,
    value: item.value,
    detail: item.detail,
    nextAction: item.nextAction,
    source: sourceFor(
      snapshot,
      sectionLabel,
      item.rawText,
      item.sourceUrl
    ),
    copyText: status === EXTRACTION_STATUS.FOUND ? item.rawText : ""
  });
}

export function parseCourseSnapshot(snapshot, basis, now = new Date()) {
  const fields = getFieldsByKey();
  const parsed = [
    parseIdentity(fields.get("university"), snapshot.universityName),
    parseIdentity(fields.get("course"), snapshot.courseName),
    parseTextField(
      fields.get("entryRequirements"),
      snapshot,
      "entryRequirements",
      "Entry requirements",
      "과정의 Entry requirements 원문을 직접 확인하세요."
    ),
    parseKoreanRequirements(
      fields.get("koreanAcademicRequirements"),
      snapshot
    ),
    parseEnglish(fields.get("englishRequirements"), snapshot),
    parseTuition(fields.get("tuitionFee"), snapshot, basis),
    parseApplicationFee(fields.get("applicationFee"), snapshot),
    parseDeadline(
      fields.get("universityApplicationDeadline"),
      snapshot,
      basis
    ),
    parseDocument(fields.get("reference"), snapshot, "reference", "References"),
    parseDocument(
      fields.get("sopGuideline"),
      snapshot,
      "sopGuideline",
      "Statement of purpose"
    ),
    parseDocument(fields.get("cv"), snapshot, "cv", "CV")
  ];

  return createAnalysis(snapshot, basis, parsed, now);
}
