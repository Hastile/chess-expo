# server.py
from flask import Flask, request, jsonify, send_from_directory
import sqlite3
import os
import time

app = Flask(__name__)
DB_PATH = "./assets/chessDB.sqlite"

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# 에셋 서빙 (동기화용)
@app.route('/assets/<path:filename>')
def serve_assets(filename):
    return send_from_directory('./assets', filename)

@app.route('/save_data', methods=['POST'])
def save_data():
    data = request.json
    pos = data.get('position')
    moves = data.get('moves')

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # 1. Position 저장
        cursor.execute('''
            INSERT OR REPLACE INTO positions (fen, san, name_ko, name_en, eval, desc)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (pos['fen'], pos['san'], pos['name_ko'], pos['name_en'], pos['eval'], pos['desc']))

        # 2. Moves 삭제 및 재삽입
        cursor.execute('DELETE FROM moves WHERE parent_fen = ?', (pos['fen'],))
        for m in moves:
            cursor.execute('''
                INSERT INTO moves (parent_fen, move_san, name, type, priority, branches)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (pos['fen'], m['move_san'], m['name'], m['type'], m['priority'], m['branches']))

        conn.commit()
        conn.close()

        # ✅ 중요: 방금 수정한 파일의 시간을 가져와서 앱에 알려줌 (앱의 동기화 skip용)
        mtime = os.path.getmtime(DB_PATH)
        last_modified = time.strftime('%a, %d %b %Y %H:%M:%S GMT', time.gmtime(mtime))

        print(f"✅ PC DB 업데이트 완료: {pos['name_ko']}")
        return jsonify({"status": "success", "last_modified": last_modified}), 200

    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)