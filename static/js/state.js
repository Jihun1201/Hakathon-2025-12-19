// state.js

// === 상태 변수 ===
export let state = {
    currentConversationId: null,
    isRecording: false,
    editingConvId: null,
    accumulatedTranscript: '', // 음성 인식 누적 텍스트
    recognition: null // Audio 모듈에서 사용
};

// === 설정 상태 ===
export let settings = {
    speechMode: 'auto',  // auto, manual, multi
    manualLangs: ['ko', 'en'],
    ttsSpeed: 1,
    ttsPitch: 1
};

// === 상수 데이터 ===
export const langLabels = {
    'en': '영어', 'ko': '한국어', 'ja': '일본어', 'zh': '중국어',
    'es': '스페인어', 'fr': '프랑스어', 'de': '독일어', 'vi': '베트남어'
};

export const langToSpeechCode = {
    'en': 'en-US', 'ko': 'ko-KR', 'ja': 'ja-JP', 'zh': 'zh-CN',
    'es': 'es-ES', 'fr': 'fr-FR', 'de': 'de-DE', 'vi': 'vi-VN'
};

export const langFlags = {
    'en': '🇬🇧', 'ko': '🇰🇷', 'ja': '🇯🇵', 'zh': '🇨🇳',
    'es': '🇪🇸', 'fr': '🇫🇷', 'de': '🇩🇪', 'vi': '🇻🇳'
};

export const langNames = {
    'en': 'EN', 'ko': '한', 'ja': '日', 'zh': '中',
    'es': 'ES', 'fr': 'FR', 'de': 'DE', 'vi': 'VI'
};

// === 설정 관리 함수 ===
export function loadSettings() {
    const saved = localStorage.getItem('tutorSettings');
    if (saved) {
        const parsed = JSON.parse(saved);
        Object.assign(settings, parsed); // settings 객체 업데이트
    }
}

export function saveSettings() {
    localStorage.setItem('tutorSettings', JSON.stringify(settings));
}

// === 유틸리티 ===
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function escapeAttr(text) {
    return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// === 페이지 전환 ===
export const pages = {
    authPage: document.getElementById('authPage'),
    startPage: document.getElementById('startPage'),
    tutorPage: document.getElementById('tutorPage'),
    favoritesPage: document.getElementById('favoritesPage'),
    reportPage: document.getElementById('reportPage'),
    settingsPage: document.getElementById('settingsPage'),
    vocabPage: document.getElementById('vocabPage')
};

export function showPage(pageName) {
    Object.values(pages).forEach(p => p?.classList.remove('active'));
    const target = document.getElementById(pageName) || pages[pageName];
    if (target) target.classList.add('active');
}