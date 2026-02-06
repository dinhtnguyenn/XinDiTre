// ============================================
// Variables & State
// ============================================
let stream = null;
let photoBlob = null;
let latitude = null;
let longitude = null;
let address = null;
let isAutoFilled = false; // Track if fullname was auto-filled

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
// MSSV Lookup - Auto fill họ tên
// ============================================
let lookupTimeout = null;

async function lookupStudent(mssv) {
    if (!mssv || mssv.length < 3) return;

    try {
        const response = await fetch(`/api/lookup-student/${encodeURIComponent(mssv)}`);
        const result = await response.json();

        if (result.success && result.found) {
            fullnameInput.value = result.fullname;
            fullnameInput.style.backgroundColor = '#f0fdf4'; // Light green to indicate auto-filled
            isAutoFilled = true;
            showToast(`Đã tìm thấy: ${result.fullname}`, 'success');
        } else {
            // Reset if not found
            if (isAutoFilled) {
                fullnameInput.value = '';
                fullnameInput.style.backgroundColor = '';
                isAutoFilled = false;
            }
        }
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
async function startCamera() {
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

    // Convert to blob
    canvas.toBlob((blob) => {
        photoBlob = blob;
        photoPreview.src = URL.createObjectURL(blob);
        photoPreview.style.display = 'block';
        video.style.display = 'none';

        // Stop camera stream
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }

        captureBtn.style.display = 'none';
        retakeBtn.style.display = 'inline-flex';

        showToast('Đã chụp ảnh thành công!', 'success');
    }, 'image/jpeg', 0.8);
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
function getLocation() {
    if (!navigator.geolocation) {
        showLocationError('Trình duyệt không hỗ trợ GPS');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            latitude = position.coords.latitude;
            longitude = position.coords.longitude;

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
                <span class="location-icon">✅</span>
                <span class="location-text">Đã lấy được vị trí của bạn</span>
            `;

            locationDetails.style.display = 'block';
            addressText.textContent = address;
            coordsText.textContent = `Tọa độ: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
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
        <span class="location-icon">❌</span>
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
        showToast('Vui lòng chụp ảnh selfie! Hãy nhấn nút "📸 Chụp ảnh" để ghi nhận hình ảnh', 'error');
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
            // Hiển thị thông báo với số lần xin trong tháng
            const monthlyMsg = result.monthlyCount
                ? ` (Lần thứ ${result.monthlyCount} trong ${result.monthName})`
                : '';
            showToast(`Gửi yêu cầu thành công! 🎉${monthlyMsg}`, 'success');

            // Reset form
            form.reset();
            retakePhoto();

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
    submitBtn.innerHTML = '<span>🚀</span> Gửi yêu cầu';
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
cameraOverlay.addEventListener('click', startCamera);
captureBtn.addEventListener('click', capturePhoto);
retakeBtn.addEventListener('click', retakePhoto);
form.addEventListener('submit', handleSubmit);

// ============================================
// Initialize
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Get location on page load
    getLocation();
});
