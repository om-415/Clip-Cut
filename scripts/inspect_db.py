import sqlite3

conn = sqlite3.connect('stream_clipper.db')
c = conn.cursor()

def dump_table(name):
    print(f"\n=== {name} ===")
    cols = [r[1] for r in c.execute(f"PRAGMA table_info({name})")]
    print("Cols:", cols)
    rows = c.execute(f"SELECT * FROM {name}").fetchall()
    for row in rows:
        print(dict(zip(cols, row)))

for t in ['users', 'youtube_accounts', 'projects', 'clips', 'upload_queue', 'publishing_settings']:
    dump_table(t)

conn.close()
