# Phase 3 계획서 — 대학·단과대 공통 메모

## 1. 목적

과정 페이지마다 반복해서 찾는 대학 전체 또는 School·Faculty 공통 정보를 로컬 메모로 저장하고, 현재 과정 분석 결과와 함께 확인한다.

메모 대상은 다음 다섯 항목이다.

1. English Requirements
2. Application Fee
3. University Application Deadline 안내
4. Reference
5. SOP Guideline

공통 메모는 페이지 추출값을 대신하지 않는다. 현재 과정 페이지가 제공하는 더 구체적인 값을 항상 먼저 표시하고, 메모는 별도 근거와 확인 상태를 가진 보조 정보로 표시한다.

---

## 2. 시작 상태

- Phase 1 KCL 과정 추출 완료
- Phase 2 KCL·SOAS·QMUL 공통 snapshot과 parser 완료
- 확장 버전 `0.3.1` 실제 Chrome 검증 완료
- 현재 권한: `activeTab`, `scripting`, `sidePanel`, `storage`
- 저장 위치: `chrome.storage.local`
- 외부 서버, 로그인, Notion 연동 없음

Phase 3에서도 권한을 추가하지 않는다.

현재 구현 상태:

- P3-0 schema와 순수 resolver 완료
- P3-1 `chrome.storage.local` 저장 계층 완료
- P3-2 공통 메모 조회 UI 완료
- P3-3 대학 전체 확인한 사항 추가·수정 UI 완료
- P3-4 학년도 확인 완료 처리와 재확인 상태 UI 완료
- P3-5 확인 dialog와 삭제 후 화면·저장 동기화 완료
- P3-6 자동·430px 회귀와 실제 Chrome 수동 검증 대부분 완료
- 실제 Chrome에서 발견된 새 학년도 재확인 UI 누락을 `0.7.1`에서 보강
- 현재 확장 버전: `0.7.1`
- 다음 작업: 실제 Chrome `0.7.1` 재확인

---

## 3. 포함 범위

- 대학 전체 메모
- School·Faculty 범위 메모
- 메모 값
- 출처 URL
- 출처 설명
- 적용 범위
- 학년도별 확인 기록
- 마지막 수정일과 마지막 확인일
- 현재 과정 결과와 공통 메모의 동시 표시
- 값 불일치 표시
- 현재 학년도 확인 완료 수동 처리
- 다음 학년도에 재확인 필요 상태
- 메모 추가·수정
- 메모 삭제 전 확인
- 로컬 저장 검증과 손상 데이터 격리

## 4. 제외 범위

- 과정 페이지에서 메모 자동 생성
- 페이지 추출 결과로 기존 메모 자동 덮어쓰기
- Notion 또는 외부 데이터베이스 동기화
- 여러 기기 동기화
- 대학 71개 전체 일괄 입력
- CSV 일괄 가져오기
- AI 요약 또는 의미상 동일성 판정
- School·Faculty 이름 fuzzy match
- 로그인된 지원 시스템 읽기
- 대학 공통 정보가 과정별 예외보다 우선하도록 만들기

---

## 5. 메모 항목

### 5.1 English Requirements

저장 가능한 형태:

- `English language band: B`
- `Band 4`
- `IELTS 6.5 overall with 6.0 in each component`
- 별도 공통 English requirements 링크

일반 안내 문단은 저장하지 않는다. 점수, band 또는 확인 링크 중심으로 간결하게 저장한다.

### 5.2 University Application Deadline 안내

저장 가능한 형태:

- 대학 전체 해외 지원자 권장 마감일
- School·Faculty 공통 마감 안내
- 공식적으로 공통 적용된 특정 입학 회차 마감일
- 아직 미정이라는 공식 안내

장학금, 기숙사, 비자, deposit 마감일은 저장하지 않는다.

과정별 마감일이 따로 있으면 과정 페이지 값을 위에 표시한다.

---

## 6. 적용 범위

### 6.1 University

`siteKey`를 대학 식별자로 사용한다.

예:

- `kcl`
- `soas`
- `qmul`

같은 `siteKey`의 다른 과정에서도 재사용할 수 있다.

### 6.2 School 또는 Faculty

다음 값을 별도로 저장한다.

- 범위 종류: `school` 또는 `faculty`
- 화면 표시명
- 정규화된 범위 키

예:

```json
{
  "scopeType": "school",
  "scopeKey": "school-of-economics-and-finance",
  "scopeLabel": "School of Economics and Finance"
}
```

School·Faculty 범위는 정확히 확인된 이름만 사용한다. 페이지 adapter가 조직명을 제공하지 않는 학교에서는 University 범위만 입력·연결하고, School·Faculty 입력은 열지 않는다.

URL이나 과정명만으로 School·Faculty를 추정하지 않는다.

---

## 7. 저장 구조

새 저장 키:

```text
commonMemoStore
```

초기 schema:

```json
{
  "schemaVersion": 1,
  "records": [
    {
      "id": "qmul::school::school-of-economics-and-finance::englishRequirements",
      "siteKey": "qmul",
      "universityName": "Queen Mary University of London",
      "scopeType": "school",
      "scopeKey": "school-of-economics-and-finance",
      "scopeLabel": "School of Economics and Finance",
      "fieldKey": "englishRequirements",
      "value": "Band 4: IELTS 6.5 overall with 6.0 in each component",
      "sourceUrl": "https://...",
      "sourceLabel": "English language requirements",
      "updatedAt": "2026-07-31T00:00:00.000Z",
      "verificationByCycle": {
        "2026/27": {
          "verifiedAt": "2026-07-31T00:00:00.000Z",
          "verifiedValue": "Band 4: IELTS 6.5 overall with 6.0 in each component",
          "sourceUrl": "https://..."
        }
      }
    }
  ]
}
```

저장하지 않는 것:

- 페이지 전체 HTML
- 전체 국가 목록
- 브라우저 방문 기록
- 자동 수집한 본문 전문
- 로그인 정보

---

## 8. 학년도 확인 상태

현재 앱 기준 `academicCycle`과 `verificationByCycle`을 비교해 상태를 계산한다.

### `confirmed`

- 현재 학년도 확인 기록이 있음
- 확인 당시 값과 현재 메모 값이 같음

### `needs_review`

- 값은 있지만 현재 학년도 확인 기록이 없음
- 새 학년도로 기준이 바뀜

### `changed_after_verification`

- 현재 학년도 확인 후 메모 값이 수정됨
- 다시 확인해야 함

### `unverified`

- 확인 기록이 한 번도 없음

학년도가 바뀌어도 값과 이전 확인 기록을 삭제하지 않는다.

---

## 9. 메모 선택 우선순위

현재 과정에 연결할 메모 순서:

1. 정확히 일치하는 School·Faculty 메모
2. 대학 전체 메모

둘 다 있으면 둘 다 보존하되 더 구체적인 School·Faculty 메모를 위에 표시한다.

School·Faculty를 확인하지 못한 과정에서는 대학 메모만 자동 연결한다.

모호한 범위를 임의 선택하지 않는다.

---

## 10. 현재 페이지 값과 비교

비교 대상:

- English Requirements
- Application Fee
- University Application Deadline
- Reference
- SOP Guideline

비교 규칙:

1. 공백과 줄바꿈만 정규화한다.
2. 완전히 같으면 `페이지와 메모가 같음`.
3. 다르면 `페이지 값과 공통 메모가 다름`.
4. 의미가 비슷하다는 이유로 자동 일치 처리하지 않는다.
5. 페이지 값과 메모 값을 모두 표시한다.
6. 페이지 추출 상태를 변경하지 않는다.
7. Reference와 SOP Guideline의 설명·복사·출처에는 페이지 원문을 유지하고 앱이 바꿔 쓴 문장을 넣지 않는다.

표시 순서:

1. 현재 과정 페이지 값
2. 정확한 School·Faculty 메모
3. 대학 전체 메모

---

## 11. Side Panel UI

공통 메모를 별도 섹션으로 분리하지 않는다. 다섯 대상 분석 카드 안에서 페이지 결과 바로 아래에 `확인한 사항`으로 표시한다.

### 페이지 결과 영역

- 현재 과정 페이지에서 추출한 값과 상태
- 페이지 출처
- 별도 안내 페이지 링크가 있으면 바로 열 수 있는 링크
- 페이지 값 복사

### 확인한 사항 블록

- `확인한 사항` 제목
- 적용 범위
- 값
- 메모 출처 확인
- 마지막 확인일
- 적용 학년도
- 상태 아이콘과 문구
- 복사
- 수정
- `이번 학년도 확인 완료`
- 현재 페이지 값과 같음·다름 또는 페이지에 구체적인 값이 없음을 표시

표시 순서:

1. 과정 페이지 값 또는 `별도 페이지 확인 필요`
2. 별도 페이지 URL이 있으면 바로가기
3. 페이지 출처와 복사
4. 같은 항목의 `확인한 사항`

### 메모 편집 dialog

입력:

- 항목과 현재 대학
- 값
- 출처 URL
- 출처 설명

현재 과정 분석 결과에는 정확한 School·Faculty 식별자가 없다. 따라서 첫 입력 UI는 현재 대학의 University 범위만 저장한다. 데이터 schema와 resolver는 School·Faculty를 계속 지원하지만, 과정명이나 URL로 조직 범위를 추정해 저장하는 UI는 제공하지 않는다.

저장 전 검증:

- 지원하는 field key인지
- 현재 대학과 같은 `siteKey`인지
- URL이 `http:` 또는 `https:`인지
- 값이 비어 있지 않은지
- 같은 id가 이미 존재하는지

기존 id가 있으면 새 항목을 만들지 않고 수정임을 명확히 표시한다.

### 삭제

메모 삭제는 별도 확인 dialog를 거친다.

삭제 대상:

- 메모 현재 값
- 해당 메모의 학년도별 확인 기록

삭제 후 자동 복구는 제공하지 않으므로 정확한 범위와 항목명을 확인 문구에 표시한다.

---

## 12. 페이지 결과와 메모의 경계

메모가 할 수 있는 것:

- 페이지에서 못 찾은 공통 안내를 함께 보여주기
- 반복 확인 링크 제공
- 현재 학년도 확인 여부 표시
- 복사 제공

메모가 할 수 없는 것:

- `not_found` 페이지 결과를 `found`로 변경
- 페이지 출처를 메모 출처로 교체
- 다른 과정의 deadline을 현재 과정 deadline으로 확정
- 다른 School·Faculty 메모를 자동 적용
- 학년도 미확인 값을 확정값처럼 표시

---

## 13. 저장 실패와 손상 데이터

- 저장 전 전체 record를 검증한다.
- 손상된 record 하나 때문에 전체 메모를 버리지 않는다.
- 유효한 record만 불러오고 제외 개수를 안내한다.
- 저장 실패 시 기존 저장값과 현재 화면을 유지한다.
- 편집 dialog를 닫지 않고 오류를 표시한다.
- schema가 알 수 없는 상위 버전이면 자동 변환하지 않는다.

---

## 14. 자동 테스트

### schema와 저장

- University 메모 저장·로드
- School·Faculty 메모 저장·로드
- 잘못된 URL 거부
- 지원하지 않는 field key 거부
- 손상 record 격리
- 저장 실패 시 기존 값 유지

### 학년도

- 현재 학년도 확인 완료
- 새 학년도에서 `needs_review`
- 값 수정 후 `changed_after_verification`
- 이전 학년도 기록 유지

### resolver

- 정확한 School 메모 우선
- Faculty 메모 우선
- 조직명 미확인 시 대학 메모만
- 다른 대학 메모 미적용
- 모호한 범위 미선택

### 충돌 표시

- 페이지와 메모 동일
- 페이지와 메모 다름
- 페이지 값 없음
- 메모 값 없음
- School과 University 메모 동시 표시

### 회귀

- 기존 33개 테스트 유지
- KCL, SOAS, QMUL 분석 결과 변화 없음
- 기존 복사와 stale 동작 유지
- 권한 변화 없음

---

## 15. 실제 Chrome 검증

1. QMUL School of Economics and Finance English 메모를 저장한다.
2. 같은 School의 다른 과정에서 메모가 보이는지 확인한다.
3. 대학 전체 메모와 School 메모가 함께 있을 때 School 메모가 위에 보이는지 확인한다.
4. 과정 페이지 English 값과 메모가 다르면 둘 다 보이는지 확인한다.
5. `이번 학년도 확인 완료` 후 패널을 닫고 다시 열어 상태가 유지되는지 확인한다.
6. Academic cycle을 다음 학년도로 바꿔 값은 남고 `재확인 필요`로 바뀌는지 확인한다.
7. 다시 이전 학년도로 바꾸면 기존 확인 기록이 남아 있는지 확인한다.
8. 저장 실패 fixture에서 기존 메모가 유지되는지 확인한다.
9. KCL, SOAS, QMUL 기존 분석과 복사가 그대로 동작하는지 확인한다.

---

## 16. 구현 순서

### P3-0 — schema와 순수 resolver

- 메모 field와 scope 상수
- schema validator
- 학년도 확인 상태 계산
- scope resolver
- 페이지 값 충돌 비교
- fixture와 단위 테스트

### P3-1 — 로컬 저장

- `commonMemoStore` 키
- load/save
- 손상 record 격리
- schema version 처리
- 저장 실패 테스트

### P3-2 — 조회 UI

- [x] English Requirements·Application Fee·University Application Deadline·Reference·SOP Guideline 카드 내부 연결
- [x] `확인한 사항` 인라인 블록
- [x] 학년도 확인 상태·출처·복사
- [x] 페이지 값과 같음·다름 표시
- [x] 별도 안내 페이지 직접 열기
- [x] 읽기 실패, 상위 schema, 손상 record 안내
- [x] 별도 `03 공통 메모` 섹션 제거

현재 과정 분석에는 정확한 School·Faculty 식별자가 없으므로 P3-2 화면은 University 범위 메모만 연결한다. School·Faculty 메모를 과정명이나 URL에서 추정하지 않으며, schema와 resolver 지원만 유지한다.

### P3-3 — 추가·수정 UI

- [x] 대상 항목 카드의 추가 버튼
- [x] 기존 확인한 사항의 수정 버튼
- [x] University 범위 편집 dialog
- [x] 값·http/https 출처 URL 입력 검증
- [x] 같은 id를 신규 생성하지 않고 기존 record 수정
- [x] 수정 시 기존 학년도 확인 기록 유지
- [x] 저장 오류 시 dialog와 기존 화면 유지
- [x] 항목별 입력 예시와 현재 페이지 출처 기본값
- [x] Reference·SOP Guideline 비교 시 원문 excerpt 우선 사용
- [ ] School·Faculty 입력 — 정확한 조직 식별자를 제공하는 adapter가 준비될 때까지 보류

School·Faculty 메모를 수동으로 저장한 뒤 현재 과정에 적용 여부를 판정할 근거가 없으면 저장 직후 화면에서 사라지거나 다른 과정에 잘못 붙을 수 있다. 이 상태에서는 입력 기능을 열지 않고 University 범위만 완성한다.

### P3-4 — 학년도 확인

- [x] 미확인·재확인 필요·확인 후 변경 메모에 `이번 학년도 확인 완료` 제공
- [x] 현재 메모 값·출처 URL·확인 시각을 현재 `academicCycle` 기록으로 저장
- [x] 확인 성공 후 상태·최근 확인일을 즉시 갱신하고 확인 버튼 숨김
- [x] 새 학년도에서 값과 이전 기록을 유지한 채 `재확인 필요` 표시
- [x] 이전 학년도로 돌아가면 기존 확인 기록과 `이번 학년도 확인` 상태 복원
- [x] 확인 후 값 또는 출처가 수정되면 `확인 후 변경`과 재확인 버튼 표시
- [x] 저장 실패 시 기존 메모와 확인 기록 유지
- [x] 430px 로컬 Side Panel harness에서 동작·배치·가로 넘침 검증

실제 Chrome 확장 재로딩과 실사이트 확인은 P3-4 구현 시점에는 진행하지 않았다.

### P3-5 — 삭제

- [x] 수정·복사와 구분되는 삭제 버튼 제공
- [x] 별도 확인 dialog에서 대학·항목·적용 범위·현재 값 표시
- [x] 학년도별 확인 기록 개수와 함께 삭제됨을 명확히 안내
- [x] 삭제 후 자동 복구할 수 없다는 경고 표시
- [x] 기본 초점을 취소에 두고 삭제 중 중복 실행·닫기 방지
- [x] 취소 시 메모 값과 학년도별 확인 기록 유지
- [x] 저장 성공 후 해당 record만 제거하고 카드에 추가 버튼 복원
- [x] 저장 실패 시 dialog, 기존 메모와 확인 기록 유지
- [x] 430px 로컬 Side Panel harness에서 dialog·취소·삭제·실패·가로 넘침 검증

실제 Chrome 확장 재로딩과 실사이트 삭제 확인은 P3-5 구현 시점에는 진행하지 않았다.

### P3-6 — 전체 검증

- [x] 전체 JavaScript 문법 검사와 자동 테스트
- [x] KCL·SOAS·QMUL 430px 로컬 Side Panel UI 회귀
- [x] 저장 실패 시 기존 메모와 확인 기록 유지
- [x] native dialog의 접근성 이름, 초기 포커스와 명시적 취소 경로 자동 검사
- [x] 실제 Chrome에서 KCL·SOAS·QMUL 과정 탭 연결과 KCL 원문 DOM 확인
- [x] 실제 Chrome Side Panel의 대학 메모 재사용과 패널 재오픈 저장 유지
- [x] 실제 Chrome Side Panel의 삭제 영구 반영
- [ ] 실제 Chrome `0.7.1`에서 학년도 전환·복귀와 재확인 UI 재검증
- [x] 실제 Chrome에서 키보드만으로 추가·수정·확인 완료·삭제 dialog 이동과 취소
- [x] 실제 Chrome 수동 검증 체크리스트 작성
- [x] Roadmap과 개발 로그에 P3-6 부분 완료 상태 기록

J님의 실제 Chrome 수동 검증에서 학년도 전환 항목 하나를 제외한 체크리스트가 통과했다. `2027/28` 전환 후 값은 유지되지만 `재확인 필요`와 새 확인 버튼이 보이지 않는 문제가 보고되어, `0.7.1`에서는 기준 저장 직후 학년도 의존 UI를 먼저 다시 그리도록 보강했다. 또한 현재 학년도에 확정한 메모가 페이지의 구체값 없음 상태를 대체할 때는 `찾지 못함`과 중복 안내를 숨기고, 상단 기준 패널의 sticky를 해제했다.

로컬 430px harness에서는 확정 Application Fee의 중복 안내가 사라지고, `2027/28` 전환 시 `재확인 필요`와 `이번 학년도 확인 완료` 버튼이 복원되는 것을 확인했다. 실제 Chrome `0.7.1` 재검증은 아직 진행하지 않았으므로 Phase 3은 완료로 전환하지 않는다.

---

## 17. 완료 기준

- 같은 대학의 다른 과정에서 University 메모를 재사용한다.
- 정확한 조직 식별자가 제공될 때만 School·Faculty 메모를 대학 메모와 구분하며, 조직을 모르면 대학 메모만 연결한다.
- 현재 과정 페이지 값을 항상 우선 표시한다.
- 페이지 값과 메모가 다르면 둘 다 표시한다.
- 현재 학년도 확인 여부를 바로 알 수 있다.
- 새 학년도에서 값은 유지되고 재확인 상태가 된다.
- 이전 학년도 확인 기록을 잃지 않는다.
- 메모 추가·수정·삭제가 명확한 확인 절차를 가진다.
- 손상 데이터와 저장 실패가 기존 메모를 훼손하지 않는다.
- 기존 KCL·SOAS·QMUL 분석을 깨뜨리지 않는다.
- 권한을 추가하지 않는다.
- 자동 검사와 실제 Chrome 검증을 통과한다.

---

## 18. Phase 4로 넘길 것

- 여러 과정 작업 목록
- 과정별 완료 상태
- 탭 간 작업 전환
- 실사용 실패·수정·복사 기록 집계
- 반복 실패를 학교 adapter 개선 후보로 묶기
- 메모 CSV 일괄 입력 필요성 판단

Phase 3에서는 한 번에 현재 과정 하나와 연결된 공통 메모만 다룬다.
