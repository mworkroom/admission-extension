# Phase 4 실제 Chrome 수동 검증 체크리스트

검증 대상 버전: `0.13.0`

이 체크리스트는 로컬 UI harness로 대신할 수 없는 실제 Chrome Side Panel의 저장 유지, 여러 공식 출처 병합, 직접 입력과 내보내기를 확인한다.

## 1. 준비

- [ ] Chrome 기본 프로필의 `admission-extension`을 다시 로드하고 버전이 `0.13.0`인지 확인한다.
- [x] KCL Nutrition Requirements 페이지가 실제 Chrome에서 열린다.
- [x] SOAS MSc Global Development 페이지가 실제 Chrome에서 열린다.
- [x] QMUL Corporate Finance MSc 페이지가 실제 Chrome에서 열린다.
- [x] Alliance MBS MSc Marketing Entry requirements 페이지가 실제 Chrome에서 열린다.
- [ ] 각 페이지에서 확장 아이콘을 눌러 Side Panel이 열리는지 확인한다.

확장 관리 화면과 Side Panel은 자동 브라우저 제어 대상에 포함되지 않으므로 설치 버전과 아래 동작은 J님이 직접 확인한다.

## 2. KCL 활성 작업과 여러 출처

KCL Nutrition Requirements:

`https://www.kcl.ac.uk/study/postgraduate-taught/courses/nutrition-msc/requirements`

- [ ] `현재 페이지 분석` 후 11개 카드가 표시된다.
- [x] SOP Guideline의 `Yes`와 personal statement 분량 안내는 `확인됨`으로 표시되고 `지원서 확인 필요` 실패 분류가 나타나지 않는다.
- [ ] `이 분석으로 작업 시작`을 누르면 활성 작업이 `Nutrition MSc`로 저장된다.
- [ ] 활성 작업 요약에 `출처 2개`와 `저장값 11개`가 표시된다.
- [ ] Tuition Fee가 현재 DOM에서 발견한 KCL Fees 링크를 출처로 사용한다.
- [ ] Side Panel을 닫았다가 다시 열어도 `Nutrition MSc` 활성 작업과 선택값이 유지된다.
- [ ] 페이지를 새로고침한 뒤 Side Panel을 다시 열어도 활성 작업이 유지된다.

## 3. 직접 입력과 저장 유지

- [ ] Application Fee 또는 Reference 카드의 `직접 입력`을 연다.
- [ ] 기존 페이지 분석값이 사라지지 않는다는 안내를 확인한다.
- [ ] 직접 확인한 값과 선택적 출처를 저장하면 카드의 활성 작업 값에 `직접 입력` origin이 표시된다.
- [ ] Side Panel을 닫았다가 다시 열어도 직접 입력값이 유지된다.
- [ ] `작업 값 복사`가 직접 입력값을 일반 텍스트로 복사한다.

## 4. 다른 과정 보호와 명시적 교체

QMUL Corporate Finance:

`https://www.qmul.ac.uk/postgraduate/taught/coursefinder/courses/corporate-finance-msc/`

- [ ] QMUL 페이지에서 분석해도 기존 KCL 활성 작업이 자동으로 바뀌지 않는다.
- [ ] `새 작업으로 시작…`을 누르면 KCL Nutrition과 QMUL Corporate Finance를 비교하는 `활성 작업 교체` dialog가 열린다.
- [ ] dialog의 초기 초점이 `취소`에 있고 Esc 또는 `취소`로 닫으면 KCL 작업이 유지된다.
- [ ] 다시 dialog를 열어 `교체하고 시작`을 누른 경우에만 활성 작업이 QMUL로 바뀐다.
- [ ] 교체 후 `Corporate Finance MSc`, `출처 2개`, `저장값 11개`가 표시된다.

## 5. SOAS·QMUL 기본 회귀

SOAS MSc Global Development:

`https://www.soas.ac.uk/study/find-course/msc-global-development`

- [ ] SOAS에서 11개 카드가 정해진 순서로 표시된다.
- [ ] Reference는 앱이 바꿔 쓴 요약이 아니라 페이지 원문을 그대로 표시·복사한다.
- [ ] Tuition Fee의 적용 학년도 미확정, English 별도 페이지, SOP 지원서 확인 필요가 서로 다른 상태로 표시된다.

QMUL Corporate Finance:

- [ ] QMUL에서 11개 카드가 정해진 순서로 표시된다.
- [ ] Unibuddy 상담 위젯이 숨겨지고, 설정을 끄면 다시 나타난다.
- [ ] Application Fee의 `찾지 못함` 상태와 다음 확인 안내가 표시된다.
- [ ] 공통 메모를 현재 학년도 확인 완료한 항목은 중복된 `페이지 값 없음` 안내가 숨겨진다.

## 6. Manchester 기본 회귀

Manchester MSc Marketing:

`https://www.alliancembs.manchester.ac.uk/study/masters/msc-marketing/entry-requirements/`

- [ ] 현재 페이지가 `Manchester 과정 페이지를 정밀 분석할 수 있습니다.`로 표시된다.
- [ ] `현재 페이지 분석` 후 11개 카드가 정해진 순서로 표시된다.
- [ ] Korean Academic Requirements에 `3.3/4.3 or 3.5/4.5`가 표시된다.
- [ ] English Requirements에 `IELTS 7.0 overall`과 각 영역 `6.5`가 표시된다.
- [ ] Tuition Fee `£33,100`, Application Fee `£60`, University Application Deadline `5 July 2026`가 각각 해당 공식 페이지 출처와 함께 표시된다.
- [ ] Reference는 최초 지원 시 필수 아님, SOP는 필수·1페이지 이내, CV는 학부 졸업 후 경력 2년 초과 시 필수라는 원문이 표시된다.
- [ ] 11개 카드와 출처 버튼에 가로 스크롤이 생기지 않는다.

## 7. 미등록 대학 generic 분석

University of Bristol MSc Marketing:

`https://www.bristol.ac.uk/study/postgraduate/taught/msc-marketing/`

- [ ] 네 학교만 지원한다는 차단 문구가 나타나지 않는다.
- [ ] `bristol.ac.uk 페이지를 일반 분석할 수 있습니다.`와 실패 기록 안내가 표시된다.
- [ ] `현재 페이지 분석` 후 University `University of Bristol`, Course `MSc Marketing`과 Entry Requirements 원문이 표시된다.
- [ ] English Requirements는 학교의 별도 영어 조건 페이지 링크를 출처로 표시한다.
- [ ] Tuition Fee는 `£33,900`을 남기되 적용 학년도 근거가 없어 `확인 필요`로 표시한다.
- [ ] 찾지 못한 항목도 11개 카드에서 유지되고 `사이트 구조` 실패 기록에 포함된다.
- [ ] `이 분석으로 작업 시작`을 누르면 `bristol-ac-uk` 학교 키와 `msc-marketing` 과정 키로 활성 작업이 저장된다.
- [ ] 다른 미등록 대학의 일반 HTTPS 과정 페이지에서도 분석 버튼이 활성화된다.

## 8. 기록·요약·내보내기

- [ ] 분석, 직접 입력, 수정과 복사를 수행하면 `기록 N개`가 늘어난다.
- [ ] 추출 실패 수와 학교·항목별 실패 요약이 실제 행동 기록에 맞게 표시된다.
- [ ] `활성 작업 JSON`을 누르면 `.json` 파일이 다운로드된다.
- [ ] JSON에 `format`, export schema version, 내보낸 시각과 전체 활성 작업이 포함된다.
- [ ] `실사용 기록 CSV`를 누르면 `.csv` 파일이 다운로드된다.
- [ ] CSV를 Excel에서 열었을 때 한글·파운드 기호가 깨지지 않고 14개 열이 유지된다.
- [ ] 내보내기 뒤에도 활성 작업과 Side Panel 상태가 바뀌지 않는다.

## 9. 430px Side Panel

- [ ] 상단 기준 패널이 화면에 고정되지 않고 일반 스크롤로 함께 올라간다.
- [ ] 활성 작업 상자, 내보내기 버튼, 실패 요약과 11개 카드에 가로 스크롤이 생기지 않는다.
- [ ] 직접 입력·과정 교체 dialog의 버튼과 입력란이 잘리지 않는다.
- [ ] 키보드만으로 주요 버튼, 입력란, dialog 취소와 확정에 접근할 수 있다.

## 10. 검증 결과

- 검증 일시:
- Chrome 버전:
- 확장 버전:
- 통과하지 못한 항목:
- Phase 4 완료 판단:
