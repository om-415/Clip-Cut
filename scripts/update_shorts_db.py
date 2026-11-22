import sqlite3

def run():
    conn = sqlite3.connect('stream_clipper.db')
    cur = conn.cursor()

    # 1. Update publishing settings
    cur.execute(
        "UPDATE publishing_settings SET default_title_template = '{title} #Shorts', default_tags = '[\"Shorts\", \"YouTube Shorts\", \"Gaming\"]' WHERE id = 'default'"
    )

    # 2. Update existing queue items
    items = cur.execute('SELECT id, title, description, hashtags FROM upload_queue').fetchall()
    for item_id, title, desc, tags in items:
        new_title = title.strip()
        if '#shorts' not in new_title.lower():
            if len(new_title) > 65:
                new_title = new_title[:62].strip() + '...'
            new_title = f'{new_title} #Shorts'
        
        new_desc = desc or ''
        if '#shorts' not in new_desc.lower():
            new_desc = f'#Shorts\n\n{new_desc}'
            
        cur.execute('UPDATE upload_queue SET title = ?, description = ? WHERE id = ?', (new_title, new_desc, item_id))
        print(f'Updated {item_id}: {new_title}')

    conn.commit()
    conn.close()
    print('Database successfully updated!')

if __name__ == '__main__':
    run()
