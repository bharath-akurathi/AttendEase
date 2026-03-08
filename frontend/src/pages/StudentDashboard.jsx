import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';
import { BookOpen, Calendar, AlertTriangle, TrendingUp, LogOut, Flame } from 'lucide-react';
import { toast } from 'sonner';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const ProgressRing = ({ percentage, size = 120, strokeWidth = 10 }) => {
    const { isDark } = useTheme();
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const color = percentage >= 75 ? '#22c55e' : percentage >= 65 ? '#eab308' : '#ef4444';
    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'} strokeWidth={strokeWidth} />
                <motion.circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
                    initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: circumference - (percentage / 100) * circumference }}
                    transition={{ duration: 1.5, ease: 'easeOut' }} strokeDasharray={circumference} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span className="text-2xl font-bold text-heading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                    {Math.round(percentage)}%
                </motion.span>
                <span className="text-[10px] uppercase tracking-wider text-muted">attendance</span>
            </div>
        </div>
    );
};

const StudentDashboard = () => {
    const { profile, session, logout } = useAuth();
    const [subjects, setSubjects] = useState([]);
    const [absenceHistory, setAbsenceHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState(profile?.current_year || 1);
    const [selectedSemester, setSelectedSemester] = useState(profile?.current_semester || 1);
    const headers = { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' };

    useEffect(() => { if (session?.access_token) fetchData(); }, [session?.access_token, selectedYear, selectedSemester]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const histRes = await fetch(`${API_BASE}/api/attendance/history?year=${selectedYear}&semester=${selectedSemester}` +
                (profile?.course_id ? `&courseId=${profile.course_id}` : '') +
                (profile?.regulation_id ? `&regulationId=${profile.regulation_id}` : ''), { headers });
            const histData = await histRes.json();
            setSubjects(Array.isArray(histData) ? histData : []);
            const absRes = await fetch(`${API_BASE}/api/attendance?studentId=${profile?.id}`, { headers });
            const absData = await absRes.json();
            setAbsenceHistory(Array.isArray(absData) ? absData.slice(0, 20) : []);
        } catch { toast.error('Failed to load data'); }
        finally { setLoading(false); }
    };

    const totalClasses = subjects.reduce((s, x) => s + (x.total_classes || 0), 0);
    const totalHolidays = subjects.reduce((s, x) => s + (x.total_holidays || 0), 0);
    const totalAbsences = subjects.reduce((s, x) => s + (x.total_absences || 0), 0);
    const totalAttended = totalClasses - totalAbsences;
    const overallPct = totalClasses > 0 ? (totalAttended / totalClasses) * 100 : 100;
    const hasRisk = subjects.some(s => { const t = s.total_classes || 0; return t > 0 && ((t - (s.total_absences || 0)) / t) * 100 < 75; });

    const maxSem = profile?.courses?.total_semesters || 8;
    const semOpts = [];
    for (let y = 1; y <= Math.ceil(maxSem / 2); y++) for (let s = 1; s <= 2; s++) if ((y - 1) * 2 + s <= maxSem) semOpts.push({ year: y, semester: s, label: `Y${y} S${s}` });

    const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
    const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

    return (
        <div className="min-h-screen bg-page">
            <header className="sticky top-0 z-50 nav-bg backdrop-blur-xl border-b border-theme">
                <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-violet-500" />
                        <span className="text-sm font-bold text-heading tracking-tight">ATTENDEASE</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right hidden sm:block">
                            <p className="text-sm text-heading font-medium">{profile?.full_name}</p>
                            <p className="text-xs text-muted">{profile?.roll_number || 'Student'}</p>
                        </div>
                        <ThemeToggle />
                        <button onClick={logout} className="p-2 text-muted hover:text-heading transition-colors"><LogOut className="w-4 h-4" /></button>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
                {/* Academic tags */}
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-2">
                    {profile?.regulations?.code && <span className="px-2.5 py-1 bg-violet-600/10 border border-violet-500/20 text-violet-400 rounded-lg text-xs font-medium">{profile.regulations.code}</span>}
                    {profile?.courses?.name && <span className="px-2.5 py-1 bg-card border border-theme text-body rounded-lg text-xs font-medium">{profile.courses.name}</span>}
                    <span className="px-2.5 py-1 bg-card border border-theme text-body rounded-lg text-xs font-medium">Year {selectedYear}, Sem {selectedSemester}</span>
                </motion.div>

                {hasRisk && (
                    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                        className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center shrink-0"><AlertTriangle className="w-5 h-5 text-red-400" /></div>
                        <div><p className="text-red-400 font-semibold text-sm">Condonation Risk</p><p className="text-red-400/70 text-xs">One or more subjects below 75%.</p></div>
                    </motion.div>
                )}

                {/* Stats */}
                <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <motion.div variants={fadeUp} className="md:col-span-1 bg-card border border-theme rounded-2xl p-6 flex flex-col items-center justify-center">
                        <ProgressRing percentage={overallPct} size={140} strokeWidth={12} />
                        <div className="mt-3 text-center">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${overallPct >= 75 ? 'bg-green-500/10 text-green-400' : overallPct >= 65 ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'}`}>
                                {overallPct >= 75 ? 'Good Standing' : overallPct >= 65 ? 'Warning' : 'At Risk'}
                            </span>
                        </div>
                    </motion.div>
                    <motion.div variants={fadeUp} className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                        {[
                            { label: 'Subjects', value: subjects.length, icon: BookOpen, color: 'violet' },
                            { label: 'Absences', value: totalAbsences, icon: Calendar, color: 'red' },
                            { label: 'Attended', value: totalAttended, icon: TrendingUp, color: 'green' },
                            { label: 'Classes', value: totalClasses, icon: Flame, color: 'amber' },
                            { label: 'Holidays', value: totalHolidays, icon: BookOpen, color: 'blue' },
                        ].map(stat => (
                            <motion.div key={stat.label} variants={fadeUp} className="bg-card border border-theme rounded-xl p-4">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 bg-${stat.color}-600/10`}>
                                    <stat.icon className={`w-4 h-4 text-${stat.color}-400`} />
                                </div>
                                <p className="text-2xl font-bold text-heading">{stat.value}</p>
                                <p className="text-xs text-muted mt-0.5">{stat.label}</p>
                            </motion.div>
                        ))}
                    </motion.div>
                </motion.div>

                {/* Semester picker */}
                <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wider text-muted font-medium">Semester</span>
                    <div className="flex gap-1.5 flex-wrap">
                        {semOpts.map(opt => (
                            <button key={`${opt.year}-${opt.semester}`}
                                onClick={() => { setSelectedYear(opt.year); setSelectedSemester(opt.semester); }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedYear === opt.year && selectedSemester === opt.semester
                                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/25'
                                    : 'bg-card border border-theme text-muted hover:text-heading'
                                    }`}>{opt.label}</button>
                        ))}
                    </div>
                </div>

                {/* Subject cards */}
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1, 2, 3].map(i => <div key={i} className="bg-card border border-theme rounded-2xl p-6 animate-pulse h-48" />)}
                    </div>
                ) : subjects.length === 0 ? (
                    <div className="text-center py-16 border border-dashed border-theme rounded-2xl">
                        <BookOpen className="w-12 h-12 text-faint mx-auto mb-3" />
                        <p className="text-muted text-sm">No subjects found for this semester</p>
                    </div>
                ) : (
                    <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {subjects.map(sub => {
                            const tc = sub.total_classes || 0, abs = sub.total_absences || 0, hol = sub.total_holidays || 0;
                            const pct = tc > 0 ? ((tc - abs) / tc) * 100 : 100;
                            return (
                                <motion.div key={sub.subject_id} variants={fadeUp}
                                    className={`bg-card border rounded-2xl p-5 transition-all hover:border-violet-500/20 ${pct < 75 ? 'border-red-500/20' : 'border-theme'}`}>
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-heading font-semibold text-sm">{sub.subject_name}</h3>
                                                {pct < 75 && <span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded text-[10px] font-bold uppercase">Risk</span>}
                                            </div>
                                            <p className="text-faint text-xs mt-0.5">{sub.subject_code}</p>
                                        </div>
                                        <ProgressRing percentage={pct} size={60} strokeWidth={5} />
                                    </div>
                                    <div className="flex gap-4 text-xs text-muted">
                                        <span>Classes: <span className="text-body">{tc}</span></span>
                                        <span>Absences: <span className={abs > 0 ? 'text-red-400' : 'text-body'}>{abs}</span></span>
                                        {hol > 0 && <span>Holidays: <span className="text-blue-400">{hol}</span></span>}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </motion.div>
                )}
            </main>
        </div>
    );
};

export default StudentDashboard;
