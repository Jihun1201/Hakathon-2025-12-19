Hakathon-2025-12-19
2025-12-19 카이로스 교내 해커톤 1조(탐나조)

🤖 MascotTalk Tutor
AI 튜터와 함께하는 외국어 회화 연습 웹 애플리케이션

음성으로 대화하고, 실시간 피드백을 받아보세요!

✨ 주요 기능
🎙️ 음성 인식 - 마이크로 말하면 자동 텍스트 변환
🤖 AI 튜터 - Gemini 기반 자연스러운 대화
✏️ 실시간 피드백 - 문법 교정 & 더 나은 표현 추천
🌍 다국어 지원 - 영어, 일본어, 중국어, 스페인어 등
📚 단어장 - 학습한 표현 저장 및 복습
📊 학습 통계 - 연속 학습일, 진도 추적
🛠️ 기술 스택
Python Flask SQLite Google Gemini API Web Speech API

MascotTalk Tutor
AI 기반 외국어 회화 학습 웹 애플리케이션

프로젝트 구조
mascot-tutor/
├── app.py                    # Flask 앱 진입점
├── config.py                 # 설정 (API 키, 언어 설정 등)
├── requirements.txt          # Python 의존성
│
├── models/                   # 데이터 모델 레이어
│   ├── __init__.py          # 모델 패키지 초기화 및 export
│   ├── database.py          # DB 연결 및 스키마
│   ├── user.py              # 사용자 관련 모델
│   ├── conversation.py      # 대화 관련 모델
│   ├── message.py           # 메시지/피드백 모델
│   └── favorite.py          # 찜/단어장 모델
│
├── services/                 # 비즈니스 로직
│   ├── __init__.py          # 서비스 패키지 초기화
│   └── ai_service.py        # Gemini AI 연동
│
├── routes/                   # API 라우트
│   ├── __init__.py          # 블루프린트 등록
│   ├── auth.py              # 인증 API
│   ├── conversation.py      # 대화/메시지 API
│   └── favorite.py          # 찜/단어장 API
│
├── static/
│   ├── css/                 # 스타일시트 (모듈화)
│   │   ├── style.css        # 메인 (모든 CSS import)
│   │   ├── base.css         # 기본 스타일, 리셋
│   │   ├── auth.css         # 인증 페이지
│   │   ├── tutor.css        # 튜터 페이지 레이아웃
│   │   ├── rightbar.css     # 오른쪽 사이드바
│   │   ├── pages.css        # 찜/단어장/리포트/설정
│   │   └── components.css   # 모달, 반응형
│   │
│   └── js/                  # JavaScript (모듈화)
│       ├── app.js           # 메인 앱 초기화
│       ├── config.js        # 설정, 상수
│       ├── utils.js         # 유틸리티 함수
│       ├── auth.js          # 인증 기능
│       ├── speech.js        # 음성 인식/TTS
│       ├── conversation.js  # 대화 관리
│       ├── favorites.js     # 찜/단어장
│       └── pages.js         # 리포트/설정/통계
│
└── templates/
    ├── base.html              # 기본 레이아웃 (head, scripts)
    ├── index.html             # 메인 (모든 페이지 include)
    │
    ├── pages/                 # 페이지별 분리
    │   ├── auth.html          # 로그인/회원가입
    │   ├── start.html         # 언어/상황 선택
    │   ├── tutor.html         # 메인 학습 화면
    │   ├── favorites.html     # 찜 목록
    │   ├── vocabulary.html    # 단어장
    │   ├── report.html        # 리포트
    │   └── settings.html      # 설정
    │
    └── components/            # 재사용 컴포넌트
        ├── sidebar.html       # 좌측 대화 목록
        ├── rightbar.html      # 우측 통계
        └── modals.html        # 모달들
주요 기능
🎯 회화 학습
다국어 지원 (영어, 일본어, 중국어, 한국어, 스페인어 등)
상황별 회화 연습 (일상, 비즈니스, 여행, 레스토랑 등)
AI 튜터의 실시간 피드백 (문법 교정, 추천 표현)
🎙️ 음성 인식
Web Speech API 기반 음성 입력
문장 누적 기능 (끊어 말해도 이어붙임)
언어별 자동/수동 전환
📚 학습 관리
대화 기록 저장 및 관리
찜 목록 (언어/유형별 필터)
단어장 (단어, 의미, 예문)
학습 리포트 (교정/추천 통계)
📊 사용자 통계
연속 학습일 (streak)
주간 학습 목표
최근 학습 이력
설치 및 실행
# 의존성 설치
pip install -r requirements.txt

# Gemini API 키 설정 (환경변수)
export GEMINI_API_KEY="your-api-key"

# Windows의 경우
set GEMINI_API_KEY=your-api-key

# 실행
python app.py

# http://localhost:5000 접속
API 키 발급
Gemini API 키는 Google AI Studio에서 발급받을 수 있습니다.

기술 스택
Backend: Python 3.11+, Flask
Database: SQLite
AI: Google Gemini API
Frontend: HTML, CSS, Vanilla JavaScript
Speech: Web Speech API
파일 수정 가이드
수정 내용	파일 위치
API 키 변경	config.py
DB 스키마 변경	models/database.py
AI 프롬프트 수정	services/ai_service.py
API 엔드포인트 추가	routes/ 폴더
UI 스타일 변경	static/css/ 폴더
프론트엔드 로직	static/js/ 폴더
