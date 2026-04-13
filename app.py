"""
FaceTrack — Smart Attendance System with Face Recognition
Flask Backend Server
"""

import os
import json
import csv
import io
import sqlite3
from datetime import datetime, date
from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS

app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)

DATABASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'attendance.db')


def get_db():
    """Get database connection with row factory."""
    db = sqlite3.connect(DATABASE)
    db.row_factory = sqlite3.Row
    return db


def init_db():
    """Initialize database tables."""
    db = get_db()
    db.execute('''
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            roll_number TEXT UNIQUE NOT NULL,
            class_section TEXT NOT NULL,
            face_descriptors TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    db.execute('''
        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            status TEXT DEFAULT 'present',
            FOREIGN KEY (student_id) REFERENCES students(id),
            UNIQUE(student_id, date)
        )
    ''')
    db.commit()
    db.close()
    print("[OK] Database initialized")


# ─── Static Files ─────────────────────────────────────────────

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')


# ─── Student APIs ─────────────────────────────────────────────

@app.route('/api/students', methods=['GET'])
def get_students():
    """Get all registered students with their face descriptors."""
    db = get_db()
    students = db.execute(
        'SELECT id, name, roll_number, class_section, face_descriptors, created_at '
        'FROM students ORDER BY name'
    ).fetchall()
    result = []
    for s in students:
        result.append({
            'id': s['id'],
            'name': s['name'],
            'roll_number': s['roll_number'],
            'class_section': s['class_section'],
            'face_descriptors': json.loads(s['face_descriptors']),
            'created_at': s['created_at']
        })
    db.close()
    return jsonify(result)


@app.route('/api/students', methods=['POST'])
def add_student():
    """Register a new student with face descriptors."""
    data = request.json
    name = data.get('name')
    roll_number = data.get('roll_number')
    class_section = data.get('class_section')
    face_descriptors = data.get('face_descriptors')

    if not all([name, roll_number, class_section, face_descriptors]):
        return jsonify({'error': 'All fields are required'}), 400

    if len(face_descriptors) < 1:
        return jsonify({'error': 'At least 1 face sample is required'}), 400

    db = get_db()
    try:
        db.execute(
            'INSERT INTO students (name, roll_number, class_section, face_descriptors) VALUES (?, ?, ?, ?)',
            (name, roll_number, class_section, json.dumps(face_descriptors))
        )
        db.commit()
        student_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]
        db.close()
        print(f"[OK] Student registered: {name} ({roll_number})")
        return jsonify({'id': student_id, 'message': 'Student registered successfully'}), 201
    except sqlite3.IntegrityError:
        db.close()
        return jsonify({'error': 'Roll number already exists'}), 409


@app.route('/api/students/<int:student_id>', methods=['DELETE'])
def delete_student(student_id):
    """Delete a student and their attendance records."""
    db = get_db()
    student = db.execute('SELECT name FROM students WHERE id = ?', (student_id,)).fetchone()
    db.execute('DELETE FROM attendance WHERE student_id = ?', (student_id,))
    db.execute('DELETE FROM students WHERE id = ?', (student_id,))
    db.commit()
    db.close()
    name = student['name'] if student else 'Unknown'
    print(f"[OK] Student deleted: {name}")
    return jsonify({'message': 'Student deleted successfully'})


# ─── Attendance APIs ──────────────────────────────────────────

@app.route('/api/attendance', methods=['POST'])
def mark_attendance():
    """Mark attendance for a student."""
    data = request.json
    student_id = data.get('student_id')
    att_date = data.get('date', date.today().isoformat())
    att_time = data.get('time', datetime.now().strftime('%H:%M:%S'))

    if not student_id:
        return jsonify({'error': 'Student ID is required'}), 400

    db = get_db()
    try:
        db.execute(
            'INSERT INTO attendance (student_id, date, time) VALUES (?, ?, ?)',
            (student_id, att_date, att_time)
        )
        db.commit()
        student = db.execute('SELECT name FROM students WHERE id = ?', (student_id,)).fetchone()
        db.close()
        name = student['name'] if student else 'Unknown'
        print(f"[OK] Attendance marked: {name} on {att_date}")
        return jsonify({'message': 'Attendance marked successfully'}), 201
    except sqlite3.IntegrityError:
        db.close()
        return jsonify({'error': 'Attendance already marked for today'}), 409


@app.route('/api/attendance', methods=['GET'])
def get_attendance():
    """Get attendance records with optional filters."""
    att_date = request.args.get('date')
    student_id = request.args.get('student_id')
    class_section = request.args.get('class_section')

    query = '''
        SELECT a.id, a.date, a.time, a.status,
               s.id as student_id, s.name, s.roll_number, s.class_section
        FROM attendance a
        JOIN students s ON a.student_id = s.id
        WHERE 1=1
    '''
    params = []

    if att_date:
        query += ' AND a.date = ?'
        params.append(att_date)
    if student_id:
        query += ' AND a.student_id = ?'
        params.append(student_id)
    if class_section:
        query += ' AND s.class_section = ?'
        params.append(class_section)

    query += ' ORDER BY a.date DESC, a.time DESC'

    db = get_db()
    records = db.execute(query, params).fetchall()
    result = []
    for r in records:
        result.append({
            'id': r['id'],
            'date': r['date'],
            'time': r['time'],
            'status': r['status'],
            'student_id': r['student_id'],
            'name': r['name'],
            'roll_number': r['roll_number'],
            'class_section': r['class_section']
        })
    db.close()
    return jsonify(result)


@app.route('/api/attendance/export', methods=['GET'])
def export_attendance():
    """Export attendance records as CSV."""
    att_date = request.args.get('date')
    class_section = request.args.get('class_section')

    query = '''
        SELECT a.date, a.time, s.name, s.roll_number, s.class_section, a.status
        FROM attendance a
        JOIN students s ON a.student_id = s.id
        WHERE 1=1
    '''
    params = []

    if att_date:
        query += ' AND a.date = ?'
        params.append(att_date)
    if class_section:
        query += ' AND s.class_section = ?'
        params.append(class_section)

    query += ' ORDER BY a.date DESC, s.name'

    db = get_db()
    records = db.execute(query, params).fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Date', 'Time', 'Name', 'Roll Number', 'Class/Section', 'Status'])
    for r in records:
        writer.writerow([r['date'], r['time'], r['name'], r['roll_number'], r['class_section'], r['status']])

    db.close()

    return Response(
        output.getvalue(),
        mimetype='text/csv',
        headers={'Content-Disposition': f'attachment; filename=attendance_{att_date or "all"}.csv'}
    )


# ─── Dashboard API ────────────────────────────────────────────

@app.route('/api/dashboard', methods=['GET'])
def dashboard():
    """Get dashboard statistics."""
    db = get_db()

    total_students = db.execute('SELECT COUNT(*) FROM students').fetchone()[0]
    today = date.today().isoformat()
    today_present = db.execute('SELECT COUNT(*) FROM attendance WHERE date = ?', (today,)).fetchone()[0]

    # Attendance rate (last 30 days)
    total_days = db.execute('''
        SELECT COUNT(DISTINCT date) as days FROM attendance
        WHERE date >= date('now', '-30 days')
    ''').fetchone()[0]

    avg_attendance = 0
    if total_students > 0 and total_days > 0:
        total_marked = db.execute('''
            SELECT COUNT(*) FROM attendance
            WHERE date >= date('now', '-30 days')
        ''').fetchone()[0]
        avg_attendance = round((total_marked / (total_students * total_days)) * 100, 1)

    # Recent 7 days trend
    trend = db.execute('''
        SELECT date, COUNT(*) as count
        FROM attendance
        WHERE date >= date('now', '-7 days')
        GROUP BY date
        ORDER BY date
    ''').fetchall()

    # Per-student attendance
    student_stats = db.execute('''
        SELECT s.name, s.roll_number, COUNT(a.id) as present_days
        FROM students s
        LEFT JOIN attendance a ON s.id = a.student_id
        GROUP BY s.id
        ORDER BY s.name
    ''').fetchall()

    # Get all classes
    classes = db.execute('SELECT DISTINCT class_section FROM students ORDER BY class_section').fetchall()

    db.close()

    return jsonify({
        'total_students': total_students,
        'today_present': today_present,
        'today_absent': total_students - today_present,
        'avg_attendance': avg_attendance,
        'trend': [{'date': t['date'], 'count': t['count']} for t in trend],
        'student_stats': [{'name': s['name'], 'roll_number': s['roll_number'], 'present_days': s['present_days']} for s in student_stats],
        'classes': [c['class_section'] for c in classes]
    })


# ─── Run Server ───────────────────────────────────────────────

if __name__ == '__main__':
    init_db()
    print("\n" + "=" * 50)
    print("  FaceTrack - Smart Attendance System")
    print("  http://localhost:5000")
    print("=" * 50 + "\n")
    app.run(debug=True, port=5000)
