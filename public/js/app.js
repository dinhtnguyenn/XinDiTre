// ============================================
// Variables & State
// ============================================
let stream = null;
let photoBlob = null;
let latitude = null;
let longitude = null;
let address = null;
let isAutoFilled = false;
let miniMap = null;
let countdownInterval = null;
let monthlyCount = 0;
let faceModel = null; // AI Face Model
let currentWeather = null; // Weather condition
let weatherTemp = null; // Temperature
let weatherCode = null; // WMO Weather code

// Evidence Cam Variables
let evidenceStream = null;
let evidenceBlob = null;
let evidenceUsingFrontCamera = false; // Track if using front camera

// Class schedules (phải khớp với server)
const CLASS_SCHEDULES = {
    'Ca 1 (07:15 - 09:15)': { hour: 7, minute: 15 },
    'Ca 2 (09:25 - 11:25)': { hour: 9, minute: 25 },
    'Ca 3 (12:00 - 14:00)': { hour: 12, minute: 0 },
    'Ca 4 (14:10 - 16:10)': { hour: 14, minute: 10 },
    'Ca 5 (16:20 - 18:20)': { hour: 16, minute: 20 },
    'Ca 6 (18:30 - 20:30)': { hour: 18, minute: 30 }
};

// Tọa độ trường (FPT Polytechnic TP.HCM - CS3)
const SCHOOL_COORDS = {
    latitude: 10.853784,
    longitude: 106.626292
};

// DOM Elements
const form = document.getElementById('lateRequestForm');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const photoPreview = document.getElementById('photoPreview');
const cameraOverlay = document.getElementById('cameraOverlay');

const startCameraBtn = document.getElementById('startCameraBtn');
const captureBtn = document.getElementById('captureBtn');
const retakeBtn = document.getElementById('retakeBtn');

const locationStatus = document.getElementById('locationStatus');
const locationDetails = document.getElementById('locationDetails');
const addressText = document.getElementById('addressText');
const coordsText = document.getElementById('coordsText');

const submitBtn = document.getElementById('submitBtn');
const toast = document.getElementById('toast');

const mssvInput = document.getElementById('mssv');
const fullnameInput = document.getElementById('fullname');

// ============================================
// Lunar Calendar - Ho Ngoc Duc Algorithm (Proven)
// ============================================
const PI = Math.PI;

function jdFromDate(dd, mm, yy) {
    const a = Math.floor((14 - mm) / 12);
    const y = yy + 4800 - a;
    const m = mm + 12 * a - 3;
    let jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
    if (jd < 2299161) {
        jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
    }
    return jd;
}

function getNewMoonDay(k) {
    const T = k / 1236.85;
    const T2 = T * T;
    const T3 = T2 * T;
    const dr = PI / 180;
    let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
    Jd1 = Jd1 + 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
    const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
    const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
    const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
    let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
    C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
    C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
    C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
    C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
    C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
    C1 = C1 + 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
    let deltat;
    if (T < -11) {
        deltat = 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3;
    } else {
        deltat = -0.000278 + 0.000265 * T + 0.000262 * T2;
    }
    return Math.floor(Jd1 + C1 - deltat + 0.5 + 0.5);
}

function getSunLongitude(jdn) {
    const T = (jdn - 2451545.5 - 0.5) / 36525;
    const T2 = T * T;
    const dr = PI / 180;
    const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
    const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
    let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
    DL = DL + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M);
    let L = L0 + DL;
    L = L * dr;
    L = L - PI * 2 * Math.floor(L / (PI * 2));
    return Math.floor(L / PI * 6);
}

function getLunarMonth11(yy) {
    const off = jdFromDate(31, 12, yy) - 2415021;
    const k = Math.floor(off / 29.530588853);
    let nm = getNewMoonDay(k);
    const sunLong = getSunLongitude(nm);
    if (sunLong >= 9) nm = getNewMoonDay(k - 1);
    return nm;
}

function getLeapMonthOffset(a11) {
    const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
    let last = 0;
    let i = 1;
    let arc = getSunLongitude(getNewMoonDay(k + i));
    do {
        last = arc;
        i++;
        arc = getSunLongitude(getNewMoonDay(k + i));
    } while (arc !== last && i < 14);
    return i - 1;
}

function convertSolar2Lunar(dd, mm, yy) {
    const dayNumber = jdFromDate(dd, mm, yy);
    const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853);
    let monthStart = getNewMoonDay(k + 1);
    if (monthStart > dayNumber) monthStart = getNewMoonDay(k);
    let a11 = getLunarMonth11(yy);
    let b11 = a11;
    let lunarYear;
    if (a11 >= monthStart) {
        lunarYear = yy;
        a11 = getLunarMonth11(yy - 1);
    } else {
        lunarYear = yy + 1;
        b11 = getLunarMonth11(yy + 1);
    }
    const lunarDay = dayNumber - monthStart + 1;
    const diff = Math.floor((monthStart - a11) / 29);
    let lunarLeap = 0;
    let lunarMonth = diff + 11;
    if (b11 - a11 > 365) {
        const leapMonthDiff = getLeapMonthOffset(a11);
        if (diff >= leapMonthDiff) {
            lunarMonth = diff + 10;
            if (diff === leapMonthDiff) lunarLeap = 1;
        }
    }
    if (lunarMonth > 12) lunarMonth = lunarMonth - 12;
    if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;
    return { day: lunarDay, month: lunarMonth, year: lunarYear, leap: lunarLeap };
}

function updateLunarDate() {
    const now = new Date();
    const lunar = convertSolar2Lunar(now.getDate(), now.getMonth() + 1, now.getFullYear());
    const lunarText = document.getElementById('lunarDateText');

    // Vietnamese zodiac (Can Chi) - Standard order starting from Giáp
    const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
    const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];

    // Formula: Year 4 AD = Giáp Tý (index 0, 0)
    const canIndex = (lunar.year - 4) % 10;
    const chiIndex = (lunar.year - 4) % 12;
    const canChi = CAN[canIndex] + ' ' + CHI[chiIndex];
    const leapText = lunar.leap === 1 ? ' nhuận' : '';

    if (lunarText) {
        lunarText.textContent = `${lunar.day}/${lunar.month}${leapText} - ${canChi}`;
    }
}

// ============================================
// Rate Limiting (3 requests/day/MSSV)
// ============================================
const MAX_REQUESTS_PER_DAY = 3;

function getRateLimitKey(mssv) {
    const today = new Date().toISOString().split('T')[0];
    return `rate_limit_${mssv}_${today}`;
}

function getRequestCount(mssv) {
    const key = getRateLimitKey(mssv);
    return parseInt(localStorage.getItem(key) || '0');
}

function incrementRequestCount(mssv) {
    const key = getRateLimitKey(mssv);
    const count = getRequestCount(mssv) + 1;
    localStorage.setItem(key, count.toString());
    return count;
}

function getRemainingRequests(mssv) {
    return MAX_REQUESTS_PER_DAY - getRequestCount(mssv);
}

function canMakeRequest(mssv) {
    return getRequestCount(mssv) < MAX_REQUESTS_PER_DAY;
}

// ============================================
// Help Modal
// ============================================
function initHelpModal() {
    const helpBtn = document.getElementById('helpBtn');
    const helpModal = document.getElementById('helpModal');
    const closeHelpModal = document.getElementById('closeHelpModal');

    if (helpBtn && helpModal) {
        helpBtn.addEventListener('click', () => {
            helpModal.classList.add('show');
        });

        closeHelpModal?.addEventListener('click', () => {
            helpModal.classList.remove('show');
        });

        helpModal.addEventListener('click', (e) => {
            if (e.target === helpModal) {
                helpModal.classList.remove('show');
            }
        });
    }
}

// ============================================
// MSSV Lookup - Auto fill họ tên
// ============================================
let lookupTimeout = null;

async function lookupStudent(mssv) {
    if (!mssv || mssv.length < 3) {
        document.getElementById('monthlyCountBox').style.display = 'none';
        return;
    }

    try {
        // Auto-fill logic enabled
        const response = await fetch(`/api/lookup-student/${encodeURIComponent(mssv)}`);
        const result = await response.json();

        if (result.success && result.found) {
            fullnameInput.value = result.fullname;
            fullnameInput.style.backgroundColor = '#f0fdf4';
            isAutoFilled = true;
            showToast(`Đã tìm thấy: ${result.fullname}`, 'success');

            // Lưu MSSV vào localStorage
            localStorage.setItem('saved_mssv', mssv);
        } else {
            if (isAutoFilled) {
                fullnameInput.value = '';
                fullnameInput.style.backgroundColor = '';
                isAutoFilled = false;
            }
        }

        // Save MSSV manually since we skipped validation
        localStorage.setItem('saved_mssv', mssv);

        // Fetch monthly count
        fetchMonthlyCount(mssv);
    } catch (error) {
        console.error('Lỗi lookup MSSV:', error);
    }
}

// Event listener for MSSV input
mssvInput.addEventListener('input', () => {
    clearTimeout(lookupTimeout);
    const mssv = mssvInput.value.trim();

    // Debounce: chờ 500ms sau khi ngừng gõ
    lookupTimeout = setTimeout(() => {
        lookupStudent(mssv);
    }, 500);
});

// Reset auto-fill indicator when user manually edits fullname
fullnameInput.addEventListener('input', () => {
    if (isAutoFilled) {
        fullnameInput.style.backgroundColor = '';
        isAutoFilled = false;
    }
});

// ============================================
// Camera Functions
// ============================================
// ============================================
// Input Validation
// ============================================
function validateStudentInfo() {
    const mssvInput = document.getElementById('mssv');
    const fullnameInput = document.getElementById('fullname');
    const classSessionInput = document.getElementById('class_session');

    let isValid = true;
    let errorMsg = [];

    if (!mssvInput.value.trim()) {
        isValid = false;
        mssvInput.style.borderColor = 'red';
        errorMsg.push('MSSV');
    } else {
        mssvInput.style.borderColor = '';
    }

    if (!fullnameInput.value.trim()) {
        isValid = false;
        fullnameInput.style.borderColor = 'red';
        errorMsg.push('Họ và tên');
    } else {
        fullnameInput.style.borderColor = '';
    }

    if (!classSessionInput.value) {
        isValid = false;
        classSessionInput.style.borderColor = 'red';
        errorMsg.push('Ca học');
        classSessionInput.style.borderColor = '';
    }

    // Validate Reason
    const reasonInput = document.getElementById('reason'); // Assuming id is 'reason' based on previous context
    if (!reasonInput.value.trim()) {
        isValid = false;
        reasonInput.style.borderColor = 'red';
        errorMsg.push('Lý do');
    } else {
        reasonInput.style.borderColor = '';
    }

    if (!isValid) {
        showToast(`Vui lòng nhập đầy đủ: ${errorMsg.join(', ')}`, 'error');
        // Scroll to top or first invalid input
        mssvInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    return isValid;
}

async function startCamera() {
    // Validate inputs before starting camera
    if (!validateStudentInfo()) {
        return;
    }

    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'user', // Camera trước (selfie)
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        });

        video.srcObject = stream;
        video.style.display = 'block';
        cameraOverlay.classList.add('hidden');

        startCameraBtn.style.display = 'none';
        captureBtn.style.display = 'inline-flex';

        // Start Liveness Check Immediately
        startLivenessCheck();

    } catch (error) {
        console.error('Lỗi khi bật camera:', error);
        showToast('Không thể truy cập camera. Vui lòng cấp quyền!', 'error');
    }
}

function capturePhoto() {
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Flip horizontally for selfie mirror effect
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0);

    // Reset transform for watermark
    context.setTransform(1, 0, 0, 1, 0, 0);

    // Add watermark with timestamp and GPS
    addWatermark(context, canvas.width, canvas.height);

    // Convert to blob
    canvas.toBlob((blob) => {
        photoBlob = blob;
        photoPreview.src = URL.createObjectURL(blob);
        photoPreview.style.display = 'block';
        photoPreview.style.cursor = 'zoom-in'; // Indicate clickable
        photoPreview.style.zIndex = '50';

        // Local listener removed in favor of global delegation

        video.style.display = 'none';

        // Stop camera stream
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }

        captureBtn.style.display = 'none';
        retakeBtn.style.display = 'inline-flex';

        // Show evidence section after selfie capture
        // Show evidence section after selfie capture
        const evidenceSection = document.getElementById('evidenceSection');
        if (evidenceSection) {
            evidenceSection.style.display = 'block';
        }

        // Display Watermark Text Below Photo
        const photoTextDetails = document.getElementById('photoTextDetails');

        if (photoTextDetails) {
            const now = new Date();
            const timestamp = now.toLocaleString('vi-VN');
            const weatherInfo = currentWeather ? `${currentWeather} | 🌡️ ${weatherTemp}°C` : 'N/A';

            // Use full address as requested
            const addressFull = address || '';

            // Use Helpers to Generate Content
            const student = getStudentInfo();
            const location = getLocationInfo();

            photoTextDetails.innerHTML = generateInfoHTML(student, location, timestamp, weatherInfo);
            photoTextDetails.style.display = 'block';
            photoTextDetails.style.border = 'none'; // Reset any debug border
        }

        showToast('Đã chụp ảnh thành công! Bạn có thể thêm ảnh minh chứng (tùy chọn).', 'success');
    }, 'image/jpeg', 0.9);
}

// ============================================
// Watermark Function
// ============================================
function addWatermark(ctx, width, height) {
    const now = new Date();
    const timestamp = now.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    const gpsText = latitude && longitude
        ? `📍 ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
        : '📍 Không có GPS';

    const addressShort = address
        ? (address.length > 60 ? address.substring(0, 60) + '...' : address)
        : '';

    // Get Data using Helpers
    const student = getStudentInfo();
    const location = getLocationInfo();

    // Background for watermark
    const padding = 10;
    const lineHeight = 20;

    // Calculate required height based on content
    // Base lines: Timestamp, Weather, GPS
    let lineCount = 3;

    if (addressShort) lineCount++;
    // Add Student Info line
    lineCount++;
    // Add Class & Distance line
    lineCount++;

    const boxHeight = (lineCount * lineHeight) + 15;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // Slightly darker for better readability
    ctx.fillRect(0, height - boxHeight, width, boxHeight);

    // Text style
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Inter, Arial, sans-serif';
    ctx.textBaseline = 'top';

    let currentY = height - boxHeight + padding;

    // Draw Student Info
    ctx.fillText(`👤 ${student.fullname} - ${student.mssv}`, padding, currentY);
    currentY += lineHeight;

    // Draw Class & Distance
    ctx.fillText(`📚 ${student.classSession} | 📏 Cách trường: ${location.distanceStr}`, padding, currentY);
    currentY += lineHeight;

    // Draw timestamp
    ctx.fillText(`🕐 ${timestamp}`, padding, currentY);
    currentY += lineHeight;

    // Draw Weather
    const weatherText = currentWeather ? `${currentWeather} | 🌡️ ${weatherTemp}°C` : '🌦️ Đang cập nhật thời tiết...';
    ctx.fillText(weatherText, padding, currentY);
    currentY += lineHeight;

    // Draw GPS
    ctx.fillText(gpsText, padding, currentY);
    currentY += lineHeight;

    // Draw Address
    if (addressShort) {
        ctx.fillText(`📫 ${addressShort}`, padding, currentY);
    }

    // Add verification badge
    ctx.fillStyle = 'rgba(16, 185, 129, 0.9)';
    ctx.fillRect(width - 120, height - boxHeight, 120, 25);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Inter, Arial, sans-serif';
    ctx.fillText('✅ XÁC THỰC', width - 110, height - boxHeight + 7);
}

function retakePhoto() {
    photoBlob = null;
    photoPreview.style.display = 'none';
    video.style.display = 'block';

    retakeBtn.style.display = 'none';
    startCameraBtn.style.display = 'inline-flex';
    captureBtn.style.display = 'none';
    cameraOverlay.classList.remove('hidden');
}

// ============================================
// Location Functions
// ============================================
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(2); // Distance in km
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}
function getLocation() {
    if (!navigator.geolocation) {
        showLocationError('Trình duyệt không hỗ trợ GPS');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            latitude = position.coords.latitude;
            longitude = position.coords.longitude;

            // Fetch Weather
            fetchWeather(latitude, longitude);

            // Reverse geocoding để lấy địa chỉ
            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=vi`
                );
                const data = await response.json();
                address = data.display_name || 'Không xác định được địa chỉ';
            } catch (error) {
                address = 'Không xác định được địa chỉ';
            }

            // Update UI
            locationStatus.classList.add('success');
            locationStatus.innerHTML = `
                <span class="location-icon"><i class="fa-solid fa-circle-check"></i></span>
                <span class="location-text">Đã lấy được vị trí của bạn</span>
            `;

            locationDetails.style.display = 'block';
            addressText.textContent = address;
            coordsText.textContent = `Tọa độ: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

            // Tính và hiển thị khoảng cách
            const distance = calculateDistance(latitude, longitude, SCHOOL_COORDS.latitude, SCHOOL_COORDS.longitude);
            const distanceInfo = document.getElementById('distanceInfo');
            const distanceValue = document.getElementById('distanceValue');

            if (distanceInfo && distanceValue) {
                distanceInfo.style.display = 'block';
                distanceValue.textContent = distance;

                // Color coding distance
                if (distance > 20) {
                    distanceInfo.style.color = 'var(--danger)'; // > 20km (Red)
                } else if (distance > 5) {
                    distanceInfo.style.color = 'var(--warning)'; // > 5km (Orange)
                } else {
                    distanceInfo.style.color = 'var(--success)'; // < 5km (Green)
                }
            }

            // Show mini map
            showMiniMap(latitude, longitude);
        },
        (error) => {
            let message = 'Không thể lấy vị trí';
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    message = 'Bạn đã từ chối cấp quyền vị trí';
                    break;
                case error.POSITION_UNAVAILABLE:
                    message = 'Không thể xác định vị trí';
                    break;
                case error.TIMEOUT:
                    message = 'Hết thời gian chờ lấy vị trí';
                    break;
            }
            showLocationError(message);
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

function showLocationError(message) {
    locationStatus.classList.add('error');
    locationStatus.innerHTML = `
        <span class="location-icon"><i class="fa-solid fa-circle-xmark"></i></span>
        <span class="location-text">${message}</span>
    `;
}

// ============================================
// Form Submit
// ============================================
async function handleSubmit(e) {
    e.preventDefault();

    // Lấy và trim tất cả giá trị
    const mssv = document.getElementById('mssv').value.trim();
    const fullname = document.getElementById('fullname').value.trim();
    const classSession = document.getElementById('class_session').value;
    const reason = document.getElementById('reason').value.trim();

    // Rate limit check - 3 requests per day per MSSV
    if (mssv && !canMakeRequest(mssv)) {
        showToast('Bạn đã gửi tối đa 3 lần hôm nay! Vui lòng thử lại ngày mai.', 'error');
        return;
    }

    // Validate bắt buộc - không cho phép khoảng trắng
    if (!mssv) {
        showToast('Vui lòng nhập MSSV!', 'error');
        document.getElementById('mssv').focus();
        return;
    }

    if (!fullname) {
        showToast('Vui lòng nhập Họ tên đầy đủ!', 'error');
        document.getElementById('fullname').focus();
        return;
    }

    if (!classSession) {
        showToast('Vui lòng chọn Ca học!', 'error');
        document.getElementById('class_session').focus();
        return;
    }

    if (!reason) {
        showToast('Vui lòng nhập Lý do xin đi trễ!', 'error');
        document.getElementById('reason').focus();
        return;
    }

    // Validate độ dài tối thiểu
    if (mssv.length < 3) {
        showToast('MSSV phải có ít nhất 3 ký tự!', 'error');
        document.getElementById('mssv').focus();
        return;
    }

    if (fullname.length < 2) {
        showToast('Họ tên phải có ít nhất 2 ký tự!', 'error');
        document.getElementById('fullname').focus();
        return;
    }

    if (reason.length < 5) {
        showToast('Lý do phải có ít nhất 5 ký tự!', 'error');
        document.getElementById('reason').focus();
        return;
    }

    // Validate ảnh và vị trí
    if (!photoBlob) {
        showToast('Vui lòng chụp ảnh selfie! Hãy nhấn nút "Chụp ảnh" để ghi nhận hình ảnh', 'error');
        return;
    }

    if (!latitude || !longitude) {
        showToast('Vui lòng cho phép truy cập vị trí!', 'error');
        return;
    }

    // Prepare form data với giá trị đã trim
    const formData = new FormData();
    formData.append('mssv', mssv);
    formData.append('fullname', fullname);
    formData.append('class_session', classSession);
    formData.append('reason', reason);
    formData.append('photo', photoBlob, 'selfie.jpg');
    formData.append('latitude', latitude);
    formData.append('longitude', longitude);
    formData.append('address', address);

    // Append evidence photo if exists
    if (evidenceBlob) {
        formData.append('evidence', evidenceBlob, 'evidence.jpg');
    }

    // Disable button
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loader"></span> Đang gửi...';

    try {
        const response = await fetch('/api/late-requests', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            // Increment rate limit counter
            incrementRequestCount(mssv);
            const remaining = getRemainingRequests(mssv);

            // Hiển thị thông báo với số lần xin trong tháng
            const monthlyMsg = result.monthlyCount
                ? ` (Lần thứ ${result.monthlyCount} trong ${result.monthName})`
                : '';
            const rateLimitMsg = remaining > 0 ? ` - Còn ${remaining} lần hôm nay` : '';
            showToast(`Gửi yêu cầu thành công!${monthlyMsg}${rateLimitMsg}`, 'success');

            // Show Digital Ticket
            showTicket({
                id: result.id,
                fullname: fullname,
                mssv: mssv,
                class_session: classSession
            });

            // Reset form
            form.reset();
            retakePhoto();

            // Clear evidence photo if exists
            clearEvidence();

            // Reset location
            latitude = null;
            longitude = null;
            address = null;
            locationDetails.style.display = 'none';
            locationStatus.classList.remove('success');
            getLocation(); // Re-fetch location

        } else {
            showToast(result.message || 'Có lỗi xảy ra!', 'error');
        }

    } catch (error) {
        console.error('Lỗi khi gửi yêu cầu:', error);
        showToast('Không thể kết nối đến server!', 'error');
    }

    // Enable button
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Gửi yêu cầu';
}

// ============================================
// Toast Notification
// ============================================
function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = 'toast show ' + type;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ============================================
// Event Listeners
// ============================================
startCameraBtn.addEventListener('click', startCamera);
// cameraOverlay.addEventListener('click', startCamera); // Disabled as per user request
captureBtn.addEventListener('click', detectFaceAndCapture);
retakeBtn.addEventListener('click', retakePhoto);
form.addEventListener('submit', handleSubmit);

// View History Button
document.getElementById('viewHistoryBtn').addEventListener('click', viewStudentHistory);

// Close History Modal
document.getElementById('closeHistoryModal').addEventListener('click', () => {
    document.getElementById('historyModal').classList.remove('show');
});

// ============================================
// Digital Ticket Functions
// ============================================
let ticketInterval = null;

function showTicket(data) {
    const modal = document.getElementById('ticketModal');
    const ticketPhoto = document.getElementById('ticketPhoto');
    const qrContainer = document.getElementById('qrcode');

    // Populate info
    document.getElementById('ticketStudentName').textContent = data.fullname;
    document.getElementById('ticketMssv').textContent = data.mssv;
    document.getElementById('ticketClass').textContent = data.class_session;
    document.getElementById('ticketTime').textContent = new Date().toLocaleString('vi-VN');

    // Set photo
    if (photoBlob) {
        ticketPhoto.src = URL.createObjectURL(photoBlob);
    }

    // Generate QR Code
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, {
        text: JSON.stringify({
            id: data.id,
            mssv: data.mssv,
            time: new Date().toISOString(),
            valid: true
        }),
        width: 100,
        height: 100
    });

    // Start Timer (10 minutes)
    startTicketTimer(10 * 60);

    // Show modal
    modal.classList.add('show');
    modal.style.display = 'flex';
}

function startTicketTimer(duration) {
    const timerDisplay = document.getElementById('ticketTimer');
    const header = document.querySelector('.ticket-header');
    const statusText = document.querySelector('.status-text');
    const statusIcon = document.querySelector('.status-icon');

    let timer = duration;

    // Reset state
    header.classList.remove('expired');
    statusText.textContent = 'DIGITAL TICKET';
    statusIcon.innerHTML = '<i class="fa-solid fa-circle-check"></i>';

    if (ticketInterval) clearInterval(ticketInterval);

    ticketInterval = setInterval(() => {
        const minutes = Math.floor(timer / 60);
        const seconds = timer % 60;

        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        if (--timer < 0) {
            clearInterval(ticketInterval);
            header.classList.add('expired');
            statusText.textContent = 'DIGITAL TICKET';
            statusIcon.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>';
            timerDisplay.textContent = "00:00";
        }
    }, 1000);
}

// Close Ticket Button
document.getElementById('closeTicketBtn').addEventListener('click', () => {
    document.getElementById('ticketModal').classList.remove('show');
    document.getElementById('ticketModal').style.display = 'none';
    if (ticketInterval) clearInterval(ticketInterval);
});

// Class session change - update countdown
document.getElementById('class_session').addEventListener('change', (e) => {
    updateCountdown(e.target.value);
});

// ============================================
// Monthly Count Functions
// ============================================
async function fetchMonthlyCount(mssv) {
    try {
        const response = await fetch(`/api/student-history/${encodeURIComponent(mssv)}`);
        const result = await response.json();

        if (result.success) {
            // Use server-side calculation for consistency
            monthlyCount = result.monthlyCount || 0;
            const monthName = result.monthName || 'tháng này';

            // Legacy fallback (client-side calc) removed to prevent timezone mismatch
            const monthlyCountBox = document.getElementById('monthlyCountBox');
            const monthlyCountText = document.getElementById('monthlyCountText');

            if (monthlyCount > 0) {
                monthlyCountBox.style.display = 'flex';
                monthlyCountText.textContent = `Bạn đã xin ${monthlyCount} lần trong tháng này`;

                if (monthlyCount >= 3) {
                    monthlyCountBox.classList.add('warning');
                } else {
                    monthlyCountBox.classList.remove('warning');
                }
            } else {
                monthlyCountBox.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Lỗi fetch monthly count:', error);
    }
}

// ============================================
// Student History View
// ============================================
async function viewStudentHistory() {
    const mssv = mssvInput.value.trim();

    if (!mssv || mssv.length < 3) {
        showToast('Vui lòng nhập MSSV (ít nhất 3 ký tự)!', 'error');
        mssvInput.focus();
        return;
    }

    try {
        const response = await fetch(`/api/student-history/${encodeURIComponent(mssv)}`);
        const result = await response.json();

        if (result.success) {
            if (result.data.length === 0) {
                showToast('Không tìm thấy lịch sử xin đi trễ!', 'info');
                return;
            }

            document.getElementById('historyMssv').textContent = mssv;
            document.getElementById('historyStudentName').textContent = result.data[0].fullname;
            document.getElementById('historyTotal').textContent = result.total;

            const historyBody = document.getElementById('historyBody');
            historyBody.innerHTML = result.data.map((req, index) => {
                const statusHtml = req.is_within_deadline === true
                    ? '<span style="color: #10b981;"><i class="fa-solid fa-circle-check"></i> Trong hạn</span>'
                    : req.is_within_deadline === false
                        ? '<span style="color: #ef4444;"><i class="fa-solid fa-circle-xmark"></i> Ngoài hạn</span>'
                        : '<span style="color: #64748b;"><i class="fa-solid fa-question"></i> Không xác định</span>';

                return `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${req.class_session}</td>
                        <td>${new Date(req.created_at).toLocaleString('vi-VN')}</td>
                        <td>${statusHtml}</td>
                    </tr>
                `;
            }).join('');

            document.getElementById('historyModal').classList.add('show');
        } else {
            showToast('Không thể tải lịch sử!', 'error');
        }
    } catch (error) {
        showToast('Lỗi kết nối server!', 'error');
    }
}

// ============================================
// Countdown Timer
// ============================================
function updateCountdown(classSession) {
    const countdownBox = document.getElementById('countdownBox');
    const countdownTimer = document.getElementById('countdownTimer');
    const countdownLabel = countdownBox.querySelector('.countdown-label');

    if (!classSession || !CLASS_SCHEDULES[classSession]) {
        countdownBox.style.display = 'none';
        if (countdownInterval) clearInterval(countdownInterval);
        return;
    }

    countdownBox.style.display = 'flex';

    function tick() {
        const now = new Date();
        const schedule = CLASS_SCHEDULES[classSession];

        // Deadline = class start + 14:30
        const deadline = new Date(now);
        deadline.setHours(schedule.hour, schedule.minute + 14, 30, 0);

        const diff = deadline - now;

        if (diff <= 0) {
            // Đã quá hạn - hiển thị quá bao lâu
            const overMs = Math.abs(diff);
            const overMinutes = Math.floor(overMs / 60000);
            const overSeconds = Math.floor((overMs % 60000) / 1000);

            countdownLabel.textContent = '⏰ Đã quá hạn:';
            countdownTimer.textContent = `${overMinutes}p ${overSeconds}s`;
            countdownTimer.className = 'countdown-timer expired';
        } else {
            // Còn thời gian - hiển thị countdown
            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);

            countdownLabel.textContent = '⏰ Còn lại để xin đi trễ:';
            countdownTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            if (minutes >= 10) {
                countdownTimer.className = 'countdown-timer safe';
            } else if (minutes >= 5) {
                countdownTimer.className = 'countdown-timer';
            } else {
                countdownTimer.className = 'countdown-timer urgent';
            }
        }
    }

    tick();
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(tick, 1000);
}

// ============================================
// Weather API
// ============================================
async function fetchWeather(lat, lon) {
    try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const data = await response.json();

        if (data.current_weather) {
            weatherTemp = data.current_weather.temperature;
            weatherCode = data.current_weather.weathercode;
            currentWeather = getWeatherIcon(weatherCode);
            console.log(`🌦️ Weather: ${weatherTemp}°C, Code: ${weatherCode}`);
        }
    } catch (error) {
        console.error('Lỗi lấy thời tiết:', error);
    }
}

function getWeatherIcon(code) {
    // WMO Weather interpretation codes (https://open-meteo.com/en/docs)
    const icons = {
        0: '☀️ Nắng đẹp',
        1: '🌤️ Ít mây',
        2: '⛅ Có mây',
        3: '☁️ Nhiều mây',
        45: '🌫️ Sương mù',
        48: '🌫️ Sương giá',
        51: 'imưa Mưa nhỏ',
        53: '🌧️ Mưa vừa',
        55: '🌧️ Mưa dày',
        61: '☔ Mưa rào nhẹ',
        63: '☔ Mưa rào vừa',
        65: '☔ Mưa rào nặng',
        80: '⛈️ Mưa rào',
        81: '⛈️ Mưa rào mạnh',
        82: '⛈️ Mưa rất to',
        95: '⚡ Dông',
        96: '⚡ Dông mưa đá',
        99: '⚡ Dông mưa đá nặng'
    };
    return icons[code] || '❓ Không rõ';
}

// ============================================
// Mini Map
// ============================================
function showMiniMap(lat, lng) {
    const container = document.getElementById('miniMapContainer');
    container.style.display = 'block';

    if (miniMap) {
        miniMap.remove();
    }

    miniMap = L.map('miniMap').setView([lat, lng], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(miniMap);

    L.marker([lat, lng]).addTo(miniMap)
        .bindPopup('<i class="fa-solid fa-location-dot"></i> Vị trí của bạn')
        .openPopup();
}

// ============================================
// Auto Suggest Class Session
// ============================================
function suggestClassSession() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute; // Convert to minutes

    let suggestedSession = null;
    let suggestedKey = null;

    // Find the current or upcoming class session
    for (const [key, schedule] of Object.entries(CLASS_SCHEDULES)) {
        const classStart = schedule.hour * 60 + schedule.minute;
        const deadline = classStart + 14; // 14 minutes after start

        // If current time is before deadline (can still submit)
        if (currentTime <= deadline + 30) { // 30 minutes grace for suggestion
            if (!suggestedSession || classStart < suggestedSession) {
                suggestedSession = classStart;
                suggestedKey = key;
            }
        }
    }

    const select = document.getElementById('class_session');
    const label = document.getElementById('suggestedSessionLabel');

    if (suggestedKey) {
        select.value = suggestedKey;
        label.textContent = '(Gợi ý)';
        label.style.display = 'inline';
        updateCountdown(suggestedKey);
    } else {
        label.style.display = 'none';
        label.textContent = '';
    }
}

// ============================================
// Initialize
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    getLocation();
    suggestClassSession();

    // Initialize new features
    updateLunarDate();
    initHelpModal();

    // Load saved MSSV from localStorage
    const savedMssv = localStorage.getItem('saved_mssv');
    if (savedMssv) {
        mssvInput.value = savedMssv;
        showToast(`Đã tải MSSV: ${savedMssv}`, 'info');

        // Trigger lookup after a short delay
        setTimeout(() => {
            lookupStudent(savedMssv);
        }, 500);
    }

    // Load Face Model
    loadFaceModel();
});

// ============================================
// AI Face Detection
// ============================================
async function loadFaceModel() {
    const btn = document.getElementById('startCameraBtn');

    try {
        console.log('⏳ Đang tải Face Model...');
        faceModel = await blazeface.load();
        console.log('✅ Face Model đã tải xong!');

        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-camera"></i> Bật Camera';
            btn.disabled = false;
        }
        // showToast('AI Đã sẵn sàng!', 'success'); // Optional: show toast
    } catch (error) {
        console.error('Lỗi tải Face Model:', error);
        showToast('Không thể tải AI nhận diện khuôn mặt! (Chuyển sang chế độ thường)', 'warning');

        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-camera"></i> Bật Camera (No AI)';
            btn.disabled = false;
        }
    }
}

// ============================================
// AI Liveness Check
// ============================================
let livenessState = 'IDLE'; // IDLE, DETECTING, CHALLENGE, VERIFIED
let targetDirection = null; // 'LEFT' or 'RIGHT'
let verificationLoopId = null;

async function startLivenessCheck() {
    livenessState = 'DETECTING';
    const overlay = document.getElementById('livenessOverlay');
    const icon = document.getElementById('livenessIcon');
    const text = document.getElementById('livenessText');
    const captureBtn = document.getElementById('captureBtn');

    overlay.style.display = 'flex';
    icon.innerHTML = '<i class="fa-solid fa-robot"></i>';
    text.innerHTML = 'Đang tìm khuôn mặt...';
    captureBtn.disabled = true;
    captureBtn.style.opacity = '0.5';

    verifyLivenessLoop();
}

async function verifyLivenessLoop() {
    if (!faceModel || !stream || video.style.display === 'none') return;
    if (livenessState === 'VERIFIED') return;

    try {
        const predictions = await faceModel.estimateFaces(video, false);
        const overlay = document.getElementById('livenessOverlay');
        const icon = document.getElementById('livenessIcon');
        const text = document.getElementById('livenessText');

        if (predictions.length > 0) {
            const face = predictions[0];
            const landmarks = face.landmarks;

            // Landmarks: 0=RightEye, 1=LeftEye, 2=Nose
            // Note: landmarks coords are relative to video size
            const rightEyeX = landmarks[0][0];
            const leftEyeX = landmarks[1][0];
            const noseX = landmarks[2][0];

            // Calculate ratios
            // Distance between eyes (Reference scale)
            const eyeDist = leftEyeX - rightEyeX;
            // Nose relative position (0=RightEye, 1=LeftEye)
            // If Nose is closer to RightEye (small value) -> User turned RIGHT (Screen Left)
            // If Nose is closer to LeftEye (large value) -> User turned LEFT (Screen Right)

            // Wait: 
            // Turning Left (User's Left) -> Nose moves to User's Left (Screen Right). 
            // Screen Coords: 0 is Left. 
            // User looking at camera (Mirror off? No, mirror ON usually).
            // context.scale(-1, 1) is used for drawing.
            // But estimateFaces runs on raw video? 
            // Raw video usually is NOT mirrored unless CSS transform scaleX(-1).
            // Let's assume standard webcam feed.
            // RightEye is User's Right Eye (Screen Left). x is small.
            // LeftEye is User's Left Eye (Screen Right). x is big.
            // Looking Left (User's Left) -> Nose moves towards Left Ear (Screen Right). 
            // So noseX increases. Ratio (nose - right) / (left - right) increases.

            const ratio = (noseX - rightEyeX) / eyeDist;

            if (livenessState === 'DETECTING') {
                // Face found, start challenge
                livenessState = 'CHALLENGE';
                // Randomize direction
                targetDirection = Math.random() > 0.5 ? 'LEFT' : 'RIGHT';

                if (targetDirection === 'LEFT') {
                    icon.innerHTML = '⬅️';
                    text.innerHTML = 'Quay mặt sang TRÁI';
                } else {
                    icon.innerHTML = '<i class="fa-solid fa-arrow-right"></i>';
                    text.innerHTML = 'Quay mặt sang PHẢI';
                }
            } else if (livenessState === 'CHALLENGE') {
                let passed = false;

                // Thresholds need tuning. 
                // Center is ~0.5.
                // Turn Left -> Ratio > 0.65?
                // Turn Right -> Ratio < 0.35?

                // Debug: Print ratio to console
                console.log(`Target: ${targetDirection}, Ratio: ${ratio.toFixed(2)}`);

                // Logic correction:
                // User turns LEFT -> Face turns Right (in raw feed) -> Nose moves to Left Eye (Screen Right) -> Ratio INCREASES > 0.65
                // User turns RIGHT -> Face turns Left (in raw feed) -> Nose moves to Right Eye (Screen Left) -> Ratio DECREASES < 0.35

                if (targetDirection === 'LEFT' && ratio > 0.65) {
                    passed = true;
                } else if (targetDirection === 'RIGHT' && ratio < 0.35) {
                    passed = true;
                }

                if (passed) {
                    livenessState = 'VERIFIED';
                    overlay.style.display = 'none';

                    const captureBtn = document.getElementById('captureBtn');
                    captureBtn.disabled = false;
                    captureBtn.style.opacity = '1';

                    showToast('Xác thực thành công! Hãy chụp ảnh.', 'success');
                    return; // Stop loop
                }
            }
        } else {
            // No face lost
            if (livenessState === 'CHALLENGE') {
                // Reset if lost face? Or just wait.
                // Let's keep waiting.
            }
        }
    } catch (e) {
        console.error(e);
    }

    verificationLoopId = requestAnimationFrame(verifyLivenessLoop);
}


// We modify startCamera mainly.

async function detectFaceAndCapture() {
    // Check if face is present at the moment of capture
    // If AI model not loaded, skip face detection entirely
    if (!faceModel || !stream) {
        capturePhoto();
        showToast('Đã chụp ảnh!', 'success');
        return;
    }

    // Show spinner
    const btn = document.getElementById('captureBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang kiểm tra...';
    btn.disabled = true;

    try {
        const predictions = await faceModel.estimateFaces(video, false);
        if (predictions.length > 0) {
            // Face present -> Capture
            capturePhoto();
            showToast('Đã chụp ảnh!', 'success');
        } else {
            showToast('Không thấy khuôn mặt! Vui lòng không che mặt.', 'error');
        }
    } catch (e) {
        console.error(e);
        // AI error - capture anyway without face check
        capturePhoto();
        showToast('Đã chụp ảnh!', 'success');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// ============================================
// Global Event Delegation for Zoom (More Robust)
// ============================================
document.addEventListener('click', (e) => {
    // Open Zoom
    if (e.target && e.target.id === 'photoPreview') {
        const modal = document.getElementById('imageZoomModal');
        const zoomedImg = document.getElementById('zoomedImage');

        if (modal && zoomedImg) {
            zoomedImg.src = e.target.src;
            modal.classList.add('show'); // Required for CSS visibility!
            modal.style.display = 'flex';
            modal.style.justifyContent = 'center';
            modal.style.alignItems = 'center';
            modal.style.background = 'rgba(0,0,0,0.95)';
            modal.style.zIndex = '100000'; // Maximum z-index
        }
    }

    // Close Zoom (X button)
    if (e.target && e.target.id === 'closeImageZoom') {
        const modal = document.getElementById('imageZoomModal');
        if (modal) {
            modal.classList.remove('show');
            modal.style.display = 'none';
        }
    }

    // Close Zoom (Click outside)
    if (e.target && e.target.id === 'imageZoomModal') {
        e.target.classList.remove('show');
        e.target.style.display = 'none';
    }

    // Open Evidence Zoom
    if (e.target && e.target.id === 'evidencePreview') {
        const modal = document.getElementById('imageZoomModal');
        const zoomedImg = document.getElementById('zoomedImage');

        if (modal && zoomedImg) {
            zoomedImg.src = e.target.src;
            modal.classList.add('show');
            modal.style.display = 'flex';
            modal.style.justifyContent = 'center';
            modal.style.alignItems = 'center';
            modal.style.background = 'rgba(0,0,0,0.95)';
            modal.style.zIndex = '100000';
        }
    }
});

// ============================================
// Evidence Cam Functions
// ============================================

async function startEvidenceCamera() {
    // Validate inputs before starting evidence camera
    if (!validateStudentInfo()) {
        return;
    }

    const evidenceVideo = document.getElementById('evidenceVideo');
    const evidenceCameraContainer = document.getElementById('evidenceCameraContainer');
    const startEvidenceCamBtn = document.getElementById('startEvidenceCamBtn');
    const captureEvidenceBtn = document.getElementById('captureEvidenceBtn');

    try {
        // Request rear camera (environment)
        evidenceStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
            audio: false
        });

        evidenceVideo.srcObject = evidenceStream;
        evidenceCameraContainer.style.display = 'block';
        startEvidenceCamBtn.style.display = 'none';
        captureEvidenceBtn.style.display = 'inline-flex';
        evidenceUsingFrontCamera = false; // Using rear camera

        showToast('Camera sau đã bật!', 'success');
    } catch (err) {
        console.error('Evidence camera error:', err);
        showToast('Không thể bật camera sau. Thử dùng camera trước.', 'error');

        // Fallback to front camera
        try {
            evidenceStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user' },
                audio: false
            });
            evidenceVideo.srcObject = evidenceStream;
            evidenceCameraContainer.style.display = 'block';
            startEvidenceCamBtn.style.display = 'none';
            captureEvidenceBtn.style.display = 'inline-flex';
            evidenceUsingFrontCamera = true; // Using front camera - need to mirror
            evidenceVideo.style.transform = 'scaleX(-1)'; // Mirror preview for front camera
        } catch (e) {
            showToast('Không thể truy cập camera.', 'error');
        }
    }
}

function captureEvidence() {
    const evidenceVideo = document.getElementById('evidenceVideo');
    const evidencePreview = document.getElementById('evidencePreview');
    const captureEvidenceBtn = document.getElementById('captureEvidenceBtn');
    const retakeEvidenceBtn = document.getElementById('retakeEvidenceBtn');
    const removeEvidenceBtn = document.getElementById('removeEvidenceBtn');

    // Create canvas and capture
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = evidenceVideo.videoWidth;
    tempCanvas.height = evidenceVideo.videoHeight;
    const ctx = tempCanvas.getContext('2d');

    // Mirror if using front camera
    if (evidenceUsingFrontCamera) {
        ctx.translate(tempCanvas.width, 0);
        ctx.scale(-1, 1);
    }
    ctx.drawImage(evidenceVideo, 0, 0);

    // Reset transform before adding watermark
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Add same watermark as selfie (with GPS, timestamp, address)
    addWatermark(ctx, tempCanvas.width, tempCanvas.height);

    // Convert to blob with higher quality
    tempCanvas.toBlob((blob) => {
        evidenceBlob = blob;
        evidencePreview.src = URL.createObjectURL(blob);
        evidencePreview.style.display = 'block';
        evidenceVideo.style.display = 'none';

        // Stop stream
        if (evidenceStream) {
            evidenceStream.getTracks().forEach(track => track.stop());
            evidenceStream = null;
        }

        // Toggle buttons
        captureEvidenceBtn.style.display = 'none';
        retakeEvidenceBtn.style.display = 'inline-flex';
        removeEvidenceBtn.style.display = 'inline-flex';

        // Display Evidence Text Details
        const evidenceTextDetails = document.getElementById('evidenceTextDetails');
        if (evidenceTextDetails) {
            const now = new Date();
            const timestamp = now.toLocaleString('vi-VN');
            const weatherInfo = currentWeather ? `${currentWeather} | 🌡️ ${weatherTemp}°C` : 'N/A';

            // Use full address as requested
            const addressFull = address || '';

            // Use Helpers to Generate Content
            const student = getStudentInfo();
            const location = getLocationInfo();

            evidenceTextDetails.innerHTML = generateInfoHTML(student, location, timestamp, weatherInfo);
            evidenceTextDetails.style.display = 'block';
        }

        showToast('Đã chụp minh chứng!', 'success');
    }, 'image/jpeg', 0.95); // Higher quality
}

function retakeEvidence() {
    const evidencePreview = document.getElementById('evidencePreview');
    const evidenceVideo = document.getElementById('evidenceVideo');
    const retakeEvidenceBtn = document.getElementById('retakeEvidenceBtn');
    const removeEvidenceBtn = document.getElementById('removeEvidenceBtn');

    evidenceBlob = null;
    evidencePreview.style.display = 'none';

    // Hide Evidence Text Details
    const evidenceTextDetails = document.getElementById('evidenceTextDetails');
    if (evidenceTextDetails) {
        evidenceTextDetails.style.display = 'none';
        evidenceTextDetails.innerHTML = '';
    }

    evidenceVideo.style.display = 'block';
    retakeEvidenceBtn.style.display = 'none';
    removeEvidenceBtn.style.display = 'none';

    startEvidenceCamera();
}

function removeEvidence() {
    const evidenceSection = document.getElementById('evidenceSection');
    const evidenceCameraContainer = document.getElementById('evidenceCameraContainer');
    const evidencePreview = document.getElementById('evidencePreview');
    const startEvidenceCamBtn = document.getElementById('startEvidenceCamBtn');
    const captureEvidenceBtn = document.getElementById('captureEvidenceBtn');
    const retakeEvidenceBtn = document.getElementById('retakeEvidenceBtn');
    const removeEvidenceBtn = document.getElementById('removeEvidenceBtn');

    // Stop stream if running
    if (evidenceStream) {
        evidenceStream.getTracks().forEach(track => track.stop());
        evidenceStream = null;
    }

    evidenceBlob = null;
    evidencePreview.style.display = 'none';

    // Hide Evidence Text Details
    const evidenceTextDetails = document.getElementById('evidenceTextDetails');
    if (evidenceTextDetails) {
        evidenceTextDetails.style.display = 'none';
        evidenceTextDetails.innerHTML = '';
    }

    evidenceCameraContainer.style.display = 'none';
    startEvidenceCamBtn.style.display = 'inline-flex';
    captureEvidenceBtn.style.display = 'none';
    retakeEvidenceBtn.style.display = 'none';
    removeEvidenceBtn.style.display = 'none';

    showToast('Đã bỏ ảnh minh chứng', 'info');
}

// Clear evidence completely (used after successful submit)
function clearEvidence() {
    const evidenceSection = document.getElementById('evidenceSection');
    const evidenceCameraContainer = document.getElementById('evidenceCameraContainer');
    const evidencePreview = document.getElementById('evidencePreview');
    const evidenceVideo = document.getElementById('evidenceVideo');
    const startEvidenceCamBtn = document.getElementById('startEvidenceCamBtn');
    const captureEvidenceBtn = document.getElementById('captureEvidenceBtn');
    const retakeEvidenceBtn = document.getElementById('retakeEvidenceBtn');
    const removeEvidenceBtn = document.getElementById('removeEvidenceBtn');

    // Stop stream if running
    if (evidenceStream) {
        evidenceStream.getTracks().forEach(track => track.stop());
        evidenceStream = null;
    }

    evidenceBlob = null;

    if (evidencePreview) evidencePreview.style.display = 'none';
    if (evidenceVideo) evidenceVideo.style.display = 'block';
    if (evidenceCameraContainer) evidenceCameraContainer.style.display = 'none';
    if (startEvidenceCamBtn) startEvidenceCamBtn.style.display = 'inline-flex';
    if (captureEvidenceBtn) captureEvidenceBtn.style.display = 'none';
    if (retakeEvidenceBtn) retakeEvidenceBtn.style.display = 'none';
    if (removeEvidenceBtn) removeEvidenceBtn.style.display = 'none';
    if (evidenceSection) evidenceSection.style.display = 'none'; // Hide the whole section
}

// Evidence Cam Event Listeners
document.getElementById('startEvidenceCamBtn')?.addEventListener('click', startEvidenceCamera);
document.getElementById('captureEvidenceBtn')?.addEventListener('click', captureEvidence);
document.getElementById('retakeEvidenceBtn')?.addEventListener('click', retakeEvidence);
document.getElementById('removeEvidenceBtn')?.addEventListener('click', removeEvidence);
