import { firebaseService } from './firebase.js';
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs';

let currentUser = null;
let allRequestsData = [];
let employeesData = [];

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
        // Reset login button state regardless of success/failure
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
        // Auth state listener will handle the rest and reset the button
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
        
        // Reset button state on error
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
    
    // Update welcome message based on role
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
    
    // Show appropriate view based on role
    document.getElementById('employeeView').style.display = currentUser.role === 'Employee' ? 'block' : 'none';
    document.getElementById('headView').style.display = currentUser.role === 'Head' ? 'block' : 'none';
    document.getElementById('hrView').style.display = currentUser.role === 'HR' ? 'block' : 'none';
    
    // Initialize the appropriate view
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
    
    const totalDays = calculateDaysDifference(startDate, endDate);
    if (totalDays <= 0) {
        showMessage('Invalid Dates/无效日期', 'End date must be after start date./结束日期必须在开始日期之后。');
        return;
    }
    
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
        type: 'Leave',
        status: 'Pending',
        submissionDate: new Date().toISOString()
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
    
    const totalHours = calculateHoursDifference(startDateTime, endDateTime);
    if (totalHours <= 0) {
        showMessage('Invalid Times/无效时间', 'End time must be after start time./结束时间必须在开始时间之后。');
        return;
    }
    
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
        type: 'Overtime',
        status: 'Pending',
        submissionDate: new Date().toISOString()
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
            const canCancel = (request.status === 'Pending' || request.status === 'Approved') && !request.cancellationRequested;
            const showCancelButton = canCancel && request.status !== 'Cancelled' && request.status !== 'Rejected';
            
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
                        ${request.approvedBy ? `
                            <div class="small text-muted mt-1">
                                by ${request.approvedBy}
                            </div>
                        ` : ''}
                    </td>
                    <td>
                        ${showCancelButton ? `
                            <button class="btn btn-outline-warning btn-sm" onclick="showCancelModal('${request.id}', '${request.type}')">
                                <i class="fas fa-times me-1"></i>Cancel/取消
                            </button>
                        ` : ''}
                        ${request.cancellationRequested ? `
                            <span class="badge bg-warning">Cancellation Pending/取消待处理</span>
                        ` : ''}
                    </td>
                    <td>
                        <small>${formatDate(request.submissionDate)}</small>
                    </td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
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
    // Store the request info in the modal
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
        
        // Close modal
        const bootstrapModal = bootstrap.Modal.getInstance(modal);
        bootstrapModal.hide();
        
        // Reload requests
        loadMyRequests();
        
        // If user is Head or HR, reload their views too
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
            <p class="mt-2 text-muted">Loading requests for your department.../正在加载您部门的请求...</p>
        </div>
    `;
    
    try {
        const requests = await firebaseService.getPendingRequestsByDepartment(currentUser.department);
        
        if (requests.length === 0) {
            container.innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-inbox fa-3x text-muted mb-3"></i>
                    <h5 class="text-muted">No Pending Requests/无待处理请求</h5>
                    <p class="text-muted">No pending requests found in your department./在您的部门中未找到待处理请求。</p>
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
                            <th>Position/职位</th>
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
                    <td>
                        <strong>${request.employeeName}</strong><br>
                        <small class="text-muted">${request.employeeId}</small>
                    </td>
                    <td>${request.position || 'N/A'}</td>
                    <td>
                        <span class="badge ${request.type === 'Leave' ? 'bg-info' : 'bg-warning'}">
                            ${request.type}
                        </span>
                        <br>
                        <small>${request.leaveType || request.adjustmentType}</small>
                    </td>
                    <td>
                        ${formatDate(request.startDate)}<br>
                        <small class="text-muted">to ${formatDate(request.endDate)}</small>
                    </td>
                    <td>
                        <strong>
                            ${request.type === 'Leave' ? 
                                request.totalDays + ' days/天' : 
                                request.totalHours + ' hours/小时'
                            }
                        </strong>
                    </td>
                    <td>${request.reason || 'No reason provided/未提供原因'}</td>
                    <td>
                        <div class="btn-group-vertical">
                            <button class="btn btn-success btn-sm mb-1" onclick="approveRequest('${request.id}', '${request.type}')">
                                <i class="fas fa-check me-1"></i>Approve/批准
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="rejectRequest('${request.id}', '${request.type}')">
                                <i class="fas fa-times me-1"></i>Reject/拒绝
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
            <div class="mt-3">
                <p class="text-muted"><small>Found ${requests.length} pending request(s)/找到 ${requests.length} 个待处理请求</small></p>
            </div>
        `;
        
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = `
            <div class="alert alert-danger">
                <h5>Error Loading Requests/加载请求错误</h5>
                <p>${error.message}</p>
                <button class="btn btn-primary btn-sm" onclick="loadDepartmentRequests()">Try Again/重试</button>
            </div>
        `;
    }
}

// Cancellation requests for Head/HR
async function loadCancellationRequests() {
    if (currentUser.role !== 'Head' && currentUser.role !== 'HR') return;
    
    const containerId = currentUser.role === 'Head' ? 'cancellationRequestsContainer' : 'hrCancellationRequestsContainer';
    let container = document.getElementById(containerId);
    
    // Create container if it doesn't exist
    if (!container) {
        const parentContainer = currentUser.role === 'Head' ? 
            document.getElementById('requestsContainer').parentNode : 
            document.getElementById('allRequestsTable').parentNode.parentNode;
        
        const cancellationSection = document.createElement('div');
        cancellationSection.className = 'dashboard-card';
        cancellationSection.innerHTML = `
            <h5 class="mb-3"><i class="fas fa-ban me-2"></i>Cancellation Requests/取消请求</h5>
            <div id="${containerId}">
                <div class="loading-spinner">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2 text-muted">Loading cancellation requests.../正在加载取消请求...</p>
                </div>
            </div>
        `;
        parentContainer.appendChild(cancellationSection);
        container = document.getElementById(containerId);
    } else {
        container.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2 text-muted">Loading cancellation requests.../正在加载取消请求...</p>
            </div>
        `;
    }
    
    try {
        let requests = await firebaseService.getCancellationRequests();
        
        // For Head, filter by department
        if (currentUser.role === 'Head') {
            requests = requests.filter(request => request.department === currentUser.department);
        }
        
        if (requests.length === 0) {
            container.innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-ban fa-3x text-muted mb-3"></i>
                    <h5 class="text-muted">No Cancellation Requests/无取消请求</h5>
                    <p class="text-muted">No cancellation requests found./未找到取消请求。</p>
                </div>
            `;
            return;
        }
        
        let html = `
            <div class="table-responsive">
                <table class="table table-hover mobile-friendly">
                    <thead class="table-light">
                        <tr>
                            <th>Employee/员工</th>
                            <th>Type/类型</th>
                            <th>Original Request/原请求</th>
                            <th>Cancellation Reason/取消原因</th>
                            <th>Actions/操作</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        requests.forEach(request => {
            html += `
                <tr>
                    <td>
                        <strong>${request.employeeName}</strong><br>
                        <small class="text-muted">${request.employeeId} - ${request.department}</small>
                    </td>
                    <td>
                        <span class="badge ${request.type === 'Leave' ? 'bg-info' : 'bg-warning'}">
                            ${request.type}
                        </span>
                    </td>
                    <td>
                        <small>
                            ${request.leaveType || request.adjustmentType}<br>
                            ${formatDate(request.startDate)} to ${formatDate(request.endDate)}<br>
                            Reason: ${request.reason}
                        </small>
                    </td>
                    <td>${request.cancellationReason || 'No reason provided/未提供原因'}</td>
                    <td>
                        <div class="btn-group-vertical">
                            <button class="btn btn-success btn-sm mb-1" onclick="approveCancellation('${request.id}', '${request.type}')">
                                <i class="fas fa-check me-1"></i>Approve Cancel/批准取消
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="rejectCancellation('${request.id}', '${request.type}')">
                                <i class="fas fa-times me-1"></i>Reject Cancel/拒绝取消
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
            <div class="mt-3">
                <p class="text-muted"><small>Found ${requests.length} cancellation request(s)/找到 ${requests.length} 个取消请求</small></p>
            </div>
        `;
        
        container.innerHTML = html;
    } catch (error) {
        container.innerHTML = `
            <div class="alert alert-danger">
                <h5>Error Loading Cancellation Requests/加载取消请求错误</h5>
                <p>${error.message}</p>
                <button class="btn btn-primary btn-sm" onclick="loadCancellationRequests()">Try Again/重试</button>
            </div>
        `;
    }
}

async function approveRequest(requestId, type) {
    if (confirm('Are you sure you want to APPROVE this request?/您确定要批准此请求吗？')) {
        try {
            await firebaseService.updateRequestStatus(requestId, 'Approved', type, currentUser.name);
            showMessage('Success/成功', 'Request approved successfully!/请求批准成功！');
            loadDepartmentRequests();
        } catch (error) {
            showMessage('Error/错误', 'Failed to approve request: ' + error.message);
        }
    }
}

async function rejectRequest(requestId, type) {
    if (confirm('Are you sure you want to REJECT this request?/您确定要拒绝此请求吗？')) {
        try {
            await firebaseService.updateRequestStatus(requestId, 'Rejected', type, currentUser.name);
            showMessage('Notice/通知', 'Request rejected./请求已拒绝。');
            loadDepartmentRequests();
        } catch (error) {
            showMessage('Error/错误', 'Failed to reject request: ' + error.message);
        }
    }
}

async function approveCancellation(requestId, type) {
    if (confirm('Are you sure you want to APPROVE this cancellation?/您确定要批准此取消请求吗？')) {
        try {
            await firebaseService.approveCancellation(requestId, type);
            showMessage('Success/成功', 'Cancellation approved successfully!/取消批准成功！');
            loadCancellationRequests();
            loadDepartmentRequests();
        } catch (error) {
            showMessage('Error/错误', 'Failed to approve cancellation: ' + error.message);
        }
    }
}

async function rejectCancellation(requestId, type) {
    if (confirm('Are you sure you want to REJECT this cancellation?/您确定要拒绝此取消请求吗？')) {
        try {
            await firebaseService.rejectCancellation(requestId, type);
            showMessage('Notice/通知', 'Cancellation rejected./取消请求已拒绝。');
            loadCancellationRequests();
        } catch (error) {
            showMessage('Error/错误', 'Failed to reject cancellation: ' + error.message);
        }
    }
}

// HR View Functions
function initializeHRView() {
    loadAllRequests();
    loadEmployeeList();
    loadCancellationRequests();
    setupFilters();
    
    // Add Excel download button listener
    document.getElementById('downloadExcelBtn').addEventListener('click', showExcelModal);
    document.getElementById('confirmExcelDownload').addEventListener('click', generateExcelReport);
}

function setupFilters() {
    document.getElementById('searchName').addEventListener('input', applyFilters);
    document.getElementById('filterDepartment').addEventListener('change', applyFilters);
    document.getElementById('filterRequestType').addEventListener('change', applyFilters);
    document.getElementById('filterStatus').addEventListener('change', applyFilters);
    document.getElementById('startDateFilter').addEventListener('change', applyFilters);
    document.getElementById('endDateFilter').addEventListener('change', applyFilters);
    document.getElementById('clearFilters').addEventListener('click', clearFilters);
}

async function loadAllRequests() {
    const tbody = document.getElementById('allRequestsTable');
    tbody.innerHTML = `
        <tr>
            <td colspan="8" class="text-center py-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2 text-muted">Loading all requests.../正在加载所有请求...</p>
            </td>
        </tr>
    `;
    
    try {
        allRequestsData = await firebaseService.getAllRequests();
        displayFilteredRequests(allRequestsData);
    } catch (error) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4 text-danger">
                    Error loading requests: ${error.message}/加载请求错误：${error.message}
                </td>
            </tr>
        `;
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
        // Name filter
        if (searchName && !request.employeeName.toLowerCase().includes(searchName) && 
            !request.employeeId.toLowerCase().includes(searchName)) {
            return false;
        }
        
        // Department filter
        if (department && request.department !== department) {
            return false;
        }
        
        // Request Type filter
        if (requestType && request.type !== requestType) {
            return false;
        }
        
        // Status filter
        if (status && request.status !== status) {
            return false;
        }
        
        // Date range filter
        if (startDate) {
            const requestStartDate = new Date(request.startDate);
            const filterStartDate = new Date(startDate);
            if (requestStartDate < filterStartDate) return false;
        }
        
        if (endDate) {
            const requestEndDate = new Date(request.endDate);
            const filterEndDate = new Date(endDate);
            if (requestEndDate > filterEndDate) return false;
        }
        
        return true;
    });
    
    displayFilteredRequests(filteredRequests);
}

function displayFilteredRequests(requests) {
    const tbody = document.getElementById('allRequestsTable');
    
    if (requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">No requests match your filters/没有匹配筛选条件的请求</td></tr>';
        return;
    }
    
    let html = '';
    requests.forEach(request => {
        const statusClass = getStatusBadgeClass(request.status);
        html += `
            <tr>
                <td>
                    <div class="fw-semibold">${request.employeeName}</div>
                    <small class="text-muted">${request.employeeId}</small>
                </td>
                <td>
                    <span class="badge bg-light text-dark">${request.department}</span>
                </td>
                <td>${request.position || 'N/A'}</td>
                <td>
                    <span class="badge ${request.type === 'Leave' ? 'bg-info' : 'bg-warning'}">
                        ${request.type}
                    </span>
                    <div class="small text-muted mt-1">
                        ${request.leaveType || request.adjustmentType}
                    </div>
                </td>
                <td>
                    <div class="small">
                        ${formatDate(request.startDate)} to ${formatDate(request.endDate)}
                    </div>
                    <div class="small text-muted">
                        ${request.type === 'Leave' ? 
                            request.totalDays + ' days/天' : 
                            request.totalHours + ' hours/小时'
                        }
                    </div>
                    <div class="small text-truncate" style="max-width: 200px;" title="${request.reason || 'No reason/无原因'}">
                        ${request.reason || '-'}
                    </div>
                    ${request.cancellationRequested ? `
                        <div class="small text-warning mt-1">
                            <i class="fas fa-exclamation-triangle"></i> Cancellation Requested/取消请求中
                        </div>
                    ` : ''}
                </td>
                <td>
                    <span class="badge ${statusClass}">
                        ${request.status}
                        ${request.cancellationRequested ? ' (Cancel Requested/取消请求中)' : ''}
                    </span>
                </td>
                <td>
                    ${request.cancellationRequested ? `
                        <div class="btn-group-vertical">
                            <button class="btn btn-success btn-sm mb-1" onclick="approveCancellation('${request.id}', '${request.type}')">
                                <i class="fas fa-check me-1"></i>Approve Cancel/批准取消
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="rejectCancellation('${request.id}', '${request.type}')">
                                <i class="fas fa-times me-1"></i>Reject Cancel/拒绝取消
                            </button>
                        </div>
                    ` : ''}
                </td>
                <td>
                    <small>${formatDate(request.submissionDate)}</small>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

function clearFilters() {
    document.getElementById('searchName').value = '';
    document.getElementById('filterDepartment').value = '';
    document.getElementById('filterRequestType').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('startDateFilter').value = '';
    document.getElementById('endDateFilter').value = '';
    displayFilteredRequests(allRequestsData);
}

// Excel Report Functions with Modal
function showExcelModal() {
    // Set default dates (current month)
    setDefaultExcelDates();
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('excelModal'));
    modal.show();
}

function setDefaultExcelDates() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    // Format dates for input fields (YYYY-MM-DD)
    const formatDateForInput = (date) => {
        return date.toISOString().split('T')[0];
    };
    
    document.getElementById('excelStartDate').value = formatDateForInput(firstDay);
    document.getElementById('excelEndDate').value = formatDateForInput(lastDay);
}

async function generateExcelReport() {
    try {
        // Get selected date range from modal
        const startDateInput = document.getElementById('excelStartDate').value;
        const endDateInput = document.getElementById('excelEndDate').value;
        
        if (!startDateInput || !endDateInput) {
            showMessage('Date Range Required/需要日期范围', 'Please select both start and end dates for the Excel report./请为Excel报告选择开始和结束日期。');
            return;
        }
        
        const startDate = new Date(startDateInput);
        const endDate = new Date(endDateInput);
        
        // Validate date range
        if (startDate > endDate) {
            showMessage('Invalid Date Range/无效日期范围', 'Start date cannot be after end date./开始日期不能在结束日期之后。');
            return;
        }
        
        // Close the modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('excelModal'));
        if (modal) {
            modal.hide();
        }
        
        // Show loading state
        const confirmBtn = document.getElementById('confirmExcelDownload');
        const originalText = confirmBtn.innerHTML;
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Generating.../生成中...';
        confirmBtn.disabled = true;

        // Format dates for display
        const formatDateForDisplay = (date) => {
            return date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            });
        };

        // Get all requests and filter by selected date range
        const allRequests = await firebaseService.getAllRequests();
        const filteredRequests = allRequests.filter(request => {
            const requestDate = request.submissionDate?.toDate ? 
                request.submissionDate.toDate() : 
                new Date(request.submissionDate);
            
            return requestDate >= startDate && requestDate <= endDate;
        });

        if (filteredRequests.length === 0) {
            showMessage('No Data/无数据', `No requests found between ${formatDateForDisplay(startDate)} and ${formatDateForDisplay(endDate)}./在${formatDateForDisplay(startDate)}和${formatDateForDisplay(endDate)}之间未找到请求。`);
            // Reset button state
            confirmBtn.innerHTML = originalText;
            confirmBtn.disabled = false;
            return;
        }

        // Prepare data for Excel
        const excelData = filteredRequests.map(request => ({
            'Employee ID': request.employeeId,
            'Employee Name': request.employeeName,
            'Department': request.department,
            'Position': request.position,
            'Request Type': request.type,
            'Leave Type': request.leaveType || request.adjustmentType || 'N/A',
            'Start Date': formatDateForDisplay(new Date(request.startDate)),
            'End Date': formatDateForDisplay(new Date(request.endDate)),
            'Duration': request.type === 'Leave' ? 
                `${request.totalDays} days` : 
                `${request.totalHours} hours`,
            'Reason': request.reason || 'No reason provided',
            'Status': request.status,
            'Cancellation Requested': request.cancellationRequested ? 'Yes' : 'No',
            'Cancellation Reason': request.cancellationReason || 'N/A',
            'Approved By': request.approvedBy || 'N/A',
            'Submission Date': formatDateForDisplay(
                request.submissionDate?.toDate ? 
                request.submissionDate.toDate() : 
                new Date(request.submissionDate)
            ),
            'Approval Date': request.approvalDate ? 
                formatDateForDisplay(
                    request.approvalDate?.toDate ? 
                    request.approvalDate.toDate() : 
                    new Date(request.approvalDate)
                ) : 'N/A'
        }));

        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);

        // Set column widths
        const colWidths = [
            { wch: 12 }, // Employee ID
            { wch: 20 }, // Employee Name
            { wch: 15 }, // Department
            { wch: 15 }, // Position
            { wch: 12 }, // Request Type
            { wch: 15 }, // Leave Type
            { wch: 12 }, // Start Date
            { wch: 12 }, // End Date
            { wch: 10 }, // Duration
            { wch: 30 }, // Reason
            { wch: 10 }, // Status
            { wch: 15 }, // Cancellation Requested
            { wch: 20 }, // Cancellation Reason
            { wch: 15 }, // Approved By
            { wch: 15 }, // Submission Date
            { wch: 15 }  // Approval Date
        ];
        ws['!cols'] = colWidths;

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Staff Requests');

        // Generate filename with date range
        const startStr = startDateInput.replace(/-/g, '');
        const endStr = endDateInput.replace(/-/g, '');
        const filename = `Luo_City_Spa_Requests_${startStr}_to_${endStr}.xlsx`;

        // Download the file
        XLSX.writeFile(wb, filename);

        // Show success message
        showMessage('Success/成功', 
            `Excel report downloaded successfully!/Excel报告下载成功！\n\n` +
            `Date Range: ${formatDateForDisplay(startDate)} to ${formatDateForDisplay(endDate)}\n` +
            `Total Requests: ${filteredRequests.length}\n` +
            `File: ${filename}`
        );

    } catch (error) {
        console.error('Error generating Excel report:', error);
        showMessage('Error/错误', 'Failed to generate Excel report: ' + error.message);
    } finally {
        // Reset button state
        const confirmBtn = document.getElementById('confirmExcelDownload');
        if (confirmBtn) {
            confirmBtn.innerHTML = '<i class="fas fa-download me-1"></i>Download Excel/下载Excel';
            confirmBtn.disabled = false;
        }
    }
}

// Employee Management Functions
async function loadEmployeeList() {
    const container = document.getElementById('employeesContainer');
    container.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-2 text-muted">Loading employees.../正在加载员工...</p>
        </div>
    `;
    
    try {
        employeesData = await firebaseService.getAllEmployees();
        displayEmployees(employeesData);
    } catch (error) {
        container.innerHTML = `
            <div class="alert alert-danger">
                <h5>Error Loading Employees/加载员工错误</h5>
                <p>${error.message}</p>
                <button class="btn btn-primary btn-sm" onclick="loadEmployeeList()">Try Again/重试</button>
            </div>
        `;
    }
}

function displayEmployees(employees) {
    const container = document.getElementById('employeesContainer');
    
    if (employees.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-users fa-3x text-muted mb-3"></i>
                <h5 class="text-muted">No Employees Found/未找到员工</h5>
                <p class="text-muted">No employees have been added to the system yet./系统中尚未添加任何员工。</p>
                <button class="btn btn-primary" onclick="showAddEmployeeForm()">
                    <i class="fas fa-plus me-1"></i>Add First Employee/添加第一个员工
                </button>
            </div>
        `;
        return;
    }
    
    let html = `
        <div class="table-responsive">
            <table class="table table-hover mobile-friendly">
                <thead class="table-dark">
                    <tr>
                        <th>Employee ID/员工ID</th>
                        <th>Name/姓名</th>
                        <th>Email/邮箱</th>
                        <th>Department/部门</th>
                        <th>Position/职位</th>
                        <th>Role/角色</th>
                        <th>Actions/操作</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    employees.forEach(employee => {
        html += `
            <tr>
                <td><strong>${employee.employeeId}</strong></td>
                <td>${employee.name}</td>
                <td>${employee.email}</td>
                <td>
                    <span class="badge bg-light text-dark">${employee.department}</span>
                </td>
                <td>${employee.position || 'N/A'}</td>
                <td>
                    <span class="badge ${getRoleBadgeClass(employee.role)}">
                        ${employee.role}
                    </span>
                </td>
                <td>
                    <button class="btn btn-outline-danger btn-sm" onclick="deleteEmployee('${employee.id}', '${employee.name}')">
                        <i class="fas fa-trash"></i> Delete/删除
                    </button>
                </td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
        <div class="mt-3">
            <p class="text-muted"><small>Total employees: ${employees.length}/员工总数：${employees.length}</small></p>
        </div>
    `;
    
    container.innerHTML = html;
}

function getRoleBadgeClass(role) {
    switch(role) {
        case 'HR': return 'bg-danger';
        case 'Head': return 'bg-warning';
        case 'Employee': return 'bg-info';
        default: return 'bg-secondary';
    }
}

function showAddEmployeeForm() {
    document.getElementById('employeeFormTitle').textContent = 'Add New Staff Member/添加新员工';
    document.getElementById('employeeForm').reset();
    document.getElementById('employeePasswordGroup').style.display = 'block';
    const modal = new bootstrap.Modal(document.getElementById('employeeModal'));
    modal.show();
}

async function handleEmployeeSubmit(e) {
    e.preventDefault();
    
    const employeeData = {
        employeeId: document.getElementById('employeeId').value,
        name: document.getElementById('employeeName').value,
        email: document.getElementById('employeeEmail').value,
        department: document.getElementById('employeeDepartment').value,
        role: document.getElementById('employeeRole').value,
        position: document.getElementById('employeePosition').value
    };
    
    const password = document.getElementById('employeePassword').value;
    
    // Validation
    if (!employeeData.employeeId || !employeeData.name || !employeeData.email || 
        !employeeData.department || !employeeData.role || !employeeData.position) {
        showMessage('Error/错误', 'Please fill in all required fields./请填写所有必填字段。');
        return;
    }
    
    if (!password) {
        showMessage('Error/错误', 'Password is required for new employees./新员工需要密码。');
        return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Saving.../保存中...';
    submitBtn.disabled = true;
    
    try {
        console.log('Creating new employee:', employeeData);
        await firebaseService.createEmployee(employeeData, password);
        showMessage('Success/成功', 'Staff member created successfully!/员工创建成功！');
        
        // Close modal and refresh list
        const modal = bootstrap.Modal.getInstance(document.getElementById('employeeModal'));
        if (modal) {
            modal.hide();
        }
        
        // Reset form and reload data
        document.getElementById('employeeForm').reset();
        await loadEmployeeList();
        
    } catch (error) {
        console.error('Error creating employee:', error);
        showMessage('Error/错误', `Failed to create staff member: ${error.message}`);
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

async function deleteEmployee(employeeId, employeeName) {
    if (confirm(`Are you sure you want to delete staff member "${employeeName}"? This will permanently remove their account and all associated data. This action cannot be undone./您确定要删除员工"${employeeName}"吗？这将永久删除他们的账户和所有相关数据。此操作无法撤消。`)) {
        try {
            const result = await firebaseService.deleteEmployee(employeeId);
            showMessage('Success/成功', result.message || 'Staff member deleted successfully!/员工删除成功！');
            loadEmployeeList();
        } catch (error) {
            showMessage('Error/错误', 'Failed to delete staff member: ' + error.message);
        }
    }
}

// Utility Functions
function calculateDaysDifference(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

function calculateHoursDifference(startDateTime, endDateTime) {
    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    const diffTime = Math.abs(end - start);
    return parseFloat((diffTime / (1000 * 60 * 60)).toFixed(2));
}

function getStatusBadgeClass(status) {
    switch(status) {
        case 'Approved': return 'status-approved';
        case 'Rejected': return 'status-rejected';
        case 'Pending': return 'status-pending';
        case 'Cancelled': return 'bg-secondary';
        default: return 'bg-secondary';
    }
}

function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        if (dateString.toDate) {
            const date = dateString.toDate();
            return date.toLocaleDateString('en-US');
        } else {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US');
        }
    } catch (e) {
        return String(dateString);
    }
}

// Make functions globally available for HTML onclick handlers
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