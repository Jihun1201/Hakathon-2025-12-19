from flask import Flask, render_template, request, jsonify, session
import os
import sqlite3 # 에러 처리를 위해 필요

# 우리가 분리한 파일들 불러오기
import db_handler as db
import ai_manager as ai

app = Flask(__name__)
app.secret_key = os.urandom(24)

# 앱이 종료될 때 DB 연결도 끊어주기 (안전장치)
@app.teardown_appcontext
def close_connection(exception):
    db.close_db(exception)

@app.route('/')
def index():
    return render_template('index.html')

# ============ 인증 API ============
@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username', '').strip()
    password = data.get('password', '')
    
    if not username or not password:
        return jsonify({'error': '아이디와 비밀번호를 입력해주세요.'}), 400
    if len(password) < 4:
        return jsonify({'error': '비밀번호는 4자 이상이어야 합니다.'}), 400
    
    conn = db.get_db()
    try:
        # db_handler에 있는 hash_password 사용
        conn.execute('INSERT INTO users (username, password) VALUES (?, ?)',
                     (username, db.hash_password(password)))
        conn.commit()
        return jsonify({'status': 'ok', 'message': '회원가입 완료!'})
    except sqlite3.IntegrityError:
        return jsonify({'error': '이미 존재하는 아이디입니다.'}), 400

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username', '').strip()
    password = data.get('password', '')
    
    conn = db.get_db()
    # db_handler에 있는 hash_password 사용
    user = conn.execute('SELECT * FROM users WHERE username = ? AND password = ?',
                        (username, db.hash_password(password))).fetchone()
    
    if user:
        session['user_id'] = user['id']
        session['username'] = user['username']
        return jsonify({'status': 'ok', 'username': username})
    else:
        return jsonify({'error': '아이디 또는 비밀번호가 틀렸습니다.'}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'status': 'ok'})

@app.route('/api/me', methods=['GET'])
def me():
    if 'user_id' in session:
        user_id = session['user_id']
        
        # 1. 유저 통계 및 대화방 개수 가져오기
        stats = db.get_user_stats(user_id)
        conv_count = db.get_conversation_count(user_id) # <--- [핵심] 개수 확인
        
        conn = db.get_db()
        
        # 최근 대화 및 언어 통계 (기존 로직)
        recent = conn.execute('''SELECT id, title, language, created_at FROM conversations 
                                 WHERE user_id = ? ORDER BY created_at DESC LIMIT 5''', (user_id,)).fetchall()
        
        top_lang = conn.execute('''SELECT language, COUNT(*) as cnt FROM conversations 
                                   WHERE user_id = ? GROUP BY language ORDER BY cnt DESC LIMIT 1''', 
                                  (user_id,)).fetchone()
        
        lang_labels = {'en': '영어', 'ko': '한국어', 'ja': '일본어', 'zh': '중국어',
                       'es': '스페인어', 'fr': '프랑스어', 'de': '독일어', 'vi': '베트남어'}
        
        week_progress = min(100, int((stats.get('week_minutes', 0) / max(1, stats.get('week_goal_min', 30))) * 100))
        
        return jsonify({
            'logged_in': True,
            'username': session['username'],
            'conversation_count': conv_count,  # <--- [핵심] 프론트로 전달
            'streak_days': stats.get('streak_days', 0),
            'last_study_date': stats.get('last_study_date', '-'),
            'total_turns': stats.get('total_turns', 0),
            'week_minutes': stats.get('week_minutes', 0),
            'week_goal_min': stats.get('week_goal_min', 30),
            'week_progress_pct': week_progress,
            'top_lang': lang_labels.get(top_lang['language'], top_lang['language']) if top_lang else '-',
            'recent_sessions': [{'id': r['id'], 'title': r['title'], 'lang': lang_labels.get(r['language'], r['language']), 
                                 'date': r['created_at'][:10]} for r in recent]
        })
    return jsonify({'logged_in': False})

# ============ 대화 API ============
@app.route('/api/conversations', methods=['GET', 'POST'])
def conversations():
    if 'user_id' not in session:
        return jsonify({'error': '로그인이 필요합니다.'}), 401
    user_id = session['user_id']
    
    conn = db.get_db()
    if request.method == 'POST':
        data = request.json
        language = data['language']
        situation = data.get('situation', '')
        custom_prompt = data.get('custom_prompt', '')
        
        lang_names = {'en': '영어', 'ko': '한국어', 'ja': '일본어', 'zh': '중국어', 
                      'es': '스페인어', 'fr': '프랑스어', 'de': '독일어', 'vi': '베트남어'}
        sit_names = {'daily': '일상', 'business': '비즈니스', 'travel': '여행', 
                     'restaurant': '레스토랑', 'shopping': '쇼핑', 'hospital': '병원', 'hotel': '호텔'}
        
        default_title = f"{lang_names.get(language, language)} - {sit_names.get(situation, '대화')}"
        
        cur = conn.execute(
            'INSERT INTO conversations (user_id, title, language, situation, custom_prompt) VALUES (?, ?, ?, ?, ?)',
            (user_id, default_title, language, situation, custom_prompt)
        )
        conn.commit()
        conv_id = cur.lastrowid
        
        # [변경점] AI 관련 코드는 ai_manager(ai)에서 호출
        system_msg = ai.build_system_prompt(language, situation, custom_prompt)
        initial_msg = ai.get_ai_response([], system_msg)
        
        conn.execute('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)',
                     (conv_id, 'assistant', initial_msg))
        conn.commit()
        
        return jsonify({'id': conv_id, 'title': default_title, 'initial_message': initial_msg})
    else:
        rows = conn.execute('SELECT * FROM conversations WHERE user_id = ? ORDER BY created_at DESC', 
                           (user_id,)).fetchall()
        return jsonify([dict(r) for r in rows])

@app.route('/api/conversations/<int:conv_id>', methods=['DELETE', 'PATCH'])
def manage_conversation(conv_id):
    if 'user_id' not in session: return jsonify({'error': '로그인이 필요합니다.'}), 401
    user_id = session['user_id']
    
    conn = db.get_db()
    # 소유권 확인
    conv = conn.execute('SELECT * FROM conversations WHERE id = ? AND user_id = ?', 
                        (conv_id, user_id)).fetchone()
    if not conv: return jsonify({'error': '권한이 없습니다.'}), 403
    
    if request.method == 'DELETE':
        conn.execute('DELETE FROM feedbacks WHERE message_id IN (SELECT id FROM messages WHERE conversation_id = ?)', (conv_id,))
        conn.execute('DELETE FROM messages WHERE conversation_id = ?', (conv_id,))
        conn.execute('DELETE FROM favorites WHERE conversation_id = ?', (conv_id,))
        conn.execute('DELETE FROM conversations WHERE id = ?', (conv_id,))
        conn.commit()
        return jsonify({'status': 'ok'})
    
    elif request.method == 'PATCH':
        data = request.json
        new_title = data.get('title', '').strip()
        if new_title:
            conn.execute('UPDATE conversations SET title = ? WHERE id = ?', (new_title, conv_id))
            conn.commit()
            return jsonify({'status': 'ok', 'title': new_title})
        return jsonify({'error': '제목을 입력해주세요.'}), 400

@app.route('/api/conversations/<int:conv_id>/messages', methods=['GET', 'POST'])
def messages(conv_id):
    if 'user_id' not in session: return jsonify({'error': '로그인이 필요합니다.'}), 401
    user_id = session['user_id']
    
    conn = db.get_db()
    conv = conn.execute('SELECT * FROM conversations WHERE id = ? AND user_id = ?', 
                        (conv_id, user_id)).fetchone()
    if not conv: return jsonify({'error': '권한이 없습니다.'}), 403
    
    if request.method == 'POST':
        data = request.json
        user_msg = data['content']
        
        # 사용자 메시지 저장
        cur = conn.execute('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)',
                           (conv_id, 'user', user_msg))
        user_msg_id = cur.lastrowid
        conn.commit()
        
        history = conn.execute(
            'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at',
            (conv_id,)
        ).fetchall()
        
        # [변경점] AI Manager 사용
        system_msg = ai.build_system_prompt(conv['language'], conv['situation'], conv['custom_prompt'])
        messages_list = [{'role': r['role'], 'content': r['content']} for r in history]
        
        # 피드백 포함된 응답 받기
        result = ai.get_ai_response_with_feedback(messages_list, system_msg, conv['language'], user_msg)
        
        conn.execute('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)',
                     (conv_id, 'assistant', result['response']))
        
        for fb in result.get('feedbacks', []):
            conn.execute('INSERT INTO feedbacks (message_id, type, content) VALUES (?, ?, ?)',
                         (user_msg_id, fb['type'], fb['content']))
        
        # [중요] 활동 통계 업데이트 (db_handler에 있는 함수 호출)
        db.update_user_activity(user_id)
        conn.commit()
        
        return jsonify(result)
    else:
        # GET 요청 처리
        rows = conn.execute('''
            SELECT m.*, GROUP_CONCAT(f.type || '::' || f.content, '||') as feedbacks
            FROM messages m
            LEFT JOIN feedbacks f ON m.id = f.message_id
            WHERE m.conversation_id = ?
            GROUP BY m.id
            ORDER BY m.created_at
        ''', (conv_id,)).fetchall()
        
        result = []
        for r in rows:
            msg = dict(r)
            if msg['feedbacks']:
                msg['feedbacks'] = [
                    {'type': f.split('::')[0], 'content': f.split('::')[1]}
                    for f in msg['feedbacks'].split('||')
                ]
            else:
                msg['feedbacks'] = []
            result.append(msg)
        return jsonify(result)

# ============ 리포트 API ============
@app.route('/api/conversations/<int:conv_id>/report', methods=['GET'])
def conversation_report(conv_id):
    if 'user_id' not in session: return jsonify({'error': '로그인이 필요합니다.'}), 401
    user_id = session['user_id']
    
    conn = db.get_db()
    conv = conn.execute('SELECT * FROM conversations WHERE id = ? AND user_id = ?', 
                        (conv_id, user_id)).fetchone()
    if not conv: return jsonify({'error': '권한이 없습니다.'}), 403
    
    conv_data = dict(conv)
    feedbacks = conn.execute('''
        SELECT m.content as user_message, f.type, f.content as feedback
        FROM feedbacks f
        JOIN messages m ON f.message_id = m.id
        WHERE m.conversation_id = ?
        ORDER BY m.created_at
    ''', (conv_id,)).fetchall()
    
    corrections = []
    suggestions = []
    
    for fb in feedbacks:
        item = {'user_message': fb['user_message'], 'feedback': fb['feedback']}
        if fb['type'] == 'correction':
            corrections.append(item)
        else:
            suggestions.append(item)
    
    total_messages = conn.execute(
        'SELECT COUNT(*) as cnt FROM messages WHERE conversation_id = ? AND role = "user"',
        (conv_id,)
    ).fetchone()['cnt']
    
    return jsonify({
        'conversation': conv_data,
        'total_messages': total_messages,
        'total_corrections': len(corrections),
        'total_suggestions': len(suggestions),
        'corrections': corrections,
        'suggestions': suggestions
    })

# ============ 찜/단어장 API ============
# (5) Mark (찜/밑줄)  ✅ 단 하나만!
@app.post("/api/mark")
def api_mark():
    # 로그인 체크 (DB 연동 버전의 기준)
    if "user_id" not in session:
        return jsonify({"ok": False, "error": "login required"}), 401

    user_id = session["user_id"]

    payload = request.get_json(force=True) or {}
    mark_type = (payload.get("type") or "").strip()      # fav | underline
    conversation_id = payload.get("conversation_id")     # int
    message_id = payload.get("message_id")               # int (assistant msg id)

    if mark_type not in ("fav", "underline"):
        return jsonify({"ok": False, "error": "invalid type"}), 400
    if not conversation_id or not message_id:
        return jsonify({"ok": False, "error": "missing fields"}), 400

    conn = db.get_db()

    # ✅ 소유권 체크: 이 conversation이 내 것인지 확인 (보안/필수)
    conv = conn.execute(
        "SELECT id FROM conversations WHERE id = ? AND user_id = ?",
        (conversation_id, user_id)
    ).fetchone()
    if not conv:
        return jsonify({"ok": False, "error": "forbidden"}), 403

    # ✅ message content 가져오기 (assistant 메시지만 찜하게 제한해도 됨)
    msg = conn.execute(
        "SELECT id, role, content FROM messages WHERE id = ? AND conversation_id = ?",
        (message_id, conversation_id)
    ).fetchone()
    if not msg:
        return jsonify({"ok": False, "error": "message not found"}), 404

    # (선택) assistant만 찜 허용
    if msg["role"] != "assistant":
        return jsonify({"ok": False, "error": "only assistant message can be marked"}), 400

    if mark_type == "fav":
        # ✅ 중복 방지: 같은 메시지를 이미 찜했으면 dedup
        exists = conn.execute(
            "SELECT 1 FROM favorites WHERE user_id = ? AND conversation_id = ? AND content = ? AND type = 'fav' LIMIT 1",
            (user_id, conversation_id, msg["content"])
        ).fetchone()
        if exists:
            return jsonify({"ok": True, "dedup": True})

        conn.execute(
            "INSERT INTO favorites (user_id, conversation_id, content, type) VALUES (?, ?, ?, ?)",
            (user_id, conversation_id, msg["content"], "fav")
        )
        conn.commit()
        return jsonify({"ok": True})

    # underline도 DB에 저장하려면 favorites에 type='underline'로 저장 가능
    if mark_type == "underline":
        exists = conn.execute(
            "SELECT 1 FROM favorites WHERE user_id = ? AND conversation_id = ? AND content = ? AND type = 'underline' LIMIT 1",
            (user_id, conversation_id, msg["content"])
        ).fetchone()
        if exists:
            return jsonify({"ok": True, "dedup": True})

        conn.execute(
            "INSERT INTO favorites (user_id, conversation_id, content, type) VALUES (?, ?, ?, ?)",
            (user_id, conversation_id, msg["content"], "underline")
        )
        conn.commit()
        return jsonify({"ok": True})
    

@app.route('/api/favorites', methods=['GET', 'POST'])
def favorites():
    user_id = session['user_id']
    if not user_id:
        return jsonify({'error': '로그인이 필요합니다.'}), 401
    
    conn = db.get_db()
    if request.method == 'POST':
        data = request.json
        conn.execute('INSERT INTO favorites (user_id, conversation_id, content, type) VALUES (?, ?, ?, ?)',
                    (user_id, data['conversation_id'], data['content'], data['type']))
        conn.commit()
        return jsonify({'status': 'ok'})
    else:
        rows = conn.execute('SELECT * FROM favorites WHERE user_id = ? ORDER BY created_at DESC',
                           (user_id,)).fetchall()
        return jsonify([dict(r) for r in rows])

@app.route('/api/favorites/<int:fav_id>', methods=['DELETE'])
def delete_favorite(fav_id):
    user_id = session['user_id']
    if not user_id:
        return jsonify({'error': '로그인이 필요합니다.'}), 401
    
    conn = db.get_db()
    conn.execute('DELETE FROM favorites WHERE id = ? AND user_id = ?', (fav_id, user_id))
    conn.commit()
    return jsonify({'status': 'ok'})

@app.route('/api/vocabulary', methods=['GET', 'POST'])
def vocabulary():
    if 'user_id' not in session: return jsonify({'error': '로그인이 필요합니다.'}), 401
    user_id = session['user_id']
    conn = db.get_db()
    
    if request.method == 'POST':
        data = request.json
        conn.execute('INSERT INTO vocabulary (user_id, word, meaning, language, example) VALUES (?, ?, ?, ?, ?)',
                     (user_id, data['word'], data.get('meaning', ''), data.get('language', ''), data.get('example', '')))
        conn.commit()
        return jsonify({'status': 'ok'})
    else:
        lang_filter = request.args.get('language')
        if lang_filter:
            rows = conn.execute('SELECT * FROM vocabulary WHERE user_id = ? AND language = ? ORDER BY created_at DESC',
                               (user_id, lang_filter)).fetchall()
        else:
            rows = conn.execute('SELECT * FROM vocabulary WHERE user_id = ? ORDER BY created_at DESC',
                               (user_id,)).fetchall()
        return jsonify([dict(r) for r in rows])

@app.route('/api/vocabulary/<int:vocab_id>', methods=['DELETE'])
def delete_vocabulary(vocab_id):
    if 'user_id' not in session: return jsonify({'error': '로그인이 필요합니다.'}), 401
    user_id = session['user_id']
    conn = db.get_db()
    conn.execute('DELETE FROM vocabulary WHERE id = ? AND user_id = ?', (vocab_id, user_id))
    conn.commit()
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    # 앱 시작 전 DB 초기화 (테이블 생성 등)
    db.init_db()
    app.run(debug=True, port=5000)