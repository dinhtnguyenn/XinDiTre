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
// Cấu hình thời gian các ca học
// ============================================
const CLASS_SCHEDULES = {
    'Ca 1 (07:15 - 09:15)': { hour: 7, minute: 15 },
    'Ca 2 (09:25 - 11:25)': { hour: 9, minute: 25 },
    'Ca 3 (12:00 - 14:00)': { hour: 12, minute: 0 },
    'Ca 4 (14:10 - 16:10)': { hour: 14, minute: 10 },
    'Ca 5 (16:20 - 18:20)': { hour: 16, minute: 20 },
    'Ca 6 (18:30 - 20:30)': { hour: 18, minute: 30 }
};

// Hạn xin đi trễ: 14 phút 30 giây sau khi bắt đầu ca
const DEADLINE_MINUTES = 14;
const DEADLINE_SECONDS = 30;

// ============================================
// Hàm kiểm tra trong hạn/ngoài hạn
// ============================================
function checkDeadlineStatus(classSession, submittedAt) {
    const schedule = CLASS_SCHEDULES[classSession];
    if (!schedule) {
        return { isWithinDeadline: null, message: 'Không xác định' };
    }

    const submitted = new Date(submittedAt);

    // Tạo deadline cho ca học (ngày submit + giờ bắt đầu + 14:30)
    const deadline = new Date(submitted);
    deadline.setHours(schedule.hour, schedule.minute + DEADLINE_MINUTES, DEADLINE_SECONDS, 0);

    const isWithinDeadline = submitted <= deadline;

    // Tính khoảng cách thời gian
    const diffMs = submitted - deadline;
    const diffMinutes = Math.abs(Math.floor(diffMs / 60000));
    const diffSeconds = Math.abs(Math.floor((diffMs % 60000) / 1000));

    let message;
    if (isWithinDeadline) {
        message = `✅ Trong hạn (trước ${diffMinutes}p${diffSeconds}s)`;
    } else {
        message = `❌ Ngoài hạn (trễ ${diffMinutes}p${diffSeconds}s)`;
    }

    return { isWithinDeadline, message, deadline: deadline.toISOString() };
}

// ============================================
// Telegram Notification Function
// ============================================
async function sendTelegramNotification(data) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.log('⚠️ Telegram chưa được cấu hình');
        return;
    }

    const now = new Date();
    const deadlineStatus = checkDeadlineStatus(data.class_session, now);
    const statusIcon = deadlineStatus.isWithinDeadline ? '✅' : '❌';
    const statusText = deadlineStatus.isWithinDeadline ? 'TRONG HẠN' : 'NGOÀI HẠN';

    const message = `
🔔 *YÊU CẦU XIN ĐI TRỄ MỚI*

👤 *Sinh viên:* ${data.fullname}
🆔 *MSSV:* ${data.mssv}
📚 *Ca học:* ${data.class_session}
📝 *Lý do:* ${data.reason}
📍 *Vị trí:* ${data.address || 'Không xác định'}
⏰ *Thời gian:* ${now.toLocaleString('vi-VN')}

${statusIcon} *Trạng thái:* ${statusText}
${deadlineStatus.message}
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
// API: Admin lấy danh sách (có filter + deadline status)
// ============================================
app.get('/api/late-requests', requireAdminAuth, async (req, res) => {
    try {
        const { filter, search, deadline_filter } = req.query;
        let data = await getRequests();

        // Thêm trạng thái trong hạn/ngoài hạn cho mỗi record
        data = data.map(req => {
            const deadlineStatus = checkDeadlineStatus(req.class_session, req.created_at);
            return {
                ...req,
                is_within_deadline: deadlineStatus.isWithinDeadline,
                deadline_message: deadlineStatus.message
            };
        });

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

        // Lọc theo trạng thái deadline
        if (deadline_filter === 'within') {
            data = data.filter(req => req.is_within_deadline === true);
        } else if (deadline_filter === 'outside') {
            data = data.filter(req => req.is_within_deadline === false);
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
        let studentData = allData.filter(req => req.mssv === mssv);

        // Thêm trạng thái deadline
        studentData = studentData.map(req => {
            const deadlineStatus = checkDeadlineStatus(req.class_session, req.created_at);
            return {
                ...req,
                is_within_deadline: deadlineStatus.isWithinDeadline,
                deadline_message: deadlineStatus.message
            };
        });

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
        let data = await getRequests();

        // Thêm trạng thái deadline cho thống kê
        data = data.map(req => {
            const deadlineStatus = checkDeadlineStatus(req.class_session, req.created_at);
            return { ...req, is_within_deadline: deadlineStatus.isWithinDeadline };
        });

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
            const dateStr = new Date(req.created_at).toISOString().split('T')[0];
            if (dailyStats[dateStr] !== undefined) {
                dailyStats[dateStr]++;
            }

            const classSession = req.class_session || 'Không xác định';
            classStats[classSession] = (classStats[classSession] || 0) + 1;
        });

        // Thống kê trong hạn/ngoài hạn
        const withinDeadline = data.filter(r => r.is_within_deadline === true).length;
        const outsideDeadline = data.filter(r => r.is_within_deadline === false).length;

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
            byDeadline: {
                within: withinDeadline,
                outside: outsideDeadline
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
    ⏱️  Hạn xin đi trễ: ${DEADLINE_MINUTES}p${DEADLINE_SECONDS}s sau khi bắt đầu ca
    ☁️  Database: Supabase Cloud
        `);
    });
});
