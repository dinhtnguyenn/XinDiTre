// ============================================
// Authentication
// ============================================
let authToken = null;

function checkAuth() {
    const savedToken = localStorage.getItem('adminToken');
    if (savedToken) {
        authToken = savedToken;
        showAdminContent();
        fetchRequests();
        fetchStatistics();
    }
}

async function handleLogin(e) {
    e.preventDefault();

    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('loginError');

    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        const result = await response.json();

        if (result.success) {
            authToken = btoa(password);
            localStorage.setItem('adminToken', authToken);
            showAdminContent();
            fetchRequests();
            fetchStatistics();
        } else {
            errorEl.textContent = result.message;
            errorEl.style.display = 'block';
        }
    } catch (error) {
        errorEl.textContent = 'Không thể kết nối đến server!';
        errorEl.style.display = 'block';
    }
}

function logout() {
    authToken = null;
    localStorage.removeItem('adminToken');
    document.getElementById('loginModal').classList.add('show');
    document.getElementById('adminContent').style.display = 'none';
    document.getElementById('password').value = '';
}

function showAdminContent() {
    document.getElementById('loginModal').classList.remove('show');
    document.getElementById('adminContent').style.display = 'flex';
}

function getAuthHeaders() {
    return { 'Authorization': `Basic ${authToken}` };
}

// ============================================
// Variables & State
// ============================================
let requests = [];
let currentRequest = null;
let map = null;
let dailyChart = null;
let classChart = null;

// DOM Elements
const requestsBody = document.getElementById('requestsBody');
const totalRequests = document.getElementById('totalRequests');
const todayRequests = document.getElementById('todayRequests');
const weekRequests = document.getElementById('weekRequests');
const refreshBtn = document.getElementById('refreshBtn');
const searchInput = document.getElementById('searchInput');
const filterSelect = document.getElementById('filterSelect');
const resultCount = document.getElementById('resultCount');

const modal = document.getElementById('detailModal');
const closeModal = document.getElementById('closeModal');
const deleteBtn = document.getElementById('deleteBtn');
const viewHistoryBtn = document.getElementById('viewHistoryBtn');

const historyModal = document.getElementById('historyModal');
const closeHistoryModal = document.getElementById('closeHistoryModal');

const toast = document.getElementById('toast');

// ============================================
// Fetch Statistics & Charts
// ============================================
async function fetchStatistics() {
    try {
        const response = await fetch('/api/statistics', {
            headers: getAuthHeaders()
        });

        if (response.status === 401) return;

        const result = await response.json();

        if (result.success) {
            // Update stats
            totalRequests.textContent = result.total;
            weekRequests.textContent = result.thisWeek;

            // Daily chart
            renderDailyChart(result.daily);

            // Class chart
            renderClassChart(result.byClass);
        }
    } catch (error) {
        console.error('Lỗi khi lấy thống kê:', error);
    }
}

function renderDailyChart(data) {
    const ctx = document.getElementById('dailyChart').getContext('2d');

    if (dailyChart) dailyChart.destroy();

    dailyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Số yêu cầu',
                data: data.values,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
            }
        }
    });
}

function renderClassChart(data) {
    const ctx = document.getElementById('classChart').getContext('2d');

    if (classChart) classChart.destroy();

    const colors = [
        '#6366f1', '#8b5cf6', '#a855f7',
        '#d946ef', '#ec4899', '#f43f5e'
    ];

    classChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.labels,
            datasets: [{
                data: data.values,
                backgroundColor: colors.slice(0, data.labels.length)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { boxWidth: 12 }
                }
            }
        }
    });
}

// ============================================
// Fetch Data with Filter & Search
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
        const filter = filterSelect.value;
        const search = searchInput.value.trim();

        let url = '/api/late-requests';
        const params = new URLSearchParams();
        if (filter) params.append('filter', filter);
        if (search) params.append('search', search);
        if (params.toString()) url += '?' + params.toString();

        const response = await fetch(url, {
            headers: getAuthHeaders()
        });

        if (response.status === 401) {
            logout();
            showToast('Phiên đăng nhập hết hạn!', 'error');
            return;
        }

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
    resultCount.textContent = `Hiển thị ${requests.length} yêu cầu`;

    if (requests.length === 0) {
        requestsBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-row">
                    📭 Không tìm thấy yêu cầu nào
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

    document.getElementById('detailMssv').textContent = currentRequest.mssv;
    document.getElementById('detailFullname').textContent = currentRequest.fullname;
    document.getElementById('detailClassSession').textContent = currentRequest.class_session;
    document.getElementById('detailTime').textContent = formatDate(currentRequest.created_at);
    document.getElementById('detailReason').textContent = currentRequest.reason;

    const photoEl = document.getElementById('detailPhoto');
    const noPhotoText = document.getElementById('noPhotoText');

    if (currentRequest.photo_url) {
        photoEl.src = currentRequest.photo_url;
        photoEl.style.display = 'block';
        noPhotoText.style.display = 'none';
    } else {
        photoEl.style.display = 'none';
        noPhotoText.style.display = 'block';
    }

    document.getElementById('detailAddress').textContent =
        currentRequest.address || 'Không có thông tin vị trí';

    modal.classList.add('show');

    setTimeout(() => initMap(), 100);
}

// ============================================
// Student History
// ============================================
async function viewStudentHistory() {
    if (!currentRequest) return;

    const mssv = currentRequest.mssv;

    try {
        const response = await fetch(`/api/late-requests/student/${mssv}`, {
            headers: getAuthHeaders()
        });

        const result = await response.json();

        if (result.success) {
            document.getElementById('historyMssv').textContent = mssv;
            document.getElementById('historyStudentName').textContent = currentRequest.fullname;
            document.getElementById('historyTotal').textContent = result.total;

            const historyBody = document.getElementById('historyBody');
            historyBody.innerHTML = result.data.map((req, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${escapeHtml(req.class_session)}</td>
                    <td>${escapeHtml(req.reason)}</td>
                    <td>${formatDate(req.created_at)}</td>
                </tr>
            `).join('');

            closeModalFn();
            historyModal.classList.add('show');
        }
    } catch (error) {
        showToast('Không thể tải lịch sử!', 'error');
    }
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

    if (map) map.remove();

    map = L.map('detailMap').setView([currentRequest.latitude, currentRequest.longitude], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    L.marker([currentRequest.latitude, currentRequest.longitude])
        .addTo(map)
        .bindPopup(`<b>${currentRequest.fullname}</b><br>${currentRequest.address || 'Vị trí sinh viên'}`)
        .openPopup();
}

// ============================================
// Delete Request
// ============================================
async function deleteRequest() {
    if (!currentRequest) return;

    if (!confirm('Bạn có chắc muốn xóa yêu cầu này?')) return;

    try {
        const response = await fetch(`/api/late-requests/${currentRequest.id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (response.status === 401) {
            logout();
            showToast('Phiên đăng nhập hết hạn!', 'error');
            return;
        }

        const result = await response.json();

        if (result.success) {
            showToast('Đã xóa yêu cầu thành công!', 'success');
            closeModalFn();
            fetchRequests();
            fetchStatistics();
        } else {
            showToast(result.message || 'Có lỗi xảy ra!', 'error');
        }
    } catch (error) {
        showToast('Không thể kết nối đến server!', 'error');
    }
}

// ============================================
// Close Modals
// ============================================
function closeModalFn() {
    modal.classList.remove('show');
    currentRequest = null;
    if (map) { map.remove(); map = null; }
}

function closeHistoryModalFn() {
    historyModal.classList.remove('show');
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
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// Debounce search
let searchTimeout;
function handleSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(fetchRequests, 300);
}

// ============================================
// Event Listeners
// ============================================
document.getElementById('loginForm').addEventListener('submit', handleLogin);
document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    logout();
});

refreshBtn.addEventListener('click', () => {
    fetchRequests();
    fetchStatistics();
});
searchInput.addEventListener('input', handleSearch);
filterSelect.addEventListener('change', fetchRequests);

closeModal.addEventListener('click', closeModalFn);
deleteBtn.addEventListener('click', deleteRequest);
viewHistoryBtn.addEventListener('click', viewStudentHistory);

closeHistoryModal.addEventListener('click', closeHistoryModalFn);

modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModalFn();
});

historyModal.addEventListener('click', (e) => {
    if (e.target === historyModal) closeHistoryModalFn();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModalFn();
        closeHistoryModalFn();
    }
});

// ============================================
// Initialize
// ============================================
document.addEventListener('DOMContentLoaded', checkAuth);
