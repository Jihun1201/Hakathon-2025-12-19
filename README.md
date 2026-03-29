# 🤖 MascotTalk Tutor

AI 튜터와 함께하는 외국어 회화 연습 웹 애플리케이션

---

## 📌 프로젝트 소개

카이로스 교내 해커톤(2025-12-19)에서 개발된 서비스로,
사용자가 AI와 자연스럽게 대화하며 외국어를 학습할 수 있도록 설계되었습니다.

---

## 🚀 주요 기능

* 🎙️ 음성 인식 (Web Speech API)
* 🤖 Gemini 기반 AI 회화
* ✏️ 문법 교정 및 표현 추천
* 📚 단어장 및 즐겨찾기
* 📊 학습 통계 및 리포트

---

## 🛠 기술 스택

* Backend: Flask
* Database: SQLite
* AI: Google Gemini API
* Frontend: HTML / CSS / JS

---

## 📁 프로젝트 구조

```
project/
├── app.py              # 메인 서버
├── ai_manager.py       # AI 응답 및 프롬프트 처리
├── db_handler.py       # DB 처리
├── templates/          # HTML 템플릿
├── static/             # CSS / JS
```

---

## ⚙️ 실행 방법

```bash
pip install -r requirements.txt
python app.py
```

---

## 🔐 환경 변수

```
GEMINI_API_KEY=your-api-key
```

---

## 💡 특징

* 단순 번역이 아닌 **상황 기반 대화 학습**
* 사용자 입력에 대한 **실시간 피드백 제공**
* 학습 데이터 기반 **통계 및 리포트 제공**