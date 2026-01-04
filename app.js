import { firebaseService } from './firebase.js';

let currentUser = null;
let allRequestsData = [];
let employeesData = [];

// PAGINATION STATE
let currentRequestPage = 1;
const requestsPerPage = 10; // Change this number to show more/less rows
let currentEmployeePage = 1;
const employeesPerPage = 10;

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
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
        
        if (error.code === 'auth/invalid-credential') {
            errorMessage = 'Invalid email or password./无效的邮箱或密码。';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = 'Too many failed attempts. Please try again later./尝试次数过多，请稍后重试。';
        } else if (error.code === 'auth/user-not-found') {
            errorMessage = 'No account found with this email./未找到此邮箱的账户。';
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = 'Incorrect password./密码错误。';
        }
        
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
    
    if (currentUser.role === 'Employee') {
        initializeEmployeeView();
    } else if (currentUser.role === 'Head') {
        initializeHeadView();
    } else if (currentUser.role === 'HR') {
        initializeHRView();
    }
}

async function logout() {
    if (confirm('Are you sure you want to logout?/您确定要退出吗？')) {
        try {
            await firebaseService.logoutUser();
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
}

function showHelp() {
    showMessage('Need Help?/需要帮助？', 'For technical support or login issues, please contact HR Department./如需技术支持或登录问题，请联系人力资源部。');
}

function showMessage(title, message) {
    document.getElementById('messageModalTitle').textContent = title;
    document.getElementById('messageModalBody').textContent = message;
    const modal = new bootstrap.Modal(document.getElementById('messageModal'));
    modal.show();
}

// Employee View Functions
function initializeEmployeeView() {
    loadMyRequests();
}

async function submitLeaveRequest() {
    const leaveType = document.getElementById('leaveType').value;
    const startDate = document.getElementById('leaveStartDate').value;
    const endDate = document.getElementById('leaveEndDate').value;
    const reason = document.getElementById('leaveReason').value;
    
    if (!leaveType || !startDate || !endDate || !reason) {
        showMessage('Error/错误', 'Please fill in all required fields./请填写所有必填字段。');
        return;
    }

    // --- NEW VALIDATION: Date Check ---
    const startObj = new Date(startDate);
    const endObj = new Date(endDate);

    // Check if End Date is BEFORE Start Date
    if (endObj < startObj) {
        showMessage('Invalid Dates/无效日期', 'End date cannot be earlier than start date./结束日期不能早于开始日期。');
        return; // Stop the function here
    }
    // ----------------------------------
    
    // Calculate difference (We add 1 to include the start day itself)
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
    const startDateTime = document.getElementById('overtimeStartDate').value;
    const endDateTime = document.getElementById('overtimeEndDate').value;
    const reason = document.getElementById('overtimeReason').value;
    
    if (!adjustmentType || !startDateTime || !endDateTime || !reason) {
        showMessage('Error/错误', 'Please fill in all required fields./请填写所有必填字段。');
        return;
    }
    
    // --- NEW VALIDATION: Date Check ---
    const startObj = new Date(startDateTime);
    const endObj = new Date(endDateTime);

    if (endObj < startObj) {
        showMessage('Invalid Times/无效时间', 'End time cannot be earlier than start time./结束时间不能早于开始时间。');
        return;
    }
    // ----------------------------------
    
    const diffTime = Math.abs(endObj - startObj);
    const totalHours = parseFloat((diffTime / (1000 * 60 * 60)).toFixed(2));
    
    const requestData = {
        employeeName: currentUser.name,
        employeeId: currentUser.employeeId,
        department: currentUser.department,
        position: currentUser.position,
        adjustmentType: adjustmentType,
        startDate: startDateTime,
        endDate: endDateTime,
        totalHours: totalHours,
        reason: reason,
    };
    
    try {
        await firebaseService.submitOvertimeRequest(requestData);
        showMessage('Success/成功', 'Overtime request submitted successfully!/加班请求提交成功！');
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
    document.getElementById('overtimeReason').value = '';
}

async function loadMyRequests() {
    const container = document.getElementById('myRequestsContainer');
    container.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
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
            container.innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-inbox fa-3x text-muted mb-3"></i>
                    <h5 class="text-muted">No Requests Found/未找到请求</h5>
                    <p class="text-muted">You haven't submitted any requests yet./您尚未提交任何请求。</p>
                </div>
            `;
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
            
            // --- NEW CANCEL BUTTON LOGIC ---
            let showCancelButton = false;

            // 1. Basic Rule: Can't cancel if already Cancelled, Rejected, or waiting for Cancellation
            const isActive = request.status !== 'Cancelled' && request.status !== 'Rejected';
            const isNotPendingCancel = !request.cancellationRequested;

            if (isActive && isNotPendingCancel) {
                if (request.status === 'Pending') {
                    // Pending requests can always be cancelled
                    showCancelButton = true;
                } 
                else if (request.status === 'Approved') {
                    if (request.type === 'Overtime') {
                        // Overtime: Keep existing behavior (Can always cancel if approved)
                        showCancelButton = true;
                    } 
                    else if (request.type === 'Leave') {
                        // Leave: Only show cancel if the leave is NOT finished yet
                        const endDate = new Date(request.endDate);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0); // Ignore time, compare dates only

                        // If End Date is today or in the future, show button.
                        // If End Date is yesterday or older, hide button.
                        if (endDate >= today) {
                            showCancelButton = true;
                        }
                    }
                }
            }
            // -------------------------------
            
            html += `
                <tr>
                    <td>
                        <span class="badge ${request.type === 'Leave' ? 'bg-info' : 'bg-warning'}">
                            ${request.type}
                        </span>
                        <div class="small text-muted mt-1">
                            ${request.leaveType || request.adjustmentType}
                        </div>
                    </td>
                    <td>
                        <div class="small">${request.reason || 'No reason provided/未提供原因'}</div>
                        ${request.cancellationRequested ? `
                            <div class="small text-warning mt-1">
                                <i class="fas fa-exclamation-triangle"></i> Cancellation Requested/已请求取消
                                ${request.cancellationReason ? `<br><small>Reason: ${request.cancellationReason}</small>` : ''}
                            </div>
                        ` : ''}
                        ${request.status === 'Cancelled' && request.cancellationReason ? `
                            <div class="small text-muted mt-1">
                                Cancelled: ${request.cancellationReason}
                            </div>
                        ` : ''}
                    </td>
                    <td>
                        <div class="small">
                            ${formatDate(request.startDate)} to ${formatDate(request.endDate)}
                        </div>
                    </td>
                    <td>
                        <strong>
                            ${request.type === 'Leave' ? 
                                request.totalDays + ' days/天' : 
                                request.totalHours + ' hours/小时'
                            }
                        </strong>
                    </td>
                    <td>
                        <span class="badge ${statusClass}">
                            ${request.status}
                            ${request.cancellationRequested ? ' (Cancel Requested/取消请求中)' : ''}
                        </span>
                    </td>
                    <td>
                        ${showCancelButton ? `
                            <button class="btn btn-outline-warning btn-sm" onclick="showCancelModal('${request.id}', '${request.type}')">
                                <i class="fas fa-times me-1"></i>Cancel/取消
                            </button>
                        ` : ''}
                    </td>
                    <td>
                        <small>${formatDate(request.submissionDate)}</small>
                    </td>
                </tr>
            `;
        });
        
        html += `</tbody></table></div>`;
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = `
            <div class="alert alert-danger">
                <h5>Error Loading Requests/加载请求错误</h5>
                <p>${error.message}</p>
                <button class="btn btn-primary btn-sm" onclick="loadMyRequests()">Try Again/重试</button>
            </div>
        `;
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
    
    if (!reason) {
        showMessage('Error/错误', 'Please provide a reason for cancellation./请提供取消原因。');
        return;
    }
    
    try {
        await firebaseService.cancelRequest(requestId, requestType, reason);
        showMessage('Success/成功', 'Cancellation request submitted successfully!/取消请求提交成功！');
        
        const bootstrapModal = bootstrap.Modal.getInstance(modal);
        bootstrapModal.hide();
        loadMyRequests();
        
        if (currentUser.role === 'Head') {
            loadDepartmentRequests();
            loadCancellationRequests();
        } else if (currentUser.role === 'HR') {
            loadAllRequests();
            loadCancellationRequests();
        }
    } catch (error) {
        showMessage('Error/错误', 'Failed to submit cancellation: ' + error.message);
    }
}

// Head View Functions
function initializeHeadView() {
    document.getElementById('headDepartment').textContent = `${currentUser.department}`;
    loadDepartmentRequests();
    loadCancellationRequests();
}

async function loadDepartmentRequests() {
    const container = document.getElementById('requestsContainer');
    container.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>
    `;
    
    try {
        const requests = await firebaseService.getPendingRequestsByDepartment(currentUser.department);
        
        if (requests.length === 0) {
            container.innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-inbox fa-3x text-muted mb-3"></i>
                    <h5 class="text-muted">No Pending Requests/无待处理请求</h5>
                </div>
            `;
            return;
        }
        
        let html = `
            <div class="table-responsive">
                <table class="table table-hover table-bordered mobile-friendly">
                    <thead class="table-dark">
                        <tr>
                            <th>Employee/员工</th>
                            <th>Type/类型</th>
                            <th>Dates/日期</th>
                            <th>Duration/时长</th>
                            <th>Reason/原因</th>
                            <th>Actions/操作</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        requests.forEach(request => {
            html += `
                <tr>
                    <td><strong>${request.employeeName}</strong><br><small class="text-muted">${request.employeeId}</small></td>
                    <td>${request.type}</td>
                    <td>${formatDate(request.startDate)} to ${formatDate(request.endDate)}</td>
                    <td>${request.type === 'Leave' ? request.totalDays + ' days' : request.totalHours + ' hours'}</td>
                    <td>${request.reason}</td>
                    <td>
                        <div class="btn-group-vertical">
                            <button class="btn btn-success btn-sm mb-1" onclick="approveRequest('${request.id}', '${request.type}')">Approve</button>
                            <button class="btn btn-danger btn-sm" onclick="rejectRequest('${request.id}', '${request.type}')">Reject</button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        html += `</tbody></table></div>`;
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
}

async function loadCancellationRequests() {
    if (currentUser.role !== 'Head' && currentUser.role !== 'HR') return;
    
    const containerId = currentUser.role === 'Head' ? 'cancellationRequestsContainer' : 'hrCancellationRequestsContainer';
    let container = document.getElementById(containerId);
    
    if (!container) {
        const parentContainer = currentUser.role === 'Head' ? 
            document.getElementById('requestsContainer').parentNode : 
            document.getElementById('allRequestsTable').parentNode.parentNode;
        
        const cancellationSection = document.createElement('div');
        cancellationSection.className = 'dashboard-card';
        cancellationSection.innerHTML = `
            <h5 class="mb-3"><i class="fas fa-ban me-2"></i>Cancellation Requests/取消请求</h5>
            <div id="${containerId}">Loading...</div>
        `;
        parentContainer.appendChild(cancellationSection);
        container = document.getElementById(containerId);
    }
    
    try {
        let requests = await firebaseService.getCancellationRequests();
        if (currentUser.role === 'Head') requests = requests.filter(r => r.department === currentUser.department);
        
        if (requests.length === 0) {
            container.innerHTML = `<div class="text-center py-3"><p class="text-muted">No cancellation requests/无取消请求</p></div>`;
            return;
        }
        
        // Simplified rendering for cancellations (omitted full table for brevity, logic remains similar)
        let html = `<div class="table-responsive"><table class="table table-hover"><tbody>`;
        requests.forEach(request => {
            html += `
                <tr>
                    <td>${request.employeeName}</td>
                    <td>${request.type} - ${request.cancellationReason}</td>
                    <td>
                        <button class="btn btn-success btn-sm" onclick="approveCancellation('${request.id}', '${request.type}')">Approve</button>
                        <button class="btn btn-danger btn-sm" onclick="rejectCancellation('${request.id}', '${request.type}')">Reject</button>
                    </td>
                </tr>
            `;
        });
        html += `</tbody></table></div>`;
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = `<p class="text-danger">${error.message}</p>`;
    }
}

async function approveRequest(requestId, type) {
    if (confirm('Approve this request?')) {
        await firebaseService.updateRequestStatus(requestId, 'Approved', type, currentUser.name);
        loadDepartmentRequests();
    }
}
async function rejectRequest(requestId, type) {
    if (confirm('Reject this request?')) {
        await firebaseService.updateRequestStatus(requestId, 'Rejected', type, currentUser.name);
        loadDepartmentRequests();
    }
}
async function approveCancellation(requestId, type) {
    if (confirm('Approve cancellation?')) {
        await firebaseService.approveCancellation(requestId, type);
        loadCancellationRequests();
        loadDepartmentRequests();
    }
}
async function rejectCancellation(requestId, type) {
    if (confirm('Reject cancellation?')) {
        await firebaseService.rejectCancellation(requestId, type);
        loadCancellationRequests();
    }
}

// HR View Functions
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
        currentRequestPage = 1; // Reset to page 1 on load
        applyFilters();
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Error: ${error.message}</td></tr>`;
    }
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

// --- PAGINATION FOR REQUESTS ---
function displayFilteredRequests(requests) {
    const tbody = document.getElementById('allRequestsTable');
    // Clear any previous pagination controls that might be appended after the table
    const existingNav = document.getElementById('requestsPagination');
    if (existingNav) existingNav.remove();

    if (requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">No requests match your filters/没有匹配筛选条件的请求</td></tr>';
        return;
    }

    // Pagination Logic
    const totalPages = Math.ceil(requests.length / requestsPerPage);
    if (currentRequestPage > totalPages) currentRequestPage = totalPages;
    if (currentRequestPage < 1) currentRequestPage = 1;

    const startIndex = (currentRequestPage - 1) * requestsPerPage;
    const endIndex = startIndex + requestsPerPage;
    const pageRequests = requests.slice(startIndex, endIndex);

    let html = '';
    pageRequests.forEach(request => {
        const statusClass = getStatusBadgeClass(request.status);
        html += `
            <tr>
                <td>
                    <div class="fw-semibold">${request.employeeName}</div>
                    <small class="text-muted">${request.employeeId}</small>
                </td>
                <td><span class="badge bg-light text-dark">${request.department}</span></td>
                <td>${request.position || 'N/A'}</td>
                <td>
                    <span class="badge ${request.type === 'Leave' ? 'bg-info' : 'bg-warning'}">${request.type}</span>
                    <div class="small text-muted mt-1">${request.leaveType || request.adjustmentType}</div>
                </td>
                <td>
                    <div class="small">${formatDate(request.startDate)} to ${formatDate(request.endDate)}</div>
                    <div class="small text-muted">${request.type === 'Leave' ? request.totalDays + ' days' : request.totalHours + ' hours'}</div>
                </td>
                <td><span class="badge ${statusClass}">${request.status}</span></td>
                <td>
                    ${request.cancellationRequested ? `
                        <button class="btn btn-success btn-sm mb-1" onclick="approveCancellation('${request.id}', '${request.type}')"><i class="fas fa-check"></i></button>
                    ` : '-'}
                </td>
                <td><small>${formatDate(request.submissionDate)}</small></td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;

    // Create Pagination Controls
    if (totalPages > 1) {
        const tableContainer = tbody.closest('.table-responsive');
        const paginationHTML = `
            <nav id="requestsPagination" aria-label="Request navigation" class="mt-3">
                <ul class="pagination justify-content-center">
                    <li class="page-item ${currentRequestPage === 1 ? 'disabled' : ''}">
                        <a class="page-link" href="#" onclick="changeRequestPage(-1); return false;">Previous/上一页</a>
                    </li>
                    <li class="page-item disabled">
                        <span class="page-link">Page ${currentRequestPage} of ${totalPages}</span>
                    </li>
                    <li class="page-item ${currentRequestPage === totalPages ? 'disabled' : ''}">
                        <a class="page-link" href="#" onclick="changeRequestPage(1); return false;">Next/下一页</a>
                    </li>
                </ul>
            </nav>
        `;
        // Append pagination after the table
        tableContainer.insertAdjacentHTML('afterend', paginationHTML);
    }
}

// Global function for onclick events
window.changeRequestPage = function(delta) {
    currentRequestPage += delta;
    applyFilters(); // Re-render with new page
};

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
        // 1. Get dates
        const startInput = document.getElementById('excelStartDate').value;
        const endInput = document.getElementById('excelEndDate').value;

        if (!startInput || !endInput) {
            showMessage('Error/错误', 'Please select both start and end dates./请选择开始和结束日期。');
            return;
        }

        const filterStart = new Date(startInput);
        filterStart.setHours(0, 0, 0, 0);

        const filterEnd = new Date(endInput);
        filterEnd.setHours(23, 59, 59, 999);

        // 2. Filter by SCHEDULED START DATE
        const exportData = allRequestsData.filter(req => {
            let reqDate;
            try {
                reqDate = req.startDate.toDate ? req.startDate.toDate() : new Date(req.startDate);
            } catch (e) {
                reqDate = new Date(req.startDate);
            }
            return reqDate >= filterStart && reqDate <= filterEnd;
        });

        if (exportData.length === 0) {
            showMessage('No Data/无数据', 'No requests found for this period.');
            return;
        }

        // 3. Sort Oldest -> Newest
        exportData.sort((a, b) => {
            const dateA = new Date(a.startDate);
            const dateB = new Date(b.startDate);
            return dateA - dateB;
        });

        // 4. Prepare Data
        const excelRows = exportData.map(req => ({
            'Start Date': formatDate(req.startDate),
            'End Date': formatDate(req.endDate),
            'Employee Name': req.employeeName,
            'Employee ID': req.employeeId,
            'Department': req.department,
            'Type': req.type,
            'Category': req.leaveType || req.adjustmentType,
            'Duration': req.type === 'Leave' ? `${req.totalDays} days` : `${req.totalHours} hours`,
            'Reason': req.reason || '',
            'Status': req.status,
            'Approved By': req.approvedBy || '-',
            'Submission Date': formatDate(req.submissionDate)
        }));

        // 5. Create Worksheet
        const ws = XLSX.utils.json_to_sheet(excelRows);

        // --- STYLING SECTION (The Fun Part) ---
        
        // Define Styles
        const headerStyle = {
            fill: { fgColor: { rgb: "2E7D32" } }, // Spa Green Background
            font: { color: { rgb: "FFFFFF" }, bold: true, sz: 11 }, // White Bold Text
            alignment: { horizontal: "center", vertical: "center" },
            border: {
                top: { style: "thin", color: { rgb: "000000" } },
                bottom: { style: "thin", color: { rgb: "000000" } },
                left: { style: "thin", color: { rgb: "000000" } },
                right: { style: "thin", color: { rgb: "000000" } }
            }
        };

        const rowStyle = {
            alignment: { horizontal: "left", vertical: "center" },
            border: {
                top: { style: "thin", color: { rgb: "CCCCCC" } },
                bottom: { style: "thin", color: { rgb: "CCCCCC" } },
                left: { style: "thin", color: { rgb: "CCCCCC" } },
                right: { style: "thin", color: { rgb: "CCCCCC" } }
            }
        };

        // Apply Styles to All Cells
        const range = XLSX.utils.decode_range(ws['!ref']);
        
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell_address = XLSX.utils.encode_cell({r: R, c: C});
                
                // Ensure cell exists
                if (!ws[cell_address]) continue;

                // Apply Header Style (Row 0) or Data Style (Row 1+)
                if (R === 0) {
                    ws[cell_address].s = headerStyle;
                } else {
                    ws[cell_address].s = rowStyle;
                }
            }
        }

        // Set Column Widths
        ws['!cols'] = [
            {wch: 15}, {wch: 15}, {wch: 20}, {wch: 10}, 
            {wch: 15}, {wch: 10}, {wch: 15}, {wch: 10}, 
            {wch: 30}, {wch: 10}, {wch: 15}, {wch: 15}
        ];

        // 6. Save File
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Scheduled Requests");
        
        const filename = `LuoCitySpa_Requests_${startInput}_to_${endInput}.xlsx`;
        XLSX.writeFile(wb, filename);
        
        bootstrap.Modal.getInstance(document.getElementById('excelModal')).hide();
        showMessage('Success/成功', `Excel report downloaded successfully!\nFile: ${filename}`);

    } catch (e) {
        console.error(e);
        showMessage('Error/错误', 'Failed to generate Excel: ' + e.message);
    }
}

// --- EMPLOYEE MANAGEMENT WITH PAGINATION ---
async function loadEmployeeList() {
    const container = document.getElementById('employeesContainer');
    container.innerHTML = `<div class="spinner-border text-primary"></div>`;
    
    try {
        employeesData = await firebaseService.getAllEmployees();
        currentEmployeePage = 1;
        displayEmployees(employeesData);
    } catch (error) {
        container.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
}

function displayEmployees(employees) {
    const container = document.getElementById('employeesContainer');
    
    if (employees.length === 0) {
        container.innerHTML = '<div class="text-center py-5">No employees found.</div>';
        return;
    }

    // Pagination Logic
    const totalPages = Math.ceil(employees.length / employeesPerPage);
    if (currentEmployeePage > totalPages) currentEmployeePage = totalPages;
    if (currentEmployeePage < 1) currentEmployeePage = 1;

    const startIndex = (currentEmployeePage - 1) * employeesPerPage;
    const endIndex = startIndex + employeesPerPage;
    const pageEmployees = employees.slice(startIndex, endIndex);
    
    let html = `
        <div class="table-responsive">
            <table class="table table-hover mobile-friendly">
                <thead class="table-dark">
                    <tr>
                        <th>Employee ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Department</th>
                        <th>Role</th>
                        <th>Actions</th>
                    </tr>
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

    // Pagination Controls
    if (totalPages > 1) {
        html += `
            <nav aria-label="Employee navigation" class="mt-3">
                <ul class="pagination justify-content-center">
                    <li class="page-item ${currentEmployeePage === 1 ? 'disabled' : ''}">
                        <a class="page-link" href="#" onclick="changeEmployeePage(-1); return false;">Previous</a>
                    </li>
                    <li class="page-item disabled">
                        <span class="page-link">Page ${currentEmployeePage} of ${totalPages}</span>
                    </li>
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
    displayEmployees(employeesData);
};

function getRoleBadgeClass(role) {
    switch(role) {
        case 'HR': return 'bg-danger';
        case 'Head': return 'bg-warning';
        case 'Employee': return 'bg-info';
        default: return 'bg-secondary';
    }
}

function showAddEmployeeForm() {
    document.getElementById('employeeFormTitle').textContent = 'Add New Staff Member';
    document.getElementById('employeeForm').reset();
    document.getElementById('employeePasswordGroup').style.display = 'block';
    new bootstrap.Modal(document.getElementById('employeeModal')).show();
}

async function handleEmployeeSubmit(e) {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    const employeeData = {
        employeeId: document.getElementById('employeeId').value,
        name: document.getElementById('employeeName').value,
        email: document.getElementById('employeeEmail').value,
        department: document.getElementById('employeeDepartment').value,
        role: document.getElementById('employeeRole').value,
        position: document.getElementById('employeePosition').value
    };
    const password = document.getElementById('employeePassword').value;

    try {
        await firebaseService.createEmployee(employeeData, password);
        showMessage('Success', 'Staff member created successfully!');
        bootstrap.Modal.getInstance(document.getElementById('employeeModal')).hide();
        loadEmployeeList();
    } catch (error) {
        showMessage('Error', error.message);
    } finally {
        submitBtn.disabled = false;
    }
}

async function deleteEmployee(employeeId, employeeName) {
    if (confirm(`Delete ${employeeName}?`)) {
        try {
            await firebaseService.deleteEmployee(employeeId);
            showMessage('Success', 'Deleted.');
            loadEmployeeList();
        } catch (error) {
            showMessage('Error', error.message);
        }
    }
}

// Utility Functions
function calculateDaysDifference(start, end) {
    return Math.ceil(Math.abs(new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24)) + 1;
}

function calculateHoursDifference(start, end) {
    return parseFloat((Math.abs(new Date(end) - new Date(start)) / (1000 * 60 * 60)).toFixed(2));
}

function getStatusBadgeClass(status) {
    switch(status) {
        case 'Approved': return 'status-approved';
        case 'Rejected': return 'status-rejected';
        case 'Pending': return 'status-pending';
        default: return 'bg-secondary';
    }
}

function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        return (dateString.toDate ? dateString.toDate() : new Date(dateString)).toLocaleDateString('en-US');
    } catch { return String(dateString); }
}

// Global Exports
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