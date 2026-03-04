import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AcademicProvider } from './context/AcademicContext';
import { Loader2 } from 'lucide-react';
import { Toaster } from 'sonner';

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

    if (loading) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-page">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                >
                    <Loader2 className="w-8 h-8 text-violet-500" />
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-page text-heading font-sans">
            <Toaster position="top-center" richColors theme="dark" />
            <AnimatePresence mode="wait">
                <Routes>
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
