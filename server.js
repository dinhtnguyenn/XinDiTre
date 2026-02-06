const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { initDatabase, createRequest, getRequests, deleteRequest, uploadPhoto } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// Cấu hình Admin Password
// ============================================
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Dinh6997@@';

// Middleware kiểm tra xác thực admin
function requireAdminAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            success: false,
            message: 'Cần đăng nhập để truy cập!'
        });
    }

    // Basic Auth: "Basic base64(password)"
    const token = authHeader.split(' ')[1];
    const password = Buffer.from(token, 'base64').toString();

    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({
            success: false,
            message: 'Mật khẩu không đúng!'
        });
    }

    next();
}

// ============================================
// Cấu hình Multer
// ============================================
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Chỉ được upload file ảnh!'), false);
        }
    }
});

// ============================================
// Middleware
// ============================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// API: Đăng nhập admin
// ============================================
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;

    if (password === ADMIN_PASSWORD) {
        res.json({
            success: true,
            message: 'Đăng nhập thành công!'
        });
    } else {
        res.status(401).json({
            success: false,
            message: 'Mật khẩu không đúng!'
        });
    }
});

// ============================================
// API: Sinh viên gửi yêu cầu (PUBLIC)
// ============================================
app.post('/api/late-requests', upload.single('photo'), async (req, res) => {
    try {
        const { mssv, fullname, class_session, reason, latitude, longitude, address } = req.body;

        if (!mssv || !fullname || !class_session || !reason) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng điền đầy đủ thông tin!'
            });
        }

        let photo_url = null;
        if (req.file) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const fileName = `selfie-${uniqueSuffix}.jpg`;
            photo_url = await uploadPhoto(req.file.buffer, fileName);
        }

        const result = await createRequest({
            mssv,
            fullname,
            class_session,
            reason,
            photo_url,
            latitude: parseFloat(latitude) || null,
            longitude: parseFloat(longitude) || null,
            address
        });

        res.json({
            success: true,
            message: 'Gửi yêu cầu xin đi trễ thành công!',
            id: result.id
        });

    } catch (error) {
        console.error('Lỗi khi lưu yêu cầu:', error);
        res.status(500).json({
            success: false,
            message: 'Có lỗi xảy ra khi lưu yêu cầu!'
        });
    }
});

// ============================================
// API: Admin lấy danh sách (YÊU CẦU XÁC THỰC)
// ============================================
app.get('/api/late-requests', requireAdminAuth, async (req, res) => {
    try {
        const data = await getRequests();
        res.json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error('Lỗi khi lấy danh sách:', error);
        res.status(500).json({
            success: false,
            message: 'Có lỗi xảy ra!'
        });
    }
});

// ============================================
// API: Admin xóa yêu cầu (YÊU CẦU XÁC THỰC)
// ============================================
app.delete('/api/late-requests/:id', requireAdminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        await deleteRequest(id);
        res.json({ success: true, message: 'Đã xóa yêu cầu thành công!' });
    } catch (error) {
        console.error('Lỗi khi xóa:', error);
        res.status(500).json({ success: false, message: 'Có lỗi xảy ra!' });
    }
});

// ============================================
// Khởi động server
// ============================================
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`
    🚀 Server đang chạy tại: http://localhost:${PORT}
    📱 Trang sinh viên: http://localhost:${PORT}
    👨‍🏫 Trang admin: http://localhost:${PORT}/admin.html
    🔐 Mật khẩu admin: ${ADMIN_PASSWORD}
    ☁️  Database: Supabase Cloud
        `);
    });
});
