const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const { initDatabase, createRequest, getRequests, deleteRequest, uploadPhoto } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// Cấu hình Admin Password & Telegram
// ============================================
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Dinh6997@@';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8500292800:AAFIzax4FeqAEapejBqKq2647lfPtfCFnqQ';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '454920130';

// ============================================
// Telegram Notification Function
// ============================================
async function sendTelegramNotification(data) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.log('⚠️ Telegram chưa được cấu hình');
        return;
    }

    const message = `
🔔 *YÊU CẦU XIN ĐI TRỄ MỚI*

👤 *Sinh viên:* ${data.fullname}
🆔 *MSSV:* ${data.mssv}
📚 *Ca học:* ${data.class_session}
📝 *Lý do:* ${data.reason}
📍 *Vị trí:* ${data.address || 'Không xác định'}
⏰ *Thời gian:* ${new Date().toLocaleString('vi-VN')}
    `.trim();

    try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'Markdown'
            })
        });

        const result = await response.json();
        if (result.ok) {
            console.log('✅ Đã gửi thông báo Telegram');
        } else {
            console.error('❌ Lỗi gửi Telegram:', result.description);
        }
    } catch (error) {
        console.error('❌ Lỗi gửi Telegram:', error.message);
    }
}

// ============================================
// Middleware kiểm tra xác thực admin
// ============================================
function requireAdminAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            success: false,
            message: 'Cần đăng nhập để truy cập!'
        });
    }

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
        res.json({ success: true, message: 'Đăng nhập thành công!' });
    } else {
        res.status(401).json({ success: false, message: 'Mật khẩu không đúng!' });
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

        // Gửi thông báo Telegram
        sendTelegramNotification({ mssv, fullname, class_session, reason, address });

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
// API: Admin lấy danh sách (có filter)
// ============================================
app.get('/api/late-requests', requireAdminAuth, async (req, res) => {
    try {
        const { filter, search } = req.query;
        let data = await getRequests();

        // Lọc theo thời gian
        if (filter) {
            const now = new Date();
            let startDate;

            switch (filter) {
                case 'today':
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case 'week':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
            }

            if (startDate) {
                data = data.filter(req => new Date(req.created_at) >= startDate);
            }
        }

        // Tìm kiếm theo MSSV hoặc tên
        if (search) {
            const searchLower = search.toLowerCase();
            data = data.filter(req =>
                req.mssv.toLowerCase().includes(searchLower) ||
                req.fullname.toLowerCase().includes(searchLower)
            );
        }

        res.json({ success: true, data: data });
    } catch (error) {
        console.error('Lỗi khi lấy danh sách:', error);
        res.status(500).json({ success: false, message: 'Có lỗi xảy ra!' });
    }
});

// ============================================
// API: Lấy lịch sử của sinh viên theo MSSV
// ============================================
app.get('/api/late-requests/student/:mssv', requireAdminAuth, async (req, res) => {
    try {
        const { mssv } = req.params;
        const allData = await getRequests();
        const studentData = allData.filter(req => req.mssv === mssv);

        res.json({
            success: true,
            data: studentData,
            total: studentData.length
        });
    } catch (error) {
        console.error('Lỗi khi lấy lịch sử:', error);
        res.status(500).json({ success: false, message: 'Có lỗi xảy ra!' });
    }
});

// ============================================
// API: Thống kê cho biểu đồ
// ============================================
app.get('/api/statistics', requireAdminAuth, async (req, res) => {
    try {
        const data = await getRequests();

        // Thống kê theo ngày (7 ngày gần nhất)
        const dailyStats = {};
        const classStats = {};

        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            dailyStats[dateStr] = 0;
        }

        data.forEach(req => {
            // Thống kê theo ngày
            const dateStr = new Date(req.created_at).toISOString().split('T')[0];
            if (dailyStats[dateStr] !== undefined) {
                dailyStats[dateStr]++;
            }

            // Thống kê theo ca học
            const classSession = req.class_session || 'Không xác định';
            classStats[classSession] = (classStats[classSession] || 0) + 1;
        });

        res.json({
            success: true,
            daily: {
                labels: Object.keys(dailyStats).map(d => {
                    const date = new Date(d);
                    return `${date.getDate()}/${date.getMonth() + 1}`;
                }),
                values: Object.values(dailyStats)
            },
            byClass: {
                labels: Object.keys(classStats),
                values: Object.values(classStats)
            },
            total: data.length,
            thisWeek: data.filter(req => {
                const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                return new Date(req.created_at) >= weekAgo;
            }).length
        });
    } catch (error) {
        console.error('Lỗi khi lấy thống kê:', error);
        res.status(500).json({ success: false, message: 'Có lỗi xảy ra!' });
    }
});

// ============================================
// API: Admin xóa yêu cầu
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
    📲 Telegram: ${TELEGRAM_CHAT_ID ? 'Đã cấu hình' : 'Chưa cấu hình'}
    ☁️  Database: Supabase Cloud
        `);
    });
});
