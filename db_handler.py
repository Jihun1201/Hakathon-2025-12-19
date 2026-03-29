import sqlite3
import hashlib
from datetime import datetime, timedelta
from flask import g

DATABASE = 'tutor.db'

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db

def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def init_db():
    # 여기서 Flask app context 없이 실행될 경우를 위해 임시 연결 사용
    with sqlite3.connect(DATABASE) as conn:
        conn.executescript('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT,
                language TEXT NOT NULL,
                situation TEXT,
                custom_prompt TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id INTEGER NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id)
            );
            CREATE TABLE IF NOT EXISTS feedbacks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                content TEXT NOT NULL,
                FOREIGN KEY (message_id) REFERENCES messages(id)
            );
            CREATE TABLE IF NOT EXISTS favorites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                conversation_id INTEGER,
                content TEXT NOT NULL,
                type TEXT NOT NULL,
                language TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            CREATE TABLE IF NOT EXISTS vocabulary (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                word TEXT NOT NULL,
                meaning TEXT,
                language TEXT,
                example TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            CREATE TABLE IF NOT EXISTS user_stats (
                user_id INTEGER PRIMARY KEY,
                streak_days INTEGER DEFAULT 0,
                last_study_date TEXT,
                total_turns INTEGER DEFAULT 0,
                week_minutes INTEGER DEFAULT 0,
                week_goal_min INTEGER DEFAULT 30,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
        ''')

def get_user_stats(user_id):
    conn = get_db()
    stats = conn.execute('SELECT * FROM user_stats WHERE user_id = ?', (user_id,)).fetchone()
    if not stats:
        conn.execute('INSERT INTO user_stats (user_id) VALUES (?)', (user_id,))
        conn.commit()
        stats = conn.execute('SELECT * FROM user_stats WHERE user_id = ?', (user_id,)).fetchone()
    return dict(stats) if stats else {}

def update_user_activity(user_id):
    conn = get_db()
    today = datetime.now().strftime('%Y-%m-%d')
    stats = get_user_stats(user_id)
    
    last_date = stats.get('last_study_date')
    streak = stats.get('streak_days', 0)
    
    if last_date != today:
        if last_date == (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d'):
            streak += 1
        elif last_date != today:
            streak = 1
        
        conn.execute('''UPDATE user_stats SET streak_days = ?, last_study_date = ?, 
                        total_turns = total_turns + 1 WHERE user_id = ?''',
                     (streak, today, user_id))
        conn.commit()

def get_user_by_id(user_id):
    """
    User ID로 사용자 정보를 가져옵니다. (app.py에서 사용)
    """
    db = get_db()
    user = db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    return dict(user) if user else None

def get_conversation_count(user_id):
    """
    특정 사용자의 대화방 개수를 반환합니다. (신규/기존 유저 판별용)
    """
    db = get_db()
    cursor = db.execute('SELECT COUNT(*) FROM conversations WHERE user_id = ?', (user_id,))
    result = cursor.fetchone()
    return result[0] if result else 0

def get_user_by_id(user_id):
    """
    User ID로 사용자 정보를 가져옵니다. (app.py에서 사용)
    """
    db = get_db()
    user = db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    return dict(user) if user else None

def get_conversation_count(user_id):
    """
    특정 사용자의 대화방 개수를 반환합니다. (신규/기존 유저 판별용)
    """
    db = get_db()
    cursor = db.execute('SELECT COUNT(*) FROM conversations WHERE user_id = ?', (user_id,))
    result = cursor.fetchone()
    return result[0] if result else 0