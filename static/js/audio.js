// audio.js
import { state, settings, langToSpeechCode, langNames, langFlags } from './state.js';

export let currentLanguage = 'en';
export let currentSpeechLang = 'en';

// === TTS ===
export function speakText(text) {
    if (!('speechSynthesis' in window)) {
        alert('이 브라우저는 음성 합성을 지원하지 않습니다.');
        return;
    }

    if (!text?.trim()) return;

    // 기존 음성 중지
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    // ✅ 현재 선택된 언어 기반 TTS
    const langCode = langToSpeechCode[currentSpeechLang] || 'en-GB';
    utterance.lang = langCode;

    // ✅ 설정값 반영
    utterance.rate = settings.ttsSpeed;
    utterance.pitch = settings.ttsPitch;

    // ✅ 언어에 맞는 voice 자동 선택
    const voices = speechSynthesis.getVoices();
    const matchedVoice = voices.find(v => v.lang === langCode)
                        || voices.find(v => v.lang.startsWith(langCode.split('-')[0]));

    if (matchedVoice) {
        utterance.voice = matchedVoice;
    }

    speechSynthesis.speak(utterance);
}

// === STT (음성 인식) ===
export function initSpeechRecognition(onResultCallback, onStopCallback) {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        state.recognition = new SpeechRecognition();
        state.recognition.continuous = true;
        state.recognition.interimResults = true;

        state.recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            // 최종 결과면 누적
            if (finalTranscript) {
                state.accumulatedTranscript += (state.accumulatedTranscript ? ' ' : '') + finalTranscript;
            }

            // 콜백 호출 (UI 업데이트 용)
            if (onResultCallback) {
                onResultCallback(state.accumulatedTranscript, interimTranscript);
            }
        };

        state.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error !== 'no-speech') {
                stopRecording();
            }
        };

        state.recognition.onend = () => {
            if (state.isRecording) {
                try { state.recognition.start(); } catch (e) {}
            } else {
                if (onStopCallback) onStopCallback();
            }
        };
    }
}

export function setRecognitionLanguage(lang) {
    currentLanguage = lang;
    currentSpeechLang = lang;
    if (state.recognition) {
        state.recognition.lang = langToSpeechCode[lang] || 'en-US';
        console.log('음성 인식 언어 설정:', state.recognition.lang);
    }
    updateLangButtons();
}

export function startRecording() {
    state.isRecording = true;
    state.accumulatedTranscript = document.getElementById('textInput').value; // 기존 텍스트 유지
    state.recognition?.start();
    
    // UI 업데이트
    document.getElementById('recordBtn').classList.add('recording');
    document.getElementById('recordBtn').innerHTML = '🔴 녹음 중...';
    document.getElementById('liveTranscript').classList.add('recording');
    document.getElementById('liveTranscript').textContent = state.accumulatedTranscript || '듣고 있습니다...';
}

export function stopRecording() {
    if (!state.isRecording) return;
    state.isRecording = false;
    state.recognition?.stop();
    
    // UI 업데이트
    document.getElementById('recordBtn').classList.remove('recording');
    document.getElementById('recordBtn').innerHTML = '🎙️ 녹음 시작';
    document.getElementById('liveTranscript').classList.remove('recording');
}

// === 언어 선택 버튼 UI 관련 (Audio 모듈 내 위치가 적합) ===
export function updateLangSelector() {
    const selector = document.getElementById('langSelector');
    const buttonsDiv = document.getElementById('langButtons');

    if (settings.speechMode === 'manual') {
        selector.style.display = 'flex';
        buttonsDiv.innerHTML = settings.manualLangs.map(lang => `
            <button class="lang-btn ${lang === currentSpeechLang ? 'active' : ''}" data-lang="${lang}">
                ${langFlags[lang]} ${langNames[lang]}
            </button>
        `).join('');

        buttonsDiv.querySelectorAll('.lang-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                currentSpeechLang = btn.dataset.lang;
                if (state.recognition) {
                    state.recognition.lang = langToSpeechCode[currentSpeechLang] || 'en-US';
                }
                updateLangButtons();
            });
        });
    } else {
        selector.style.display = 'none';
    }
}

function updateLangButtons() {
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === currentSpeechLang);
    });
}