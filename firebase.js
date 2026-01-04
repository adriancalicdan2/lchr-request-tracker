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

export const firebaseService = {
    // Authentication Methods
    async loginUser(email, password) {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            return userCredential.user;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    },

    async logoutUser() {
        try {
            await signOut(auth);
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
            // We use a secondary "App" instance to create the new user.
            // This ensures the current admin stays logged in while creating the new account.
            const tempApp = initializeApp(firebaseConfig, "TempApp");
            const tempAuth = getAuth(tempApp);
            
            const userCredential = await createUserWithEmailAndPassword(tempAuth, employeeData.email, password);
            
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
            
            // Save to Firestore
            await setDoc(doc(db, 'employees', userCredential.user.uid), employeeDoc);
            
            // Cleanup the temp app
            await signOut(tempAuth);
            
            return employeeDoc;
        } catch (error) {
            console.error('Error creating employee:', error);
            throw new Error(`Failed to create employee: ${error.message}`);
        }
    },

    async getAllEmployees() {
        try {
            const querySnapshot = await getDocs(collection(db, 'employees'));
            const employees = [];
            querySnapshot.forEach((doc) => {
                employees.push({ id: doc.id, ...doc.data() });
            });
            return employees;
        } catch (error) {
            console.error('Error getting employees:', error);
            throw new Error(`Failed to load employees: ${error.message}`);
        }
    },

    async getEmployeeByEmail(email) {
        try {
            const q = query(collection(db, 'employees'), where('email', '==', email));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const doc = querySnapshot.docs[0];
                return { id: doc.id, ...doc.data() };
            }
            return null;
        } catch (error) {
            console.error('Error getting employee by email:', error);
            throw error;
        }
    },

    // --- UPDATED DELETE METHOD (No NPM/Backend required) ---
    async deleteEmployee(uid) {
        try {
            console.log('Deleting employee record from database:', uid);
            
            // Delete the document from the 'employees' collection.
            // This removes their profile. app.js will block login if this profile is missing.
            await deleteDoc(doc(db, 'employees', uid));
            
            console.log('Employee record deleted.');
            return { success: true, message: 'Employee access revoked (Record Deleted).' };
            
        } catch (error) {
            console.error('Error deleting employee:', error);
            throw new Error('Failed to delete employee record.');
        }
    },

    // Request Management Methods
    async submitLeaveRequest(requestData) {
        try {
            const docRef = await addDoc(collection(db, 'leaveRequests'), {
                ...requestData,
                type: 'Leave',
                status: 'Pending',
                submissionDate: serverTimestamp(),
                cancellationRequested: false
            });
            return docRef.id;
        } catch (error) {
            console.error('Error submitting leave request:', error);
            throw error;
        }
    },

    async submitOvertimeRequest(requestData) {
        try {
            const docRef = await addDoc(collection(db, 'overtimeRequests'), {
                ...requestData,
                type: 'Overtime',
                status: 'Pending',
                submissionDate: serverTimestamp(),
                cancellationRequested: false
            });
            return docRef.id;
        } catch (error) {
            console.error('Error submitting overtime request:', error);
            throw error;
        }
    },

    async getLeaveRequestsByEmployee(employeeId) {
        try {
            const q = query(collection(db, 'leaveRequests'), where('employeeId', '==', employeeId));
            const querySnapshot = await getDocs(q);
            const requests = [];
            querySnapshot.forEach((doc) => requests.push({ id: doc.id, type: 'Leave', ...doc.data() }));
            return requests;
        } catch (error) {
            console.error('Error getting leave requests:', error);
            throw error;
        }
    },

    async getOvertimeRequestsByEmployee(employeeId) {
        try {
            const q = query(collection(db, 'overtimeRequests'), where('employeeId', '==', employeeId));
            const querySnapshot = await getDocs(q);
            const requests = [];
            querySnapshot.forEach((doc) => requests.push({ id: doc.id, type: 'Overtime', ...doc.data() }));
            return requests;
        } catch (error) {
            console.error('Error getting overtime requests:', error);
            throw error;
        }
    },

    async getPendingRequestsByDepartment(department) {
        try {
            const [leaveSnapshot, overtimeSnapshot] = await Promise.all([
                getDocs(query(collection(db, 'leaveRequests'), where('department', '==', department), where('status', '==', 'Pending'))),
                getDocs(query(collection(db, 'overtimeRequests'), where('department', '==', department), where('status', '==', 'Pending')))
            ]);
            
            const requests = [];
            leaveSnapshot.forEach(doc => requests.push({ id: doc.id, type: 'Leave', ...doc.data() }));
            overtimeSnapshot.forEach(doc => requests.push({ id: doc.id, type: 'Overtime', ...doc.data() }));
            return requests;
        } catch (error) {
            console.error('Error getting pending requests:', error);
            throw error;
        }
    },

    async updateRequestStatus(requestId, status, type, approvedBy) {
        try {
            const collectionName = type === 'Leave' ? 'leaveRequests' : 'overtimeRequests';
            await updateDoc(doc(db, collectionName, requestId), {
                status: status,
                approvedBy: approvedBy,
                approvalDate: serverTimestamp()
            });
        } catch (error) {
            console.error('Error updating status:', error);
            throw error;
        }
    },

    async cancelRequest(requestId, type, reason) {
        try {
            const collectionName = type === 'Leave' ? 'leaveRequests' : 'overtimeRequests';
            const requestRef = doc(db, collectionName, requestId);
            const requestDoc = await getDoc(requestRef);
            
            if (requestDoc.data().status === 'Pending') {
                await updateDoc(requestRef, { 
                    status: 'Cancelled', 
                    cancellationReason: reason,
                    cancellationDate: serverTimestamp()
                });
            } else {
                await updateDoc(requestRef, { 
                    cancellationRequested: true, 
                    cancellationReason: reason,
                    cancellationDate: serverTimestamp() 
                });
            }
        } catch (error) {
            console.error('Error cancelling request:', error);
            throw error;
        }
    },

    async approveCancellation(requestId, type) {
        try {
            const collectionName = type === 'Leave' ? 'leaveRequests' : 'overtimeRequests';
            await updateDoc(doc(db, collectionName, requestId), {
                status: 'Cancelled',
                cancellationApproved: true,
                cancellationApprovalDate: serverTimestamp()
            });
        } catch (error) {
            console.error('Error approving cancellation:', error);
            throw error;
        }
    },

    async rejectCancellation(requestId, type) {
        try {
            const collectionName = type === 'Leave' ? 'leaveRequests' : 'overtimeRequests';
            await updateDoc(doc(db, collectionName, requestId), {
                cancellationRequested: false,
                cancellationReason: ''
            });
        } catch (error) {
            console.error('Error rejecting cancellation:', error);
            throw error;
        }
    },

    async getAllRequests() {
        try {
            const [leaveSnapshot, overtimeSnapshot] = await Promise.all([
                getDocs(collection(db, 'leaveRequests')),
                getDocs(collection(db, 'overtimeRequests'))
            ]);
            
            const requests = [];
            leaveSnapshot.forEach(doc => requests.push({ id: doc.id, type: 'Leave', ...doc.data() }));
            overtimeSnapshot.forEach(doc => requests.push({ id: doc.id, type: 'Overtime', ...doc.data() }));
            
            return requests.sort((a, b) => {
                const dateA = a.submissionDate?.toDate ? a.submissionDate.toDate() : new Date(a.submissionDate);
                const dateB = b.submissionDate?.toDate ? b.submissionDate.toDate() : new Date(b.submissionDate);
                return dateB - dateA;
            });
        } catch (error) {
            console.error('Error getting all requests:', error);
            throw error;
        }
    },

    async getCancellationRequests() {
        try {
            const [leaveSnapshot, overtimeSnapshot] = await Promise.all([
                getDocs(query(collection(db, 'leaveRequests'), where('cancellationRequested', '==', true))),
                getDocs(query(collection(db, 'overtimeRequests'), where('cancellationRequested', '==', true)))
            ]);
            
            const requests = [];
            leaveSnapshot.forEach(doc => requests.push({ id: doc.id, type: 'Leave', ...doc.data() }));
            overtimeSnapshot.forEach(doc => requests.push({ id: doc.id, type: 'Overtime', ...doc.data() }));
            return requests;
        } catch (error) {
            console.error('Error getting cancellation requests:', error);
            throw error;
        }
    }
};