# Phase 1 계획서 — KCL 한 과정 완주

## 1. Phase 1의 목적

Phase 1에서는 KCL Nutrition MSc Requirements 페이지 하나를 기준으로 실제 입학요강 추출 흐름을 처음부터 끝까지 완성한다.

Phase 0에서 만든 Side Panel, 현재 앱 기준, 11개 고정 카드 위에 다음 기능을 추가한다.

- 현재 KCL Requirements 페이지의 공개 정보를 읽는다.
- 현재 DOM에서 실제 Fees 링크를 찾는다.
- 화면을 이동하지 않고 같은 과정의 Fees 페이지를 확인한다.
- 찾은 값을 11개 카드의 올바른 위치에 표시한다.
- 찾지 못했거나 사용자 행동이 필요한 항목은 이유와 다음 행동을 표시한다.
- 결과마다 출처 페이지와 원문 구간을 남긴다.
- 찾은 값만 항목별로 일반 텍스트 복사할 수 있게 한다.

Phase 1의 목표는 모든 카드를 억지로 채우는 것이 아니다. KCL 한 과정에서 `찾음`, `사용자 확인 필요`, `찾지 못함`, `오류`를 구분하고 그 이유를 설명할 수 있어야 한다.

## 2. 조사 기준과 현재 확인된 정보

조사일: `2026-07-30`

기준 페이지:

- [KCL Nutrition MSc — Requirements](https://www.kcl.ac.uk/study/postgraduate-taught/courses/nutrition-msc/requirements)
- [KCL Nutrition MSc — Fees](https://www.kcl.ac.uk/study/postgraduate-taught/courses/nutrition-msc/fees)

현재 공개 페이지에서 확인된 내용:

| 항목 | 확인된 출처와 상태 | Phase 1 처리 |
| --- | --- | --- |
| University | KCL 페이지 브랜드와 문서 제목 | `King's College London`으로 정규화하되 KCL 페이지 표식을 실제 DOM에서 확인 |
| Course | Requirements 또는 같은 과정 Fees 페이지의 `Nutrition MSc` 과정 헤더 | Requirements의 과정 헤더를 우선 사용하고, 국가 선택 후 헤더가 사라진 DOM에서는 검증된 실제 Fees 링크의 과정 헤더를 사용 |
| Entry Requirements | Standard requirements와 Programme specific requirements가 모두 존재 | 두 구간을 구분해 같은 카드에 표시 |
| Korean Academic Requirements | Equivalent International Qualifications가 국가 선택형으로 표시 | 자동으로 South Korea를 선택하지 않고, 선택 전에는 `사용자 확인 필요` 표시 |
| English Requirements | `English language band: B` 표시 | Phase 1에서는 `Band B`까지만 추출하고 별도 영어 기준 페이지는 가져오지 않음 |
| Tuition Fee | Fees 페이지에 2026/27 Full-time International 학비 표시 | 앱 기준의 학년도·Study mode·Fee status와 맞는 후보만 선택 |
| Application Fee | Selection Process에 non-refundable application fee 표시 | 금액과 성격을 함께 표시 |
| University Application Deadline | `Overseas (international) fee status: 25 July 2026`, `Home fee status: 25 August 2026` | 현재 앱의 Fee status와 입학 연도에 일치하는 날짜만 선택 |
| Reference | 두 개의 reference와 최소 한 개 academic reference 안내 | 요구 개수와 조건을 함께 표시 |
| SOP Guideline | 페이지의 실제 명칭은 Personal Statement | 화면에는 SOP Guideline 카드에 넣되 출처 명칭이 Personal Statement임을 표시 |
| CV | CV(Resume)는 optional로 안내 | `Optional` 의미를 숨기지 않고 표시 |

실제 DOM preflight에서 추가로 확인한 내용:

- 과정 메뉴의 실제 Fees 링크는 `/study/postgraduate-taught/courses/nutrition-msc/fees`이며, URL 문자열을 추측하지 않고 DOM의 `Fees` 링크를 사용한다.
- Requirements 페이지는 동적 렌더링 후 supporting documents 표와 지원 마감일이 나타나므로 필요한 표식이 준비될 때까지 제한된 시간 동안 기다린다.
- South Korea 선택 후 `Bachelor degree with a score of 85% or GPA of 3.5/4.5 or 3.3/4.3 or 3.2/4.0` 안내가 DOM에 나타난다.
- Fees 페이지에는 2026/27 Full-time UK `£18,150`, International `£38,300` 후보가 각각 표시된다.
- 구현 전에 실제 Chrome DOM에서 과정 헤더, Fees 링크, 국제 학력 국가 선택 영역의 구조를 한 번 더 확인해야 한다.
- DOM에서 Fees 링크를 찾지 못하면 URL의 마지막 경로를 임의로 `/fees`로 바꾸지 않는다.
- 대학 페이지 내용은 바뀔 수 있으므로 테스트 기대값과 실제 페이지 검증을 구분한다.

## 3. 사용자 흐름

1. J님이 KCL Nutrition MSc Requirements 페이지를 연다.
2. Chrome 툴바의 확장 아이콘을 누른다.
3. Side Panel이 열리고 현재 페이지가 KCL Requirements 페이지인지 확인한다.
4. 지원 페이지라면 별도 버튼을 한 번 더 누르지 않아도 분석을 시작한다.
5. 상단에 `현재 페이지 분석 중` 상태와 진행 중인 출처를 표시한다.
6. 현재 페이지에서 확인할 수 있는 항목을 먼저 채운다.
7. 현재 DOM에서 Fees 링크를 찾고, 같은 과정·같은 KCL 출처인지 검증한다.
8. Fees 페이지를 뒤에서 읽어 현재 앱 기준에 맞는 Tuition Fee를 채운다.
9. 각 카드는 값, 상태, 출처를 함께 표시한다.
10. 찾은 항목은 `복사` 버튼으로 일반 텍스트를 복사한다.
11. 사용자가 South Korea를 직접 선택해야 하는 경우 해당 카드에 다음 행동을 표시한다.
12. 기준이나 페이지가 바뀌면 기존 결과가 현재 조건과 다를 수 있음을 알리고 다시 분석하게 한다.

다시 분석:

- `현재 페이지 다시 분석` 버튼은 현재 탭을 기준으로 전체 11개 항목을 다시 확인한다.
- 분석 중 기존 결과를 즉시 지우지 않고 `다시 분석 중`으로 표시한다.
- 새 분석이 성공하면 기존 결과를 교체한다.
- 새 분석이 실패하면 마지막 성공 결과와 실패 안내를 함께 유지한다.

## 4. 지원 페이지 판정

Phase 1 자동 분석 대상:

```text
https://www.kcl.ac.uk/study/postgraduate-taught/courses/{course-slug}/requirements
```

판정 규칙:

- 프로토콜은 `https:`만 허용한다.
- 호스트는 정확히 `www.kcl.ac.uk`이어야 한다.
- 경로가 postgraduate taught course의 `requirements` 페이지 형식인지 확인한다.
- KCL 브랜드나 과정 페이지 표식이 실제 DOM에 있는지 함께 확인한다.
- URL만 KCL 형식이고 필요한 페이지 표식이 없으면 분석하지 않는다.

지원하지 않는 상태:

- KCL이 아닌 대학 페이지: `Phase 2에서 지원 예정`
- 같은 KCL 과정의 Overview 또는 Fees 페이지: `Requirements 페이지에서 시작해주세요`
- Chrome 내부 페이지: Phase 0의 보안 제한 안내 유지
- URL은 맞지만 페이지 구조가 달라짐: `페이지 구조 변경 가능성` 안내

Phase 1에서는 KCL의 다른 과정을 우연히 처리할 수 있어도 완료 검증 대상은 Nutrition MSc 하나로 제한한다.

## 5. 항목 상태와 화면 표현

### 5.1 추출 상태

```js
const EXTRACTION_STATUSES = [
  "not_analyzed",
  "analyzing",
  "found",
  "action_required",
  "not_found",
  "multiple_candidates",
  "source_error"
];
```

| 상태 | 화면 문구 | 의미 |
| --- | --- | --- |
| `not_analyzed` | 분석 전 | 아직 현재 페이지를 확인하지 않음 |
| `analyzing` | 분석 중 | 현재 페이지나 연결 페이지를 확인 중 |
| `found` | 확인됨 | 출처가 있는 값을 하나로 확인함 |
| `action_required` | 사용자 확인 필요 | 국가 선택처럼 J님의 페이지 조작이 먼저 필요함 |
| `not_found` | 찾지 못함 | 페이지를 읽었지만 해당 값을 확인하지 못함 |
| `multiple_candidates` | 여러 후보 | 현재 기준으로 하나를 안전하게 고르지 못함 |
| `source_error` | 출처 확인 실패 | 페이지 연결·응답·구조 문제로 확인하지 못함 |

색상만으로 상태를 구분하지 않고 아이콘, 상태 문구, 다음 행동을 함께 표시한다.

### 5.2 복사 상태

추출 상태와 복사 상태를 섞지 않는다.

```js
const COPY_STATES = [
  "idle",
  "copied",
  "copy_failed"
];
```

- `found`인 카드에만 복사 버튼을 표시한다.
- 복사 직후 `복사 완료` 문구를 표시한다.
- 복사 실패 시 추출 결과는 유지하고 다시 시도할 수 있게 한다.
- University와 Course는 출처 확인과 복사 버튼을 표시하지 않는다.
- 카드 전체나 HTML을 합치지 않고 항목별로 지정한 대표 본문 하나만 복사한다.
- Deadline은 화면용 축약 날짜가 아니라 페이지의 fee status 포함 원문 한 줄을 복사한다.
- Reference, SOP, CV는 `Yes`·`Optional` 라벨보다 실제 안내 본문을 복사한다.

### 5.3 카드 예시

```text
Tuition Fee
● 확인됨

£38,300 per year
2026/27 · Full-time · International

출처: Nutrition - Fees
[출처 자세히] [복사]
```

```text
Korean Academic Requirements
△ 사용자 확인 필요

페이지의 국가 선택에서 South Korea를 선택한 뒤
[현재 페이지 다시 분석]을 눌러주세요.
```

```text
University Application Deadline
○ 찾지 못함

페이지에 Application closing date guidance 구간은 있지만
정확한 날짜를 확인하지 못했습니다.
```

## 6. 항목별 추출 규칙

### 6.1 University

- KCL 페이지의 공식 브랜드 표식과 문서 제목을 확인한다.
- 출력값은 `King's College London`으로 정규화한다.
- 호스트 이름만 보고 대학명을 만들지 않는다.
- 값만 표시하고 출처 확인·복사 컨트롤은 제공하지 않는다.

### 6.2 Course

우선순위:

1. 과정 페이지 상단의 실제 과정명
2. 접근 가능한 과정 헤더
3. 문서 제목에서 페이지 종류 접미사를 제거한 값

URL slug를 사람이 읽는 과정명으로 임의 변환하지 않는다.

값만 표시하고 출처 확인·복사 컨트롤은 제공하지 않는다.

### 6.3 Entry Requirements

- `Standard requirements`와 `Programme specific requirements`를 각각 찾는다.
- 두 구간을 섞지 않고 라벨과 함께 표시한다.
- Programme specific requirements를 위에 둔다.
- Selection Process, English, supporting documents 내용은 포함하지 않는다.
- 섹션 경계는 취약한 CSS 클래스보다 heading 계층과 인접 콘텐츠를 우선 사용한다.

### 6.4 Korean Academic Requirements

- `Equivalent International Qualifications` 영역을 확인한다.
- 페이지에 현재 선택된 국가와 렌더링된 학력 기준이 있으면 국가명을 함께 반환한다.
- South Korea가 선택되어 있지 않으면 자동 클릭하지 않고 `action_required`로 반환한다.
- 다른 국가 값이 선택된 경우 그 값을 South Korea 기준으로 오인하지 않는다.
- South Korea 선택 자동화는 Phase 1 제외 범위다.

### 6.5 English Requirements

- `English language requirements` 영역에서 다음 세 형태를 구분한다.
  1. `IELTS 7.0 overall and no other element below 6.5` 같은 점수 조건
  2. `English language band: B` 또는 숫자 band
  3. 별도 English requirements 페이지 링크만 있는 안내
- 화면과 복사값에는 확인된 조건 한 줄만 표시하고 일반적인 영어 능력 안내 문단은 제외한다.
- Band의 IELTS 세부 점수를 다른 페이지에서 가져오거나 기억으로 채우지 않는다.
- 링크만 있으면 점수를 추측하지 않고 `별도 페이지 확인`과 실제 링크를 표시한다.

### 6.6 Tuition Fee

1. 현재 Requirements DOM의 실제 링크 중 Fees 후보를 찾는다.
2. 링크 텍스트, 접근 가능한 이름, 목적지 URL을 함께 확인한다.
3. 현재 페이지와 같은 `https://www.kcl.ac.uk` 출처인지 검증한다.
4. 같은 과정 경로에 속하는 링크인지 검증한다.
5. 검증된 링크만 뒤에서 요청한다.
6. Fees 문서에서 Tuition fees 영역을 확인한다.
7. 앱 기준의 학년도, Study mode, Fee status와 모두 일치하는 후보를 선택한다.
8. 화면과 복사값에는 통화기호가 있으면 통화기호와 금액만, 없으면 금액 숫자만 표시한다.

선택 규칙:

- 세 조건이 모두 일치하는 후보가 하나면 `found`
- 일치 후보가 두 개 이상이면 `multiple_candidates`
- 다른 학년도의 값만 있으면 `not_found`가 아니라 기준 불일치 안내
- International 기준인데 UK/Home 값을 대신 사용하지 않음
- Full-time 기준인데 Part-time 값을 대신 사용하지 않음
- 금액만 있고 학년도를 확인할 수 없으면 자동 확정하지 않음

### 6.7 Application Fee

- Selection Process 영역에서 application fee 문구를 찾는다.
- 출처 원문은 보존하되 화면과 복사값에는 통화기호가 있으면 통화기호와 금액만, 없으면 숫자만 표시한다.
- Tuition Fee나 deposit을 Application Fee로 사용하지 않는다.

### 6.8 University Application Deadline

- `Application closing date guidance` 영역에서 구체적인 날짜나 명확한 상태를 찾는다.
- 제목만 있고 실제 날짜가 없으면 `not_found`로 반환한다.
- International 기준은 Overseas (international), Home 기준은 Home fee status 행만 선택한다.
- 마감일 연도와 현재 입학 연도가 다르면 날짜를 확정하지 않고 `action_required`로 반환한다.
- Deposit payment deadline을 대학 지원 마감일로 사용하지 않는다.
- 현재 날짜, 이전 연도, 다른 과정의 날짜를 추측해 넣지 않는다.

### 6.9 Reference

- supporting documents 영역의 References 행을 찾는다.
- 요구 개수와 academic/professional 조건을 함께 보존한다.
- 페이지의 일반적인 추천 문구를 reference requirement로 오인하지 않는다.

### 6.10 SOP Guideline

- KCL 원문의 `Personal Statement` 행을 사용한다.
- `SOP`라는 단어가 원문에 없다는 사실을 출처 라벨로 드러낸다.
- 최대 글자 수, 페이지 수, 입력 또는 첨부 방식이 있으면 함께 표시한다.

### 6.11 CV

- supporting documents 영역에서 CV 또는 Resume 문구를 찾는다.
- required와 optional을 구분한다.
- 현재 페이지의 `Optional`을 필수 제출로 바꾸지 않는다.

## 7. 데이터 구조

### 7.1 분석 세션

```js
{
  schemaVersion: 1,
  analysisId: "random UUID",
  course: {
    university: "King's College London",
    courseName: "Nutrition MSc",
    courseKey: "kcl:nutrition-msc"
  },
  basisSnapshot: {
    academicCycle: "2026/27",
    intakeMonth: 9,
    intakeYear: 2026,
    studyMode: "full-time",
    feeStatus: "international"
  },
  sourcePage: {
    tabId: 123,
    title: "Nutrition - Entry Requirements",
    url: "https://www.kcl.ac.uk/...",
    capturedAt: "ISO-8601 datetime"
  },
  linkedSources: [
    {
      kind: "fees",
      title: "Nutrition - Fees",
      url: "https://www.kcl.ac.uk/...",
      fetchedAt: "ISO-8601 datetime"
    }
  ],
  fields: [],
  startedAt: "ISO-8601 datetime",
  completedAt: "ISO-8601 datetime"
}
```

### 7.2 항목 결과

```js
{
  key: "tuitionFee",
  label: "Tuition Fee",
  order: 6,
  status: "found",
  value: "£38,300 per year",
  details: [
    "2026/27",
    "Full-time",
    "International"
  ],
  copyText: "£38,300 per year (2026/27, Full-time, International)",
  source: {
    kind: "linked",
    pageTitle: "Nutrition - Fees",
    url: "https://www.kcl.ac.uk/...",
    sectionLabel: "Full time tuition fees international",
    excerpt: "£38,300 per year (2026/27)"
  },
  observedBasis: {
    academicCycle: "2026/27",
    studyMode: "full-time",
    feeStatus: "international"
  },
  mismatchReasons: [],
  nextAction: null,
  copyState: "idle",
  checkedAt: "ISO-8601 datetime"
}
```

데이터 규칙:

- `value`와 `copyText`는 일반 텍스트만 허용한다.
- `excerpt`는 출처를 식별할 수 있는 짧은 구간만 저장한다.
- 전체 HTML이나 전체 페이지 본문은 저장하지 않는다.
- `status !== "found"`인 결과에 임의의 `value`를 넣지 않는다.
- 기준 불일치 이유는 하나의 경고 문자열로 합치지 않고 배열로 보존한다.

## 8. 기술 구조

### 8.1 권한

Phase 1에서 추가할 권한:

```json
{
  "permissions": [
    "activeTab",
    "scripting",
    "sidePanel",
    "storage"
  ]
}
```

기본 구현에서는 `host_permissions`를 추가하지 않는다.

이유:

- `activeTab`과 `scripting`으로 J님이 확장 아이콘을 누른 현재 탭에만 분석 함수를 주입한다.
- Fees 링크는 현재 KCL 페이지 DOM에서 발견한다.
- Requirements와 Fees는 같은 HTTPS origin이므로 주입된 페이지 읽기 함수에서 same-origin 요청을 우선 검증한다.
- 확장 서비스 워커가 임의 URL을 요청하는 구조를 만들지 않는다.

권한 결정 게이트:

- 실제 Chrome에서 same-origin Fees 요청이 사이트 동작 때문에 실패하는지 먼저 확인한다.
- 실패 원인을 CORS, 인증, 응답 구조, 잘못된 링크 발견으로 구분한다.
- 서비스 워커 요청이 정말 필요하다는 근거가 생긴 경우에만 `https://www.kcl.ac.uk/*`의 좁은 host permission 추가를 별도 승인 대상으로 검토한다.
- `<all_urls>`는 추가하지 않는다.

### 8.2 예상 파일 구조

```text
admission-extension/
├─ manifest.json
├─ service-worker.js
├─ content/
│  └─ read-kcl-page.js
├─ sidepanel/
│  ├─ sidepanel.html
│  ├─ sidepanel.css
│  └─ sidepanel.js
├─ shared/
│  ├─ basis.js
│  ├─ fields.js
│  ├─ extraction-status.js
│  ├─ kcl-parser.js
│  ├─ result.js
│  └─ storage.js
├─ tests/
│  ├─ fixtures/
│  │  ├─ kcl-requirements-snapshot.json
│  │  └─ kcl-fees-snapshot.json
│  ├─ kcl-parser.test.js
│  ├─ result.test.js
│  ├─ storage.test.js
│  └─ manifest.test.js
└─ docs/
   └─ spec/
      ├─ PHASE_0_PLAN.md
      └─ PHASE_1_PLAN.md
```

### 8.3 DOM 읽기와 순수 파서 분리

콘텐츠 읽기 함수:

- 현재 DOM에서 제목, heading 계층, 섹션 텍스트, supporting document 행, 링크를 제한된 구조로 수집한다.
- 발견한 Fees HTML도 `DOMParser`로 같은 구조의 snapshot으로 바꾼다.
- 페이지 전체 HTML을 Side Panel로 보내지 않는다.

순수 파서:

- DOM snapshot과 앱 기준을 받아 11개 항목 결과를 반환한다.
- Chrome API나 실제 DOM에 직접 의존하지 않는다.
- JSON fixture로 자동 테스트할 수 있게 한다.

이 분리로 KCL DOM이 바뀌었을 때 페이지 읽기 실패와 항목 판정 실패를 구분한다.

### 8.4 메시지와 입력 검증

- Side Panel이 현재 탭 ID와 앱 기준을 분석 요청에 사용한다.
- 콘텐츠 읽기 함수가 임의 URL을 서비스 워커에 전달하는 구조를 만들지 않는다.
- Fees 후보 URL은 프로토콜, 호스트, 과정 경로를 검증한다.
- 페이지에서 받은 문자열은 UI에 `textContent`로 넣고 `innerHTML`로 렌더링하지 않는다.
- 외부 페이지의 스크립트나 이벤트 핸들러를 실행하지 않는다.

## 9. 로컬 저장과 기록

Phase 1에서 추가로 저장할 데이터:

- 마지막 성공 또는 부분 성공 분석 세션 하나
- 현재 분석의 항목별 결과
- 분석·실패·복사 이벤트의 제한된 기록

저장 키 예시:

```js
{
  phase1CurrentAnalysis: {},
  phase1Events: []
}
```

이벤트 예시:

```js
{
  type: "field_copied",
  analysisId: "...",
  fieldKey: "tuitionFee",
  sourceUrl: "https://www.kcl.ac.uk/...",
  occurredAt: "ISO-8601 datetime"
}
```

저장 규칙:

- 이벤트는 최근 100개만 유지한다.
- 복사한 전체 텍스트는 이벤트 로그에 중복 저장하지 않는다.
- 페이지 전체 본문, HTML, 쿠키, 로그인 정보는 저장하지 않는다.
- 앱 기준이 바뀌면 기존 분석을 자동으로 새 기준 결과처럼 표시하지 않고 `기준 변경 후 다시 분석 필요`로 표시한다.
- 새 분석이 실패해도 마지막 성공 결과를 즉시 삭제하지 않는다.

Phase 4의 장기 실사용 기록 구조를 Phase 1에서 미리 만들지 않는다.

## 10. 오류와 예외 처리

### 분석 권한 연결 실패

```text
현재 페이지 분석 권한이 연결되지 않았습니다.
이 페이지에서 확장 아이콘을 다시 눌러주세요.
```

- Side Panel만 복원되고 `activeTab` 권한이 없는 경우에 사용한다.
- 복구 가능한 상태를 처리되지 않은 콘솔 오류로 남기지 않는다.

### KCL 페이지 구조 변경

```text
KCL 페이지의 필요한 구간을 확인하지 못했습니다.
페이지 구조가 바뀌었을 수 있습니다.
```

- 전체 항목을 같은 `not_found`로 바꾸지 않는다.
- 읽은 항목은 유지하고 영향받은 항목만 `source_error`로 표시한다.

### Fees 링크 없음

```text
현재 페이지에서 이 과정의 Fees 링크를 찾지 못했습니다.
URL을 추측하지 않았습니다.
```

### Fees 응답 실패

- 현재 Requirements 페이지에서 찾은 항목은 유지한다.
- Tuition Fee 카드만 `source_error`로 표시한다.
- HTTP 상태, timeout, 파싱 실패를 사용자 문구와 내부 진단 코드로 분리한다.

### 기준 불일치

- 상단에 현재 앱 기준과 발견한 값의 기준을 함께 표시한다.
- 다른 학년도의 학비를 현재 기준값으로 복사할 수 있게 만들지 않는다.
- 후보가 여러 개면 모두 숨기지 않고 요약과 출처를 표시한다.

### 저장 실패

- 화면에 이미 표시한 분석 결과는 유지한다.
- 저장되지 않았음을 알리고 다시 저장 또는 다시 분석할 수 있게 한다.
- 저장 성공처럼 표시하지 않는다.

## 11. 접근성과 인지 부담 감소

- 분석은 지원 페이지에서 자동 시작하고 불필요한 시작 버튼을 추가하지 않는다.
- 상단에 `분석 중`, `확인 완료 n/11`, `사용자 확인 필요 n개`를 한 줄로 요약한다.
- 카드 순서는 Phase 0과 동일하게 유지한다.
- 기본 화면에는 값과 상태를 먼저 보여주고 출처 원문은 접어서 제공한다.
- `복사` 버튼은 값이 확인된 카드에만 표시한다.
- 사용자 행동이 필요한 카드는 행동 문장을 버튼 바로 위에 표시한다.
- 오류 코드를 기본 화면에 노출하지 않는다.
- 키보드 포커스, 충분한 클릭 영역, 아이콘과 문구 병행 규칙을 유지한다.
- 새 결과가 생겨도 자동으로 스크롤 위치를 크게 바꾸지 않는다.

## 12. 자동 테스트 계획

### Manifest와 권한

- Manifest V3와 Chrome 116 이상 유지
- `scripting` 추가 확인
- `activeTab`, `scripting`, `sidePanel`, `storage` 외 불필요한 권한 없음
- 기본 구현에 `host_permissions`, `<all_urls>`, `tabs`, `downloads`, `cookies` 없음

### 페이지 판정

- KCL Nutrition Requirements URL 허용
- 같은 과정의 Fees URL은 시작 페이지로 거부하고 안내
- 다른 호스트와 `http:` URL 거부
- URL만 맞고 KCL DOM 표식이 없으면 구조 오류

### Fees 링크 보안

- 실제 DOM snapshot의 same-origin Fees 링크 발견
- 상대 URL을 안전하게 절대 URL로 변환
- 다른 호스트, `javascript:`, 다른 과정 링크 거부
- 링크가 없을 때 `/fees` URL을 생성하지 않음

### 항목 파서

- 11개 결과가 고정 순서로 반환됨
- Standard와 Programme specific requirements 분리
- South Korea 미선택 시 `action_required`
- 다른 국가 선택값을 Korean requirement로 사용하지 않음
- English Band B 추출
- Application Fee와 deposit 분리
- Reference 개수와 조건 추출
- Personal Statement의 글자·페이지 제한 추출
- Optional CV 상태 보존
- 정확한 deadline이 없을 때 `not_found`

### Tuition Fee 선택

- 2026/27 Full-time International 후보 선택
- UK/Home 값을 International로 선택하지 않음
- 다른 학년도만 있으면 기준 불일치
- 여러 일치 후보면 `multiple_candidates`
- 학년도 없는 금액을 자동 확정하지 않음

### 결과와 저장

- `found` 결과만 copyText 생성
- HTML이 일반 텍스트로 정규화됨
- 기준 변경 시 분석 결과가 stale 상태가 됨
- 새 분석 실패 시 마지막 성공 결과 유지
- 이벤트 100개 제한
- 손상된 저장값 복구

## 13. 실제 Chrome 검증 계획

### P1-0 DOM preflight

1. KCL Nutrition Requirements 페이지에서 실제 DOM을 확인한다.
2. 과정명 요소와 Requirements 섹션 heading 구조를 기록한다.
3. Fees 링크의 실제 접근 가능한 이름과 href를 기록한다.
4. supporting documents 영역의 DOM 구조를 기록한다.
5. 국가 선택 전·South Korea 수동 선택 후 DOM 차이를 기록한다.
6. 필요한 최소 snapshot fixture만 익명·공개 정보로 저장한다.

P1-0에서 실제 Fees 링크를 확인하기 전에는 연결 페이지 요청 코드를 확정하지 않는다.

### 기능 검증

1. KCL Nutrition Requirements 페이지에서 확장 아이콘을 누른다.
2. 자동 분석이 시작되고 Side Panel이 계속 열려 있는지 확인한다.
3. Requirements 페이지에서 확인 가능한 카드가 먼저 채워지는지 확인한다.
4. Fees 링크를 실제 DOM에서 발견했는지 확인한다.
5. 현재 탭이 이동하지 않은 채 Tuition Fee가 채워지는지 확인한다.
6. 2026/27 · Full-time · International 값이 현재 앱 기준과 일치하는지 확인한다.
7. South Korea 미선택 상태의 다음 행동 안내를 확인한다.
8. South Korea를 수동 선택한 뒤 다시 분석해 Korean Academic Requirements를 확인한다.
9. International과 Home 기준에서 각 fee status의 지원 마감일만 선택하는지 확인한다.
10. 각 `found` 카드의 일반 텍스트 복사와 `복사 완료` 상태를 확인한다.
11. 출처 URL과 원문 구간이 각 값과 맞는지 확인한다.
12. 다른 학년도 기준으로 바꿨을 때 Tuition Fee 기준 불일치 경고를 확인한다.
13. 패널을 닫고 다시 열어 마지막 분석 결과가 유지되는지 확인한다.
14. Side Panel과 서비스 워커 콘솔에 처리되지 않은 오류가 없는지 확인한다.

## 14. 구현 순서

### P1-0 — 실제 DOM 고정

- [x] KCL Requirements·Fees DOM 구조 확인
- [x] 과정명, heading, 행, 링크의 안정적인 기준 선택
- [x] 공개 정보만 담은 최소 snapshot fixture 작성

### P1-1 — 상태와 순수 파서

- [x] 추출 상태, 복사 상태, 결과 데이터 구조
- [x] URL·Fees 링크 검증
- [x] KCL snapshot parser
- [x] 앱 기준과 Tuition Fee 후보 비교
- [x] parser 단위 테스트

### P1-2 — 현재 페이지 읽기

- [x] `scripting` 권한 추가
- [x] `activeTab` 현재 탭에 콘텐츠 읽기 함수 실행
- [x] 현재 DOM snapshot 생성
- [x] same-origin Fees 요청과 Fees snapshot 생성
- [x] 연결 실패를 항목별 오류로 변환

### P1-3 — Side Panel 결과 UI

- [x] 분석 진행·완료 요약
- [x] 11개 카드 상태와 값 렌더링
- [x] 출처 자세히 보기
- [x] 사용자 확인 필요 안내
- [x] 기준 불일치 표시
- [x] 항목별 복사

### P1-4 — 로컬 저장과 이벤트

- [x] 마지막 분석 세션 저장·복구
- [x] 분석 실패 시 이전 결과 유지
- [x] 복사·실패 이벤트의 제한된 기록
- [x] 기준 변경 시 stale 처리

### P1-5 — 전체 검증

- [x] 전체 자동 검사
- [x] 실제 KCL DOM과 fixture 추출 규칙 대조
- [x] 로컬 Side Panel fixture의 11개 카드, 복사, stale, Home 재분석 검증
- [ ] 새 확장 코드로 실제 Chrome KCL Side Panel 검증
- [ ] 실제 Side Panel의 복사·키보드·콘솔 오류 확인
- [x] 개발 로그와 Roadmap 업데이트

## 15. Phase 1 완료 기준

다음 조건을 모두 충족해야 Phase 1을 `완료`로 바꾼다.

- KCL Nutrition Requirements 페이지를 지원 페이지로 정확히 인식한다.
- 현재 페이지의 공개 정보를 올바른 11개 카드에 분류한다.
- URL을 추측하지 않고 현재 DOM의 실제 Fees 링크를 발견한다.
- 현재 탭을 이동하지 않고 Fees 페이지를 확인한다.
- 현재 앱 기준과 일치하는 Tuition Fee만 확정한다.
- South Korea 미선택 상태를 잘못된 값이 아니라 사용자 행동 필요 상태로 처리한다.
- Fee status와 입학 연도에 일치하는 Application Deadline만 확정한다.
- `found` 항목을 일반 텍스트로 복사할 수 있다.
- 모든 값에 출처 URL과 원문 구간이 남는다.
- 부분 실패가 다른 성공 결과를 지우지 않는다.
- 마지막 분석 결과가 Side Panel 재실행 후 유지된다.
- 자동 테스트와 실제 Chrome 검증을 통과한다.
- Phase 1에서 추가한 권한이 계획한 최소 범위를 넘지 않는다.
- 오늘자 개발 로그에 구현과 검증 결과를 기록한다.

## 16. Phase 1에서 하지 않을 것

- South Korea 자동 선택
- English Band 상세 점수를 위한 세 번째 페이지 자동 탐색
- 다른 KCL 과정 전체 지원 보장
- SOAS·QMUL 분석
- 결과 직접 수정
- 여러 과정 동시 작업
- 대학·단과대 공통 메모
- 전체 결과 한 번에 복사
- Word 또는 Notion 연결
- 로그인된 King's Apply 분석
- AI 분류나 원문에 없는 내용 생성
- `<all_urls>` 권한

Phase 2는 Phase 1에서 만든 항목 결과와 상태 구조를 유지한 채 SOAS·QMUL의 다른 페이지 구조에서 일반화 가능성을 검증한다.
