# 🎃 2026 부산대학교 총학생회 할로윈 페스타: 넉터의 밤
> **부산대학교(PNU) 학생회 할로윈 이벤트 페이지 & 그로스해킹(Growth Hacking) 데이터 수집 플랫폼**  
> Supabase MCP 연동 데이터베이스 & GitHub Pages 배포 지원

---

## 📌 1. 프로젝트 개요

본 프로젝트는 **부산대학교 제56대 총학생회**의 할로윈 축제 **「효원 할로윈 페스타: 넉터의 밤」**을 위한 공식 이벤트 웹사이트이자, 학우들의 유입부터 최종 티켓/굿즈 패키지 구매 및 학생 인증까지의 전 과정을 추적·분석할 수 있는 **그로스해킹(Growth Hacking) 데이터 수집 및 분석 시스템**입니다.

- **행사 일시**: 2026년 10월 31일(금) 18:00 ~ 23:00
- **행사 장소**: 부산대학교 넉넉한터(넉터) 잔디광장 및 시월광장
- **핵심 상징**: 부산대학교 공식 마스코트 **‘산지니’(Sanjini)** 할로윈 에디션, 효원 야외 호러 방탈출, 코스튬 콘테스트 실시간 투표

---

## 🚀 2. 그로스해킹 데이터 수집 핵심 기능

### 📉 1) 5단계 퍼널별 이탈율(Drop-off Rate) 수집 & 분석
유저 여정을 5단계 퍼널로 표준화하여 각 단계별 도달 수, 이전 단계 대비 **이탈율(Drop-off %)**, 전체 기준 **전환율(Conversion Rate %)**을 Supabase에 실시간 기록합니다.

| 퍼널 단계 | 단계 명칭 | 이벤트 트리거 조건 | 수집 데이터 |
| :---: | :--- | :--- | :--- |
| **Step 1** | **메인 랜딩 진입 (Landing View)** | 페이지 접속 즉시 자동 기록 | 세션 ID, UTM, 기기, 뷰포트 |
| **Step 2** | **굿즈/티켓 탐색 (Explore Packages)** | 패키지/프로그램 섹션 스크롤 도달 시 | 체류 시간, 스크롤 깊이 |
| **Step 3** | **주문서 작성 시작 (Checkout Start)** | 베이직/스푸키/VIP 패키지 선택 버튼 클릭 | 선택 패키지 ID, 가격 |
| **Step 4** | **부산대 학생 인증 (Student Verified)** | 학번(8~10자리), 이름, 학과, 휴대폰 입력 완료 | 학번 앞 4자리, 단과대/학과 |
| **Step 5** | **구매/발권 완료 (Purchase Complete)** | 카카오페이/토스페이 결제 승인 & 모바일 티켓 발급 | 고유 주문번호, 결제금액, 수단 |

> **💡 병목 구간 자동 감지(Bottleneck Detection)**  
> 대시보드에서 직전 단계 대비 이탈율이 가장 높은 구간을 찾아내고(예: 학번 인증 단계 3➔4 이탈), 전환율 개선을 위한 마케팅/UX 인사이트(예: 에브리타임 간편 인증 연동 제안)를 자동으로 제시합니다.

---

### 🖱️ 2) 버튼별 클릭 횟수 (CTA Performance Tracking)
- 사이트 내 모든 주요 버튼(`data-track-id`)의 클릭을 감지하여 고유 버튼 ID, 버튼명, 위치, 클릭 시각을 집계합니다.
- 대시보드의 **‘버튼별 클릭 횟수 TOP 순위’** 차트를 통해 어떤 CTA가 학우들의 액션을 유도하는지 한눈에 파악할 수 있습니다.
  - `btn-hero-reserve` (1차 얼리버드 한정 패키지 신청)
  - `btn-pkg-basic`, `btn-pkg-spooky`, `btn-pkg-vip` (패키지별 선택 클릭)
  - `btn-vote-candidate` (코스튬 콘테스트 후보별 투표 클릭)
  - `btn-share-copy` (에브리타임 링크 복사)

---

### 💰 3) 구매 전환율 & 커머스 KPI
- **최종 구매 전환율 (Overall Conversion Rate)**: `(총 구매 완료 세션 / 총 방문 세션) * 100%`
- **총 매출액 (Gross GMV)**: 무료/유료 티켓 패키지 총 결제액
- **평균 주문 가치 (AOV / 객단가)**: 유료 결제 건당 평균 매출
- **잔여 좌석 FOMO 카운터**: 실시간 티켓 잔여량 시뮬레이션을 통해 구매 결정을 촉진

---

### 🌐 4) 유입 채널별(UTM Source) 전환 기여도
홍보 채널별 전용 링크를 통해 어느 채널이 가장 많은 방문자와 실제 구매자를 창출했는지 추적합니다.
- `utm_source=everytime`: 에브리타임 게시판 홍보글
- `utm_source=instagram`: 총학생회 공식 인스타그램 (@pnu_student) 스토리
- `utm_source=campus_qr`: 학생회관 / 순환버스 정류장 대자보 포스터 QR코드
- `utm_source=kakaotalk`: 단과대/학과 카카오톡 공지방
- `utm_source=direct`: 직접 URL 입력

---

### ⚖️ 5) A/B 테스트 성과 자동 비교
- **Variant A (전통 축제 감성)**: "2026 부산대학교 효원 할로윈 페스타: 넉터의 밤"
- **Variant B (50% 할인 & FOMO 긴박감)**: "단 하루 50% 한정 넉터의 밤 효원 호러 페스타"
- 50:50 비율로 사용자에게 무작위 배정되며, 각 변형별 방문자 수와 최종 구매 전환율을 비교하여 우세 변형을 판별합니다.

---

### ⚡ 6) 가상 학생 트래픽 시뮬레이터 (Demo Traffic Generator)
- 대시보드 상단의 **「가상 학생 30명 트래픽 시뮬레이션」** 버튼 클릭 시, 현실적인 전환율과 이탈율을 반영한 30명의 학생 여정 데이터(방문 ➔ 클릭 ➔ 탐색 ➔ 인증 ➔ 결제)가 실제 Supabase DB에 일괄 생성되어 시연 및 분석이 즉시 가능합니다.

---

## 🗄️ 3. Supabase 데이터베이스 구조

본 프로젝트는 Supabase MCP를 통해 원격 PostgreSQL 인스턴스와 직접 연동되어 있습니다.

- **Supabase Project URL**: `https://erxywsykhsceqyrtsvdm.supabase.co`
- **테이블 구성**:
  1. `analytics_events`: 모든 세션, 페이지뷰, 5단계 퍼널, 버튼 클릭, 스크롤 깊이 이벤트 저장
  2. `orders`: 학생 인증 정보, 주문번호(`PNU-HW-XXXXXX`), 선택 패키지, 결제 상태 저장
  3. `costume_votes`: 코스튬 콘테스트 학우 투표 데이터 저장
- **PostgreSQL 집계 RPC**:
  - `public.get_growth_metrics()`: 퍼널 이탈율, 버튼 클릭 순위, UTM 기여도, A/B 테스트 지표를 단 1회의 쿼리로 고속 연산하여 JSON으로 반환

---

## 🌐 4. GitHub Pages 배포 가이드

본 프로젝트는 별도의 Node 서버 없이 정적 호스팅(GitHub Pages)에서 100% 작동하도록 설계되었습니다.

### 방법 A: GitHub Settings에서 1클릭 활성화
1. GitHub 저장소에 코드를 푸시합니다:
   ```bash
   git add .
   git commit -m "feat: 부산대학교 총학생회 할로윈 그로스해킹 사이트 완성"
   git remote add origin https://github.com/<사용자명>/<저장소명>.git
   git push -u origin master
   ```
2. GitHub 저장소 페이지의 **Settings** 탭으로 이동합니다.
3. 좌측 메뉴에서 **Pages**를 클릭합니다.
4. **Build and deployment** 항목의 **Source**를 `Deploy from a branch`로 선택합니다.
5. Branch를 `master` (또는 `main`), 폴더를 `/ (root)`로 지정하고 **Save**를 누릅니다.
6. 1~2분 후 `https://<사용자명>.github.io/<저장소명>/` 주소로 즉시 라이브 배포됩니다!

### 방법 B: GitHub Actions 자동 배포
- `.github/workflows/deploy.yml` 파일이 이미 포함되어 있어, 브랜치 푸시 시 Actions가 자동으로 Pages 환경에 배포합니다.

---

## 💻 5. 로컬 실행 및 테스트 방법

웹 브라우저에서 `index.html`을 바로 열거나, 아래 로컬 서버 명령어로 실행할 수 있습니다:

```bash
# Python으로 로컬 서버 실행 (포트 8000)
python -m http.server 8000

# 또는 npx serve
npx serve .
```

브라우저에서 `http://localhost:8000` 접속 후:
- 우측 상단 **[그로스 데이터]** 버튼을 눌러 실시간 대시보드 확인
- **[가상 학생 30명 트래픽 시뮬레이션]** 버튼을 눌러 실제 DB 데이터 유입 및 퍼널 차트 확인
- 패키지 예약 버튼을 눌러 1단계부터 5단계까지의 실제 발권 플로우 체험 가능
