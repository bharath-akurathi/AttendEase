import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';
import BrandLoader from '../components/BrandLoader';
import {
    ArrowRight, BookOpen, Users, Shield, BarChart3,
    Clock, Zap, GraduationCap, ChevronRight,
    Sparkles, Target, TrendingUp
} from 'lucide-react';

const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } }
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.12 } } };

const LandingPage = () => {
    const navigate = useNavigate();
    const { isDark } = useTheme();
    const [isInitialLoading, setIsInitialLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsInitialLoading(false);
        }, 2000);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="min-h-screen bg-page text-heading overflow-hidden">
            <AnimatePresence mode="wait">
                {isInitialLoading ? (
                    <BrandLoader isFullScreen={true} speed="slow" key="landing-loader" />
                ) : (
                    <motion.div
                        key="landing-content"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5 }}
                    >
                        {/* NAV */}
                        <nav className="fixed top-0 w-full z-50 nav-bg backdrop-blur-2xl border-b border-theme">
                            <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                                <Link to="/">
                                    <div className="flex items-center gap-2.5">
                                        <img src="/icon-512.png" height={24} width={24} alt="" />
                                        <span className="text-md font-bold tracking-[0.15em] text-heading">ATTENDEASE</span>
                                    </div>
                                </Link>
                                <div className="flex items-center gap-3">
                                    <a href="#features" className="text-xs text-muted hover:text-heading transition-colors hidden sm:block">Features</a>
                                    <a href="#how" className="text-xs text-muted hover:text-heading transition-colors hidden sm:block">How it Works</a>
                                    <ThemeToggle />
                                    <button
                                        onClick={() => navigate('/login')}
                                        className="px-5 py-2 bg-violet-600 text-white rounded-xl text-xs font-semibold hover:bg-violet-500 transition-all shadow-lg shadow-violet-600/20"
                                    >
                                        Sign In
                                    </button>
                                </div>
                            </div>
                        </nav>

                        {/* HERO */}
                        <section className="relative min-h-screen flex items-center justify-center pt-20">
                            <div className="absolute inset-0">
                                <div className="absolute inset-0" style={{
                                    backgroundImage: `linear-gradient(${isDark ? 'rgba(139,92,246,0.04)' : 'rgba(139,92,246,0.06)'} 1px, transparent 1px),
                            linear-gradient(90deg, ${isDark ? 'rgba(139,92,246,0.04)' : 'rgba(139,92,246,0.06)'} 1px, transparent 1px)`,
                                    backgroundSize: '80px 80px',
                                    transform: 'perspective(600px) rotateX(40deg)',
                                    transformOrigin: 'center 30%'
                                }} />
                                <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full blur-[150px] ${isDark ? 'bg-violet-600/8' : 'bg-violet-400/10'}`} />
                            </div>

                            <div className="relative max-w-4xl mx-auto px-6 text-center">
                                <motion.div initial={{ opacity: 0, y: 20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={{ duration: 0.5 }}
                                    className="inline-flex items-center gap-2 px-4 py-1.5 bg-violet-600/10 border border-violet-500/20 rounded-full mb-8">
                                    <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                                    <span className="text-xs text-violet-400 font-medium">Built for JNTUH CEH</span>
                                </motion.div>

                                <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
                                    className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
                                    <span className="text-heading">Attendance,</span><br />
                                    <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
                                        simplified.
                                    </span>
                                </motion.h1>

                                <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.25 }}
                                    className="text-lg md:text-xl text-body max-w-2xl mx-auto mb-10 leading-relaxed">
                                    The modern absence-tracking platform for JNTUH College of Engineering.
                                    Teachers mark, students track — all in one place.
                                </motion.p>

                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}
                                    className="flex items-center justify-center gap-4">
                                    <button onClick={() => navigate('/login')}
                                        className="group px-8 py-3.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-2xl text-sm font-semibold flex items-center gap-2 hover:from-violet-500 hover:to-purple-500 transition-all shadow-2xl shadow-violet-600/30">
                                        Get Started <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                    <a href="#features" className="px-6 py-3.5 border border-theme text-body rounded-2xl text-sm font-medium hover:text-heading transition-all">
                                        Learn More
                                    </a>
                                </motion.div>

                                <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.6 }}
                                    className="mt-20 flex items-center justify-center gap-8 md:gap-16">
                                    {[
                                        { label: 'Regulations', value: 'R18 · R22' },
                                        { label: 'Programs', value: 'B.Tech · M.Tech · IDP' },
                                        { label: 'Tracking', value: 'Absence-Only' },
                                    ].map((stat, i) => (
                                        <div key={i} className="text-center">
                                            <p className="text-sm md:text-base font-bold text-heading">{stat.value}</p>
                                            <p className="text-[10px] uppercase tracking-wider text-faint mt-1">{stat.label}</p>
                                        </div>
                                    ))}
                                </motion.div>
                            </div>

                            <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2 }}
                                className="absolute bottom-8 left-1/2 -translate-x-1/2">
                                <div className="w-5 h-8 border border-theme rounded-full flex items-start justify-center p-1.5">
                                    <div className="w-1 h-2 bg-violet-500 rounded-full" />
                                </div>
                            </motion.div>
                        </section>

                        {/* FEATURES */}
                        <section id="features" className="py-32 relative">
                            <div className="max-w-6xl mx-auto px-6">
                                <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-100px' }} className="text-center mb-16">
                                    <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1 bg-card-alt rounded-full mb-4">
                                        <Target className="w-3 h-3 text-violet-400" />
                                        <span className="text-[10px] uppercase tracking-wider text-muted font-medium">Features</span>
                                    </motion.div>
                                    <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-heading">Everything you need</motion.h2>
                                    <motion.p variants={fadeUp} className="text-muted max-w-lg mx-auto">
                                        Purpose-built for JNTUH's academic structure with role-based access for students, teachers, and admins.
                                    </motion.p>
                                </motion.div>

                                <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-50px' }}
                                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {/* Absence model — large card */}
                                    <motion.div variants={fadeUp}
                                        className="md:col-span-2 bg-gradient-to-br from-violet-600/10 to-purple-600/5 border border-violet-500/10 rounded-3xl p-8 relative overflow-hidden group hover:border-violet-500/20 transition-all">
                                        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/5 rounded-full blur-[80px] group-hover:bg-violet-600/10 transition-all" />
                                        <div className="relative">
                                            <div className="w-12 h-12 bg-violet-600/10 rounded-2xl flex items-center justify-center mb-4">
                                                <BookOpen className="w-6 h-6 text-violet-400" />
                                            </div>
                                            <h3 className="text-xl font-bold text-heading mb-2">Absence-Only Model</h3>
                                            <p className="text-body text-sm leading-relaxed max-w-md">
                                                Only absent students are recorded — no tedious roll calls for every student.
                                                Teachers mark absences per subject per date, keeping the process fast and friction-free.
                                            </p>
                                            <div className="flex gap-2 mt-6">
                                                {['Per Subject', 'Per Date', 'Idempotent Saves'].map(tag => (
                                                    <span key={tag} className="px-2.5 py-1 bg-violet-600/10 text-violet-300 rounded-lg text-[10px] font-medium uppercase tracking-wider">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </motion.div>

                                    {[
                                        { icon: GraduationCap, color: 'indigo', title: 'JNTUH Hierarchy', desc: 'Regulation → Course → Year → Semester → Subject. Fully modeled.' },
                                        { icon: Shield, color: 'emerald', title: 'Role-Based Access', desc: 'Three roles — Student, Teacher, Admin — each with tailored dashboards.' },
                                        { icon: TrendingUp, color: 'amber', title: 'Live Insights', desc: 'Per-subject attendance percentages with visual progress rings and condonation warnings.' },
                                        { icon: Zap, color: 'rose', title: 'Built to be Fast', desc: 'Mark absences with a single tap. Bulk enroll by roll numbers. Export CSV instantly.' },
                                    ].map(card => (
                                        <motion.div key={card.title} variants={fadeUp}
                                            className="bg-card border border-theme rounded-3xl p-6 hover:border-violet-500/15 transition-all">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 bg-${card.color}-600/10`}>
                                                <card.icon className={`w-5 h-5 text-${card.color}-400`} />
                                            </div>
                                            <h3 className="text-base font-bold text-heading mb-1.5">{card.title}</h3>
                                            <p className="text-muted text-sm leading-relaxed">{card.desc}</p>
                                        </motion.div>
                                    ))}
                                </motion.div>
                            </div>
                        </section>

                        {/* HOW IT WORKS */}
                        <section id="how" className="py-32 relative">
                            <div className="max-w-5xl mx-auto px-6 relative">
                                <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-100px' }} className="text-center mb-16">
                                    <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1 bg-card-alt rounded-full mb-4">
                                        <Clock className="w-3 h-3 text-violet-400" />
                                        <span className="text-[10px] uppercase tracking-wider text-muted font-medium">How it Works</span>
                                    </motion.div>
                                    <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-heading">Three steps. That&apos;s it.</motion.h2>
                                </motion.div>

                                <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-50px' }}
                                    className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {[
                                        { step: '01', title: 'Admin sets up', desc: 'Create regulations, courses, and invite teachers. Define the academic structure once.', icon: Shield, color: 'violet' },
                                        { step: '02', title: 'Teachers manage', desc: 'Create subjects, enroll students by roll number, and mark absences per session.', icon: Users, color: 'purple' },
                                        { step: '03', title: 'Students track', desc: 'View per-subject attendance, get condonation warnings, and stay on top of classes.', icon: BarChart3, color: 'fuchsia' }
                                    ].map(item => (
                                        <motion.div key={item.step} variants={fadeUp}
                                            className="relative bg-card border border-theme rounded-3xl p-8 group hover:border-violet-500/15 transition-all">
                                            <span className="text-6xl font-black text-faint absolute top-4 right-6 group-hover:text-violet-600/10 transition-colors">
                                                {item.step}
                                            </span>
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 bg-${item.color}-600/10`}>
                                                <item.icon className={`w-6 h-6 text-${item.color}-400`} />
                                            </div>
                                            <h3 className="text-lg font-bold text-heading mb-2">{item.title}</h3>
                                            <p className="text-muted text-sm leading-relaxed">{item.desc}</p>
                                        </motion.div>
                                    ))}
                                </motion.div>
                            </div>
                        </section>

                        {/* CTA */}
                        <section className="py-32 relative">
                            <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-[150px] ${isDark ? 'bg-violet-600/8' : 'bg-violet-400/10'}`} />
                            <div className="max-w-3xl mx-auto px-6 text-center relative">
                                <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={stagger}>
                                    <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-bold tracking-tight mb-6 text-heading">
                                        Ready to track<br />
                                        <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">smarter?</span>
                                    </motion.h2>
                                    <motion.p variants={fadeUp} className="text-muted mb-10 max-w-md mx-auto">
                                        Sign in with your college email to get started.
                                    </motion.p>
                                    <motion.button variants={fadeUp} onClick={() => navigate('/login')}
                                        className="group px-10 py-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-2xl text-sm font-semibold flex items-center gap-2 mx-auto shadow-2xl shadow-violet-600/30">
                                        Sign In Now <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </motion.button>
                                </motion.div>
                            </div>
                        </section>

                        {/* FOOTER */}
                        <footer className="border-t border-theme py-8">
                            <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    {/* <div className="w-1.5 h-1.5 rounded-full bg-violet-500" /> */}
                                    <span className="text-xs font-bold tracking-wider text-muted">ATTENDEASE</span>
                                </div>
                                <p className="text-xs text-faint">© 2026 AttendEase · JNTUH College of Engineering Hyderabad</p>
                            </div>
                        </footer>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default LandingPage;
