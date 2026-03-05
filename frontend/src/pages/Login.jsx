import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';
import { Loader2, Mail, Lock, ArrowRight, User, Hash, Briefcase, GraduationCap, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const Login = () => {
    const navigate = useNavigate();
    const { login, signUp, loginWithRollNumber } = useAuth();
    const { isDark } = useTheme();
    const [loginMode, setLoginMode] = useState('student'); // 'student' or 'teacher'
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);

    // Student login fields
    const [rollNumber, setRollNumber] = useState('');

    // Teacher login/signup fields
    const [email, setEmail] = useState('');
    const [fullName, setFullName] = useState('');

    // Shared
    const [password, setPassword] = useState('');

    const handleStudentLogin = async (e) => {
        e.preventDefault();
        if (!rollNumber) return toast.error('Please enter your roll number');
        setLoading(true);
        try {
            await loginWithRollNumber(rollNumber.trim().toUpperCase());
            toast.success('Welcome!');
        } catch (err) {
            toast.error(err.message || 'Lookup failed');
        } finally {
            setLoading(false);
        }
    };

    const handleTeacherSubmit = async (e) => {
        e.preventDefault();
        if (!email || !password) return toast.error('Please fill email and password');
        if (!email.endsWith('@jntuhceh.ac.in')) {
            return toast.error('Only @jntuhceh.ac.in emails are allowed');
        }

        if (isSignUp) {
            if (!fullName) return toast.error('Please enter your full name');
            if (password.length < 6) return toast.error('Password must be at least 6 characters');
        }

        setLoading(true);
        try {
            if (isSignUp) {
                const metadata = {
                    full_name: fullName.trim(),
                    role: 'teacher',
                };
                const { error, data } = await signUp(email, password, metadata);
                if (error) throw error;
                if (data?.session) {
                    toast.success('Account created successfully!');
                } else {
                    toast.success('Account created! You can now sign in.');
                    setIsSignUp(false);
                }
            } else {
                const { error } = await login(email, password);
                if (error) throw error;
                toast.success('Welcome back!');
            }
        } catch (err) {
            toast.error(err.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-page">
                {/* Grid background */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute inset-0" style={{
                        backgroundImage: `linear-gradient(${isDark ? 'rgba(139,92,246,0.06)' : 'rgba(139,92,246,0.08)'} 1px, transparent 1px),
                        linear-gradient(90deg, ${isDark ? 'rgba(139,92,246,0.06)' : 'rgba(139,92,246,0.08)'} 1px, transparent 1px)`,
                        backgroundSize: '60px 60px',
                        transform: 'perspective(500px) rotateX(35deg)',
                        transformOrigin: 'center top'
                    }} />
                    <div className={`absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full blur-[120px] ${isDark ? 'bg-violet-600/10' : 'bg-violet-400/15'}`} />
                </div>

                {/* Theme toggle */}
                <div className="absolute top-4 right-4 z-10">
                    <ThemeToggle />
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 30, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className="relative w-full max-w-md mx-4"
                >
                    {/* Brand */}
                    <div className="text-center mb-8">
                        <div
                            onClick={() => navigate('/')}
                            className="inline-flex items-center gap-2 mb-2 cursor-pointer hover:opacity-80 transition-opacity"
                        >
                            <img src="/icon-512.png" className="w-12 h-12" alt="AttendEase logo" />
                            <span className="text-xl uppercase font-bold tracking-[0.15em] font-mono text-heading hover:opacity-80 transition-opacity">
                                AttendEase
                            </span>
                        </div>
                        <div className="flex justify-center  items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                            <h1 className="text-3xl font-bold text-heading tracking-tight">
                                {loginMode === 'student' ? 'Student Portal' : (isSignUp ? 'Create your account' : 'Teacher Portal')}
                            </h1>
                        </div>

                        <p className="text-muted mt-2 text-sm">JNTUH Attendance Management</p>
                    </div>

                    {/* Top-level tabs: Student / Teacher */}

                    <div className="flex p-1 bg-input rounded-xl border border-theme mb-6">
                        <button
                            onClick={() => { setLoginMode('student'); setIsSignUp(false); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${loginMode === 'student' ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-600/25' : 'text-muted hover:text-heading'}`}
                        >
                            <GraduationCap className="w-4 h-4" /> Student
                        </button>
                        <button
                            onClick={() => { setLoginMode('teacher'); setIsSignUp(false); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${loginMode === 'teacher' ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-600/25' : 'text-muted hover:text-heading'}`}
                        >
                            <Briefcase className="w-4 h-4" /> Teacher
                        </button>
                    </div>

                    {/* Glass card */}
                    <div className="bg-elevated backdrop-blur-xl border border-violet-500/10 rounded-2xl p-6 shadow-2xl" style={{ boxShadow: `0 25px 50px -12px ${isDark ? 'rgba(124,58,237,0.05)' : 'rgba(124,58,237,0.08)'}` }}>
                        <AnimatePresence mode="wait">
                            {/* ===== STUDENT LOGIN ===== */}
                            {loginMode === 'student' && (
                                <motion.form
                                    key="student-form"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    transition={{ duration: 0.25 }}
                                    onSubmit={handleStudentLogin}
                                    className="space-y-4"
                                >
                                    <div>
                                        <label className="block text-xs uppercase tracking-wider text-muted mb-1.5 font-medium">Roll Number</label>
                                        <div className="relative">
                                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                                            <input type="text" value={rollNumber} onChange={(e) => setRollNumber(e.target.value)}
                                                placeholder="e.g. 23011P0531"
                                                className="w-full pl-10 pr-4 py-3 bg-input border border-theme rounded-xl text-heading placeholder-faint focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition-all text-sm uppercase" />
                                        </div>
                                    </div>
                                    <button type="submit" disabled={loading}
                                        className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:from-violet-500 hover:to-purple-500 transition-all disabled:opacity-50 shadow-lg shadow-violet-600/20 mt-2">
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Eye className="w-4 h-4" /> View Attendance</>}
                                    </button>
                                </motion.form>
                            )}

                            {/* ===== TEACHER LOGIN / SIGNUP ===== */}
                            {loginMode === 'teacher' && (
                                <motion.div
                                    key="teacher-form"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.25 }}
                                >
                                    {/* Sign In / Sign Up sub-tabs */}
                                    <div className="flex p-1 bg-input rounded-lg border border-theme mb-5">
                                        <button
                                            onClick={() => setIsSignUp(false)}
                                            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${!isSignUp ? 'bg-page border border-theme shadow-sm text-heading' : 'text-muted hover:text-heading'}`}
                                        >
                                            Sign In
                                        </button>
                                        <button
                                            onClick={() => setIsSignUp(true)}
                                            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${isSignUp ? 'bg-page border border-theme shadow-sm text-heading' : 'text-muted hover:text-heading'}`}
                                        >
                                            Sign Up
                                        </button>
                                    </div>

                                    <form onSubmit={handleTeacherSubmit} className="space-y-4">
                                        <AnimatePresence mode="popLayout">
                                            {isSignUp && (
                                                <motion.div
                                                    key="teacher-name"
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    transition={{ duration: 0.3 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="mb-4">
                                                        <label className="block text-xs uppercase tracking-wider text-muted mb-1.5 font-medium">Full Name</label>
                                                        <div className="relative">
                                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                                                            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                                                                placeholder="John Doe"
                                                                className="w-full pl-10 pr-4 py-3 bg-input border border-theme rounded-xl text-heading placeholder-faint focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition-all text-sm" />
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        <div>
                                            <label className="block text-xs uppercase tracking-wider text-muted mb-1.5 font-medium">Email</label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                                                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                                                    placeholder="you@jntuhceh.ac.in"
                                                    className="w-full pl-10 pr-4 py-3 bg-input border border-theme rounded-xl text-heading placeholder-faint focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition-all text-sm" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs uppercase tracking-wider text-muted mb-1.5 font-medium">Password</label>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                                                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                                                    placeholder={isSignUp ? "Create password (min 6 chars)" : "Enter password"}
                                                    className="w-full pl-10 pr-4 py-3 bg-input border border-theme rounded-xl text-heading placeholder-faint focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition-all text-sm" />
                                            </div>
                                        </div>
                                        <button type="submit" disabled={loading}
                                            className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:from-violet-500 hover:to-purple-500 transition-all disabled:opacity-50 shadow-lg shadow-violet-600/20 mt-2">
                                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{isSignUp ? 'Create Account' : 'Sign In'} <ArrowRight className="w-4 h-4" /></>}
                                        </button>
                                    </form>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Footer note */}
                        <div className="bg-violet-600/5 border border-violet-500/10 rounded-xl p-3 mt-5">
                            <p className="text-xs text-muted">
                                <span className="text-violet-400 font-medium">
                                    {loginMode === 'student' ? 'Students: ' : 'Teachers: '}
                                </span>
                                {loginMode === 'student'
                                    ? 'Enter your JNTUH roll number to view your attendance dashboard. No password needed!'
                                    : <>Use your <code className="text-violet-400">@jntuhceh.ac.in</code> college email to sign in or create an account.</>
                                }
                            </p>
                        </div>
                    </div>
                    <p className="text-center text-xs text-faint mt-6">AttendEase — JNTUH Edition</p>
                </motion.div >
            </div >
        </div>
    );
};

export default Login;
