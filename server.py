# server.py
from flask import Flask, request, jsonify
import sqlite3
import os

app = Flask(__name__)
DB_PATH = "./assets/chessDB.sqlite"

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/save_data', methods=['POST'])
def save_data():
    data = request.json
    pos = data.get('position')
    moves = data.get('moves')

    print(pos)
    print(moves)
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # 1. Position 저장 (INSERT OR REPLACE)
        cursor.execute('''
            INSERT OR REPLACE INTO positions (fen, san, name_ko, name_en, eval, desc)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (pos['fen'], pos['san'], pos['name_ko'], pos['name_en'], pos['eval'], pos['desc']))

        # 2. 기존 추천 수 삭제
        cursor.execute('DELETE FROM moves WHERE parent_fen = ?', (pos['fen'],))

        # 3. 새로운 추천 수 삽입
        for m in moves:
            cursor.execute('''
                INSERT INTO moves (parent_fen, move_san, name, type, priority, branches)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (pos['fen'], m['move_san'], m['name'], m['type'], m['priority'], m['branches']))

        conn.commit()
        conn.close()
        print(f"✅ DB 업데이트 완료: {pos['name_ko']}")
        return jsonify({"status": "success"}), 200

    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    # 외부 접속 허용을 위해 0.0.0.0으로 실행
    app.run(host='0.0.0.0', port=8000)