import sqlite3
import uuid
import hashlib
import os

DB_PATH = 'stream_clipper.db'

def hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000).hex()

def migrate():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # 1. Create users table if not exists
    c.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        first_name VARCHAR(100) DEFAULT '',
        last_name VARCHAR(100) DEFAULT '',
        hashed_password VARCHAR(255),
        salt VARCHAR(64),
        auth_provider VARCHAR(50) DEFAULT 'email',
        google_id VARCHAR(255),
        avatar_url TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME,
        updated_at DATETIME
    )
    ''')

    # 2. Add user_id to projects if not present
    c.execute("PRAGMA table_info(projects)")
    cols = [r[1] for r in c.fetchall()]
    if 'user_id' not in cols:
        print("Adding user_id to projects...")
        c.execute("ALTER TABLE projects ADD COLUMN user_id VARCHAR(36)")

    # 3. Add user_id to clips if not present
    c.execute("PRAGMA table_info(clips)")
    cols = [r[1] for r in c.fetchall()]
    if 'user_id' not in cols:
        print("Adding user_id to clips...")
        c.execute("ALTER TABLE clips ADD COLUMN user_id VARCHAR(36)")

    # 4. Add user_id to upload_queue if not present
    c.execute("PRAGMA table_info(upload_queue)")
    cols = [r[1] for r in c.fetchall()]
    if 'user_id' not in cols:
        print("Adding user_id to upload_queue...")
        c.execute("ALTER TABLE upload_queue ADD COLUMN user_id VARCHAR(36)")

    # 5. Seed default demo user if not exists
    demo_email = "demo@fragflash.ai"
    c.execute("SELECT id FROM users WHERE email = ?", (demo_email,))
    existing_user = c.fetchone()
    
    if not existing_user:
        salt = uuid.uuid4().hex[:16]
        hashed = hash_password("Demo1234!", salt)
        demo_id = str(uuid.uuid4())
        c.execute('''
        INSERT INTO users (id, email, first_name, last_name, hashed_password, salt, auth_provider, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'email', 1, datetime('now'), datetime('now'))
        ''', (demo_id, demo_email, "Demo", "Creator", hashed, salt))
        print(f"Created demo user: {demo_email} (ID: {demo_id})")
    else:
        demo_id = existing_user[0]

    # 6. Assign orphaned projects/clips to demo_id so previous data is not lost
    c.execute("UPDATE projects SET user_id = ? WHERE user_id IS NULL", (demo_id,))
    c.execute("UPDATE clips SET user_id = ? WHERE user_id IS NULL", (demo_id,))
    c.execute("UPDATE upload_queue SET user_id = ? WHERE user_id IS NULL", (demo_id,))

    conn.commit()
    conn.close()
    print("Database migration for User Authentication completed successfully!")

if __name__ == '__main__':
    migrate()
