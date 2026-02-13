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
// Mật khẩu động: Dinh@ + ddmm (theo múi giờ Việt Nam)
function getDynamicPassword() {
    const now = new Date();
    const vnTimeStr = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
    const vnTime = new Date(vnTimeStr);
    const dd = String(vnTime.getDate()).padStart(2, '0');
    const mm = String(vnTime.getMonth() + 1).padStart(2, '0');
    return `Dinh@${dd}${mm}`;
}

// Lấy ngày hiện tại (VN) dạng YYYY-MM-DD để so sánh session
function getTodayVN() {
    const now = new Date();
    const vnTimeStr = now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
    const vnTime = new Date(vnTimeStr);
    const yyyy = vnTime.getFullYear();
    const mm = String(vnTime.getMonth() + 1).padStart(2, '0');
    const dd = String(vnTime.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}
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
// Trong hạn = trước khi bắt đầu ca HOẶC trong vòng 14p30s sau khi bắt đầu ca
// ============================================
function checkDeadlineStatus(classSession, submittedAt) {
    const schedule = CLASS_SCHEDULES[classSession];
    if (!schedule) {
        return { isWithinDeadline: null, message: 'Không xác định' };
    }

    // Chuyển thời gian submit về Date object
    const submitted = new Date(submittedAt);

    // Lấy giờ submit theo múi giờ Việt Nam (UTC+7)
    // Sử dụng toLocaleString để lấy thời gian đúng timezone
    const vnTimeStr = submitted.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
    const vnTime = new Date(vnTimeStr);
    const submittedHour = vnTime.getHours();
    const submittedMinute = vnTime.getMinutes();
    const submittedSecond = vnTime.getSeconds();

    // Thời gian bắt đầu ca (hour:minute:00)
    const classStartHour = schedule.hour;
    const classStartMinute = schedule.minute;

    // Deadline = bắt đầu ca + 14 phút 30 giây
    let deadlineHour = classStartHour;
    let deadlineMinute = classStartMinute + DEADLINE_MINUTES;
    let deadlineSecond = DEADLINE_SECONDS;

    // Xử lý nếu phút vượt quá 60
    if (deadlineMinute >= 60) {
        deadlineHour += 1;
        deadlineMinute -= 60;
    }

    // Chuyển tất cả về giây để so sánh dễ hơn
    const submittedTotalSeconds = submittedHour * 3600 + submittedMinute * 60 + submittedSecond;
    const classStartTotalSeconds = classStartHour * 3600 + classStartMinute * 60;
    const deadlineTotalSeconds = deadlineHour * 3600 + deadlineMinute * 60 + deadlineSecond;

    // Trong hạn nếu gửi trước hoặc đúng deadline
    const isWithinDeadline = submittedTotalSeconds <= deadlineTotalSeconds;

    // Tính khoảng cách thời gian
    const diffFromStart = submittedTotalSeconds - classStartTotalSeconds;
    const diffMinutes = Math.floor(Math.abs(diffFromStart) / 60);
    const diffSeconds = Math.abs(diffFromStart) % 60;

    let message;
    if (submittedTotalSeconds < classStartTotalSeconds) {
        // Gửi trước khi bắt đầu ca
        message = `✅ Trong hạn (gửi trước ${diffMinutes}p${diffSeconds}s khi bắt đầu ca)`;
    } else if (isWithinDeadline) {
        // Gửi sau khi bắt đầu ca nhưng trong hạn
        message = `✅ Trong hạn (gửi sau ${diffMinutes}p${diffSeconds}s khi bắt đầu ca)`;
    } else {
        // Gửi quá hạn
        const lateSeconds = submittedTotalSeconds - deadlineTotalSeconds;
        const lateMinutes = Math.floor(lateSeconds / 60);
        const lateSecs = lateSeconds % 60;
        message = `❌ Ngoài hạn (trễ ${lateMinutes}p${lateSecs}s so với hạn 14p30s)`;
    }

    return {
        isWithinDeadline,
        message,
        submittedTime: `${submittedHour}:${submittedMinute}:${submittedSecond}`,
        deadline: `${deadlineHour}:${deadlineMinute}:${deadlineSecond}`
    };
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

    // Kiểm tra mật khẩu động theo ngày hiện tại
    if (password !== getDynamicPassword()) {
        return res.status(401).json({
            success: false,
            message: 'Phiên đăng nhập đã hết hạn! Mật khẩu thay đổi mỗi ngày.'
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
    const todayPassword = getDynamicPassword();

    if (password === todayPassword) {
        res.json({
            success: true,
            message: 'Đăng nhập thành công!',
            loginDate: getTodayVN()  // Trả về ngày đăng nhập để client kiểm tra
        });
    } else {
        res.status(401).json({ success: false, message: 'Mật khẩu không đúng!' });
    }
});

// ============================================
// API: Lookup sinh viên theo MSSV (PUBLIC)
// ============================================
app.get('/api/lookup-student/:mssv', async (req, res) => {
    try {
        const { mssv } = req.params;

        if (!mssv || mssv.trim().length < 3) {
            return res.json({ success: false, found: false });
        }

        const allRequests = await getRequests();
        const studentRequest = allRequests.find(r => r.mssv.toLowerCase() === mssv.toLowerCase().trim());

        if (studentRequest) {
            res.json({
                success: true,
                found: true,
                fullname: studentRequest.fullname
            });
        } else {
            res.json({ success: true, found: false });
        }
    } catch (error) {
        console.error('Lỗi lookup MSSV:', error);
        res.json({ success: false, found: false });
    }
});

// ============================================
// API: Lịch sử sinh viên theo MSSV (PUBLIC)
// ============================================
app.get('/api/student-history/:mssv', async (req, res) => {
    try {
        const { mssv } = req.params;

        if (!mssv || mssv.trim().length < 3) {
            return res.json({ success: false, data: [], total: 0 });
        }

        const allRequests = await getRequests();
        const studentRequests = allRequests.filter(r =>
            r.mssv.toLowerCase() === mssv.toLowerCase().trim()
        );

        // Thêm deadline status cho mỗi request
        const dataWithStatus = studentRequests.map(req => {
            const deadlineStatus = checkDeadlineStatus(req.class_session, req.created_at);
            return {
                ...req,
                is_within_deadline: deadlineStatus.isWithinDeadline,
                deadline_message: deadlineStatus.message
            };
        });

        // Calculate Monthly Count (Vietnam Time)
        const nowVNStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
        const nowVN = new Date(nowVNStr);
        const currentMonth = nowVN.getMonth();
        const currentYear = nowVN.getFullYear();

        const monthlyCount = studentRequests.filter(req => {
            const reqDate = new Date(req.created_at);
            const vnReqDateStr = reqDate.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
            const vnReqDate = new Date(vnReqDateStr);
            return vnReqDate.getMonth() === currentMonth && vnReqDate.getFullYear() === currentYear;
        }).length;

        res.json({
            success: true,
            data: dataWithStatus,
            total: studentRequests.length,
            monthlyCount: monthlyCount,
            monthName: nowVN.toLocaleString('vi-VN', { month: 'long', year: 'numeric' })
        });
    } catch (error) {
        console.error('Lỗi lấy lịch sử sinh viên:', error);
        res.json({ success: false, data: [], total: 0 });
    }
});

// ============================================
// API: Sinh viên gửi yêu cầu (PUBLIC)
// ============================================
app.post('/api/late-requests', upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'evidence', maxCount: 1 }]), async (req, res) => {
    try {
        let { mssv, fullname, class_session, reason, latitude, longitude, address } = req.body;

        // Trim tất cả input để chống bypass bằng khoảng trắng
        mssv = (mssv || '').trim().toUpperCase();
        fullname = (fullname || '').trim();
        class_session = (class_session || '').trim();
        reason = (reason || '').trim();
        address = (address || '').trim();

        // Validate bắt buộc
        if (!mssv || !fullname || !class_session || !reason) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng điền đầy đủ thông tin!'
            });
        }

        // Validate độ dài tối thiểu
        if (mssv.length < 3) {
            return res.status(400).json({
                success: false,
                message: 'MSSV phải có ít nhất 3 ký tự!'
            });
        }

        if (fullname.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Họ tên phải có ít nhất 2 ký tự!'
            });
        }

        if (reason.length < 5) {
            return res.status(400).json({
                success: false,
                message: 'Lý do phải có ít nhất 5 ký tự!'
            });
        }

        // Validate ca học hợp lệ
        if (!CLASS_SCHEDULES[class_session]) {
            return res.status(400).json({
                success: false,
                message: 'Ca học không hợp lệ!'
            });
        }

        // Validate ảnh
        if (!req.files || !req.files.photo || req.files.photo.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng chụp ảnh selfie!'
            });
        }

        let photo_url = null;
        let evidence_url = null;
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);

        // Upload selfie
        const fileName = `selfie-${uniqueSuffix}.jpg`;
        photo_url = await uploadPhoto(req.files.photo[0].buffer, fileName);

        // Upload evidence if exists
        if (req.files.evidence && req.files.evidence.length > 0) {
            const evidenceFileName = `evidence-${uniqueSuffix}.jpg`;
            evidence_url = await uploadPhoto(req.files.evidence[0].buffer, evidenceFileName);
        }

        const result = await createRequest({
            mssv,
            fullname,
            class_session,
            reason,
            photo_url,
            evidence_url,
            latitude: parseFloat(latitude) || null,
            longitude: parseFloat(longitude) || null,
            address
        });

        // Gửi thông báo Telegram
        sendTelegramNotification({ mssv, fullname, class_session, reason, address });

        // Đếm số lần xin trong tháng của sinh viên
        const allRequests = await getRequests();
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const monthlyCount = allRequests.filter(r => {
            if (r.mssv.toUpperCase() !== mssv) return false;

            // Convert to Vietnam Time string then parse back to get components
            const reqDate = new Date(r.created_at);
            const vnReqDateStr = reqDate.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
            const vnReqDate = new Date(vnReqDateStr);

            const nowVNStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
            const nowVN = new Date(nowVNStr);

            return vnReqDate.getMonth() === nowVN.getMonth() && vnReqDate.getFullYear() === nowVN.getFullYear();
        }).length;

        res.json({
            success: true,
            message: 'Gửi yêu cầu xin đi trễ thành công!',
            id: result.id,
            monthlyCount: monthlyCount,
            monthName: now.toLocaleString('vi-VN', { month: 'long', year: 'numeric' })
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
        let studentData = allData.filter(req => req.mssv.toUpperCase() === mssv.toUpperCase());

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
            }).length,
            thisMonth: data.filter(req => {
                const now = new Date();
                const reqDate = new Date(req.created_at);
                return reqDate.getMonth() === now.getMonth() && reqDate.getFullYear() === now.getFullYear();
            }).length,
            // Top 10 sinh viên xin nhiều nhất (tháng này)
            topStudents: (() => {
                const now = new Date();
                const monthlyData = data.filter(req => {
                    const reqDate = new Date(req.created_at);
                    return reqDate.getMonth() === now.getMonth() && reqDate.getFullYear() === now.getFullYear();
                });

                const studentCounts = {};
                monthlyData.forEach(req => {
                    const key = req.mssv.toUpperCase();
                    if (!studentCounts[key]) {
                        studentCounts[key] = { mssv: req.mssv.toUpperCase(), fullname: req.fullname, count: 0 };
                    }
                    studentCounts[key].count++;
                });

                return Object.values(studentCounts)
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10);
            })(),
            // Thống kê theo tuần (4 tuần gần nhất)
            weekly: (() => {
                const weeklyStats = [];
                for (let i = 3; i >= 0; i--) {
                    const weekStart = new Date();
                    weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
                    const weekEnd = new Date();
                    weekEnd.setDate(weekEnd.getDate() - i * 7);

                    const count = data.filter(req => {
                        const reqDate = new Date(req.created_at);
                        return reqDate >= weekStart && reqDate < weekEnd;
                    }).length;

                    weeklyStats.push({
                        label: `Tuần ${4 - i}`,
                        count: count
                    });
                }
                return weeklyStats;
            })(),
            // Thống kê theo tháng (6 tháng gần nhất)
            monthly: (() => {
                const monthlyStats = [];
                for (let i = 5; i >= 0; i--) {
                    const date = new Date();
                    date.setMonth(date.getMonth() - i);
                    const month = date.getMonth();
                    const year = date.getFullYear();

                    const count = data.filter(req => {
                        const reqDate = new Date(req.created_at);
                        return reqDate.getMonth() === month && reqDate.getFullYear() === year;
                    }).length;

                    monthlyStats.push({
                        label: `${date.getMonth() + 1}/${date.getFullYear()}`,
                        count: count
                    });
                }
                return monthlyStats;
            })()
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
// API: Admin xóa nhiều yêu cầu (Bulk Delete)
// ============================================
app.post('/api/late-requests/bulk-delete', requireAdminAuth, async (req, res) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng chọn ít nhất 1 yêu cầu để xóa!'
            });
        }

        let deletedCount = 0;
        for (const id of ids) {
            try {
                await deleteRequest(id);
                deletedCount++;
            } catch (err) {
                console.error(`Lỗi xóa ID ${id}:`, err);
            }
        }

        res.json({
            success: true,
            message: `Đã xóa ${deletedCount}/${ids.length} yêu cầu!`,
            deletedCount
        });
    } catch (error) {
        console.error('Lỗi bulk delete:', error);
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
    🔐 Mật khẩu admin: ${getDynamicPassword()} (thay đổi mỗi ngày)
    📲 Telegram: ${TELEGRAM_CHAT_ID ? 'Đã cấu hình' : 'Chưa cấu hình'}
    ⏱️  Hạn xin đi trễ: ${DEADLINE_MINUTES}p${DEADLINE_SECONDS}s sau khi bắt đầu ca
    ☁️  Database: Supabase Cloud
        `);
    });
});
