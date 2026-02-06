// ============================================
// Variables & State
// ============================================
let requests = [];
let currentRequest = null;
let map = null;
let marker = null;

// DOM Elements
const requestsBody = document.getElementById('requestsBody');
const totalRequests = document.getElementById('totalRequests');
const todayRequests = document.getElementById('todayRequests');
const refreshBtn = document.getElementById('refreshBtn');

const modal = document.getElementById('detailModal');
const closeModal = document.getElementById('closeModal');
const deleteBtn = document.getElementById('deleteBtn');

const toast = document.getElementById('toast');

// ============================================
// Fetch Data
// ============================================
async function fetchRequests() {
    requestsBody.innerHTML = `
        <tr>
            <td colspan="6" class="loading-row">
                <span class="loader"></span>
                Đang tải dữ liệu...
            </td>
        </tr>
    `;

    try {
        const response = await fetch('/api/late-requests');
        const result = await response.json();

        if (result.success) {
            requests = result.data;
            renderTable();
            updateStats();
        } else {
            showToast('Không thể tải dữ liệu!', 'error');
        }
    } catch (error) {
        console.error('Lỗi khi tải dữ liệu:', error);
        requestsBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-row">
                    ❌ Không thể kết nối đến server
                </td>
            </tr>
        `;
    }
}

// ============================================
// Render Table
// ============================================
function renderTable() {
    if (requests.length === 0) {
        requestsBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-row">
                    📭 Chưa có yêu cầu xin đi trễ nào
                </td>
            </tr>
        `;
        return;
    }

    requestsBody.innerHTML = requests.map((req, index) => `
        <tr>
            <td>${index + 1}</td>
            <td><strong>${escapeHtml(req.mssv)}</strong></td>
            <td>${escapeHtml(req.fullname)}</td>
            <td>${escapeHtml(req.class_session)}</td>
            <td>${formatDate(req.created_at)}</td>
            <td>
                <button class="action-btn" onclick="viewDetail(${req.id})">
                    Xem chi tiết
                </button>
            </td>
        </tr>
    `).join('');
}

// ============================================
// Statistics
// ============================================
function updateStats() {
    totalRequests.textContent = requests.length;

    // Count today's requests
    const today = new Date().toDateString();
    const todayCount = requests.filter(req => {
        const reqDate = new Date(req.created_at).toDateString();
        return reqDate === today;
    }).length;

    todayRequests.textContent = todayCount;
}

// ============================================
// View Detail Modal
// ============================================
function viewDetail(id) {
    currentRequest = requests.find(req => req.id === id);
    if (!currentRequest) return;

    // Fill data
    document.getElementById('detailMssv').textContent = currentRequest.mssv;
    document.getElementById('detailFullname').textContent = currentRequest.fullname;
    document.getElementById('detailClassSession').textContent = currentRequest.class_session;
    document.getElementById('detailTime').textContent = formatDate(currentRequest.created_at);
    document.getElementById('detailReason').textContent = currentRequest.reason;

    // Photo
    const photoEl = document.getElementById('detailPhoto');
    const noPhotoText = document.getElementById('noPhotoText');

    if (currentRequest.photo_path) {
        photoEl.src = currentRequest.photo_path;
        photoEl.style.display = 'block';
        noPhotoText.style.display = 'none';
    } else {
        photoEl.style.display = 'none';
        noPhotoText.style.display = 'block';
    }

    // Address
    document.getElementById('detailAddress').textContent =
        currentRequest.address || 'Không có thông tin vị trí';

    // Show modal
    modal.classList.add('show');

    // Initialize map after modal is visible
    setTimeout(() => {
        initMap();
    }, 100);
}

// ============================================
// Map Functions
// ============================================
function initMap() {
    const mapContainer = document.getElementById('detailMap');

    if (!currentRequest.latitude || !currentRequest.longitude) {
        mapContainer.innerHTML = '<p style="padding: 20px; text-align: center; color: #64748b;">Không có dữ liệu vị trí</p>';
        return;
    }

    // Destroy old map if exists
    if (map) {
        map.remove();
    }

    // Create new map
    map = L.map('detailMap').setView([currentRequest.latitude, currentRequest.longitude], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    // Add marker
    marker = L.marker([currentRequest.latitude, currentRequest.longitude]).addTo(map);
    marker.bindPopup(`<b>${currentRequest.fullname}</b><br>${currentRequest.address || 'Vị trí sinh viên'}`).openPopup();
}

// ============================================
// Delete Request
// ============================================
async function deleteRequest() {
    if (!currentRequest) return;

    if (!confirm('Bạn có chắc muốn xóa yêu cầu này?')) return;

    try {
        const response = await fetch(`/api/late-requests/${currentRequest.id}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            showToast('Đã xóa yêu cầu thành công!', 'success');
            closeModalFn();
            fetchRequests();
        } else {
            showToast(result.message || 'Có lỗi xảy ra!', 'error');
        }
    } catch (error) {
        console.error('Lỗi khi xóa yêu cầu:', error);
        showToast('Không thể kết nối đến server!', 'error');
    }
}

// ============================================
// Close Modal
// ============================================
function closeModalFn() {
    modal.classList.remove('show');
    currentRequest = null;

    // Destroy map
    if (map) {
        map.remove();
        map = null;
    }
}

// ============================================
// Utility Functions
// ============================================
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

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
refreshBtn.addEventListener('click', fetchRequests);
closeModal.addEventListener('click', closeModalFn);
deleteBtn.addEventListener('click', deleteRequest);

// Close modal on outside click
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        closeModalFn();
    }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('show')) {
        closeModalFn();
    }
});

// ============================================
// Initialize
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    fetchRequests();
});
