const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Tạo database file
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Khởi tạo bảng late_requests
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS late_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mssv TEXT NOT NULL,
            fullname TEXT NOT NULL,
            class_session TEXT NOT NULL,
            reason TEXT NOT NULL,
            photo_path TEXT,
            latitude REAL,
            longitude REAL,
            address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log('✅ Database đã được khởi tạo thành công!');
});

module.exports = db;
