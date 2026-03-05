import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AcademicProvider } from './context/AcademicContext';
import { Toaster } from 'sonner';
import BrandLoader from './components/BrandLoader';

import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentDashboard from './pages/StudentDashboard';

const pageTransition = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.2 } }
};

function AppContent() {
    const { user, profile, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return <BrandLoader isFullScreen={true} speed="fast" />;
    }

    return (
        <div className="min-h-screen bg-page text-heading font-sans">
            <Toaster position="top-center" richColors theme="dark" />
            <AnimatePresence mode="wait">
                <Routes location={location} key={location.pathname}>
                    <Route
                        path="/"
                        element={
                            user ? (
                                <Navigate to="/dashboard" replace />
                            ) : (
                                <motion.div key="landing" {...pageTransition}><LandingPage /></motion.div>
                            )
                        }
                    />
                    <Route
                        path="/login"
                        element={!user ? (
                            <motion.div key="login" {...pageTransition}><Login /></motion.div>
                        ) : (
                            <Navigate to="/dashboard" replace />
                        )}
                    />
                    <Route
                        path="/dashboard"
                        element={
                            !user ? (
                                <Navigate to="/login" replace />
                            ) : (
                                <AcademicProvider>
                                    <motion.div key="dashboard" {...pageTransition}>
                                        {profile?.role === 'admin' ? (
                                            <AdminDashboard />
                                        ) : profile?.role === 'teacher' ? (
                                            <TeacherDashboard />
                                        ) : (
                                            <StudentDashboard />
                                        )}
                                    </motion.div>
                                </AcademicProvider>
                            )
                        }
                    />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AnimatePresence>
        </div>
    );
}

export default function App() {
    return <AppContent />;
}
