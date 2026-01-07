import { firebaseService } from './firebase.js';

let currentUser = null;
let allRequestsData = [];
let employeesData = [];

// PAGINATION STATE
let currentRequestPage = 1;
const requestsPerPage = 10; 
let currentEmployeePage = 1;
const employeesPerPage = 10;

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();

    // --- Dynamic Overtime Form Listener ---
    const overtimeTypeSelect = document.getElementById('overtimeType');
    if (overtimeTypeSelect) {
        overtimeTypeSelect.addEventListener('change', function() {
            const standardInputs = document.getElementById('standardOvertimeInputs');
            const changeOffInputs = document.getElementById('changeOffInputs');
            
            if (this.value === 'Shift Swap') {
                standardInputs.style.display = 'none';
                changeOffInputs.style.display = 'block';
                document.getElementById('overtimeStartDate').required = false;
                document.getElementById('overtimeEndDate').required = false;
                document.getElementById('originalOffDate').required = true;
                document.getElementById('newOffDate').required = true;
            } else {
                standardInputs.style.display = 'block';
                changeOffInputs.style.display = 'none';
                document.getElementById('overtimeStartDate').required = true;
                document.getElementById('overtimeEndDate').required = true;
                document.getElementById('originalOffDate').required = false;
                document.getElementById('newOffDate').required = false;
            }
        });
    }
});

function initializeApp() {
    // Login form handler
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // Employee management event listeners
    document.getElementById('addEmployeeBtn').addEventListener('click', showAddEmployeeForm);
    document.getElementById('employeeForm').addEventListener('submit', handleEmployeeSubmit);
    
    // Listen for auth state changes
    firebaseService.onAuthStateChanged(async (user) => {
        const loginBtn = document.querySelector('#loginForm button[type="submit"]');
        if (loginBtn) {
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i>Sign In/登录';
            loginBtn.disabled = false;
        }
        
        if (user) {
            try {
                const employee = await firebaseService.getEmployeeByEmail(user.email);
                if (employee) {
                    currentUser = {
                        uid: user.uid,
                        email: user.email,
                        ...employee
                    };
                    showAppPage();
                } else {
                    await firebaseService.logoutUser();
                    showMessage('Error/错误', 'Employee record not found. Please contact HR./未找到员工记录，请联系人力资源。');
                }
            } catch (error) {
                console.error('Auth state error:', error);
            }
        } else {
            currentUser = null;
            showLoginPage();
        }
    });
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Signing in.../登录中...';
    submitBtn.disabled = true;
    
    try {
        await firebaseService.loginUser(email, password);
    } catch (error) {
        console.error('Login error:', error);
        let errorMessage = 'Login failed. Please try again./登录失败，请重试。';
        if (error.code === 'auth/invalid-credential') errorMessage = 'Invalid email or password./无效的邮箱或密码。';
        else if (error.code === 'auth/too-many-requests') errorMessage = 'Too many failed attempts. Please try again later./尝试次数过多，请稍后重试。';
        else if (error.code === 'auth/user-not-found') errorMessage = 'No account found with this email./未找到此邮箱的账户。';
        else if (error.code === 'auth/wrong-password') errorMessage = 'Incorrect password./密码错误。';
        
        showMessage('Login Failed/登录失败', errorMessage);
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

function showLoginPage() {
    document.getElementById('loginPage').style.display = 'block';
    document.getElementById('appPage').style.display = 'none';
    document.getElementById('loginForm').reset();
}

function showAppPage() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('appPage').style.display = 'block';
    document.getElementById('userWelcome').textContent = `Welcome, ${currentUser.name}/欢迎, ${currentUser.name}`;
    
    const welcomeTitle = document.getElementById('welcomeTitle');
    const welcomeSubtitle = document.getElementById('welcomeSubtitle');
    
    if (currentUser.role === 'Employee') {
        welcomeTitle.textContent = `Welcome to Your Spa Portal, ${currentUser.name}/欢迎来到您的SPA门户, ${currentUser.name}`;
        welcomeSubtitle.textContent = 'Manage your schedule, request time off, and view your requests/管理您的日程、请假并查看您的请求';
    } else if (currentUser.role === 'Head') {
        welcomeTitle.textContent = `Team Management Portal/团队管理门户`;
        welcomeSubtitle.textContent = `Review and manage requests for the ${currentUser.department} team/审阅和管理${currentUser.department}团队的请求`;
    } else if (currentUser.role === 'HR') {
        welcomeTitle.textContent = `Spa Management Dashboard/SPA管理仪表板`;
        welcomeSubtitle.textContent = 'Manage all staff members and review system-wide requests/管理所有员工并审阅全系统请求';
    }
    
    document.getElementById('employeeView').style.display = currentUser.role === 'Employee' ? 'block' : 'none';
    document.getElementById('headView').style.display = currentUser.role === 'Head' ? 'block' : 'none';
    document.getElementById('hrView').style.display = currentUser.role === 'HR' ? 'block' : 'none';
    
    if (currentUser.role === 'Employee') initializeEmployeeView();
    else if (currentUser.role === 'Head') initializeHeadView();
    else if (currentUser.role === 'HR') initializeHRView();
}

async function logout() {
    if (confirm('Are you sure you want to logout?/您确定要退出吗？')) {
        try { await firebaseService.logoutUser(); } 
        catch (error) { console.error('Logout error:', error); }
    }
}

function showHelp() { showMessage('Need Help?/需要帮助？', 'For technical support or login issues, please contact HR Department./如需技术支持或登录问题，请联系人力资源部。'); }

function showMessage(title, message) {
    document.getElementById('messageModalTitle').textContent = title;
    document.getElementById('messageModalBody').textContent = message;
    const modal = new bootstrap.Modal(document.getElementById('messageModal'));
    modal.show();
}

// Employee View Functions
function initializeEmployeeView() { loadMyRequests(); }

async function submitLeaveRequest() {
    const leaveType = document.getElementById('leaveType').value;
    const startDate = document.getElementById('leaveStartDate').value;
    const endDate = document.getElementById('leaveEndDate').value;
    const reason = document.getElementById('leaveReason').value;
    
    if (!leaveType || !startDate || !endDate || !reason) {
        showMessage('Error/错误', 'Please fill in all required fields./请填写所有必填字段。');
        return;
    }
    
    const startObj = new Date(startDate);
    const endObj = new Date(endDate);
    if (endObj < startObj) {
        showMessage('Invalid Dates/无效日期', 'End date cannot be earlier than start date./结束日期不能早于开始日期。');
        return;
    }
    
    const diffTime = Math.abs(endObj - startObj);
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    const requestData = {
        employeeName: currentUser.name,
        employeeId: currentUser.employeeId,
        department: currentUser.department,
        position: currentUser.position,
        leaveType: leaveType,
        startDate: startDate,
        endDate: endDate,
        totalDays: totalDays,
        reason: reason,
    };
    
    try {
        await firebaseService.submitLeaveRequest(requestData);
        showMessage('Success/成功', 'Leave request submitted successfully!/请假请求提交成功！');
        clearLeaveForm();
        loadMyRequests();
    } catch (error) {
        showMessage('Error/错误', 'Failed to submit request: ' + error.message);
    }
}

async function submitOvertimeRequest() {
    const adjustmentType = document.getElementById('overtimeType').value;
    const reason = document.getElementById('overtimeReason').value;
    
    let startDate, endDate, totalHours;

    if (adjustmentType === 'Shift Swap') {
        startDate = document.getElementById('originalOffDate').value;
        endDate = document.getElementById('newOffDate').value;

        if (!startDate || !endDate || !reason) {
            showMessage('Error/错误', 'Please fill in Original Off Date, New Off Date, and Reason./请填写原定休息日、新休息日和原因。');
            return;
        }
        totalHours = 0;
    } else {
        startDate = document.getElementById('overtimeStartDate').value;
        endDate = document.getElementById('overtimeEndDate').value;

        if (!startDate || !endDate || !reason) {
            showMessage('Error/错误', 'Please fill in all required fields./请填写所有必填字段。');
            return;
        }

        const startObj = new Date(startDate);
        const endObj = new Date(endDate);
        if (endObj < startObj) {
            showMessage('Invalid Times/无效时间', 'End time cannot be earlier than start time./结束时间不能早于开始时间。');
            return;
        }
        
        const diffTime = Math.abs(endObj - startObj);
        totalHours = parseFloat((diffTime / (1000 * 60 * 60)).toFixed(2));
    }
    
    const requestData = {
        employeeName: currentUser.name,
        employeeId: currentUser.employeeId,
        department: currentUser.department,
        position: currentUser.position,
        adjustmentType: adjustmentType,
        startDate: startDate,
        endDate: endDate,
        totalHours: totalHours,
        reason: reason,
    };
    
    try {
        await firebaseService.submitOvertimeRequest(requestData);
        showMessage('Success/成功', 'Request submitted successfully!/请求提交成功！');
        clearOvertimeForm();
        loadMyRequests();
    } catch (error) {
        showMessage('Error/错误', 'Failed to submit request: ' + error.message);
    }
}

function clearLeaveForm() {
    document.getElementById('leaveType').value = '';
    document.getElementById('leaveStartDate').value = '';
    document.getElementById('leaveEndDate').value = '';
    document.getElementById('leaveReason').value = '';
}

function clearOvertimeForm() {
    document.getElementById('overtimeType').value = 'Overtime';
    document.getElementById('overtimeStartDate').value = '';
    document.getElementById('overtimeEndDate').value = '';
    document.getElementById('originalOffDate').value = '';
    document.getElementById('newOffDate').value = '';
    document.getElementById('overtimeReason').value = '';
    const event = new Event('change');
    document.getElementById('overtimeType').dispatchEvent(event);
}

// --- loadMyRequests with Swap Display ---
async function loadMyRequests() {
    const container = document.getElementById('myRequestsContainer');
    container.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>
            <p class="mt-2 text-muted">Loading your requests.../正在加载您的请求...</p>
        </div>
    `;
    
    try {
        const [leaveRequests, overtimeRequests] = await Promise.all([
            firebaseService.getLeaveRequestsByEmployee(currentUser.employeeId),
            firebaseService.getOvertimeRequestsByEmployee(currentUser.employeeId)
        ]);
        
        const allRequests = [...leaveRequests, ...overtimeRequests].sort((a, b) => {
            const dateA = a.submissionDate?.toDate ? a.submissionDate.toDate() : new Date(a.submissionDate);
            const dateB = b.submissionDate?.toDate ? b.submissionDate.toDate() : new Date(b.submissionDate);
            return dateB - dateA;
        });
        
        if (allRequests.length === 0) {
            container.innerHTML = `<div class="text-center py-5"><h5 class="text-muted">No Requests Found/未找到请求</h5></div>`;
            return;
        }
        
        let html = `
            <div class="table-responsive">
                <table class="table table-hover mobile-friendly">
                    <thead class="table-light">
                        <tr>
                            <th>Type/类型</th>
                            <th>Details/详情</th>
                            <th>Dates/日期</th>
                            <th>Duration/时长</th>
                            <th>Status/状态</th>
                            <th>Actions/操作</th>
                            <th>Submitted/提交时间</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        allRequests.forEach(request => {
            const statusClass = getStatusBadgeClass(request.status);
            
            let dateDisplay, durationDisplay;
            if (request.adjustmentType === 'Shift Swap') {
                dateDisplay = `
                    <div class="small text-muted">Orig Off:</div><strong>${formatDate(request.startDate)}</strong>
                    <div class="small text-muted mt-1">New Off:</div><strong>${formatDate(request.endDate)}</strong>
                `;
                durationDisplay = `<span class="badge bg-secondary">Swap</span>`;
            } else {
                dateDisplay = `${formatDate(request.startDate)} to ${formatDate(request.endDate)}`;
                durationDisplay = request.type === 'Leave' ? 
                    `<strong>${request.totalDays} days</strong>` : 
                    `<strong>${request.totalHours} hrs</strong>`;
            }

            let showCancelButton = false;
            const isActive = request.status !== 'Cancelled' && request.status !== 'Rejected';
            const isNotPendingCancel = !request.cancellationRequested;

            if (isActive && isNotPendingCancel) {
                if (request.status === 'Pending') {
                    showCancelButton = true;
                } else if (request.status === 'Approved') {
                    if (request.type === 'Overtime') {
                        showCancelButton = true;
                    } else if (request.type === 'Leave') {
                        const endDate = new Date(request.endDate);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        if (endDate >= today) showCancelButton = true;
                    }
                }
            }
            
            html += `
                <tr>
                    <td>
                        <span class="badge ${request.type === 'Leave' ? 'bg-info' : 'bg-warning'}">${request.type}</span>
                        <div class="small text-muted mt-1">${request.leaveType || request.adjustmentType}</div>
                    </td>
                    <td>
                        <div class="small">${request.reason || '-'}</div>
                        ${request.cancellationRequested ? `<div class="small text-warning mt-1"><i class="fas fa-exclamation-triangle"></i> Cancellation Requested</div>` : ''}
                        ${request.status === 'Cancelled' ? `<div class="small text-muted mt-1">Cancelled: ${request.cancellationReason || '-'}</div>` : ''}
                    </td>
                    <td><div class="small">${dateDisplay}</div></td>
                    <td>${durationDisplay}</td>
                    <td><span class="badge ${statusClass}">${request.status}</span></td>
                    <td>
                        ${showCancelButton ? `<button class="btn btn-outline-warning btn-sm" onclick="showCancelModal('${request.id}', '${request.type}')"><i class="fas fa-times me-1"></i>Cancel</button>` : ''}
                    </td>
                    <td><small>${formatDate(request.submissionDate)}</small></td>
                </tr>
            `;
        });
        
        html += `</tbody></table></div>`;
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
}

// Cancel Request Modal
function showCancelModal(requestId, requestType) {
    const modal = new bootstrap.Modal(document.getElementById('cancelModal'));
    document.getElementById('cancelModal').setAttribute('data-request-id', requestId);
    document.getElementById('cancelModal').setAttribute('data-request-type', requestType);
    document.getElementById('cancelReason').value = '';
    modal.show();
}

async function submitCancellation() {
    const modal = document.getElementById('cancelModal');
    const requestId = modal.getAttribute('data-request-id');
    const requestType = modal.getAttribute('data-request-type');
    const reason = document.getElementById('cancelReason').value;
    
    if (!reason) { showMessage('Error', 'Please provide a reason.'); return; }
    
    try {
        await firebaseService.cancelRequest(requestId, requestType, reason);
        showMessage('Success', 'Cancellation submitted!');
        bootstrap.Modal.getInstance(modal).hide();
        loadMyRequests();
        if (currentUser.role === 'Head') { loadDepartmentRequests(); loadCancellationRequests(); }
        else if (currentUser.role === 'HR') { loadAllRequests(); loadCancellationRequests(); }
    } catch (error) { showMessage('Error', error.message); }
}

function initializeHeadView() {
    document.getElementById('headDepartment').textContent = `${currentUser.department}`;
    loadDepartmentRequests();
    loadCancellationRequests();
}

async function loadDepartmentRequests() {
    const container = document.getElementById('requestsContainer');
    container.innerHTML = `<div class="spinner-border text-primary"></div>`;
    
    try {
        const requests = await firebaseService.getPendingRequestsByDepartment(currentUser.department);
        if (requests.length === 0) { container.innerHTML = '<div class="text-center py-5">No Pending Requests</div>'; return; }
        
        let html = `
            <div class="table-responsive">
                <table class="table table-hover table-bordered mobile-friendly">
                    <thead class="table-dark">
                        <tr><th>Employee</th><th>Type</th><th>Dates/Details</th><th>Reason</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
        `;
        
        requests.forEach(request => {
            let dateDisplay;
            if (request.adjustmentType === 'Shift Swap') {
                dateDisplay = `Original Off: ${formatDate(request.startDate)}<br>New Off: ${formatDate(request.endDate)}`;
            } else {
                dateDisplay = `${formatDate(request.startDate)} - ${formatDate(request.endDate)}`;
            }

            html += `
                <tr>
                    <td><strong>${request.employeeName}</strong><br><small>${request.employeeId}</small></td>
                    <td>${request.type}<br><small>${request.leaveType || request.adjustmentType}</small></td>
                    <td>${dateDisplay}<br><strong>${request.type === 'Leave' ? request.totalDays + ' days' : (request.adjustmentType === 'Shift Swap' ? 'Swap' : request.totalHours + ' hrs')}</strong></td>
                    <td>${request.reason}</td>
                    <td>
                        <button class="btn btn-success btn-sm" onclick="approveRequest('${request.id}', '${request.type}')">Approve</button>
                        <button class="btn btn-danger btn-sm" onclick="rejectRequest('${request.id}', '${request.type}')">Reject</button>
                    </td>
                </tr>
            `;
        });
        html += `</tbody></table></div>`;
        container.innerHTML = html;
    } catch (error) { container.innerHTML = `<div class="alert alert-danger">${error.message}</div>`; }
}

async function loadCancellationRequests() {
    if (currentUser.role !== 'Head' && currentUser.role !== 'HR') return;
    const containerId = currentUser.role === 'Head' ? 'cancellationRequestsContainer' : 'hrCancellationRequestsContainer';
    let container = document.getElementById(containerId);
    if (!container) return; // Guard clause
    
    try {
        let requests = await firebaseService.getCancellationRequests();
        if (currentUser.role === 'Head') requests = requests.filter(r => r.department === currentUser.department);
        if (requests.length === 0) { container.innerHTML = '<div class="text-center py-3">No cancellation requests</div>'; return; }
        
        let html = `<table class="table"><tbody>`;
        requests.forEach(r => {
            html += `<tr><td>${r.employeeName} - ${r.type}<br>Reason: ${r.cancellationReason}</td><td><button onclick="approveCancellation('${r.id}','${r.type}')" class="btn btn-success btn-sm">Approve</button></td></tr>`;
        });
        html += `</tbody></table>`;
        container.innerHTML = html;
    } catch (e) { container.innerHTML = e.message; }
}

async function approveRequest(id, type) { if(confirm('Approve?')) { await firebaseService.updateRequestStatus(id, 'Approved', type, currentUser.name); loadDepartmentRequests(); } }
async function rejectRequest(id, type) { if(confirm('Reject?')) { await firebaseService.updateRequestStatus(id, 'Rejected', type, currentUser.name); loadDepartmentRequests(); } }
async function approveCancellation(id, type) { if(confirm('Approve Cancel?')) { await firebaseService.approveCancellation(id, type); loadCancellationRequests(); loadDepartmentRequests(); } }
async function rejectCancellation(id, type) { if(confirm('Reject Cancel?')) { await firebaseService.rejectCancellation(id, type); loadCancellationRequests(); } }

function initializeHRView() {
    loadAllRequests();
    loadEmployeeList();
    loadCancellationRequests();
    setupFilters();
    document.getElementById('downloadExcelBtn').addEventListener('click', showExcelModal);
    document.getElementById('confirmExcelDownload').addEventListener('click', generateExcelReport);
}

function setupFilters() {
    document.getElementById('searchName').addEventListener('input', () => { currentRequestPage = 1; applyFilters(); });
    document.getElementById('filterDepartment').addEventListener('change', () => { currentRequestPage = 1; applyFilters(); });
    document.getElementById('filterRequestType').addEventListener('change', () => { currentRequestPage = 1; applyFilters(); });
    document.getElementById('filterStatus').addEventListener('change', () => { currentRequestPage = 1; applyFilters(); });
    document.getElementById('startDateFilter').addEventListener('change', () => { currentRequestPage = 1; applyFilters(); });
    document.getElementById('endDateFilter').addEventListener('change', () => { currentRequestPage = 1; applyFilters(); });
    document.getElementById('clearFilters').addEventListener('click', clearFilters);
}

async function loadAllRequests() {
    const tbody = document.getElementById('allRequestsTable');
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4">Loading...</td></tr>`;
    try {
        allRequestsData = await firebaseService.getAllRequests();
        currentRequestPage = 1;
        applyFilters();
    } catch (error) { tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Error: ${error.message}</td></tr>`; }
}

function applyFilters() {
    const searchName = document.getElementById('searchName').value.toLowerCase();
    const department = document.getElementById('filterDepartment').value;
    const requestType = document.getElementById('filterRequestType').value;
    const status = document.getElementById('filterStatus').value;
    const startDate = document.getElementById('startDateFilter').value;
    const endDate = document.getElementById('endDateFilter').value;

    const filteredRequests = allRequestsData.filter(request => {
        if (searchName && !request.employeeName.toLowerCase().includes(searchName) && !request.employeeId.toLowerCase().includes(searchName)) return false;
        if (department && request.department !== department) return false;
        if (requestType && request.type !== requestType) return false;
        if (status && request.status !== status) return false;
        if (startDate && new Date(request.startDate) < new Date(startDate)) return false;
        if (endDate && new Date(request.endDate) > new Date(endDate)) return false;
        return true;
    });
    
    displayFilteredRequests(filteredRequests);
}

function displayFilteredRequests(requests) {
    const tbody = document.getElementById('allRequestsTable');
    const existingNav = document.getElementById('requestsPagination');
    if (existingNav) existingNav.remove();

    if (requests.length === 0) { tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4">No requests</td></tr>'; return; }

    const totalPages = Math.ceil(requests.length / requestsPerPage);
    if (currentRequestPage > totalPages) currentRequestPage = totalPages;
    if (currentRequestPage < 1) currentRequestPage = 1;

    const pageRequests = requests.slice((currentRequestPage - 1) * requestsPerPage, currentRequestPage * requestsPerPage);

    let html = '';
    pageRequests.forEach(request => {
        const statusClass = getStatusBadgeClass(request.status);
        let dateDisplay;
        if (request.adjustmentType === 'Shift Swap') dateDisplay = `Orig: ${formatDate(request.startDate)}<br>New: ${formatDate(request.endDate)}`;
        else dateDisplay = `${formatDate(request.startDate)} to ${formatDate(request.endDate)}`;

        html += `
            <tr>
                <td>${request.employeeName}<br><small class="text-muted">${request.employeeId}</small></td>
                <td><span class="badge bg-light text-dark">${request.department}</span></td>
                <td>${request.position || '-'}</td>
                <td><span class="badge ${request.type === 'Leave' ? 'bg-info' : 'bg-warning'}">${request.type}</span><div class="small mt-1">${request.leaveType || request.adjustmentType}</div></td>
                <td><div class="small">${dateDisplay}</div></td>
                <td><span class="badge ${statusClass}">${request.status}</span></td>
                <td>${request.cancellationRequested ? `<button class="btn btn-success btn-sm mb-1" onclick="approveCancellation('${request.id}', '${request.type}')">Approve Cancel</button>` : '-'}</td>
                <td><small>${formatDate(request.submissionDate)}</small></td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;

    if (totalPages > 1) {
        const tableContainer = tbody.closest('.table-responsive');
        const paginationHTML = `
            <nav id="requestsPagination" class="mt-3">
                <ul class="pagination justify-content-center">
                    <li class="page-item ${currentRequestPage === 1 ? 'disabled' : ''}"><a class="page-link" href="#" onclick="changeRequestPage(-1); return false;">Prev</a></li>
                    <li class="page-item disabled"><span class="page-link">${currentRequestPage} / ${totalPages}</span></li>
                    <li class="page-item ${currentRequestPage === totalPages ? 'disabled' : ''}"><a class="page-link" href="#" onclick="changeRequestPage(1); return false;">Next</a></li>
                </ul>
            </nav>
        `;
        tableContainer.insertAdjacentHTML('afterend', paginationHTML);
    }
}

window.changeRequestPage = function(delta) { currentRequestPage += delta; applyFilters(); };

function clearFilters() {
    document.getElementById('searchName').value = '';
    document.getElementById('filterDepartment').value = '';
    document.getElementById('filterRequestType').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('startDateFilter').value = '';
    document.getElementById('endDateFilter').value = '';
    currentRequestPage = 1;
    applyFilters();
}

// Excel Functions
function showExcelModal() {
    const now = new Date();
    document.getElementById('excelStartDate').value = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    document.getElementById('excelEndDate').value = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    new bootstrap.Modal(document.getElementById('excelModal')).show();
}

async function generateExcelReport() {
    try {
        const startInput = document.getElementById('excelStartDate').value;
        const endInput = document.getElementById('excelEndDate').value;
        if (!startInput || !endInput) { showMessage('Error', 'Please select dates.'); return; }

        const filterStart = new Date(startInput); filterStart.setHours(0, 0, 0, 0);
        const filterEnd = new Date(endInput); filterEnd.setHours(23, 59, 59, 999);

        const exportData = allRequestsData.filter(req => {
            let reqDate;
            try { reqDate = req.startDate.toDate ? req.startDate.toDate() : new Date(req.startDate); } catch (e) { reqDate = new Date(req.startDate); }
            return reqDate >= filterStart && reqDate <= filterEnd;
        });

        if (exportData.length === 0) { showMessage('No Data', 'No requests found.'); return; }

        exportData.sort((a, b) => { return new Date(a.startDate) - new Date(b.startDate); });

        const excelRows = exportData.map(req => ({
            'Start Date': formatDate(req.startDate),
            'End Date': formatDate(req.endDate),
            'Employee Name': req.employeeName,
            'Employee ID': req.employeeId,
            'Department': req.department,
            'Type': req.type,
            'Category': req.leaveType || req.adjustmentType,
            'Duration': req.type === 'Leave' ? `${req.totalDays} days` : (req.adjustmentType === 'Shift Swap' ? 'Swap' : `${req.totalHours} hours`),
            'Reason': req.reason || '',
            'Status': req.status,
            'Submitted': formatDate(req.submissionDate)
        }));

        const ws = XLSX.utils.json_to_sheet(excelRows);
        const headerStyle = { fill: { fgColor: { rgb: "2E7D32" } }, font: { color: { rgb: "FFFFFF" }, bold: true }, alignment: { horizontal: "center" } };
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell = ws[XLSX.utils.encode_cell({r: R, c: C})];
                if (!cell) continue;
                if (R === 0) cell.s = headerStyle;
            }
        }
        ws['!cols'] = [{wch:15}, {wch:15}, {wch:20}, {wch:10}, {wch:15}, {wch:10}, {wch:15}, {wch:10}, {wch:30}, {wch:10}, {wch:15}];
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Requests");
        const filename = `LuoCitySpa_Requests_${startInput}_to_${endInput}.xlsx`;
        XLSX.writeFile(wb, filename);
        
        bootstrap.Modal.getInstance(document.getElementById('excelModal')).hide();
        showMessage('Success', `Downloaded: ${filename}`);
    } catch (e) { showMessage('Error', e.message); }
}

// ==========================================
// EMPLOYEE MANAGEMENT (Updated with Filter/Sort)
// ==========================================

async function loadEmployeeList() {
    const container = document.getElementById('employeesContainer');
    container.innerHTML = `<div class="spinner-border text-primary"></div>`;
    
    // Attach Event Listeners for the new filters
    const searchInput = document.getElementById('employeeSearchInput');
    if (searchInput) {
        // Remove old listeners to prevent duplicates
        const newSearch = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearch, searchInput);
        newSearch.addEventListener('input', () => { currentEmployeePage = 1; applyEmployeeFilters(); });

        document.getElementById('employeeDeptFilter').addEventListener('change', () => { currentEmployeePage = 1; applyEmployeeFilters(); });
        document.getElementById('employeeSortFilter').addEventListener('change', () => { currentEmployeePage = 1; applyEmployeeFilters(); });
        document.getElementById('clearEmployeeFilters').addEventListener('click', clearEmployeeFilters);
    }

    try {
        employeesData = await firebaseService.getAllEmployees();
        currentEmployeePage = 1;
        applyEmployeeFilters(); // Replaces direct displayEmployees call
    } catch (error) { 
        container.innerHTML = `<div class="alert alert-danger">${error.message}</div>`; 
    }
}

function applyEmployeeFilters() {
    const searchTerm = document.getElementById('employeeSearchInput').value.toLowerCase();
    const deptFilter = document.getElementById('employeeDeptFilter').value;
    const sortValue = document.getElementById('employeeSortFilter').value;

    // 1. FILTERING
    let filteredEmployees = employeesData.filter(emp => {
        const matchesSearch = (emp.name.toLowerCase().includes(searchTerm) || emp.employeeId.toLowerCase().includes(searchTerm));
        const matchesDept = deptFilter === '' || emp.department === deptFilter;
        return matchesSearch && matchesDept;
    });

    // 2. SORTING
    filteredEmployees.sort((a, b) => {
        if (sortValue === 'id_asc') {
            return a.employeeId.localeCompare(b.employeeId, undefined, { numeric: true });
        } else if (sortValue === 'id_desc') {
            return b.employeeId.localeCompare(a.employeeId, undefined, { numeric: true });
        } else if (sortValue === 'date_newest') {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
            return dateB - dateA;
        } else if (sortValue === 'date_oldest') {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
            return dateA - dateB;
        }
        return 0;
    });

    displayEmployees(filteredEmployees);
}

function clearEmployeeFilters() {
    document.getElementById('employeeSearchInput').value = '';
    document.getElementById('employeeDeptFilter').value = '';
    document.getElementById('employeeSortFilter').value = 'id_asc';
    currentEmployeePage = 1;
    applyEmployeeFilters();
}

function displayEmployees(employees) {
    const container = document.getElementById('employeesContainer');
    
    // Remove existing pagination if it exists to prevent duplicates
    const existingNav = document.getElementById('employeesPagination');
    if (existingNav) existingNav.remove();

    if (employees.length === 0) { 
        container.innerHTML = '<div class="text-center py-4 text-muted">No employees match your filters.</div>'; 
        return; 
    }

    const totalPages = Math.ceil(employees.length / employeesPerPage);
    if (currentEmployeePage > totalPages) currentEmployeePage = totalPages;
    if (currentEmployeePage < 1) currentEmployeePage = 1;

    const pageEmployees = employees.slice((currentEmployeePage - 1) * employeesPerPage, currentEmployeePage * employeesPerPage);
    
    let html = `
        <div class="table-responsive">
            <table class="table table-hover mobile-friendly align-middle">
                <thead class="table-dark">
                    <tr><th>ID</th><th>Name</th><th>Email</th><th>Dept</th><th>Role</th><th>Actions</th></tr>
                </thead>
                <tbody>
    `;
    
    pageEmployees.forEach(employee => {
        html += `
            <tr>
                <td><strong>${employee.employeeId}</strong></td>
                <td>${employee.name}</td>
                <td>${employee.email}</td>
                <td><span class="badge bg-light text-dark">${employee.department}</span></td>
                <td><span class="badge ${getRoleBadgeClass(employee.role)}">${employee.role}</span></td>
                <td>
                    <button class="btn btn-outline-danger btn-sm" onclick="deleteEmployee('${employee.id}', '${employee.name}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            </tr>
        `;
    });
    
    html += `</tbody></table></div>`;

    if (totalPages > 1) {
        html += `
            <nav id="employeesPagination" class="mt-3">
                <ul class="pagination justify-content-center">
                    <li class="page-item ${currentEmployeePage === 1 ? 'disabled' : ''}">
                        <a class="page-link" href="#" onclick="changeEmployeePage(-1); return false;">Prev</a>
                    </li>
                    <li class="page-item disabled"><span class="page-link">${currentEmployeePage} / ${totalPages}</span></li>
                    <li class="page-item ${currentEmployeePage === totalPages ? 'disabled' : ''}">
                        <a class="page-link" href="#" onclick="changeEmployeePage(1); return false;">Next</a>
                    </li>
                </ul>
            </nav>
        `;
    }
    
    container.innerHTML = html;
}

window.changeEmployeePage = function(delta) { 
    currentEmployeePage += delta; 
    applyEmployeeFilters(); 
};

function getRoleBadgeClass(role) { switch(role) { case 'HR': return 'bg-danger'; case 'Head': return 'bg-warning'; case 'Employee': return 'bg-info'; default: return 'bg-secondary'; } }
function showAddEmployeeForm() { document.getElementById('employeeFormTitle').textContent = 'Add New Staff'; document.getElementById('employeeForm').reset(); document.getElementById('employeePasswordGroup').style.display = 'block'; new bootstrap.Modal(document.getElementById('employeeModal')).show(); }
async function handleEmployeeSubmit(e) { e.preventDefault(); const submitBtn = e.target.querySelector('button[type="submit"]'); submitBtn.disabled = true; const employeeData = { employeeId: document.getElementById('employeeId').value, name: document.getElementById('employeeName').value, email: document.getElementById('employeeEmail').value, department: document.getElementById('employeeDepartment').value, role: document.getElementById('employeeRole').value, position: document.getElementById('employeePosition').value }; const password = document.getElementById('employeePassword').value; try { await firebaseService.createEmployee(employeeData, password); showMessage('Success', 'Created!'); bootstrap.Modal.getInstance(document.getElementById('employeeModal')).hide(); loadEmployeeList(); } catch (error) { showMessage('Error', error.message); } finally { submitBtn.disabled = false; } }
async function deleteEmployee(employeeId, employeeName) { if (confirm(`Delete ${employeeName}?`)) { try { await firebaseService.deleteEmployee(employeeId); showMessage('Success', 'Deleted.'); loadEmployeeList(); } catch (error) { showMessage('Error', error.message); } } }
function calculateDaysDifference(start, end) { return Math.ceil(Math.abs(new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24)) + 1; }
function calculateHoursDifference(start, end) { return parseFloat((Math.abs(new Date(end) - new Date(start)) / (1000 * 60 * 60)).toFixed(2)); }
function getStatusBadgeClass(status) { switch(status) { case 'Approved': return 'status-approved'; case 'Rejected': return 'status-rejected'; case 'Pending': return 'status-pending'; default: return 'bg-secondary'; } }
function formatDate(d) { if(!d) return '-'; try { return (d.toDate ? d.toDate() : new Date(d)).toLocaleDateString('en-US'); } catch { return String(d); } }

// Exports
window.submitLeaveRequest = submitLeaveRequest;
window.submitOvertimeRequest = submitOvertimeRequest;
window.clearLeaveForm = clearLeaveForm;
window.clearOvertimeForm = clearOvertimeForm;
window.loadMyRequests = loadMyRequests;
window.loadDepartmentRequests = loadDepartmentRequests;
window.approveRequest = approveRequest;
window.rejectRequest = rejectRequest;
window.loadAllRequests = loadAllRequests;
window.loadEmployeeList = loadEmployeeList;
window.showAddEmployeeForm = showAddEmployeeForm;
window.deleteEmployee = deleteEmployee;
window.handleEmployeeSubmit = handleEmployeeSubmit;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.generateExcelReport = generateExcelReport;
window.showExcelModal = showExcelModal;
window.logout = logout;
window.showHelp = showHelp;
window.showCancelModal = showCancelModal;
window.submitCancellation = submitCancellation;
window.approveCancellation = approveCancellation;
window.rejectCancellation = rejectCancellation;
window.changeRequestPage = changeRequestPage;
// window.changeEmployeePage is exported in its definition above