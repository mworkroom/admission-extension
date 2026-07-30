# Phase 0 계획서 — Chrome Extension 기본 골격

## 1. Phase 0의 목적

Phase 0에서는 입학요강 정보를 실제로 추출하지 않는다.

이 단계의 목적은 이후 추출 기능을 안전하게 추가할 수 있도록 Chrome 확장 프로그램의 실행 구조, Side Panel 화면, 고정 항목, 앱 전체 기준값, 로컬 저장 구조를 먼저 검증하는 것이다.

Phase 0가 끝나면 다음 질문에 답할 수 있어야 한다.

- 확장 아이콘을 누르면 원하는 탭에 연결된 Side Panel이 안정적으로 열리는가
- 현재 어떤 대학 페이지를 보고 있는지 패널에서 확인할 수 있는가
- 현재 앱이 어느 학년도와 입학 회차를 기준으로 작동하는지 놓치지 않는가
- 11개 확인 항목이 빠짐없이 한 화면에 보이는가
- 다음 단계에서 추출 결과를 넣을 데이터 구조가 준비됐는가

## 2. 사용자 흐름

1. J님이 대학 과정 페이지를 연다.
2. Chrome 툴바의 확장 아이콘을 누른다.
3. 브라우저 오른쪽에 Side Panel이 열린다.
4. 패널 상단에서 현재 앱 기준을 확인한다.
5. 현재 페이지 제목과 URL을 확인한다.
6. 11개 항목 카드가 모두 `분석 전` 상태로 표시된다.
7. 기준을 변경하면 앱 전체에 즉시 저장된다.
8. 다른 탭이나 페이지에서 다시 확장을 열어도 저장한 기준이 유지된다.

Phase 0에서는 카드 내용을 추출하거나 복사하지 않는다.

## 3. 화면 구성

### 3.1 현재 앱 기준

Side Panel 최상단에 항상 표시한다.

```text
현재 앱 기준
2026/27 · 2026년 9월
Full-time · International

[기준 변경]
```

기본값:

- Academic cycle: `2026/27`
- Intake: `September 2026`
- Study mode: `Full-time`
- Fee status: `International`

변경 규칙:

- 기준 변경은 현재 작업만이 아니라 앱 전체에 적용한다.
- 변경 즉시 `chrome.storage.local`에 저장한다.
- 날짜가 바뀌어도 자동으로 다음 학년도로 변경하지 않는다.
- 9월이 아닌 입학 회차를 선택하면 상단에 주의 문구와 `9월 기준으로 되돌리기` 바로가기를 표시한다.
- Phase 0에서는 기준과 페이지 정보의 일치 여부를 판단하지 않는다.

### 3.2 현재 페이지

```text
현재 페이지
Nutrition - Entry Requirements
https://www.kcl.ac.uk/...

[현재 페이지 다시 확인]
```

- 페이지 제목과 URL을 표시한다.
- 긴 URL은 화면에서 줄여 보이되 전체 URL은 접근 가능한 이름과 복사 가능한 값으로 유지한다.
- `현재 페이지 다시 확인`은 현재 활성 탭의 제목과 URL만 다시 읽는다.
- `chrome://`, Chrome Web Store 등 확장이 읽을 수 없는 페이지에서는 이유를 설명한다.

### 3.3 항목 카드

다음 11개 카드를 항상 같은 순서로 표시한다.

1. University
2. Course
3. Entry Requirements
4. Korean Academic Requirements
5. English Requirements
6. Tuition Fee
7. Application Fee
8. University Application Deadline
9. Reference
10. SOP Guideline
11. CV

Phase 0의 카드 예시:

```text
Entry Requirements
○ 분석 전

Phase 1에서 현재 페이지를 분석합니다.
```

- 내부 업무 마감일과 혼동하지 않도록 `Application Deadline`의 내부 키와 화면 의미를 대학 지원 마감일로 고정한다.
- 색상만으로 상태를 구분하지 않고 아이콘과 상태 문구를 함께 사용한다.
- Phase 0에서는 작동하지 않는 복사·수정 버튼을 미리 노출하지 않는다.

## 4. 기술 구조

### 4.1 기본 기술

- Chrome Extension Manifest V3
- 최소 Chrome 버전: 116
- 빌드 도구 없는 Vanilla JavaScript ES Modules
- HTML과 CSS로 구성한 Side Panel
- Node 내장 테스트 러너를 이용한 최소 자동 검사

Chrome 116을 최소 버전으로 두는 이유는 `chrome.sidePanel.open()`을 확장 아이콘 클릭에 맞춰 직접 사용할 수 있기 때문이다.

공식 문서:

- [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- [Chrome activeTab permission](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)

### 4.2 예상 파일 구조

```text
admission-extension/
├─ manifest.json
├─ service-worker.js
├─ sidepanel/
│  ├─ sidepanel.html
│  ├─ sidepanel.css
│  └─ sidepanel.js
├─ shared/
│  ├─ fields.js
│  ├─ basis.js
│  └─ storage.js
├─ tests/
│  ├─ basis.test.js
│  ├─ fields.test.js
│  └─ manifest.test.js
├─ ROADMAP.md
└─ docs/
   ├─ spec/
   │  └─ PHASE_0_PLAN.md
   └─ devlog/
```

Phase 1에서 콘텐츠 스크립트와 페이지 분석 모듈을 추가한다. Phase 0에서는 실제 페이지 본문을 읽는 분석 코드를 만들지 않는다.

### 4.3 Manifest 권한

Phase 0에 필요한 권한:

```json
{
  "permissions": [
    "activeTab",
    "sidePanel",
    "storage"
  ]
}
```

- `sidePanel`: Side Panel 표시
- `activeTab`: J님이 확장 아이콘을 누른 현재 탭의 제목과 URL 확인
- `storage`: 앱 전체 기준값 보관

Phase 0에서는 다음 권한을 요청하지 않는다.

- `<all_urls>`
- 대학 사이트 전체에 대한 고정 host permission
- `tabs`
- `downloads`
- `cookies`

Phase 1에서 현재 페이지에 분석 코드를 주입할 때 `scripting` 권한을 추가한다. 다른 페이지를 뒤에서 가져오는 권한도 KCL 구현 범위를 확인한 뒤 최소 범위로 추가한다.

### 4.4 Side Panel 열기

확장 아이콘 클릭 이벤트에서 바로 Side Panel을 연다.

```js
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ tabId: tab.id });
});
```

중요한 규칙:

- `chrome.action.onClicked`의 사용자 동작 안에서 `sidePanel.open()`을 호출한다.
- 팝업을 함께 등록하지 않는다. 팝업이 있으면 `action.onClicked`가 실행되지 않는다.
- Side Panel을 연 뒤에 권한을 얻으려 하지 않는다.
- 읽을 수 없는 탭은 오류처럼 뭉개지 않고 사용자 안내 상태로 표시한다.

### 4.5 데이터 구조

#### 앱 전체 기준

```js
{
  academicCycle: "2026/27",
  intakeMonth: 9,
  intakeYear: 2026,
  studyMode: "full-time",
  feeStatus: "international",
  updatedAt: "ISO-8601 datetime"
}
```

#### 현재 페이지

```js
{
  tabId: 123,
  title: "Nutrition - Entry Requirements",
  url: "https://www.kcl.ac.uk/...",
  capturedAt: "ISO-8601 datetime"
}
```

#### 항목 정의

```js
{
  key: "entryRequirements",
  label: "Entry Requirements",
  order: 3,
  status: "not_analyzed"
}
```

Phase 0에서 허용하는 카드 상태는 `not_analyzed` 하나다. 추출 성공, 여러 후보, 수정, 다른 페이지, 찾지 못함, 복사 완료 상태는 Phase 1부터 추가한다.

### 4.6 로컬 저장

`chrome.storage.local`에 저장할 Phase 0 데이터:

- 현재 앱 기준
- UI 버전

저장하지 않는 데이터:

- 페이지 본문
- 방문 기록
- 로그인 정보
- Word 문서 정보
- Notion 정보

현재 페이지 제목과 URL은 패널을 열 때 다시 읽으며, Phase 0에서는 장기 기록으로 저장하지 않는다.

## 5. 접근성과 인지 부담 감소

- 본문과 버튼 글자를 작게 만들지 않는다.
- 상단 기준은 스크롤 중에도 놓치지 않게 고정한다.
- 11개 카드는 항상 같은 순서로 표시한다.
- 카드마다 제목, 아이콘, 상태 문구를 함께 사용한다.
- 비활성 기능을 활성 버튼처럼 보이게 만들지 않는다.
- 긴 설명은 기본 화면에서 줄이고 필요한 경우에만 펼친다.
- 키보드 포커스가 눈에 보이게 표시한다.
- 클릭 영역을 텍스트 크기보다 충분히 크게 만든다.
- 성공·주의·오류를 색상만으로 구분하지 않는다.

## 6. 오류와 예외 처리

### 지원하지 않는 페이지

다음 페이지에서는 본문 분석 대신 안내를 표시한다.

- `chrome://` 페이지
- Chrome Web Store
- 확장 프로그램 내부 페이지
- URL을 읽을 수 없는 탭

안내 예시:

```text
이 페이지는 Chrome 보안 제한으로 확인할 수 없습니다.
대학 과정 페이지에서 확장을 다시 눌러주세요.
```

### Side Panel 연결 실패

- 확장 아이콘을 다시 누르는 행동을 안내한다.
- 복구 가능한 연결 대기는 개발자 콘솔 오류가 아니라 UI 안내로 처리한다.
- 패널이 열렸지만 탭 정보가 늦게 도착하면 짧은 로딩 상태를 표시한다.

### 저장 실패

- 기준 변경이 저장되지 않으면 기존 기준을 유지한다.
- 저장 성공처럼 표시하지 않는다.
- 다시 시도할 수 있는 안내를 제공한다.

## 7. 테스트 계획

### 자동 검사

- Manifest가 유효한 JSON인지 확인
- Manifest V3와 최소 Chrome 버전 확인
- 필요한 권한만 포함됐는지 확인
- 11개 항목 키와 순서 확인
- 기본 앱 기준값 확인
- 잘못된 학년도·입학월 입력 거부
- 저장값이 없거나 손상됐을 때 기본값 복구

### Chrome 수동 검증

1. `chrome://extensions`에서 개발자 모드를 켠다.
2. 프로젝트 폴더를 압축 해제된 확장 프로그램으로 불러온다.
3. KCL Requirements 페이지를 연다.
4. 확장 아이콘을 누른다.
5. Side Panel이 오른쪽에 열리는지 확인한다.
6. 현재 페이지 제목과 URL이 맞는지 확인한다.
7. 11개 카드가 정해진 순서로 보이는지 확인한다.
8. 기준을 변경한 뒤 패널을 닫고 다시 열어 값이 유지되는지 확인한다.
9. 다른 대학 탭에서 확장을 열어 현재 페이지 정보가 바뀌는지 확인한다.
10. `chrome://extensions` 페이지에서 제한 안내가 보이는지 확인한다.
11. 콘솔에 처리되지 않은 오류가 없는지 확인한다.

## 8. Phase 0 완료 기준

다음 조건을 모두 충족해야 Phase 0를 `완료`로 바꾼다.

- 확장 프로그램을 Chrome에 설치할 수 있다.
- 확장 아이콘 클릭으로 Side Panel이 안정적으로 열린다.
- 현재 탭의 제목과 URL을 올바르게 표시한다.
- 현재 앱 기준을 변경하고 다시 불러올 수 있다.
- 11개 카드가 빠짐없이 동일한 순서로 보인다.
- 제한된 페이지와 저장 실패를 설명 가능한 상태로 처리한다.
- 자동 검사와 Chrome 수동 검증을 통과한다.
- 실제 추출 기능이 아직 없다는 점을 화면과 문서에서 숨기지 않는다.
- 오늘자 개발 로그에 구현·검증 결과를 기록한다.

## 9. Phase 1로 넘길 것

Phase 0에서 다음 기능을 미리 구현하지 않는다.

- KCL 페이지 본문 분석
- Fees 링크 발견과 백그라운드 요청
- 항목별 복사
- 원문 위치 표시
- 결과 수정
- 추출 실패 기록
- 학교·단과대 공통 메모
- South Korea 자동 선택
- AI 분류

Phase 1은 Phase 0의 고정 카드와 상태 구조 위에 KCL 추출 흐름을 추가한다.
