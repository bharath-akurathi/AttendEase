import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';
import { Loader2, Mail, Lock, ArrowRight, User, Hash, Briefcase, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';

const Login = () => {
    const { login, signUp } = useAuth();
    const { isDark } = useTheme();
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState('student'); // 'student' or 'teacher'
    const [rollNumber, setRollNumber] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!email || !password) return toast.error('Please fill email and password');
        if (!email.endsWith('@jntuhceh.ac.in')) {
            return toast.error('Only @jntuhceh.ac.in emails are allowed');
        }

        if (isSignUp) {
            if (!fullName) return toast.error('Please enter your full name');
            if (role === 'student' && !rollNumber) return toast.error('Please enter your roll number');
            if (password.length < 6) return toast.error('Password must be at least 6 characters');
        }

        setLoading(true);
        try {
            if (isSignUp) {
                // Formatting roll number to upper case to keep consistency
                const formattedRoll = rollNumber.trim().toUpperCase();
                const metadata = {
                    full_name: fullName.trim(),
                    role: role,
                };
                if (role === 'student') metadata.roll_number = formattedRoll;

                const { error, data } = await signUp(email, password, metadata);
                if (error) throw error;

                // Supabase signUp returns a session if auto-login is enabled, else it requires email confirmation
                if (data?.session) {
                    toast.success('Account created successfully!');
                } else {
                    toast.success('Account created! You can now sign in.');
                    // Optionally force switch to sign in tab
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

            {/* Theme toggle — top right */}
            <div className="absolute top-4 right-4 z-10">
                <ThemeToggle />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="relative w-full max-w-md mx-4 mt-8" // Added mt-8 incase it gets tall
            >
                {/* Brand */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                        <span className="text-xs uppercase tracking-[0.2em] text-muted font-mono">AttendEase</span>
                    </div>
                    <h1 className="text-3xl font-bold text-heading tracking-tight">
                        {isSignUp ? 'Create your workspace' : 'Sign in to your workspace'}
                    </h1>
                    <p className="text-muted mt-2 text-sm">JNTUH Attendance Management</p>
                </div>

                {/* Tabs */}
                <div className="flex p-1 bg-input rounded-xl border border-theme mb-6">
                    <button
                        onClick={() => setIsSignUp(false)}
                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${!isSignUp ? 'bg-page border border-theme shadow-sm text-heading' : 'text-muted hover:text-heading'}`}
                    >
                        Sign In
                    </button>
                    <button
                        onClick={() => setIsSignUp(true)}
                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${isSignUp ? 'bg-page border border-theme shadow-sm text-heading' : 'text-muted hover:text-heading'}`}
                    >
                        Sign Up
                    </button>
                </div>

                {/* Glass card */}
                <div className="bg-elevated backdrop-blur-xl border border-violet-500/10 rounded-2xl p-6 shadow-2xl" style={{ boxShadow: `0 25px 50px -12px ${isDark ? 'rgba(124,58,237,0.05)' : 'rgba(124,58,237,0.08)'}` }}>
                    <form onSubmit={handleSubmit} className="space-y-4">

                        <AnimatePresence mode="popLayout">
                            {isSignUp && (
                                <motion.div
                                    key="signup-fields"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="space-y-4 overflow-hidden"
                                >
                                    <div>
                                        <label className="block text-xs uppercase tracking-wider text-muted mb-1.5 font-medium">Full Name</label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                                            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                                                placeholder="John Doe"
                                                className="w-full pl-10 pr-4 py-3 bg-input border border-theme rounded-xl text-heading placeholder-faint focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition-all text-sm" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs uppercase tracking-wider text-muted mb-1.5 font-medium">Role</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <label className={`flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${role === 'student' ? 'border-violet-500 bg-violet-500/10 text-violet-500' : 'border-theme bg-input text-muted hover:bg-page'}`}>
                                                <input type="radio" className="hidden" name="role" value="student" checked={role === 'student'} onChange={() => setRole('student')} />
                                                <GraduationCap className="w-4 h-4" />
                                                <span className="text-sm font-medium">Student</span>
                                            </label>
                                            <label className={`flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${role === 'teacher' ? 'border-violet-500 bg-violet-500/10 text-violet-500' : 'border-theme bg-input text-muted hover:bg-page'}`}>
                                                <input type="radio" className="hidden" name="role" value="teacher" checked={role === 'teacher'} onChange={() => setRole('teacher')} />
                                                <Briefcase className="w-4 h-4" />
                                                <span className="text-sm font-medium">Teacher</span>
                                            </label>
                                        </div>
                                    </div>

                                    {role === 'student' && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                        >
                                            <label className="block text-xs uppercase tracking-wider text-muted mb-1.5 font-medium">Roll Number</label>
                                            <div className="relative">
                                                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                                                <input type="text" value={rollNumber} onChange={(e) => setRollNumber(e.target.value)}
                                                    placeholder="23011P0531"
                                                    className="w-full pl-10 pr-4 py-3 bg-input border border-theme rounded-xl text-heading placeholder-faint focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition-all text-sm uppercase" />
                                            </div>
                                        </motion.div>
                                    )}
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
                            className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:from-violet-500 hover:to-purple-500 transition-all disabled:opacity-50 shadow-lg shadow-violet-600/20 mt-4">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{isSignUp ? 'Create Account' : 'Sign In'} <ArrowRight className="w-4 h-4" /></>}
                        </button>
                    </form>
                    <div className="bg-violet-600/5 border border-violet-500/10 rounded-xl p-3 mt-5">
                        <p className="text-xs text-muted">
                            <span className="text-violet-400 font-medium">Note:</span> Use your <code className="text-violet-400">@jntuhceh.ac.in</code> college email to sign in or create an account.
                        </p>
                    </div>
                </div>
                <p className="text-center text-xs text-faint mt-6">AttendEase v2.0 — JNTUH Edition</p>
            </motion.div>
        </div>
    );
};

export default Login;
