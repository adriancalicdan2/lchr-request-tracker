// firebase.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import {
    getFirestore,
    collection,
    doc,
    setDoc,
    getDocs,
    getDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    serverTimestamp,
    addDoc
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { 
    getFunctions, 
    httpsCallable 
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-functions.js';

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAfaVfpgWBP0l1xnt0s91mR2C6mSWAam6U",
    authDomain: "luo-city-spa-club-836bf.firebaseapp.com",
    projectId: "luo-city-spa-club-836bf",
    storageBucket: "luo-city-spa-club-836bf.firebasestorage.app",
    messagingSenderId: "25443267460",
    appId: "1:25443267460:web:d345d5227187b6716da3d1",
    measurementId: "G-P857NTSPJ2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

// Initialize the Cloud Function
const deleteEmployeeFunction = httpsCallable(functions, 'deleteEmployee');

export const firebaseService = {
    // Authentication Methods
    async loginUser(email, password) {
        try {
            console.log('Attempting login for:', email);
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            console.log('Login successful for:', email);
            return userCredential.user;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    },

    async logoutUser() {
        try {
            await signOut(auth);
            console.log('User logged out successfully');
        } catch (error) {
            console.error('Logout error:', error);
            throw error;
        }
    },

    onAuthStateChanged(callback) {
        return onAuthStateChanged(auth, callback);
    },

    // Employee Management Methods
    async createEmployee(employeeData, password) {
        try {
            console.log('Creating employee with data:', employeeData);
            
            // Create a temporary auth instance to avoid affecting current session
            const tempApp = initializeApp(firebaseConfig, "TempApp");
            const tempAuth = getAuth(tempApp);
            
            // Create the new user account using temporary auth
            const userCredential = await createUserWithEmailAndPassword(tempAuth, employeeData.email, password);
            console.log('Auth user created with UID:', userCredential.user.uid);
            
            // Add employee data to Firestore
            const employeeDoc = {
                employeeId: employeeData.employeeId,
                name: employeeData.name,
                email: employeeData.email,
                department: employeeData.department,
                role: employeeData.role,
                position: employeeData.position,
                uid: userCredential.user.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };
            
            await setDoc(doc(db, 'employees', userCredential.user.uid), employeeDoc);
            console.log('Employee document created successfully');
            
            // Sign out from temporary auth
            await signOut(tempAuth);
            
            return employeeDoc;
        } catch (error) {
            console.error('Error creating employee:', error);
            throw new Error(`Failed to create employee: ${error.message}`);
        }
    },

    async getAllEmployees() {
        try {
            console.log('Fetching all employees...');
            const querySnapshot = await getDocs(collection(db, 'employees'));
            const employees = [];
            
            querySnapshot.forEach((doc) => {
                employees.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            console.log('Loaded employees:', employees.length);
            return employees;
        } catch (error) {
            console.error('Error getting employees:', error);
            throw new Error(`Failed to load employees: ${error.message}`);
        }
    },

    async getEmployeeByEmail(email) {
        try {
            console.log('Getting employee by email:', email);
            const q = query(
                collection(db, 'employees'),
                where('email', '==', email)
            );
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                const doc = querySnapshot.docs[0];
                const employeeData = {
                    id: doc.id,
                    ...doc.data()
                };
                console.log('Employee found:', employeeData.name);
                return employeeData;
            }
            console.log('No employee found with email:', email);
            return null;
        } catch (error) {
            console.error('Error getting employee by email:', error);
            throw error;
        }
    },

    async deleteEmployee(employeeId) {
        try {
            console.log('Deleting employee via Cloud Function:', employeeId);
            
            // Call the Cloud Function to delete both Firestore doc and Auth user
            const result = await deleteEmployeeFunction({ employeeId });
            
            console.log('Cloud Function result:', result.data);
            return result.data;
            
        } catch (error) {
            console.error('Error deleting employee via Cloud Function:', error);
            
            // Provide user-friendly error messages
            let errorMessage = 'Failed to delete employee';
            
            if (error.details) {
                // Cloud Function error
                errorMessage = error.details.message || errorMessage;
            } else if (error.code === 'functions/not-found') {
                errorMessage = 'Delete function not available. Please contact administrator.';
            } else if (error.code === 'functions/unauthenticated') {
                errorMessage = 'You must be logged in to delete employees.';
            } else if (error.code === 'functions/internal') {
                errorMessage = 'Server error occurred while deleting employee.';
            }
            
            throw new Error(errorMessage);
        }
    },

    // Request Management Methods
    async submitLeaveRequest(requestData) {
        try {
            console.log('Submitting leave request:', requestData);
            const docRef = await addDoc(collection(db, 'leaveRequests'), {
                employeeName: requestData.employeeName,
                employeeId: requestData.employeeId,
                department: requestData.department,
                position: requestData.position,
                leaveType: requestData.leaveType,
                startDate: requestData.startDate,
                endDate: requestData.endDate,
                totalDays: requestData.totalDays,
                reason: requestData.reason,
                type: 'Leave',
                status: 'Pending',
                submissionDate: serverTimestamp(),
                cancellationRequested: false,
                cancellationReason: '',
                cancellationDate: null
            });
            console.log('Leave request submitted with ID:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('Error submitting leave request:', error);
            throw new Error(`Failed to submit leave request: ${error.message}`);
        }
    },

    async submitOvertimeRequest(requestData) {
        try {
            console.log('Submitting overtime request:', requestData);
            const docRef = await addDoc(collection(db, 'overtimeRequests'), {
                employeeName: requestData.employeeName,
                employeeId: requestData.employeeId,
                department: requestData.department,
                position: requestData.position,
                adjustmentType: requestData.adjustmentType,
                startDate: requestData.startDate,
                endDate: requestData.endDate,
                totalHours: requestData.totalHours,
                reason: requestData.reason,
                type: 'Overtime',
                status: 'Pending',
                submissionDate: serverTimestamp(),
                cancellationRequested: false,
                cancellationReason: '',
                cancellationDate: null
            });
            console.log('Overtime request submitted with ID:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('Error submitting overtime request:', error);
            throw new Error(`Failed to submit overtime request: ${error.message}`);
        }
    },

    async getLeaveRequestsByEmployee(employeeId) {
        try {
            console.log('Getting leave requests for employee:', employeeId);
            const q = query(
                collection(db, 'leaveRequests'),
                where('employeeId', '==', employeeId)
            );
            const querySnapshot = await getDocs(q);
            const requests = [];
            
            querySnapshot.forEach((doc) => {
                requests.push({
                    id: doc.id,
                    type: 'Leave',
                    ...doc.data()
                });
            });
            
            console.log('Found leave requests:', requests.length);
            return requests;
        } catch (error) {
            console.error('Error getting leave requests:', error);
            throw error;
        }
    },

    async getOvertimeRequestsByEmployee(employeeId) {
        try {
            console.log('Getting overtime requests for employee:', employeeId);
            const q = query(
                collection(db, 'overtimeRequests'),
                where('employeeId', '==', employeeId)
            );
            const querySnapshot = await getDocs(q);
            const requests = [];
            
            querySnapshot.forEach((doc) => {
                requests.push({
                    id: doc.id,
                    type: 'Overtime',
                    ...doc.data()
                });
            });
            
            console.log('Found overtime requests:', requests.length);
            return requests;
        } catch (error) {
            console.error('Error getting overtime requests:', error);
            throw error;
        }
    },

    async getPendingRequestsByDepartment(department) {
        try {
            console.log('Getting pending requests for department:', department);
            const [leaveRequestsSnapshot, overtimeRequestsSnapshot] = await Promise.all([
                getDocs(query(
                    collection(db, 'leaveRequests'),
                    where('department', '==', department),
                    where('status', '==', 'Pending')
                )),
                getDocs(query(
                    collection(db, 'overtimeRequests'),
                    where('department', '==', department),
                    where('status', '==', 'Pending')
                ))
            ]);

            const requests = [];

            leaveRequestsSnapshot.forEach((doc) => {
                requests.push({
                    id: doc.id,
                    type: 'Leave',
                    ...doc.data()
                });
            });

            overtimeRequestsSnapshot.forEach((doc) => {
                requests.push({
                    id: doc.id,
                    type: 'Overtime',
                    ...doc.data()
                });
            });

            console.log('Found pending requests:', requests.length);
            return requests;
        } catch (error) {
            console.error('Error getting pending requests:', error);
            throw error;
        }
    },

    async updateRequestStatus(requestId, status, type, approvedBy) {
        try {
            console.log('Updating request status:', { requestId, status, type, approvedBy });
            
            const collectionName = type === 'Leave' ? 'leaveRequests' : 'overtimeRequests';
            const requestRef = doc(db, collectionName, requestId);
            
            // Check if document exists
            const requestDoc = await getDoc(requestRef);
            if (!requestDoc.exists()) {
                throw new Error('Request document not found');
            }
            
            await updateDoc(requestRef, {
                status: status,
                approvedBy: approvedBy,
                approvalDate: serverTimestamp()
            });
            
            console.log('Request status updated successfully');
        } catch (error) {
            console.error('Error updating request status:', error);
            throw error;
        }
    },

    async cancelRequest(requestId, type, reason) {
        try {
            console.log('Cancelling request:', { requestId, type, reason });
            
            const collectionName = type === 'Leave' ? 'leaveRequests' : 'overtimeRequests';
            const requestRef = doc(db, collectionName, requestId);
            
            // Check if document exists
            const requestDoc = await getDoc(requestRef);
            if (!requestDoc.exists()) {
                throw new Error('Request document not found');
            }
            
            const requestData = requestDoc.data();
            
            if (requestData.status === 'Pending') {
                // If pending, cancel immediately
                await updateDoc(requestRef, {
                    status: 'Cancelled',
                    cancellationReason: reason,
                    cancellationDate: serverTimestamp()
                });
                console.log('Pending request cancelled immediately');
            } else if (requestData.status === 'Approved') {
                // If approved, request cancellation
                await updateDoc(requestRef, {
                    cancellationRequested: true,
                    cancellationReason: reason,
                    cancellationDate: serverTimestamp()
                });
                console.log('Cancellation requested for approved request');
            } else {
                throw new Error('Cannot cancel request with current status');
            }
            
        } catch (error) {
            console.error('Error cancelling request:', error);
            throw error;
        }
    },

    async approveCancellation(requestId, type) {
        try {
            console.log('Approving cancellation for request:', { requestId, type });
            
            const collectionName = type === 'Leave' ? 'leaveRequests' : 'overtimeRequests';
            const requestRef = doc(db, collectionName, requestId);
            
            await updateDoc(requestRef, {
                status: 'Cancelled',
                cancellationApproved: true,
                cancellationApprovalDate: serverTimestamp()
            });
            
            console.log('Cancellation approved successfully');
        } catch (error) {
            console.error('Error approving cancellation:', error);
            throw error;
        }
    },

    async rejectCancellation(requestId, type) {
        try {
            console.log('Rejecting cancellation for request:', { requestId, type });
            
            const collectionName = type === 'Leave' ? 'leaveRequests' : 'overtimeRequests';
            const requestRef = doc(db, collectionName, requestId);
            
            await updateDoc(requestRef, {
                cancellationRequested: false,
                cancellationReason: '',
                cancellationDate: null
            });
            
            console.log('Cancellation rejected successfully');
        } catch (error) {
            console.error('Error rejecting cancellation:', error);
            throw error;
        }
    },

    async getAllRequests() {
        try {
            console.log('Fetching all requests...');
            const [leaveRequestsSnapshot, overtimeRequestsSnapshot] = await Promise.all([
                getDocs(collection(db, 'leaveRequests')),
                getDocs(collection(db, 'overtimeRequests'))
            ]);

            const requests = [];

            leaveRequestsSnapshot.forEach((doc) => {
                const data = doc.data();
                requests.push({
                    id: doc.id,
                    type: 'Leave',
                    ...data
                });
            });

            overtimeRequestsSnapshot.forEach((doc) => {
                const data = doc.data();
                requests.push({
                    id: doc.id,
                    type: 'Overtime',
                    ...data
                });
            });

            // Sort by submission date (newest first)
            const sortedRequests = requests.sort((a, b) => {
                const dateA = a.submissionDate?.toDate ? a.submissionDate.toDate() : new Date(a.submissionDate);
                const dateB = b.submissionDate?.toDate ? b.submissionDate.toDate() : new Date(b.submissionDate);
                return dateB - dateA;
            });

            console.log('Total requests found:', sortedRequests.length);
            return sortedRequests;
        } catch (error) {
            console.error('Error getting all requests:', error);
            throw error;
        }
    },

    async getCancellationRequests() {
        try {
            console.log('Fetching cancellation requests...');
            const [leaveRequestsSnapshot, overtimeRequestsSnapshot] = await Promise.all([
                getDocs(query(
                    collection(db, 'leaveRequests'),
                    where('cancellationRequested', '==', true)
                )),
                getDocs(query(
                    collection(db, 'overtimeRequests'),
                    where('cancellationRequested', '==', true)
                ))
            ]);

            const requests = [];

            leaveRequestsSnapshot.forEach((doc) => {
                const data = doc.data();
                requests.push({
                    id: doc.id,
                    type: 'Leave',
                    ...data
                });
            });

            overtimeRequestsSnapshot.forEach((doc) => {
                const data = doc.data();
                requests.push({
                    id: doc.id,
                    type: 'Overtime',
                    ...data
                });
            });

            console.log('Found cancellation requests:', requests.length);
            return requests;
        } catch (error) {
            console.error('Error getting cancellation requests:', error);
            throw error;
        }
    }
};

// Initialize debug info on load
console.log('Firebase service initialized');