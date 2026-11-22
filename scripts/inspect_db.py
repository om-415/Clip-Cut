import sqlite3

conn = sqlite3.connect('stream_clipper.db')
c = conn.cursor()
tables = [r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")]
print("Tables:", tables)
print("projects columns:", [r[1] for r in c.execute("PRAGMA table_info(projects)")])
print("clips columns:", [r[1] for r in c.execute("PRAGMA table_info(clips)")])
conn.close()
