const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { initDatabase, createRequest, getRequests, deleteRequest, uploadPhoto } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Cấu hình Multer để xử lý upload (lưu trong memory)
const upload = multer({
    storage: multer.memoryStorage(),
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

// API: Sinh viên gửi yêu cầu xin đi trễ
app.post('/api/late-requests', upload.single('photo'), async (req, res) => {
    try {
        const { mssv, fullname, class_session, reason, latitude, longitude, address } = req.body;

        // Validate dữ liệu
        if (!mssv || !fullname || !class_session || !reason) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng điền đầy đủ thông tin!'
            });
        }

        // Upload ảnh lên Supabase Storage
        let photo_url = null;
        if (req.file) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const fileName = `selfie-${uniqueSuffix}.jpg`;
            photo_url = await uploadPhoto(req.file.buffer, fileName);
        }

        // Lưu vào database
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

// API: Admin lấy danh sách yêu cầu
app.get('/api/late-requests', async (req, res) => {
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

// API: Admin xóa yêu cầu
app.delete('/api/late-requests/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await deleteRequest(id);
        res.json({ success: true, message: 'Đã xóa yêu cầu thành công!' });
    } catch (error) {
        console.error('Lỗi khi xóa:', error);
        res.status(500).json({ success: false, message: 'Có lỗi xảy ra!' });
    }
});

// Khởi động server
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`
    🚀 Server đang chạy tại: http://localhost:${PORT}
    📱 Trang sinh viên: http://localhost:${PORT}
    👨‍🏫 Trang admin: http://localhost:${PORT}/admin.html
    ☁️  Database: Supabase Cloud
        `);
    });
});
