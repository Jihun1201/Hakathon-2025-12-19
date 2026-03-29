// ui_handlers.js
import { state, settings, saveSettings, showPage, escapeHtml, escapeAttr, langLabels } from './state.js';
import { API } from './api.js';
import { updateLangSelector, speakText, currentLanguage } from './audio.js';
import { loadConversations, loadMessages, setChatConvId } from './main.js'; // 순환 참조 주의: main에서 필요한 함수 import

// === 사용자 통계 로드 ===
export function loadUserStats(data) {
    const profileName = document.getElementById('profileName');
    const userAvatar = document.getElementById('userAvatar');
    const topLang = document.getElementById('topLang');
    const streakDays = document.getElementById('streakDays');
    const lastStudy = document.getElementById('lastStudy');
    const totalTurns = document.getElementById('totalTurns');
    const goalMin = document.getElementById('goalMin');
    const goalProgress = document.getElementById('goalProgress');
    const goalFill = document.getElementById('goalFill');
    const recentSessions = document.getElementById('recentSessions');

    if (profileName) profileName.textContent = data.username;
    if (userAvatar) userAvatar.textContent = data.username.charAt(0).toUpperCase();
    if (topLang) topLang.textContent = data.top_lang || '-';
    if (streakDays) streakDays.textContent = (data.streak_days || 0) + '일';
    if (lastStudy) lastStudy.textContent = data.last_study_date || '-';
    if (totalTurns) totalTurns.textContent = data.total_turns || 0;
    if (goalMin) goalMin.textContent = data.week_goal_min || 30;
    if (goalProgress) goalProgress.textContent = `${data.week_minutes || 0} / ${data.week_goal_min || 30}`;
    if (goalFill) goalFill.style.width = (data.week_progress_pct || 0) + '%';

    if (recentSessions && data.recent_sessions) {
        recentSessions.innerHTML = data.recent_sessions.map(s => `
            <div class="rb-item" data-id="${s.id}">
                <div class="rb-item-title">${escapeHtml(s.title)}</div>
                <div class="rb-item-sub">${s.date} · ${s.lang}</div>
            </div>
        `).join('') || '<p style="color:#999;font-size:12px;">아직 대화가 없습니다.</p>';

        recentSessions.querySelectorAll('.rb-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = parseInt(item.dataset.id);
                setChatConvId(id);
                showPage('tutorPage');
                loadConversations();
                loadMessages();
            });
        });
    }
}

export async function refreshUserStats() {
    try {
        const res = await API.me();
        if (res.ok && res.data.logged_in) {
            loadUserStats(res.data);
        }
    } catch (err) { console.error(err); }
}

// === 설정 UI 초기화 및 이벤트 ===
export function initSettingsUI() {
    document.querySelectorAll('input[name="speechMode"]').forEach(radio => {
        radio.checked = radio.value === settings.speechMode;
    });

    document.querySelectorAll('#manualLangSetting input[type="checkbox"]').forEach(cb => {
        cb.checked = settings.manualLangs.includes(cb.value);
    });

    document.getElementById('manualLangSetting').style.display = 
        settings.speechMode === 'manual' ? 'block' : 'none';

    document.getElementById('ttsSpeed').value = settings.ttsSpeed;
    document.getElementById('ttsSpeedValue').textContent = settings.ttsSpeed + 'x';
    document.getElementById('ttsPitch').value = settings.ttsPitch;
    document.getElementById('ttsPitchValue').textContent = settings.ttsPitch;
}

export function bindSettingsEvents() {
    document.querySelectorAll('input[name="speechMode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            document.getElementById('manualLangSetting').style.display = 
                e.target.value === 'manual' ? 'block' : 'none';
        });
    });

    document.getElementById('ttsSpeed').addEventListener('input', (e) => {
        document.getElementById('ttsSpeedValue').textContent = e.target.value + 'x';
    });

    document.getElementById('ttsPitch').addEventListener('input', (e) => {
        document.getElementById('ttsPitchValue').textContent = e.target.value;
    });

    document.getElementById('settingsLink').addEventListener('click', (e) => {
        e.preventDefault();
        initSettingsUI();
        showPage('settingsPage');
    });

    document.getElementById('settingsBackBtn').addEventListener('click', (e) => {
        e.preventDefault();
        showPage('tutorPage');
    });

    document.getElementById('saveSettingsBtn').addEventListener('click', () => {
        settings.speechMode = document.querySelector('input[name="speechMode"]:checked').value;
        settings.manualLangs = [];
        document.querySelectorAll('#manualLangSetting input[type="checkbox"]:checked').forEach(cb => {
            settings.manualLangs.push(cb.value);
        });
        settings.ttsSpeed = parseFloat(document.getElementById('ttsSpeed').value);
        settings.ttsPitch = parseFloat(document.getElementById('ttsPitch').value);

        saveSettings();
        updateLangSelector();

        alert('설정이 저장되었습니다!');
        showPage('tutorPage');
    });
}

// === 인증(로그인/회원가입) 이벤트 ===
export function bindAuthEvents() {
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            if (tab.dataset.tab === 'login') {
                document.getElementById('loginForm').style.display = 'block';
                document.getElementById('registerForm').style.display = 'none';
            } else {
                document.getElementById('loginForm').style.display = 'none';
                document.getElementById('registerForm').style.display = 'block';
            }
            document.getElementById('authError').textContent = '';
        });
    });

    document.getElementById('loginBtn').addEventListener('click', async () => {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const res = await API.login(username, password);
            if (res.ok) {
                // [핵심 수정] 로그인 성공 시 새로고침 -> main.js init() 실행 -> 자동 분기 처리
                window.location.reload(); 
            } else {
                document.getElementById('authError').textContent = res.data.error;
            }
        } catch (err) {
            document.getElementById('authError').textContent = '오류가 발생했습니다.';
        }
    });

    document.getElementById('registerBtn').addEventListener('click', async () => {
        const username = document.getElementById('regUsername').value;
        const password = document.getElementById('regPassword').value;
        const confirm = document.getElementById('regPasswordConfirm').value;

        if (password !== confirm) {
            document.getElementById('authError').textContent = '비밀번호가 일치하지 않습니다.';
            return;
        }

        try {
            const res = await API.register(username, password);
            if (res.ok) {
                alert('회원가입 완료! 로그인해주세요.');
                document.querySelector('[data-tab="login"]').click();
            } else {
                document.getElementById('authError').textContent = res.data.error;
            }
        } catch (err) {
            document.getElementById('authError').textContent = '오류가 발생했습니다.';
        }
    });

    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await API.logout();
        showPage('authPage');
    });
}

// === 리포트 로직 ===
export async function loadReport() {
    if (!state.currentConversationId) return;

    try {
        const res = await API.getReport(state.currentConversationId);
        const data = res.data;

        document.getElementById('reportStats').innerHTML = `
            <div class="stat-item">
                <div class="stat-value">${data.total_messages}</div>
                <div class="stat-label">총 메시지</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${data.total_corrections}</div>
                <div class="stat-label">문법 교정</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${data.total_suggestions}</div>
                <div class="stat-label">추천 표현</div>
            </div>
        `;

        document.getElementById('reportCorrections').innerHTML = data.corrections.length > 0 
            ? data.corrections.map(c => `
                <div class="report-item correction">
                    <div class="report-user-msg">내가 한 말: "${escapeHtml(c.user_message)}"</div>
                    <div class="report-feedback">${escapeHtml(c.feedback)}</div>
                </div>
            `).join('')
            : '<p style="color:#999;">문법 교정이 없습니다. 잘하고 있어요! 👍</p>';

        document.getElementById('reportSuggestions').innerHTML = data.suggestions.length > 0
            ? data.suggestions.map(s => `
                <div class="report-item suggestion">
                    <div class="report-user-msg">내가 한 말: "${escapeHtml(s.user_message)}"</div>
                    <div class="report-feedback">${escapeHtml(s.feedback)}</div>
                </div>
            `).join('')
            : '<p style="color:#999;">추천 표현이 없습니다.</p>';
    } catch (err) { console.error(err); }
}

export function bindReportEvents() {
    document.getElementById('reportLink').addEventListener('click', (e) => {
        e.preventDefault();
        if (!state.currentConversationId) {
            alert('대화를 먼저 선택해주세요.');
            return;
        }
        showPage('reportPage');
        loadReport();
    });

    document.getElementById('reportBackBtn').addEventListener('click', (e) => {
        e.preventDefault();
        showPage('tutorPage');
    });
}

// === 찜 목록 & 단어장 로직 ===
async function loadFavorites() {
    try {
        const res = await fetch('/api/favorites');
        const favorites = await res.json();
        
        const container = document.getElementById('favoriteItems');
        container.innerHTML = favorites.map(fav => `
            <div class="favorite-item" data-id="${fav.id}">
                <div class="favorite-content">
                    <div class="favorite-type">${fav.type === 'star' ? '⭐ 찜한 표현' : '_ 밑줄 표현'}</div>
                    <div class="favorite-text">${escapeHtml(fav.content)}</div>
                </div>
                <button class="play-btn" data-content="${escapeAttr(fav.content)}">🔊 듣기</button>
                <button class="delete-btn" data-id="${fav.id}">🗑️ 삭제</button>
            </div>
        `).join('') || '<p style="text-align:center;color:#999;padding:40px;">찜한 표현이 없습니다.</p>';
        
        container.querySelectorAll('.play-btn').forEach(btn => {
            btn.addEventListener('click', () => speakText(btn.dataset.content));
        });
        
        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                await fetch(`/api/favorites/${btn.dataset.id}`, { method: 'DELETE' });
                loadFavorites();
            });
        });
    } catch (err) {
        console.error(err);
    }
}


export async function loadVocabulary() {
    const langFilter = document.getElementById('vocabLangFilter')?.value || '';
    const query = langFilter ? `?language=${langFilter}` : '';

    try {
        const res = await API.getVocabulary(query);
        const words = res.data;

        const container = document.getElementById('vocabItems');
        container.innerHTML = words.map(w => `
            <div class="vocab-item">
                <div class="vocab-content">
                    <div class="vocab-lang">${langLabels[w.language] || w.language}</div>
                    <div class="vocab-word">${escapeHtml(w.word)}</div>
                    <div class="vocab-meaning">${escapeHtml(w.meaning || '')}</div>
                    ${w.example ? `<div class="vocab-example">"${escapeHtml(w.example)}"</div>` : ''}
                </div>
                <div class="vocab-actions">
                    <button class="play-btn" data-content="${escapeAttr(w.word)}">🔊</button>
                    <button class="delete-btn" data-id="${w.id}">🗑️</button>
                </div>
            </div>
        `).join('') || '<p style="text-align:center;color:#999;padding:40px;">단어가 없습니다.</p>';

        container.querySelectorAll('.play-btn').forEach(btn => {
            btn.addEventListener('click', () => speakText(btn.dataset.content));
        });

        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                await API.deleteVocabulary(btn.dataset.id);
                loadVocabulary();
            });
        });
    } catch (err) { console.error(err); }
}

function openWordModalFromFav(content, lang) {
    document.getElementById('wordInput').value = '';
    document.getElementById('meaningInput').value = '';
    document.getElementById('wordLangInput').value = lang || 'en';
    document.getElementById('exampleInput').value = content;
    document.getElementById('wordModal').classList.add('show');
}

export function bindLibraryEvents() {
    document.getElementById('backBtn').addEventListener('click', (e) => {
        e.preventDefault();
        showPage('tutorPage');
    });

    document.getElementById('favLangFilter')?.addEventListener('change', loadFavorites);
    document.getElementById('favTypeFilter')?.addEventListener('change', loadFavorites);

    document.getElementById('vocabLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        showPage('vocabPage');
        loadVocabulary();
    });

    document.getElementById('vocabBackBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        showPage('tutorPage');
    });

    document.getElementById('vocabLangFilter')?.addEventListener('change', loadVocabulary);

    document.getElementById('addWordBtn')?.addEventListener('click', () => {
        document.getElementById('wordInput').value = '';
        document.getElementById('meaningInput').value = '';
        document.getElementById('exampleInput').value = '';
        document.getElementById('wordModal').classList.add('show');
    });

    document.getElementById('wordCancel')?.addEventListener('click', () => {
        document.getElementById('wordModal').classList.remove('show');
    });

    document.getElementById('wordSave')?.addEventListener('click', async () => {
        const word = document.getElementById('wordInput').value.trim();
        if (!word) {
            alert('단어를 입력해주세요.');
            return;
        }

        try {
            await API.addVocabulary({
                word,
                meaning: document.getElementById('meaningInput').value,
                language: document.getElementById('wordLangInput').value,
                example: document.getElementById('exampleInput').value
            });
            document.getElementById('wordModal').classList.remove('show');
            loadVocabulary();
            alert('단어가 추가되었습니다!');
        } catch (err) { console.error(err); }
    });
}