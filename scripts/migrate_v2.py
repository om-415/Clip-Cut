import sqlite3
import uuid
import hashlib

DB_PATH = 'stream_clipper.db'

def hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000).hex()

def migrate_v2():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # 1. Add user_id to youtube_accounts if missing
    c.execute("PRAGMA table_info(youtube_accounts)")
    cols = [r[1] for r in c.fetchall()]
    if 'user_id' not in cols:
        print("[Migrate] Adding user_id column to youtube_accounts...")
        c.execute("ALTER TABLE youtube_accounts ADD COLUMN user_id VARCHAR(36)")

    # 2. Get or create demo@clipcut.ai
    c.execute("SELECT id FROM users WHERE email = 'demo@clipcut.ai'")
    clipcut_demo = c.fetchone()
    
    salt = uuid.uuid4().hex[:16]
    hashed_pwd = hash_password("Demo1234!", salt)

    if clipcut_demo:
        demo_user_id = clipcut_demo[0]
        # Update credentials to guaranteed Demo1234!
        c.execute("""
            UPDATE users 
            SET hashed_password = ?, salt = ?, first_name = 'Demo', last_name = 'Creator', auth_provider = 'email', is_active = 1
            WHERE id = ?
        """, (hashed_pwd, salt, demo_user_id))
    else:
        demo_user_id = str(uuid.uuid4())
        c.execute("""
            INSERT INTO users (id, email, first_name, last_name, hashed_password, salt, auth_provider, is_active, created_at, updated_at)
            VALUES (?, 'demo@clipcut.ai', 'Demo', 'Creator', ?, ?, 'email', 1, datetime('now'), datetime('now'))
        """, (demo_user_id, hashed_pwd, salt))

    print(f"[Migrate] Active demo user id: {demo_user_id} (demo@clipcut.ai)")

    # 3. Check for older demo user (demo@fragflash.ai) and migrate all its records
    c.execute("SELECT id FROM users WHERE email = 'demo@fragflash.ai'")
    old_demo = c.fetchone()
    old_ids = [old_demo[0]] if old_demo else []
    
    # Also include any records where user_id is NULL
    for old_id in old_ids:
        c.execute("UPDATE projects SET user_id = ? WHERE user_id = ? OR user_id IS NULL", (demo_user_id, old_id))
        c.execute("UPDATE clips SET user_id = ? WHERE user_id = ? OR user_id IS NULL", (demo_user_id, old_id))
        c.execute("UPDATE upload_queue SET user_id = ? WHERE user_id = ? OR user_id IS NULL", (demo_user_id, old_id))
        c.execute("UPDATE youtube_accounts SET user_id = ? WHERE user_id = ? OR user_id IS NULL", (demo_user_id, old_id))

    # Link any unassigned records
    c.execute("UPDATE projects SET user_id = ? WHERE user_id IS NULL", (demo_user_id,))
    c.execute("UPDATE clips SET user_id = ? WHERE user_id IS NULL", (demo_user_id,))
    c.execute("UPDATE upload_queue SET user_id = ? WHERE user_id IS NULL", (demo_user_id,))
    c.execute("UPDATE youtube_accounts SET user_id = ? WHERE user_id IS NULL", (demo_user_id,))

    conn.commit()

    # 4. Verification counts
    p_cnt = c.execute("SELECT COUNT(*) FROM projects WHERE user_id = ?", (demo_user_id,)).fetchone()[0]
    c_cnt = c.execute("SELECT COUNT(*) FROM clips WHERE user_id = ?", (demo_user_id,)).fetchone()[0]
    q_cnt = c.execute("SELECT COUNT(*) FROM upload_queue WHERE user_id = ?", (demo_user_id,)).fetchone()[0]
    yt_cnt = c.execute("SELECT COUNT(*) FROM youtube_accounts WHERE user_id = ?", (demo_user_id,)).fetchone()[0]

    print(f"[Migrate] Demo user now owns: {p_cnt} projects, {c_cnt} clips, {q_cnt} queue items, {yt_cnt} YouTube channels.")
    conn.close()

if __name__ == '__main__':
    migrate_v2()
