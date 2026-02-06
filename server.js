const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Tạo thư mục uploads nếu chưa có
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Cấu hình Multer để upload ảnh
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'selfie-' + uniqueSuffix + '.jpg');
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Max 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Chỉ được upload file ảnh!'), false);
        }
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

// API: Sinh viên gửi yêu cầu xin đi trễ
app.post('/api/late-requests', upload.single('photo'), (req, res) => {
    const { mssv, fullname, class_session, reason, latitude, longitude, address } = req.body;
    const photo_path = req.file ? `/uploads/${req.file.filename}` : null;

    // Validate dữ liệu
    if (!mssv || !fullname || !class_session || !reason) {
        return res.status(400).json({
            success: false,
            message: 'Vui lòng điền đầy đủ thông tin!'
        });
    }

    // Lưu vào database
    const sql = `
        INSERT INTO late_requests (mssv, fullname, class_session, reason, photo_path, latitude, longitude, address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(sql, [mssv, fullname, class_session, reason, photo_path, latitude, longitude, address], function (err) {
        if (err) {
            console.error('Lỗi khi lưu yêu cầu:', err);
            return res.status(500).json({
                success: false,
                message: 'Có lỗi xảy ra khi lưu yêu cầu!'
            });
        }

        res.json({
            success: true,
            message: 'Gửi yêu cầu xin đi trễ thành công!',
            id: this.lastID
        });
    });
});

// API: Admin lấy danh sách yêu cầu
app.get('/api/late-requests', (req, res) => {
    const sql = `SELECT * FROM late_requests ORDER BY created_at DESC`;

    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Lỗi khi lấy danh sách:', err);
            return res.status(500).json({
                success: false,
                message: 'Có lỗi xảy ra!'
            });
        }

        res.json({
            success: true,
            data: rows
        });
    });
});

// API: Admin xóa yêu cầu
app.delete('/api/late-requests/:id', (req, res) => {
    const { id } = req.params;

    // Lấy thông tin ảnh trước khi xóa
    db.get('SELECT photo_path FROM late_requests WHERE id = ?', [id], (err, row) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Có lỗi xảy ra!' });
        }

        // Xóa file ảnh nếu có
        if (row && row.photo_path) {
            const filePath = path.join(__dirname, row.photo_path);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        // Xóa record trong database
        db.run('DELETE FROM late_requests WHERE id = ?', [id], function (err) {
            if (err) {
                return res.status(500).json({ success: false, message: 'Có lỗi xảy ra!' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu!' });
            }

            res.json({ success: true, message: 'Đã xóa yêu cầu thành công!' });
        });
    });
});

// Khởi động server
app.listen(PORT, () => {
    console.log(`
    🚀 Server đang chạy tại: http://localhost:${PORT}
    📱 Trang sinh viên: http://localhost:${PORT}
    👨‍🏫 Trang admin: http://localhost:${PORT}/admin.html
    `);
});
