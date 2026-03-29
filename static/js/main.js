// main.js
import { state, loadSettings, showPage, escapeHtml, escapeAttr } from './state.js';
import { API } from './api.js';
import { 
    initSpeechRecognition, setRecognitionLanguage, updateLangSelector, 
    startRecording, stopRecording, speakText, currentLanguage 
} from './audio.js';
import { 
    loadUserStats, refreshUserStats, initSettingsUI, bindSettingsEvents, 
    bindAuthEvents, bindReportEvents, bindLibraryEvents 
} from './ui_handlers.js';

// === Helper for export ===
export function setChatConvId(id) {
    state.currentConversationId = id;
}

// === 초기화 (Init) ===
async function init() {
    loadSettings();
    initSettingsUI();

    initSpeechRecognition(
        (accumulated, interim) => {
            const displayText = accumulated + (interim ? ' ' + interim : '');
            document.getElementById('liveTranscript').textContent = displayText || '듣고 있습니다...';
            document.getElementById('textInput').value = accumulated;
        },
        () => {}
    );

    bindAuthEvents();
    bindSettingsEvents();
    bindReportEvents();
    bindLibraryEvents();
    bindChatEvents();

    // 로그인 체크 및 페이지 분기 처리
    try {
        const res = await API.me();
        if (res.ok && res.data.logged_in) {
            document.getElementById('welcomeUser').textContent = `안녕하세요, ${res.data.username}님!`;
            
            // [핵심 로직] 채팅방 유무에 따라 페이지 결정
            if (res.data.conversation_count && res.data.conversation_count > 0) {
                showPage('tutorPage'); 
                await loadConversations();
                
                // 가장 최근 방 자동 클릭
                const firstConv = document.querySelector('.conversation-item');
                if (firstConv) firstConv.click();
            } else {
                showPage('startPage');
            }
            
            loadUserStats(res.data);
        } else {
            showPage('authPage');
        }
    } catch (err) {
        showPage('authPage');
    }
}

// === 대화(Chat) 로직 ===
function updateHeader(title) {
    document.getElementById('headerTitle').textContent = `📘 ${title || '대화'}`;
}

// main.js

export async function loadConversations() {
    try {
        const res = await API.getConversations();
        let conversations = res.data;

        // 1. 중복 데이터 제거 (Set 사용)
        const seen = new Set();
        conversations = conversations.filter(conv => {
            const duplicate = seen.has(conv.id);
            seen.add(conv.id);
            return !duplicate;
        });

        const list = document.getElementById('conversationList');
        
        // 2. 목록 초기화 (기존 목록 삭제)
        list.innerHTML = ''; 

        // 3. 데이터가 없을 경우 처리
        if (conversations.length === 0) {
            list.innerHTML = '<p style="text-align:center;color:#999;padding:20px;">대화가 없습니다.</p>';
            return;
        }

        // 4. 목록 그리기 (여기가 두 번 반복되지 않도록 하나만 남김)
        list.innerHTML = conversations.map(conv => `
            <div class="conversation-item ${conv.id === state.currentConversationId ? 'active' : ''}" 
                 data-id="${conv.id}">
                <div class="conv-title" title="${escapeAttr(conv.title)}">${escapeHtml(conv.title)}</div>
                <div class="conv-actions">
                    <button class="conv-edit-btn" data-id="${conv.id}" title="제목 수정">✏️</button>
                    <button class="conv-delete-btn" data-id="${conv.id}" title="삭제">✕</button>
                </div>
            </div>
        `).join('');

        // 5. 클릭 이벤트 리스너 연결
        list.querySelectorAll('.conversation-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // 수정/삭제 버튼 누를 땐 대화 로드 방지
                if (e.target.classList.contains('conv-delete-btn') || 
                    e.target.classList.contains('conv-edit-btn')) return;
                
                state.currentConversationId = parseInt(item.dataset.id);
                const conv = conversations.find(c => c.id === state.currentConversationId);
                
                if (conv) {
                    updateHeader(conv.title);
                    setRecognitionLanguage(conv.language);
                    updateLangSelector();
                }

                document.getElementById('emptyState').style.display = 'none'; // 빈 화면 숨김
                document.getElementById('mainChatContent').style.display = 'flex'; // 채팅창 보임

                loadConversations(); // 클릭 시 스타일 갱신을 위해 재로드
                loadMessages();
            });
        });

        // 6. 수정 버튼 이벤트
        list.querySelectorAll('.conv-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                state.editingConvId = parseInt(btn.dataset.id);
                const conv = conversations.find(c => c.id === state.editingConvId);
                document.getElementById('titleInput').value = conv ? conv.title : '';
                document.getElementById('titleModal').classList.add('show');
            });
        });

        // 7. 삭제 버튼 이벤트
        list.querySelectorAll('.conv-delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm('이 대화를 삭제하시겠습니까?')) {
                    await API.deleteConversation(btn.dataset.id);
                    
                    // 현재 보고 있던 방을 삭제했다면 채팅창 비우기
                    if (parseInt(btn.dataset.id) === state.currentConversationId) {
                        state.currentConversationId = null;
                        document.getElementById('chatArea').innerHTML = 
                            '<p style="text-align:center;color:#999;padding:40px;">대화를 선택하거나 새 대화를 시작하세요.</p>';
                    }
                    loadConversations();
                }
            });
        });

    } catch (err) { console.error(err); }
}

export async function loadMessages() {
    if (!state.currentConversationId) return;

    try {
        const res = await API.getMessages(state.currentConversationId);
        const messages = res.data;

        const chatArea = document.getElementById('chatArea');
        chatArea.innerHTML = '';

        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            const turnWrapper = document.createElement('div');
            turnWrapper.className = 'turn-wrapper';

            if (msg.role === 'user') {
                turnWrapper.innerHTML = `
                    <div class="message user">
                        <div class="message-label">You</div>
                        <div class="message-bubble">${escapeHtml(msg.content)}</div>
                    </div>
                `;

                if (msg.feedbacks && msg.feedbacks.length > 0) {
                    const feedbackDiv = document.createElement('div');
                    feedbackDiv.className = 'feedback-cards';
                    feedbackDiv.innerHTML = msg.feedbacks.map(fb => `
                        <div class="feedback-card ${fb.type}">
                            <div class="feedback-title">
                                ${fb.type === 'suggestion' ? '🎯 추천 표현' : '✏️ 교정'}
                            </div>
                            <div class="feedback-text">${escapeHtml(fb.content)}</div>
                        </div>
                    `).join('');
                    turnWrapper.appendChild(feedbackDiv);
                }
            } else {
                turnWrapper.innerHTML = `
                    <div class="message ai">
                        <div class="message-label">AI Tutor</div>
                        <div class="message-bubble">${escapeHtml(msg.content)}</div>
                        <div class="message-actions">
                            <button class="icon-btn speak-btn" data-content="${escapeAttr(msg.content)}">🔊 듣기</button>
                        </div>
                    </div>
                `;
            }

            chatArea.appendChild(turnWrapper);
        }

        chatArea.scrollTop = chatArea.scrollHeight;
        bindMessageActionEvents(chatArea);

    } catch (err) { console.error(err); }
}

async function sendMessage(content) {
    if (!content.trim() || !state.currentConversationId) return;

    const chatArea = document.getElementById('chatArea');
    const userDiv = document.createElement('div');
    userDiv.className = 'turn-wrapper';
    userDiv.innerHTML = `
        <div class="message user">
            <div class="message-label">You</div>
            <div class="message-bubble">${escapeHtml(content)}</div>
        </div>
    `;
    chatArea.appendChild(userDiv);

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'turn-wrapper loading-wrapper';
    loadingDiv.innerHTML = `
        <div class="message ai">
            <div class="message-label">AI Tutor</div>
            <div class="message-bubble"><span class="loading"></span> 생각 중...</div>
        </div>
    `;
    chatArea.appendChild(loadingDiv);
    chatArea.scrollTop = chatArea.scrollHeight;

    try {
        const res = await API.sendMessage(state.currentConversationId, content);
        const data = res.data;

        loadingDiv.remove();

        if (data.feedbacks && data.feedbacks.length > 0) {
            const feedbackDiv = document.createElement('div');
            feedbackDiv.className = 'feedback-cards';
            feedbackDiv.innerHTML = data.feedbacks.map(fb => `
                <div class="feedback-card ${fb.type}">
                    <div class="feedback-title">
                        ${fb.type === 'suggestion' ? '🎯 추천 표현' : '✏️ 교정'}
                    </div>
                    <div class="feedback-text">${escapeHtml(fb.content)}</div>
                </div>
            `).join('');
            userDiv.appendChild(feedbackDiv);
        }

        const aiDiv = document.createElement('div');
        aiDiv.className = 'message ai';
        aiDiv.innerHTML = `
            <div class="message-label">AI Tutor</div>
            <div class="message-bubble">${escapeHtml(data.response)}</div>
            <div class="message-actions">
                <button class="icon-btn speak-btn" data-content="${escapeAttr(data.response)}">🔊 듣기</button>
            </div>
        `;
        userDiv.appendChild(aiDiv);

        // 동적 요소 이벤트 바인딩
        aiDiv.querySelector('.fav-btn').addEventListener('click', (e) => {
            addToFavorites(e.target.dataset.content, 'star');
        });
        aiDiv.querySelector('.speak-btn').addEventListener('click', (e) => {
            speakText(e.target.dataset.content);
        });

        chatArea.scrollTop = chatArea.scrollHeight;
        refreshUserStats();
    } catch (err) {
        console.error(err);
        loadingDiv.innerHTML = `
            <div class="message ai">
                <div class="message-bubble">오류가 발생했습니다. 다시 시도해주세요.</div>
            </div>
        `;
    }
}

// === 찜하기 (Chat용) ===
async function addToFavorites(content, type) {
    if (!currentConversationId) return;
    
    try {
        await fetch('/api/favorites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                conversation_id: currentConversationId,
                content,
                type
            })
        });
        alert('찜 목록에 추가되었습니다!');
    } catch (err) {
        console.error(err);
    }
}


// === 채팅 이벤트 바인딩 ===
function bindChatEvents() {
    // 대화 시작
    document.getElementById('startBtn').addEventListener('click', async () => {
        const language = document.getElementById('targetLang').value || document.getElementById('customLang').value;
        const situation = document.getElementById('situationSelect').value;
        const customPrompt = document.getElementById('userPrompt').value;

        if (!language) {
            alert('언어를 선택해주세요!');
            return;
        }

        setRecognitionLanguage(language);
        updateLangSelector();

        try {
            const res = await API.createConversation({ language, situation, custom_prompt: customPrompt });
            const data = res.data;
            state.currentConversationId = data.id;

            showPage('tutorPage');
            updateHeader(data.title);
            loadConversations();
            loadMessages();
        } catch (err) {
            console.error(err);
            alert('오류가 발생했습니다.');
        }
        
    });

    // 새 대화
    document.getElementById('newConvBtn').addEventListener('click', () => {
        showPage('startPage');
        document.getElementById('targetLang').value = '';
        document.getElementById('customLang').value = '';
        document.getElementById('situationSelect').value = '';
        document.getElementById('userPrompt').value = '';
    });

    // 텍스트 전송
    document.getElementById('sendBtn').addEventListener('click', () => {
        const input = document.getElementById('textInput');
        
        // 1. 녹음 중이라면 강제로 멈춤 (하지만 함수를 종료하진 않음)
        if (state.isRecording) {
            stopRecording(); 
        }

        // 2. 입력된 텍스트가 있으면 '즉시' 전송
        if (input.value.trim()) {
            sendMessage(input.value);
            
            // 3. UI 및 상태 완벽 초기화
            input.value = '';
            state.accumulatedTranscript = ''; 
            
            // ★ "듣고 있습니다" -> "녹음 버튼을..."으로 즉시 변경
            const liveText = document.getElementById('liveTranscript');
            liveText.textContent = '녹음 버튼을 눌러 말씀하세요...';
            liveText.classList.remove('recording'); // 빨간색 스타일 제거
        }
    });

    // ▼▼▼ [수정된 부분] 엔터키 로직 ▼▼▼
    document.getElementById('textInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            // 1. 녹음 중이라면 강제로 멈춤
            if (state.isRecording) {
                stopRecording();
            }

            // 2. 텍스트가 있으면 '즉시' 전송
            if (e.target.value.trim()) {
                sendMessage(e.target.value);
                
                // 3. UI 및 상태 완벽 초기화
                e.target.value = '';
                state.accumulatedTranscript = '';
                
                // ★ 안내 문구 초기화
                const liveText = document.getElementById('liveTranscript');
                liveText.textContent = '녹음 버튼을 눌러 말씀하세요...';
                liveText.classList.remove('recording');
            }
        }
    });

    // 녹음 버튼
    document.getElementById('recordBtn').addEventListener('click', () => {
        if (!state.recognition) {
            alert('이 브라우저는 음성 인식을 지원하지 않습니다.');
            return;
        }
        if (!state.isRecording) {
            startRecording();
        } else {
            stopRecordingAndSend();
        }
    });

    // 중지 버튼
    document.getElementById('stopBtn').addEventListener('click', () => {
        if (state.isRecording) {
            state.isRecording = false;
            state.recognition.stop();
            document.getElementById('recordBtn').classList.remove('recording');
            document.getElementById('recordBtn').innerHTML = '🎙️ 녹음 시작';
            document.getElementById('liveTranscript').classList.remove('recording');
            document.getElementById('liveTranscript').textContent = '녹음 버튼을 눌러 말씀하세요...';
            document.getElementById('textInput').value = state.accumulatedTranscript;
        }
    });

    // 제목 수정 모달
    document.getElementById('titleCancel').addEventListener('click', () => {
        document.getElementById('titleModal').classList.remove('show');
    });

    document.getElementById('titleSave').addEventListener('click', async () => {
        const newTitle = document.getElementById('titleInput').value.trim();
        if (!newTitle) {
            alert('제목을 입력해주세요.');
            return;
        }
        try {
            const res = await API.updateConversation(state.editingConvId, newTitle);
            if (res.ok) {
                document.getElementById('titleModal').classList.remove('show');
                if (state.editingConvId === state.currentConversationId) {
                    updateHeader(newTitle);
                }
                loadConversations();
            }
        } catch (err) { console.error(err); }
    });

    const expandBtn = document.getElementById('expandBtn');
    if (expandBtn) {
        expandBtn.addEventListener('click', () => {
            // body 태그에 'maximized' 클래스를 넣었다 뺐다 함 (CSS가 반응해서 화면을 키움)
            document.body.classList.toggle('maximized');
            
            // 아이콘 변경 (확대됨 <-> 원래대로)
            if (document.body.classList.contains('maximized')) {
                expandBtn.textContent = '🔙'; // 축소 아이콘
                expandBtn.title = "원래대로 축소";
            } else {
                expandBtn.textContent = '⛶'; // 확대 아이콘
                expandBtn.title = "화면 확대";
            }
        });
    }
}

function stopRecordingAndSend() {
    if (!state.isRecording) return;
    state.isRecording = false;
    state.recognition.stop();
    
    document.getElementById('recordBtn').classList.remove('recording');
    document.getElementById('recordBtn').innerHTML = '🎙️ 녹음 시작';
    document.getElementById('liveTranscript').classList.remove('recording');

    const transcript = state.accumulatedTranscript.trim();
    if (transcript) {
        sendMessage(transcript);
        document.getElementById('textInput').value = '';
        state.accumulatedTranscript = '';
    }
    document.getElementById('liveTranscript').textContent = '녹음 버튼을 눌러 말씀하세요...';
}

function bindMessageActionEvents(container) {
    container.querySelectorAll('.speak-btn').forEach(btn => {
        btn.addEventListener('click', () => speakText(btn.dataset.content));
    });
}

// 앱 시작
init();