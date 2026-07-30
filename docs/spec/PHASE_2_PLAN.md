# Phase 2 계획서 — SOAS·QMUL 일반화 검증

## 1. Phase 2의 목적

Phase 2에서는 Phase 1에서 만든 KCL 전용 추출 흐름을 SOAS와 QMUL의 서로 다른 페이지 구조에 적용해, 어떤 부분을 학교 공통 규칙으로 유지할 수 있는지 검증한다.

검증 대상:

1. KCL Nutrition MSc — 여러 과정 탭과 별도 Fees 페이지
2. SOAS MSc Global Development — 긴 단일 페이지와 전체 국가별 요건 목록
3. QMUL Corporate Finance MSc — 한 페이지 안의 여러 입학 연도와 국가 선택 영역

Phase 2의 핵심은 지원 학교 수를 빠르게 늘리는 것이 아니다.

- 학교마다 다른 DOM 읽기는 얇은 adapter로 격리한다.
- 11개 결과와 상태, 복사, 출처 형식은 공통으로 유지한다.
- 학년도, 입학 회차, Study mode, Fee status가 맞지 않으면 값을 추측하지 않는다.
- South Korea는 안전하게 자동 확인하되, 정확한 후보가 없으면 자동 선택하지 않는다.
- AI 없이 결정 가능한 범위와 이후 수동 확인이 필요한 경계를 기록한다.

---

## 2. 시작 조건과 현재 상태

Phase 2 구현 시작 전 확인할 조건:

- Phase 1의 KCL 실제 Chrome 결과가 정상이어야 한다.
- 확장 버전 `0.2.1`의 간결한 카드와 복사 규칙을 실제 Chrome에서 확인한다.
- KCL 회귀 테스트 24개가 계속 통과해야 한다.
- Phase 2 구현 중에도 KCL 동작을 깨뜨리지 않는다.

현재 Roadmap에서는 Phase 1의 최신 코드 수동 확인이 남아 있으므로:

- Phase 1: `진행 중`
- Phase 2 계획서: `작성 완료`
- Phase 2 구현: `다음 작업`

Phase 1 최종 확인이 끝나면 Phase 1을 `완료`, Phase 2를 `진행 중`으로 변경한다.

2026-07-30 구현 착수 후 현재 상태:

- P2-0 실제 SOAS·QMUL DOM preflight 완료
- P2-1 공통 snapshot schema 3과 site registry 완료
- P2-2 SOAS adapter와 fixture 완료
- P2-3 exact alias resolver와 KCL custom dropdown 자동 선택 구현
- P2-4 QMUL 2026·2027 intake adapter와 fixture 완료
- P2-5 공통 후보 선택 parser와 미발표/기준 없음 처리 완료
- P2-6 Side Panel·저장 schema 3 통합 완료
- P2-7 자동 검사, 실제 공개 페이지 adapter 실행, 세 학교 로컬 UI 회귀 완료
- `0.3.0` 실사용 피드백으로 KCL 과정명 metadata fallback과 QMUL 학위 등급 매칭을 보강
- 남은 확인: 확장 버전 `0.3.1`을 다시 불러온 실제 Chrome Side Panel 수동 검증

### 2.1 추가 학교 구조 검증 세트

J님이 실제로 자주 확인하는 학교 중 아래 12개 링크를 다음 adapter 우선순위와 회귀 검증에 사용한다. Phase 2에서 곧바로 지원 대상으로 넓히지는 않고, SOAS·QMUL 일반화가 다른 구조를 잘못 가정하지 않는지 확인하는 holdout 세트로 둔다.

인기 학교:

1. [Manchester — MSc Real Estate Development](https://www.manchester.ac.uk/study/masters/courses/list/09632/msc-real-estate-development/)
2. [Warwick — MSc Business with Operations Management](https://warwick.ac.uk/study/postgraduate/courses/msc-business-operations-management/)
3. [Edinburgh — Electronics](https://study.ed.ac.uk/programmes/postgraduate-taught/669-electronics)
4. [Leeds — Nutrition MSc](https://courses.leeds.ac.uk/f884/nutrition-msc)
5. [UCL — Clinical and Public Health Nutrition MSc](https://www.ucl.ac.uk/prospective-students/graduate/taught-degrees/clinical-and-public-health-nutrition-msc)

그 외 자주 확인하는 학교:

1. [Loughborough — International Business Management](https://www.lboro.ac.uk/study/postgraduate/masters-degrees/a-z/international-business-management/)
2. [Exeter — MSc Business and Management](https://www.exeter.ac.uk/masters-degrees/msc-business-and-management/)
3. [Henley/Reading — MSc Real Estate](https://www.henley.ac.uk/study/masters/msc-real-estate)
4. [Bath — MSc Marketing January start](https://www.bath.ac.uk/courses/postgraduate-2026/taught-postgraduate-courses/msc-marketing-january-start/)
5. [Southampton — Microelectronics Systems Design MSc](https://www.southampton.ac.uk/courses/microelectronics-systems-design-masters-msc)
6. [Birmingham — International Business MSc](https://www.birmingham.ac.uk/study/postgraduate/subjects/business-and-management-courses/international-business-msc)
7. [Bristol — Nutrition, Physical Activity and Public Health MSc](https://www.bristol.ac.uk/study/postgraduate/taught/msc-nutrition-physical-activity-and-public-health/#entry-requirements)

이 세트에서 미리 보존할 구조 차이:

- 같은 대학 안에서도 Henley/Reading처럼 별도 department 도메인·템플릿을 사용할 수 있다.
- Bath처럼 URL 자체에 입학연도와 January intake가 들어갈 수 있다.
- Bristol처럼 과정 HTML보다 연결된 PDF가 실질적인 정보 출처일 수 있다.
- 지원 대상 확대는 학교 수보다 구조 유형을 기준으로 묶고, 인기 5개교를 먼저 검증한다.

---

## 3. 현재 공개 페이지 조사 기준

조사 기준일: 2026-07-30

### 3.1 SOAS MSc Global Development

대상 페이지:

- [SOAS MSc Global Development](https://www.soas.ac.uk/study/find-course/msc-global-development)

현재 공개 페이지에서 확인한 내용:

| 항목 | 현재 공개 내용 | Phase 2 처리 |
| --- | --- | --- |
| University | SOAS University of London | University 값으로 정규화 |
| Course | MSc Global Development | 과정 헤더 사용 |
| Entry Requirements | 2:2 또는 국제 동등 학력 이상 | 과정별 일반 학력 요건으로 추출 |
| Korean Academic Requirements | South Korea의 2:ii 동등 기준: GPA 2.5/4.0, 2.8/4.3, 3.0/4.5 | 긴 국가 목록에서 South Korea 블록만 경계 추출 |
| English Requirements | 별도 English language requirements 페이지 링크 | 점수를 추측하지 않고 `별도 페이지 확인` |
| Tuition Fee | Home £12,965, International £25,320 | 금액 후보는 찾되 적용 학년도가 명시되지 않으면 자동 확정하지 않음 |
| Application Fee | 과정 페이지에서 찾지 못함 | `not_found` |
| University Application Deadline | 과정 지원 마감일을 찾지 못함 | 장학금 deadline을 과정 deadline으로 사용하지 않음 |
| Reference | References are optional | `Optional`과 조건을 보존 |
| SOP Guideline | Supporting statement가 평가 요소로 언급됨 | 제출 필요 가능성은 표시하되 구체 지침이 없음을 구분 |
| CV | 과정 페이지에서 찾지 못함 | `not_found` |

SOAS 구조의 핵심:

- 한 페이지가 매우 길다.
- 모든 국가별 학력 기준이 연속해서 포함된다.
- South Korea 앞뒤 국가의 문장이 섞이지 않도록 국가 블록 경계가 필요하다.
- 학비 금액은 있으나 페이지 본문에서 적용 academic cycle을 직접 확인하기 어렵다.
- 장학금 deadline이 여러 개 있으므로 과정 지원 마감일과 분리해야 한다.

### 3.2 QMUL Corporate Finance MSc

대상 페이지:

- [QMUL Corporate Finance MSc](https://www.qmul.ac.uk/postgraduate/taught/coursefinder/courses/corporate-finance-msc/)

현재 공개 페이지에서 확인한 내용:

| 항목 | September 2026 | September 2027 |
| --- | --- | --- |
| Tuition Fee — Overseas | £35,250 | Fees will be announced in September 2026 |
| Deadline — Overseas | 1st September 2026 | To be confirmed |
| Supporting documents | Reference, Statement of purpose, CV | 같은 목록 |

그 외 현재 공개 내용:

| 항목 | 현재 공개 내용 | Phase 2 처리 |
| --- | --- | --- |
| University | Queen Mary University of London | University 값으로 정규화 |
| Course | Corporate Finance MSc | 과정 헤더 사용 |
| Entry Requirements | 2:2 이상, 전공 제한 없음 | 과정별 일반 요건으로 추출 |
| Korean Academic Requirements | South Korea Bachelor Degree와 UK 1st, 2:1, 2:2별 GPA | 과정의 요구 등급 2:2와 맞는 South Korea 2:2 행 선택 |
| English Requirements | Band 4와 IELTS 6.5 overall, 각 영역 6.0 | 조건 한 줄만 표시 |
| Application Fee | 과정 페이지에서 찾지 못함 | `not_found` |
| Reference | 최근 대학 또는 일정 조건의 employer referee 한 명 | 실제 본문 추출 |
| SOP Guideline | Statement of purpose 제출 | 명칭은 확인되지만 세부 지침이 없음을 구분 |
| CV | Curriculum Vitae/Resume 제출 | 필수 서류로 표시 |

QMUL 구조의 핵심:

- 같은 과정 페이지 안에 여러 입학 회차가 함께 있다.
- 2026의 실제 값과 2027의 미발표 상태를 동시에 보존해야 한다.
- 현재 앱 기준과 맞지 않는 회차의 값을 대신 사용하면 안 된다.
- 국가별 학력 기준에는 UK 1st, 2:1, 2:2 후보가 모두 있다.
- 과정 자체 요구 등급과 국가별 동등 기준을 연결해야 한다.

---

## 4. Phase 2 범위

### 포함

- KCL, SOAS, QMUL 과정 페이지 판정
- 학교별 DOM reader와 공통 snapshot 형식 분리
- 긴 페이지에서 필요한 heading 구간만 수집
- 여러 입학 회차 후보 수집과 현재 앱 기준 선택
- `published`, `announced later`, `to be confirmed` 상태 구분
- 과정 요구 학위 등급과 South Korea 동등 기준 연결
- South Korea의 안전한 자동 확인과 필요한 경우 드롭다운 자동 선택
- English 점수, Band, 별도 페이지 링크 세 형태 유지
- Reference, SOP, CV supporting document 공통 분류
- 학교별 실패 reason code 기록
- KCL 회귀 테스트와 SOAS·QMUL fixture 테스트
- 실제 Chrome에서 세 학교 검증

### 제외

- SOAS·QMUL의 모든 과정 지원 보장
- 여러 과정을 동시에 저장하는 작업 문서
- 사용자가 카드 값을 직접 수정하는 기능
- 대학·단과대 공통 메모
- 별도 영어 페이지의 점수를 자동으로 따라가 수집
- 지원서 로그인 페이지 확인
- 대학 사이트 전체 탐색
- 학교별 host permission의 선제 추가
- AI 요약, AI 분류, 원문에 없는 값 생성

---

## 5. Phase 2 설계 원칙

### 5.1 학교별 코드는 DOM 정규화까지만 담당

학교마다 HTML 구조가 다르므로 DOM selector를 완전히 없앨 수는 없다.

대신 다음 경계를 지킨다.

```text
현재 페이지 DOM
  → Site Reader
  → 공통 Course Snapshot
  → 공통 Candidate Parser
  → 11개 Field Result
  → 기존 Side Panel
```

학교별 reader가 담당하는 것:

- 과정명과 학교명 근거 찾기
- heading과 구간 경계 찾기
- fee, deadline, country qualification, supporting document 후보 수집
- 원문과 출처 위치 보존

공통 parser가 담당하는 것:

- 현재 앱 기준과 후보 비교
- 과정 학위 등급과 국가별 동등 기준 연결
- found/action_required/not_found 등 상태 결정
- 화면용 값과 복사값 결정
- 11개 고정 순서 유지

### 5.2 학교별 예외를 공통 parser에 흩뿌리지 않음

피해야 할 구조:

```js
if (school === "SOAS") { ... }
if (school === "QMUL") { ... }
```

공통 parser 내부에 학교명 조건이 계속 늘어나지 않게 한다.

허용하는 구조:

```js
const SITE_ADAPTERS = [
  kclAdapter,
  soasAdapter,
  qmulAdapter
];
```

각 adapter는 동일한 snapshot을 반환하고, 공통 parser는 snapshot만 읽는다.

### 5.3 후보를 먼저 보존한 뒤 선택

reader 단계에서 현재 기준 하나만 남기지 않는다.

예:

```js
intakeCandidates: [
  {
    intakeMonth: 9,
    intakeYear: 2026,
    studyMode: "full-time",
    feeStatus: "international",
    tuitionValue: "£35,250",
    deadlineValue: "1st September 2026",
    publicationState: "published"
  },
  {
    intakeMonth: 9,
    intakeYear: 2027,
    studyMode: "full-time",
    feeStatus: "international",
    tuitionValue: "",
    tuitionNotice: "Fees will be announced in September 2026",
    deadlineValue: "",
    deadlineNotice: "To be confirmed",
    publicationState: "pending"
  }
]
```

공통 parser가 앱 기준과 일치하는 후보를 선택한다.

---

## 6. 공통 snapshot 구조

Phase 1의 KCL snapshot을 다음 공통 형태로 확장한다.

```js
{
  schemaVersion: 3,
  siteKey: "kcl" | "soas" | "qmul",
  kind: "course",
  title: string,
  url: string,
  identity: {
    universityName: string,
    courseName: string,
    departmentName: string
  },
  sections: {
    entryRequirements: SectionEvidence[],
    englishRequirements: SectionEvidence[],
    applicationInformation: SectionEvidence[],
    supportingDocuments: SectionEvidence[]
  },
  countryQualificationCandidates: [
    {
      countryLabel: string,
      normalizedCountry: string,
      ukDegreeClass: "first" | "two_one" | "two_two" | "",
      qualificationText: string,
      gradeText: string,
      source: SourceEvidence
    }
  ],
  intakeCandidates: [
    {
      academicCycle: string,
      intakeMonth: number | null,
      intakeYear: number | null,
      studyMode: "full-time" | "part-time" | "",
      feeStatus: "international" | "home" | "",
      tuitionValue: string,
      tuitionNotice: string,
      deadlineValue: string,
      deadlineNotice: string,
      source: SourceEvidence
    }
  ],
  documentCandidates: [
    {
      documentType: "reference" | "sop" | "cv",
      requirementState: "required" | "optional" | "conditional" | "mentioned",
      text: string,
      source: SourceEvidence
    }
  ],
  links: {
    fees: LinkEvidence[],
    englishRequirements: LinkEvidence[],
    countryRequirements: LinkEvidence[]
  }
}
```

규칙:

- 전체 HTML을 snapshot에 저장하지 않는다.
- 본문 전체를 저장하지 않는다.
- 필요한 최소 원문과 URL, section label만 보존한다.
- 학교별 원본 DOM 구조는 snapshot 밖으로 노출하지 않는다.

---

## 7. 페이지 판정과 adapter 선택

### KCL

- 허용 host: `www.kcl.ac.uk`, `kcl.ac.uk`
- 과정 Requirements URL 패턴 확인
- KCL 브랜드와 과정 메뉴 표식 확인

### SOAS

- 허용 host: `www.soas.ac.uk`, `soas.ac.uk`
- `/study/find-course/` 과정 URL 확인
- 과정 h1과 `Key information`, `Entry requirements` 표식 확인

### QMUL

- 허용 host: `www.qmul.ac.uk`, `qmul.ac.uk`
- `/postgraduate/taught/coursefinder/courses/` 과정 URL 확인
- 과정 h1과 `Fees and funding`, `Entry requirements`, `Apply` 표식 확인

URL만 맞고 필수 DOM 표식이 없으면 해당 adapter를 실행하지 않고 `source_error`로 반환한다.

---

## 8. South Korea 공통 resolver와 자동 선택

South Korea 자동 처리는 Phase 2에서 구현한다.

이 시점이 적절한 이유:

- KCL, SOAS, QMUL의 서로 다른 국가 표기와 DOM을 함께 비교할 수 있다.
- 한 학교 전용 클릭 코드가 아니라 공통 resolver의 경계를 정할 수 있다.
- 자동 선택이 필요 없는 정적 국가 목록과 실제 드롭다운을 구분할 수 있다.

### 8.1 정확한 별칭 목록

초기 허용 목록:

```js
[
  "south korea",
  "republic of korea",
  "korea, republic of",
  "korea (republic of)",
  "korea, south"
]
```

정규화:

- Unicode normalize
- 앞뒤 공백 제거
- 연속 공백 하나로 축소
- ASCII 대소문자 무시
- 쉼표와 괄호 차이는 허용 목록 안에서만 처리

금지:

- 단순히 `korea`가 포함됐다는 이유로 선택
- 첫 번째 Korea 후보 선택
- option 순서로 추정
- North Korea와 구분되지 않는 fuzzy match

### 8.2 자동 처리 순서

1. 현재 DOM에 South Korea 블록이 이미 렌더링됐는지 찾는다.
2. 이미 있으면 드롭다운을 조작하지 않고 해당 블록을 추출한다.
3. 없으면 International/Equivalent qualifications 구간의 국가 control을 찾는다.
4. 실제 option 또는 접근 가능한 항목을 수집한다.
5. 허용 별칭과 정확히 일치하는 후보를 찾는다.
6. 후보가 하나일 때만 선택한다.
7. native select는 실제 value 선택 후 `input`, `change` 이벤트를 전달한다.
8. custom dropdown은 실제 button과 option을 클릭한다.
9. DOM 변경을 기다린 뒤 선택된 국가명과 학력 본문을 다시 확인한다.
10. 검증된 경우에만 Korean Academic Requirements를 `found`로 반환한다.

### 8.3 실패 처리

| 상황 | 상태 |
| --- | --- |
| 정확한 별칭 후보 0개 | `action_required` |
| 정확한 후보 2개 이상 | `multiple_candidates` |
| 클릭 후 South Korea가 선택되지 않음 | `source_error` |
| 선택됐지만 학력 본문이 나타나지 않음 | `source_error` |
| 페이지가 이미 South Korea 본문을 포함 | 조작 없이 `found` |

기록 이벤트:

```text
country_block_found
country_auto_selection_started
country_auto_selected
country_auto_selection_failed
country_alias_missing
country_alias_ambiguous
```

전체 option 목록은 저장하지 않는다.

---

## 9. 학위 등급과 국가별 동등 기준 연결

QMUL처럼 South Korea 영역에 1st, 2:1, 2:2가 모두 있는 경우 과정 요구 등급과 연결한다.

정규화 예:

| 원문 | 정규화 |
| --- | --- |
| First class, 1st, 1:1 | `first` |
| 2:1, Upper Second | `upper_second` |
| 2:2, Lower Second | `lower_second` |
| Third class, 3rd | `third` |
| Ordinary degree, Pass degree | `pass` |

선택 순서:

1. 과정 Entry Requirements에서 요구 UK degree class를 찾는다.
2. South Korea 후보 중 같은 degree class를 찾는다.
3. 정확히 하나면 선택한다.
4. `first-class or upper second-class`처럼 합격 가능한 등급 범위를 함께 적으면 그중 최소 요구 등급을 선택한다.
5. 과정 요구 등급은 찾았지만 한국 후보에 같은 등급이 없으면 전문을 표시하고 `action_required`.
6. 과정 요구 등급을 찾지 못해도 South Korea 전문을 숨기지 않고 표시하되 `action_required`로 수동 확인을 요청한다.

SOAS의 `Equivalent to 2:ii`는 현재 단일 조건이므로 전문을 그대로 표시한다.

---

## 10. 입학 회차와 학비 선택

### 10.1 기준 우선순위

1. intake year
2. intake month
3. study mode
4. fee status
5. academic cycle

명시된 기준만 비교한다.

### 10.2 기준이 없는 값

SOAS처럼 금액은 있지만 적용 연도가 없는 경우:

- 금액 후보와 출처는 보존한다.
- 현재 academic cycle과 일치한다고 단정하지 않는다.
- Tuition Fee 상태는 `action_required`.
- 화면에는 금액과 `적용 학년도 확인 필요`를 표시한다.
- 확정 전에는 복사 버튼을 제공하지 않는다.

### 10.3 미발표 값

QMUL September 2027:

```text
Fees will be announced in September 2026
```

처리:

- 2026 학비를 대신 사용하지 않는다.
- `not_found` 빈칸으로 숨기지 않는다.
- 상태는 `action_required`.
- 발표 예정 문구를 값 대신 표시한다.
- 복사 버튼은 제공하지 않는다.
- reason code: `fee_announced_later`

### 10.4 여러 일치 후보

기준과 일치하는 후보가 둘 이상이면:

- 첫 후보를 자동 선택하지 않는다.
- `multiple_candidates`
- 후보별 기준과 출처를 접어서 표시한다.

---

## 11. Deadline 선택

### SOAS

- 과정 지원 deadline이 없으면 `not_found`.
- Scholarships 표의 deadline은 무시한다.
- Apply 버튼이나 장학금 일정으로 과정 deadline을 만들지 않는다.

### QMUL September 2026

- International 기준은 Overseas deadline을 선택한다.
- Home 기준은 Home deadline을 선택한다.
- intake year와 일치해야 한다.

### QMUL September 2027

```text
To be confirmed
```

처리:

- `action_required`
- 화면에 `To be confirmed`
- 이전 연도 deadline을 대신 사용하지 않음
- reason code: `deadline_to_be_confirmed`

---

## 12. English Requirements

Phase 1의 간결한 세 형태를 유지한다.

1. IELTS·TOEFL·PTE 등 점수 조건 한 줄
2. English Band 한 줄
3. 별도 페이지 확인 링크

SOAS:

- 과정 페이지에서 별도 English requirements 링크만 확인되면 링크 형태로 표시한다.
- 별도 페이지를 자동으로 따라가 점수를 가져오지 않는다.

QMUL:

- `Band 4: IELTS ...` 조건 한 줄을 표시한다.
- 일반적인 영어 시험 안내 문단은 제외한다.

학교별 영어 페이지의 공통 메모는 Phase 3 범위다.

---

## 13. Reference, SOP, CV 공통 분류

### Reference

- `required`: 명시적으로 제출 또는 referee 요구
- `optional`: 선택 사항이라고 명시
- `conditional`: 특정 지원자에게만 요구
- `mentioned`: 존재는 확인되지만 요구 여부 불명확

SOAS:

- References optional을 그대로 보존한다.

QMUL:

- one referee와 academic/employer 조건을 보존한다.

### SOP

문서명 후보:

```text
Personal Statement
Statement of Purpose
Supporting Statement
Supporting Information
```

세부 길이·질문이 있으면 함께 추출한다.

명칭만 있고 세부 지침이 없으면:

- 문서 제출 여부는 표시
- `세부 작성 지침은 현재 페이지에서 확인되지 않음`
- 원문에 없는 지침은 작성하지 않음

### CV

- Required supporting documents에 있으면 `Required`
- optional 표현이 있으면 `Optional`
- 언급이 없으면 `not_found`

---

## 14. 상태와 reason code

사용자 상태는 Phase 1 구조를 유지한다.

```js
[
  "not_analyzed",
  "analyzing",
  "found",
  "action_required",
  "not_found",
  "multiple_candidates",
  "source_error"
]
```

내부 reason code를 추가한다.

```js
[
  "basis_not_published",
  "basis_not_stated",
  "basis_mismatch",
  "fee_announced_later",
  "deadline_to_be_confirmed",
  "course_deadline_missing",
  "country_alias_missing",
  "country_alias_ambiguous",
  "country_selection_failed",
  "country_section_missing",
  "degree_class_missing",
  "degree_class_ambiguous",
  "section_boundary_missing",
  "supporting_document_details_missing"
]
```

reason code는 기본 카드에 그대로 노출하지 않고 다음 행동 문구로 변환한다.

---

## 15. Side Panel 변경

기존 11개 카드 순서와 상태 UI를 유지한다.

추가할 UI:

- 지원 학교 표시: KCL, SOAS, QMUL
- 자동 국가 확인 중 상태
- 기준 불일치 또는 미발표 상태의 짧은 안내
- 여러 입학 회차 후보가 있을 때 현재 기준과 다른 후보 개수 표시
- `다른 회차 보기` 접기 영역

유지할 규칙:

- University와 Course에는 출처·복사 버튼 없음
- 영어는 조건 한 줄만 표시
- 비용은 통화기호와 금액 또는 숫자만 표시
- 확정되지 않은 비용과 deadline에는 복사 버튼 없음
- 출처 원문은 접힌 상태
- 페이지 전체 국가 목록을 카드에 표시하지 않음

---

## 16. 권한과 보안

기본 권한 유지:

```json
[
  "activeTab",
  "scripting",
  "sidePanel",
  "storage"
]
```

Phase 2 시작 시 추가하지 않는 것:

- `<all_urls>`
- SOAS/QMUL 고정 host permission
- `tabs`
- `webRequest`
- `cookies`
- `downloads`

SOAS와 QMUL은 현재 단일 과정 페이지 안에서 검증을 시작한다.

별도 페이지 요청이 실제로 필요하고 `activeTab`으로 해결할 수 없는 근거가 생긴 경우에만 좁은 host permission을 별도 검토한다.

자동 국가 선택은 현재 활성 페이지 DOM 안에서만 수행한다.

---

## 17. 저장과 버전

분석 schema를 3으로 올린다.

저장 범위:

- 마지막 분석 결과 하나
- 선택된 adapter key
- 현재 기준과 후보 선택 결과
- 최대 100개 이벤트
- 자동 국가 선택 성공·실패 결과

저장하지 않는 것:

- 전체 HTML
- 전체 body text
- 전체 국가 option 목록
- SOAS의 전체 국가별 학력 기준
- 다른 입학 회차의 긴 원문 전체

버전 변경 시 이전 분석 결과는 자동으로 무효화하고 새 parser로 다시 분석한다.

---

## 18. 자동 테스트 계획

### Adapter registry

- KCL, SOAS, QMUL URL과 DOM 표식 판정
- 지원하지 않는 host 거부
- URL만 맞고 필수 heading이 없으면 구조 오류

### SOAS fixture

- University와 Course
- 2:2 Entry Requirements
- 긴 국가 목록에서 South Korea 블록만 추출
- 앞 국가 South Africa와 뒤 국가 Spain 내용이 섞이지 않음
- International £25,320 후보
- 학년도 미표기로 `action_required`
- English 별도 페이지 링크
- References optional
- Supporting statement 명칭
- Scholarship deadline을 과정 deadline으로 사용하지 않음
- Application Fee와 CV `not_found`

### QMUL fixture

- University와 Course
- 2:2 Entry Requirements
- South Korea 2:2 GPA 후보 선택
- South Korea 1st/2:1 값을 현재 과정 요건으로 사용하지 않음
- Band 4 IELTS 한 줄
- September 2026 Overseas £35,250
- September 2026 Overseas deadline
- September 2027 fee announced later
- September 2027 deadline to be confirmed
- 2027 기준에 2026 값을 대신 사용하지 않음
- Reference, SOP, CV supporting documents
- Application Fee `not_found`

### South Korea resolver

- 허용 별칭별 exact match
- 대소문자·공백 정규화
- North Korea 거부
- 후보 0개
- 후보 2개 이상
- 이미 렌더링된 South Korea 블록 우선
- native select 자동 선택
- custom dropdown 자동 선택
- 선택 후 본문 검증 실패

### 공통 parser

- 세 학교 모두 11개 고정 순서
- 같은 status와 source 구조
- University/Course copyText 없음
- 확정되지 않은 fee/deadline copyText 없음
- 실패한 한 항목이 다른 결과를 지우지 않음
- KCL 기존 fixture 회귀 통과

### 저장

- schema 3 저장·복구
- schema 2 결과 자동 무효화
- 이벤트 100개 제한
- 전체 HTML과 option 목록 미저장

---

## 19. 실제 Chrome 검증

### SOAS

1. MSc Global Development 페이지에서 확장 아이콘을 누른다.
2. 긴 페이지를 스크롤하지 않아도 분석되는지 확인한다.
3. South Korea 2:ii GPA만 표시되는지 확인한다.
4. International £25,320을 찾되 학년도 확인 필요 상태인지 확인한다.
5. References optional과 Supporting statement를 확인한다.
6. Scholarship deadline이 University Application Deadline에 들어가지 않는지 확인한다.
7. 페이지 스크롤 위치가 크게 이동하지 않는지 확인한다.

### QMUL — September 2026

1. 기준을 2026/27, September 2026, Full-time, International로 설정한다.
2. South Korea가 안전하게 자동 확인되는지 확인한다.
3. South Korea의 2:2 GPA 행이 선택되는지 확인한다.
4. Tuition Fee £35,250을 확인한다.
5. Overseas deadline 1st September 2026을 확인한다.
6. Band 4 IELTS 조건 한 줄을 확인한다.
7. Reference, Statement of purpose, CV를 확인한다.

### QMUL — September 2027

1. 기준을 2027/28, September 2027, Full-time, International로 변경한다.
2. `Fees will be announced in September 2026`이 표시되는지 확인한다.
3. 2026의 £35,250이 대신 들어가지 않는지 확인한다.
4. `To be confirmed`이 표시되는지 확인한다.
5. 2026 deadline이 대신 들어가지 않는지 확인한다.
6. 확정되지 않은 두 카드에 복사 버튼이 없는지 확인한다.

### KCL 회귀

1. KCL Nutrition Requirements 페이지를 다시 분석한다.
2. Phase 1의 11개 결과가 유지되는지 확인한다.
3. South Korea 미선택 상태에서 자동 선택이 안전하게 동작하는지 확인한다.
4. University/Course의 간결한 UI가 유지되는지 확인한다.
5. Tuition Fee, Application Fee, Deadline 복사 규칙이 유지되는지 확인한다.

---

## 20. 구현 순서

### P2-0 — 실제 DOM preflight

- SOAS와 QMUL의 실제 브라우저 DOM 확인
- heading, section, country control, intake block 경계 기록
- 공개 정보만 담은 최소 fixture 작성
- KCL 최신 fixture와 비교

### P2-1 — adapter contract와 공통 snapshot

- site adapter registry
- 공통 Course Snapshot schema 3
- SourceEvidence와 candidate 구조
- 기존 KCL reader를 adapter로 이동
- KCL parser 회귀 유지

### P2-2 — SOAS 긴 페이지 adapter

- Key information과 Entry requirements 구간
- 전체 국가 목록의 경계 파싱
- South Korea 블록 추출
- 학년도 없는 fee 후보
- English 링크와 supporting documents
- SOAS fixture 테스트

### P2-3 — South Korea 공통 resolver

- exact alias normalizer
- 이미 렌더링된 블록 우선
- native select와 custom dropdown adapter
- 선택 후 DOM 검증
- KCL, SOAS, QMUL 별칭·실패 fixture

South Korea 자동 선택은 이 단계에서 구현한다.

### P2-4 — QMUL 여러 입학 회차 adapter

- Entry requirements와 degree class
- 국가별 UK equivalency 후보
- Apply 영역의 2026·2027 블록
- fee/deadline publication state
- supporting documents
- QMUL fixture 테스트

### P2-5 — 공통 후보 선택 parser

- intake/basis matcher
- degree class matcher
- 미발표와 미정 상태
- copyText 제한
- reason code와 다음 행동

### P2-6 — Side Panel과 저장

- 학교 표시
- 자동 국가 확인 상태
- 다른 회차 후보 요약
- schema 3 저장·복구
- 이벤트 기록

### P2-7 — 전체 검증

- 전체 자동 검사
- 로컬 fixture UI
- 실제 Chrome SOAS·QMUL
- KCL 회귀
- 접근성·키보드·콘솔 오류
- Roadmap과 개발 로그 갱신

---

## 21. Phase 2 완료 기준

다음 조건을 모두 충족해야 Phase 2를 `완료`로 바꾼다.

- KCL, SOAS, QMUL 페이지를 정확한 adapter로 판정한다.
- 세 학교가 같은 11개 Field Result 구조를 사용한다.
- 학교별 DOM 코드는 adapter 안에 격리된다.
- SOAS 긴 국가 목록에서 South Korea 블록만 추출한다.
- 학년도 없는 SOAS fee를 현재 기준값으로 자동 확정하지 않는다.
- SOAS 장학금 deadline을 과정 deadline으로 사용하지 않는다.
- QMUL 과정 요구 등급과 South Korea 동등 기준을 연결한다.
- QMUL 2026·2027 입학 회차를 분리한다.
- 2027 미발표 fee와 미정 deadline을 이전 연도 값으로 대체하지 않는다.
- South Korea exact alias 자동 선택과 선택 후 검증이 동작한다.
- North Korea 또는 모호한 후보를 자동 선택하지 않는다.
- KCL Phase 1 회귀 테스트와 실제 동작을 유지한다.
- 권한이 계획한 최소 범위를 넘지 않는다.
- 자동 테스트와 실제 Chrome 검증을 통과한다.
- AI 없이 가능한 공통 추출 범위와 남은 실패를 개발 로그에 기록한다.

---

## 22. Phase 2에서 하지 않을 것

- 모든 SOAS·QMUL 과정 지원
- 임의의 학교를 자동 인식하는 범용 crawler
- 모든 국가 자동 선택
- South Korea fuzzy 검색
- 별도 영어 페이지 점수 자동 수집
- 미발표 fee 예측
- 미정 deadline 추정
- 학년도 없는 fee를 현재 학년도로 간주
- 사용자 입력값 자동 덮어쓰기
- 여러 과정 동시 작업
- 장기 공통 메모
- 로그인된 지원서 분석
- AI 추출 또는 요약
- `<all_urls>` 권한

---

## 23. Phase 3로 넘길 것

Phase 2에서 세 학교의 공통 구조가 확인된 뒤 다음을 Phase 3로 넘긴다.

- 대학 전체 English requirements 메모
- School/Faculty별 English Band 메모
- 학년도별 공통 deadline 안내
- 값, 출처, 마지막 확인일 저장
- 다음 학년도 재확인 상태
- 과정 페이지 값과 공통 메모 충돌 표시

Phase 2에서는 현재 과정 페이지가 직접 제공하는 값과 상태만 다룬다.
