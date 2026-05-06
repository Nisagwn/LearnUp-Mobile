import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { ToastProvider } from './components/ToastProvider';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import Chatbot from './pages/Chatbot';
import Auth from './pages/Auth';
import Quiz from './pages/Quiz';
import Loading from './components/Loading';
import 'katex/dist/katex.min.css';
import './index.css';

// Korumalı Rota (Protected Route) Bileşeni
const ProtectedRoute = ({ user, userData, allowedRoles, children }) => {
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && userData && !allowedRoles.includes(userData.role)) {
    return <Navigate to={userData.role === 'teacher' ? '/teacher' : '/student'} replace />;
  }
  return children;
};

// Rol bazlı ana yönlendirici
const DashboardRouter = ({ user, userData }) => {
  if (!user) return <Navigate to="/login" replace />;
  if (!userData) return <Loading />; // Rol bilgisi bekleniyor
  
  if (userData.role === 'teacher') return <Navigate to="/teacher" replace />;
  return <Navigate to="/student" replace />; // Varsayılan
};

function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser && currentUser.uid) {
        // Auth'dan her zaman alınabilen baseline
        const authBaseline = {
          uid: currentUser.uid,
          email: currentUser.email,
          name: currentUser.displayName || null,
        };

        try {
          const uid = currentUser.uid;
          const docRef = doc(db, 'users', uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            setUserData({ ...authBaseline, ...docSnap.data() });
          } else {
            setUserData({ ...authBaseline, role: 'student', isFallback: true });
          }
        } catch (err) {
          console.error('Failed fetching user doc for uid:', currentUser?.uid, err);
          setUserData({ ...authBaseline, role: 'student', isFallback: true });
        }
      } else if (currentUser && !currentUser.uid) {
        console.warn('onAuthStateChanged returned user without uid:', currentUser);
        setUserData({ role: 'student', isFallback: true });
      } else {
        setUserData(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <Loading />;
  }

  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          {/* Landing page'e user bilgisini yolluyoruz ki butonları ona göre güncellesin */}
          <Route path="/" element={<LandingPage user={user} />} />
          
          <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Auth />} />

          <Route path="/student/quiz" element={
            <ProtectedRoute user={user} userData={userData} allowedRoles={['student']}>
              <Quiz />
            </ProtectedRoute>
          } />

          <Route element={<Layout userData={userData} />}>
            <Route path="dashboard" element={<DashboardRouter user={user} userData={userData} />} />

            <Route path="student" element={
              <ProtectedRoute user={user} userData={userData} allowedRoles={['student']}>
                <StudentDashboard />
              </ProtectedRoute>
            } />
            <Route path="chatbot" element={
              <ProtectedRoute user={user} userData={userData} allowedRoles={['student']}>
                <Chatbot />
              </ProtectedRoute>
            } />

            <Route path="teacher/*" element={
              <ProtectedRoute user={user} userData={userData} allowedRoles={['teacher']}>
                <TeacherDashboard />
              </ProtectedRoute>
            } />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;