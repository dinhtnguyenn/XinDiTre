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
let monthlyChart = null;

// DOM Elements
const requestsBody = document.getElementById('requestsBody');
const totalRequests = document.getElementById('totalRequests');
const todayRequests = document.getElementById('todayRequests');
const withinDeadline = document.getElementById('withinDeadline');
const outsideDeadline = document.getElementById('outsideDeadline');
const refreshBtn = document.getElementById('refreshBtn');
const searchInput = document.getElementById('searchInput');
const filterSelect = document.getElementById('filterSelect');
const deadlineFilter = document.getElementById('deadlineFilter');
const resultCount = document.getElementById('resultCount');

const modal = document.getElementById('detailModal');
const closeModal = document.getElementById('closeModal');
const deleteBtn = document.getElementById('deleteBtn');
const viewHistoryBtn = document.getElementById('viewHistoryBtn');

const historyModal = document.getElementById('historyModal');
const closeHistoryModal = document.getElementById('closeHistoryModal');

const toast = document.getElementById('toast');

// Bulk Delete Elements
const selectAllCheckbox = document.getElementById('selectAll');
const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
const deleteAllBtn = document.getElementById('deleteAllBtn');
const exportExcelBtn = document.getElementById('exportExcelBtn');
const selectedCountSpan = document.getElementById('selectedCount');
let selectedIds = new Set();

// Pagination Elements & State
const pageSizeSelect = document.getElementById('pageSize');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const paginationPages = document.getElementById('paginationPages');
const paginationTotal = document.getElementById('paginationTotal');
let currentPage = 1;

let pageSize = 20;

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
            totalRequests.textContent = result.total;
            withinDeadline.textContent = result.byDeadline?.within || 0;
            outsideDeadline.textContent = result.byDeadline?.outside || 0;

            renderDailyChart(result.daily);
            renderClassChart(result.byClass);
            renderMonthlyChart(result.monthly);
            renderTopStudents(result.topStudents);
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
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

function renderClassChart(data) {
    const ctx = document.getElementById('classChart').getContext('2d');

    if (classChart) classChart.destroy();

    const colors = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'];

    classChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.labels,
            datasets: [{ data: data.values, backgroundColor: colors.slice(0, data.labels.length) }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } }
        }
    });
}

function renderMonthlyChart(data) {
    const ctx = document.getElementById('monthlyChart').getContext('2d');

    if (monthlyChart) monthlyChart.destroy();

    monthlyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.label),
            datasets: [{
                label: 'Số yêu cầu',
                data: data.map(d => d.count),
                backgroundColor: '#8b5cf6',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

function renderTopStudents(students) {
    const container = document.getElementById('topStudentsList');

    if (!students || students.length === 0) {
        container.innerHTML = '<p style="color: #64748b; text-align: center; padding: 20px;">Chưa có dữ liệu tháng này</p>';
        return;
    }

    container.innerHTML = `
        <div class="top-students-table">
            ${students.map((s, i) => `
                <div class="top-student-row ${i === 0 ? 'first' : ''} ${i === 1 ? 'second' : ''} ${i === 2 ? 'third' : ''}">
                    <span class="rank">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1)}</span>
                    <span class="student-name">${escapeHtml(s.fullname)}</span>
                    <span class="student-mssv">${escapeHtml(s.mssv)}</span>
                    <span class="count">${s.count} lần</span>
                </div>
            `).join('')}
        </div>
    `;
}

// ============================================
// Fetch Data with Filter & Search
// ============================================
async function fetchRequests() {
    requestsBody.innerHTML = `
        <tr>
            <td colspan="8" class="loading-row">
                <span class="loader"></span>
                Đang tải dữ liệu...
            </td>
        </tr>
    `;

    try {
        const filter = filterSelect.value;
        const search = searchInput.value.trim();
        const deadline = deadlineFilter.value;

        let url = '/api/late-requests';
        const params = new URLSearchParams();
        if (filter) params.append('filter', filter);
        if (search) params.append('search', search);
        if (deadline) params.append('deadline_filter', deadline);
        if (params.toString()) url += '?' + params.toString();

        const response = await fetch(url, { headers: getAuthHeaders() });

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
                <td colspan="8" class="empty-row">
                    ❌ Không thể kết nối đến server
                </td>
            </tr>
        `;
    }
}

// ============================================
// Render Table with Pagination
// ============================================
function renderTable() {
    selectedIds.clear();
    updateSelectedCount();
    selectAllCheckbox.checked = false;

    if (requests.length === 0) {
        requestsBody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-row">
                    📭 Không tìm thấy yêu cầu nào
                </td>
            </tr>
        `;
        resultCount.textContent = 'Không có yêu cầu';
        paginationTotal.textContent = '';
        paginationPages.innerHTML = '';
        prevPageBtn.disabled = true;
        nextPageBtn.disabled = true;
        return;
    }

    // Calculate pagination
    const totalPages = Math.ceil(requests.length / pageSize);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, requests.length);
    const paginatedRequests = requests.slice(startIndex, endIndex);

    // Update info
    resultCount.textContent = `Hiển thị ${startIndex + 1}-${endIndex}`;
    paginationTotal.textContent = `/ ${requests.length} yêu cầu`;

    requestsBody.innerHTML = paginatedRequests.map((req, index) => {
        const statusHtml = getDeadlineStatusHtml(req.is_within_deadline, req.deadline_message);
        const globalIndex = startIndex + index + 1;
        return `
            <tr data-id="${req.id}">
                <td><input type="checkbox" class="row-checkbox" value="${req.id}" onchange="toggleRowSelect(${req.id}, this)"></td>
                <td>${globalIndex}</td>
                <td><strong>${escapeHtml(req.mssv)}</strong></td>
                <td>${escapeHtml(req.fullname)}</td>
                <td>${escapeHtml(req.class_session)}</td>
                <td>${formatDateTime(req.created_at)}</td>
                <td>${statusHtml}</td>
                <td>
                    <button class="action-btn" onclick="viewDetail(${req.id})">
                        Xem
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Render pagination controls
    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;

    let pagesHtml = '';

    if (totalPages <= 7) {
        // Show all pages
        for (let i = 1; i <= totalPages; i++) {
            pagesHtml += `<button class="pagination-page ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
        }
    } else {
        // Show first, last, current and neighbors
        pagesHtml += `<button class="pagination-page ${1 === currentPage ? 'active' : ''}" onclick="goToPage(1)">1</button>`;

        if (currentPage > 3) {
            pagesHtml += '<span class="pagination-page ellipsis">...</span>';
        }

        for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
            pagesHtml += `<button class="pagination-page ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
        }

        if (currentPage < totalPages - 2) {
            pagesHtml += '<span class="pagination-page ellipsis">...</span>';
        }

        pagesHtml += `<button class="pagination-page ${totalPages === currentPage ? 'active' : ''}" onclick="goToPage(${totalPages})">${totalPages}</button>`;
    }

    paginationPages.innerHTML = pagesHtml;
}

function goToPage(page) {
    currentPage = page;
    renderTable();
    // Scroll to top of table
    document.querySelector('.table-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function getDeadlineStatusHtml(isWithin, message) {
    if (isWithin === null) {
        return '<span class="status-badge status-unknown">❓ Không xác định</span>';
    }
    if (isWithin) {
        return `<span class="status-badge status-within" title="${message}">✅ Trong hạn</span>`;
    }
    return `<span class="status-badge status-outside" title="${message}">❌ Ngoài hạn</span>`;
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

// Tọa độ trường (FPT Polytechnic TP.HCM - CS3)
const SCHOOL_COORDS = {
    latitude: 10.853784,
    longitude: 106.626292
};

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(2);
}

// ============================================
// View Detail Modal
// ============================================
function viewDetail(id) {
    currentRequest = requests.find(req => req.id === id);
    if (!currentRequest) return;

    // Deadline badge
    const badgeEl = document.getElementById('deadlineBadge');
    if (currentRequest.is_within_deadline === true) {
        badgeEl.className = 'deadline-badge within';
        badgeEl.innerHTML = `✅ TRONG HẠN<br><small>${currentRequest.deadline_message}</small>`;
    } else if (currentRequest.is_within_deadline === false) {
        badgeEl.className = 'deadline-badge outside';
        badgeEl.innerHTML = `❌ NGOÀI HẠN<br><small>${currentRequest.deadline_message}</small>`;
    } else {
        badgeEl.className = 'deadline-badge unknown';
        badgeEl.innerHTML = '❓ Không xác định';
    }

    document.getElementById('detailMssv').textContent = currentRequest.mssv;
    document.getElementById('detailFullname').textContent = currentRequest.fullname;
    document.getElementById('detailClassSession').textContent = currentRequest.class_session;
    document.getElementById('detailTime').textContent = formatDateTime(currentRequest.created_at);
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

    document.getElementById('detailAddress').innerHTML =
        (currentRequest.address || 'Không có thông tin vị trí');

    if (currentRequest.latitude && currentRequest.longitude) {
        const distance = calculateDistance(currentRequest.latitude, currentRequest.longitude, SCHOOL_COORDS.latitude, SCHOOL_COORDS.longitude);

        let color = '#10b981'; // Green
        let icon = '🟢';

        if (distance > 20) {
            color = '#ef4444'; // Red
            icon = '🔴';
        } else if (distance > 5) {
            color = '#f59e0b'; // Orange
            icon = '🟠';
        }

        const distanceHtml = `<br><span style="color: ${color}; font-weight: 600; margin-top: 4px; display: inline-block;">${icon} Cách trường ${distance}km</span>`;
        document.getElementById('detailAddress').innerHTML += distanceHtml;
    }

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
            historyBody.innerHTML = result.data.map((req, index) => {
                const statusHtml = getDeadlineStatusHtml(req.is_within_deadline, req.deadline_message);
                return `
                    <tr class="clickable-row" onclick="viewHistoryDetail(${req.id})" title="Click để xem chi tiết">
                        <td>${index + 1}</td>
                        <td>${escapeHtml(req.class_session)}</td>
                        <td>${formatDateTime(req.created_at)}</td>
                        <td>${statusHtml}</td>
                        <td><button class="action-btn btn-sm">Xem</button></td>
                    </tr>
                `;
            }).join('');

            closeModalFn();
            historyModal.classList.add('show');

            // Store history data for later use
            window.historyData = result.data;
        }
    } catch (error) {
        showToast('Không thể tải lịch sử!', 'error');
    }
}

// View detail from history
function viewHistoryDetail(id) {
    const historyReq = window.historyData?.find(r => r.id === id);
    if (historyReq) {
        // Add to requests if not exists
        if (!requests.find(r => r.id === id)) {
            requests.push(historyReq);
        }
        closeHistoryModalFn();
        viewDetail(id);
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
function formatDateTime(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
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
    currentPage = 1;
    fetchRequests();
    fetchStatistics();
});
searchInput.addEventListener('input', () => {
    currentPage = 1;
    handleSearch();
});
filterSelect.addEventListener('change', () => {
    currentPage = 1;
    fetchRequests();
});
deadlineFilter.addEventListener('change', () => {
    currentPage = 1;
    fetchRequests();
});

// Pagination Events
pageSizeSelect.addEventListener('change', (e) => {
    pageSize = parseInt(e.target.value);
    currentPage = 1;
    renderTable();
});

prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderTable();
        document.querySelector('.table-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
});

nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(requests.length / pageSize);
    if (currentPage < totalPages) {
        currentPage++;
        renderTable();
        document.querySelector('.table-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
});

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
        closeLightbox();
    }
});

// Bulk Delete Events
selectAllCheckbox.addEventListener('change', (e) => {
    const checkboxes = document.querySelectorAll('.row-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = e.target.checked;
        const id = parseInt(cb.value);
        const row = cb.closest('tr');
        if (e.target.checked) {
            selectedIds.add(id);
            row.classList.add('selected');
        } else {
            selectedIds.delete(id);
            row.classList.remove('selected');
        }
    });
    updateSelectedCount();
});

deleteSelectedBtn.addEventListener('click', deleteSelectedRequests);
deleteAllBtn.addEventListener('click', deleteAllRequests);
exportExcelBtn.addEventListener('click', exportToExcel);

// ============================================
// Checkbox & Bulk Delete Functions
// ============================================
function toggleRowSelect(id, checkbox) {
    const row = checkbox.closest('tr');
    if (checkbox.checked) {
        selectedIds.add(id);
        row.classList.add('selected');
    } else {
        selectedIds.delete(id);
        row.classList.remove('selected');
    }
    updateSelectedCount();

    // Update select all checkbox
    const allCheckboxes = document.querySelectorAll('.row-checkbox');
    selectAllCheckbox.checked = selectedIds.size === allCheckboxes.length && allCheckboxes.length > 0;
}

function updateSelectedCount() {
    if (selectedIds.size > 0) {
        selectedCountSpan.textContent = `(Đã chọn ${selectedIds.size})`;
        selectedCountSpan.style.display = 'inline';
        deleteSelectedBtn.style.display = 'inline-flex';
    } else {
        selectedCountSpan.style.display = 'none';
        deleteSelectedBtn.style.display = 'none';
    }
}

async function deleteSelectedRequests() {
    if (selectedIds.size === 0) return;

    if (!confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.size} yêu cầu đã chọn?`)) return;

    try {
        const response = await fetch('/api/late-requests/bulk-delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ ids: Array.from(selectedIds) })
        });

        const result = await response.json();

        if (result.success) {
            showToast(`Đã xóa ${result.deletedCount} yêu cầu!`, 'success');
            fetchRequests();
            fetchStatistics();
        } else {
            showToast(result.message || 'Không thể xóa!', 'error');
        }
    } catch (error) {
        showToast('Lỗi kết nối server!', 'error');
    }
}

async function deleteAllRequests() {
    if (requests.length === 0) {
        showToast('Không có yêu cầu nào để xóa!', 'info');
        return;
    }

    const confirmText = prompt(`Nhập "XOA TAT CA" để xác nhận xóa tất cả ${requests.length} yêu cầu:`);
    if (confirmText !== 'XOA TAT CA') {
        showToast('Đã hủy thao tác xóa!', 'info');
        return;
    }

    try {
        const allIds = requests.map(r => r.id);
        const response = await fetch('/api/late-requests/bulk-delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ ids: allIds })
        });

        const result = await response.json();

        if (result.success) {
            showToast(`Đã xóa tất cả ${result.deletedCount} yêu cầu!`, 'success');
            fetchRequests();
            fetchStatistics();
        } else {
            showToast(result.message || 'Không thể xóa!', 'error');
        }
    } catch (error) {
        showToast('Lỗi kết nối server!', 'error');
    }
}

// ============================================
// Lightbox Functions
// ============================================
function openLightbox(src) {
    if (!src) return;
    document.getElementById('lightboxImage').src = src;
    document.getElementById('lightboxCaption').textContent = 'Nhấn ESC hoặc click để đóng';
    document.getElementById('imageLightbox').classList.add('show');
}

function closeLightbox() {
    document.getElementById('imageLightbox').classList.remove('show');
}

// ============================================
// Export Excel Function
// ============================================
function exportToExcel() {
    if (!requests || requests.length === 0) {
        showToast('Không có dữ liệu để xuất!', 'info');
        return;
    }

    try {
        // Prepare data for export
        const exportData = requests.map((req, index) => {
            let status = 'Không xác định';
            if (req.is_within_deadline === true) status = 'Trong hạn';
            else if (req.is_within_deadline === false) status = 'Ngoài hạn';

            return {
                'STT': index + 1,
                'MSSV': req.mssv,
                'Họ tên': req.fullname,
                'Ca học': req.class_session,
                'Thời gian gửi': new Date(req.created_at).toLocaleString('vi-VN'),
                'Trạng thái': status,
                'Chi tiết trạng thái': req.deadline_message || '',
                'Lý do': req.reason || '',
                'Địa chỉ': req.address || '',
                'Tọa độ': `${req.latitude || ''}, ${req.longitude || ''}`
            };
        });

        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);

        // Adjust column widths
        const wscols = [
            { wch: 5 },  // STT
            { wch: 10 }, // MSSV
            { wch: 25 }, // Họ tên
            { wch: 10 }, // Ca học
            { wch: 20 }, // Thời gian
            { wch: 15 }, // Trạng thái
            { wch: 30 }, // Chi tiết
            { wch: 30 }, // Lý do
            { wch: 40 }, // Địa chỉ
            { wch: 25 }  // Tọa độ
        ];
        ws['!cols'] = wscols;

        XLSX.utils.book_append_sheet(wb, ws, "Danh sách xin đi trễ");

        // Generate filename with current date
        const date = new Date();
        const dateStr = `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
        const fileName = `Danh_sach_xin_di_tre_${dateStr}.xlsx`;

        // Save file
        XLSX.writeFile(wb, fileName);
        showToast('Đã xuất file Excel thành công!', 'success');
    } catch (error) {
        console.error('Lỗi export Excel:', error);
        showToast('Không thể xuất file Excel!', 'error');
    }
}

// ============================================
// Map Lightbox Functions
// ============================================
function openMapLightbox() {
    if (!currentRequest || !currentRequest.latitude || !currentRequest.longitude) {
        showToast('Không có dữ liệu vị trí để phóng to!', 'error');
        return;
    }

    const lightbox = document.getElementById('mapLightbox');
    lightbox.classList.add('show');
    console.log('Opening Map Lightbox...'); // Debug

    // Initialize or Update Map
    // Wait for lightbox to be visible for correct sizing
    setTimeout(() => {
        if (!largeMapInstance) {
            console.log('Initializing new large map instance');
            largeMapInstance = L.map('largeMap').setView([currentRequest.latitude, currentRequest.longitude], 16);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap'
            }).addTo(largeMapInstance);
        } else {
            console.log('Updating existing large map instance');
            largeMapInstance.setView([currentRequest.latitude, currentRequest.longitude], 16);
        }

        // Always force resize calculation after visibility change
        largeMapInstance.invalidateSize();

        // Clear existing layers (except tile layer) to remove old markers
        largeMapInstance.eachLayer((layer) => {
            if (layer instanceof L.Marker) {
                largeMapInstance.removeLayer(layer);
            }
        });

        // Add User Marker
        L.marker([currentRequest.latitude, currentRequest.longitude])
            .addTo(largeMapInstance)
            .bindPopup(`<b>${currentRequest.fullname}</b><br>${currentRequest.address || 'Vị trí sinh viên'}`)
            .openPopup();

        // Add School Marker
        if (typeof SCHOOL_COORDS !== 'undefined') {
            L.marker([SCHOOL_COORDS.latitude, SCHOOL_COORDS.longitude])
                .addTo(largeMapInstance)
                .bindPopup('<b>FPT Polytechnic CS3</b>')
                .openPopup();
        }

    }, 300); // 300ms timeout
}

function closeMapLightbox() {
    const lightbox = document.getElementById('mapLightbox');
    lightbox.classList.remove('show');
}

// ============================================
// Initialize
// ============================================
document.addEventListener('DOMContentLoaded', checkAuth);
