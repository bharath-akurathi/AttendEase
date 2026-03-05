import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useAcademic } from '../context/AcademicContext';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';
import ChangePassword from '../components/ChangePassword';
import {
    Users, BookOpen, Settings, BarChart3, Plus, Trash2, Edit2,
    LogOut, ChevronRight, ChevronDown, Check, X, Loader2,
    Shield, GraduationCap, Lock, Unlock, Eye, UserPlus, Key
} from 'lucide-react';
import { toast } from 'sonner';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const AdminDashboard = () => {
    const { profile, session, logout } = useAuth();
    const { regulations, courses, fetchRegulations, fetchCourses } = useAcademic();
    const { isDark } = useTheme();
    const headers = { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' };

    const [activeTab, setActiveTab] = useState('overview');
    const [users, setUsers] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [editingUser, setEditingUser] = useState(null);
    const [newReg, setNewReg] = useState({ code: '', name: '', start_year: 2022 });
    const [newCourse, setNewCourse] = useState({ name: '', code: '', regulation_id: '', total_semesters: 8 });
    const [showRegForm, setShowRegForm] = useState(false);
    const [showCourseForm, setShowCourseForm] = useState(false);
    const [showChangePassword, setShowChangePassword] = useState(false);
    // Bulk students state
    const [bulkPrefix, setBulkPrefix] = useState('');
    const [bulkStart, setBulkStart] = useState('');
    const [bulkEnd, setBulkEnd] = useState('');
    const [bulkRegulation, setBulkRegulation] = useState('');
    const [bulkCourse, setBulkCourse] = useState('');
    const [bulkYear, setBulkYear] = useState(1);
    const [bulkSemester, setBulkSemester] = useState(1);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [bulkResult, setBulkResult] = useState(null);

    const fetchUsers = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/admin/users`, { headers });
            const data = await res.json();
            setUsers(Array.isArray(data) ? data : []);
        } catch { toast.error('Failed to load users'); }
    }, [session?.access_token]);

    const fetchSubjects = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/subjects`, { headers });
            const data = await res.json();
            setSubjects(Array.isArray(data) ? data : []);
        } catch { /* */ }
    }, [session?.access_token]);

    useEffect(() => {
        if (session?.access_token) {
            Promise.all([fetchUsers(), fetchSubjects(), fetchRegulations()]).finally(() => setLoading(false));
        }
    }, [session?.access_token]);

    useEffect(() => {
        setStats({
            totalUsers: users.length,
            students: users.filter(u => u.role === 'student').length,
            teachers: users.filter(u => u.role === 'teacher').length,
            admins: users.filter(u => u.role === 'admin').length,
            regulations: regulations.length,
            courses: courses.length,
            subjects: subjects.length,
        });
    }, [users, regulations, courses, subjects]);

    const handleRoleChange = async (userId, newRole) => {
        try {
            const res = await fetch(`${API_BASE}/api/admin/users/${userId}/role`, { method: 'PATCH', headers, body: JSON.stringify({ role: newRole }) });
            if (!res.ok) throw new Error('Failed');
            toast.success('Role updated'); fetchUsers();
        } catch (err) { toast.error(err.message); }
    };

    const handleUpdatePermissions = async (userId, perms) => {
        try {
            const res = await fetch(`${API_BASE}/api/admin/users/${userId}/permissions`, { method: 'PATCH', headers, body: JSON.stringify(perms) });
            if (!res.ok) throw new Error('Failed');
            toast.success('Permissions updated'); fetchUsers();
        } catch (err) { toast.error(err.message); }
    };

    const handleCreateRegulation = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_BASE}/api/admin/regulations`, { method: 'POST', headers, body: JSON.stringify(newReg) });
            if (!res.ok) throw new Error('Failed');
            toast.success('Regulation created'); setShowRegForm(false); setNewReg({ code: '', name: '', start_year: 2022 }); fetchRegulations();
        } catch (err) { toast.error(err.message); }
    };

    const handleCreateCourse = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_BASE}/api/admin/courses`, { method: 'POST', headers, body: JSON.stringify(newCourse) });
            if (!res.ok) throw new Error('Failed');
            toast.success('Course created'); setShowCourseForm(false); setNewCourse({ name: '', code: '', regulation_id: '', total_semesters: 8 }); fetchCourses(newCourse.regulation_id);
        } catch (err) { toast.error(err.message); }
    };

    const handleDeleteRegulation = async (id) => { try { await fetch(`${API_BASE}/api/admin/regulations/${id}`, { method: 'DELETE', headers }); toast.success('Deleted'); fetchRegulations(); } catch { toast.error('Failed'); } };
    const handleDeleteCourse = async (id) => { try { await fetch(`${API_BASE}/api/admin/courses/${id}`, { method: 'DELETE', headers }); toast.success('Deleted'); } catch { toast.error('Failed'); } };

    const tabs = [
        { id: 'overview', label: 'Overview', icon: BarChart3 },
        { id: 'users', label: 'Users', icon: Users },
        { id: 'academic', label: 'Academic', icon: GraduationCap },
        { id: 'subjects', label: 'Subjects', icon: BookOpen },
        { id: 'bulk', label: 'Bulk Students', icon: UserPlus },
    ];

    const handleBulkCreate = async () => {
        if (!bulkPrefix || !bulkStart || !bulkEnd) return toast.error('Fill prefix, start, and end');
        if (bulkPrefix.length + bulkEnd.length !== 10) {
            return toast.error(`Roll numbers must be exactly 10 characters (currently ${bulkPrefix.length + bulkEnd.length})`);
        }
        setBulkLoading(true); setBulkResult(null);
        try {
            const res = await fetch(`${API_BASE}/api/admin/students/bulk-range`, {
                method: 'POST', headers,
                body: JSON.stringify({
                    prefix: bulkPrefix, start: bulkStart, end: bulkEnd,
                    regulation_id: bulkRegulation || undefined, course_id: bulkCourse || undefined,
                    current_year: bulkYear || undefined, current_semester: bulkSemester || undefined
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setBulkResult(data);
            toast.success(`Created ${data.total_created} students, skipped ${data.total_skipped}`);
            fetchUsers();
        } catch (err) { toast.error(err.message); }
        finally { setBulkLoading(false); }
    };

    const fadeUp = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } };
    const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

    return (
        <div className="min-h-screen bg-page">
            <header className="sticky top-0 z-50 nav-bg backdrop-blur-xl border-b border-theme">
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-violet-500" />
                        <span className="text-sm font-bold text-heading tracking-tight">ATTENDEASE</span>
                        <span className="text-xs text-muted">/ Admin</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-heading font-medium hidden sm:block">{profile?.full_name}</span>
                        <button onClick={() => setShowChangePassword(true)} className="p-2 text-muted hover:text-violet-400 transition-colors" title="Change Password"><Key className="w-4 h-4" /></button>
                        <ThemeToggle />
                        <button onClick={logout} className="p-2 text-muted hover:text-heading transition-colors"><LogOut className="w-4 h-4" /></button>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 py-6">
                {/* Tabs */}
                <div className="flex gap-1 bg-card border border-theme rounded-xl p-1 mb-6 overflow-x-auto">
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/25' : 'text-muted hover:text-heading'}`}>
                            <tab.icon className="w-4 h-4" />{tab.label}
                        </button>
                    ))}
                </div>

                <AnimatePresence mode="wait">
                    {/* OVERVIEW */}
                    {activeTab === 'overview' && (
                        <motion.div key="overview" initial="hidden" animate="show" exit={{ opacity: 0 }} variants={stagger}>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                                {[
                                    { label: 'Total Users', val: stats.totalUsers, color: 'violet', icon: Users },
                                    { label: 'Students', val: stats.students, color: 'blue', icon: GraduationCap },
                                    { label: 'Teachers', val: stats.teachers, color: 'emerald', icon: BookOpen },
                                    { label: 'Subjects', val: stats.subjects, color: 'amber', icon: BookOpen },
                                ].map(s => (
                                    <motion.div key={s.label} variants={fadeUp} className="bg-card border border-theme rounded-xl p-4">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 bg-${s.color}-600/10`}>
                                            <s.icon className={`w-4 h-4 text-${s.color}-400`} />
                                        </div>
                                        <p className="text-2xl font-bold text-heading">{s.val || 0}</p>
                                        <p className="text-xs text-muted">{s.label}</p>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* USERS */}
                    {activeTab === 'users' && (
                        <motion.div key="users" initial="hidden" animate="show" exit={{ opacity: 0 }} variants={stagger}>
                            <div className="space-y-3">
                                {users.map(user => {
                                    const isTeacher = user.role === 'teacher';
                                    const isEditing = editingUser === user.id;
                                    return (
                                        <motion.div key={user.id} variants={fadeUp} className="bg-card border border-theme rounded-xl p-4">
                                            <div className="flex items-center justify-between flex-wrap gap-2">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${user.role === 'admin' ? 'bg-violet-600/10' : user.role === 'teacher' ? 'bg-blue-600/10' : 'bg-zinc-600/10'}`}>
                                                        <span className="text-sm font-bold text-heading">{(user.full_name || '?')[0].toUpperCase()}</span>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm text-heading font-medium truncate">{user.full_name || 'Unnamed'}</p>
                                                        <p className="text-xs text-muted">{user.email} {user.roll_number && <span className="ml-1 font-mono">· {user.roll_number}</span>}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <select value={user.role} onChange={e => handleRoleChange(user.id, e.target.value)}
                                                        className="px-2 py-1 bg-input border border-theme rounded-lg text-xs text-heading focus:border-violet-500/50 focus:outline-none">
                                                        <option value="student">Student</option>
                                                        <option value="teacher">Teacher</option>
                                                        <option value="admin">Admin</option>
                                                    </select>
                                                    {isTeacher && (
                                                        <button onClick={() => setEditingUser(isEditing ? null : user.id)}
                                                            className={`p-1.5 rounded-lg transition-colors ${isEditing ? 'bg-violet-600/10 text-violet-400' : 'text-muted hover:text-heading'}`}>
                                                            <Settings className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Teacher permission panel */}
                                            <AnimatePresence>
                                                {isTeacher && isEditing && (
                                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                                        className="overflow-hidden">
                                                        <div className="mt-3 pt-3 border-t border-theme">
                                                            <p className="text-xs font-semibold text-heading uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                                <Shield className="w-3.5 h-3.5 text-violet-400" /> Teacher Privileges
                                                            </p>
                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                                {[
                                                                    { key: 'can_create_subjects', label: 'Create Subjects', desc: 'Allow creating new subjects' },
                                                                    { key: 'can_edit_subjects', label: 'Edit Subjects', desc: 'Allow modifying & enrolling' },
                                                                    { key: 'can_delete_subjects', label: 'Delete Subjects', desc: 'Allow deleting subjects' },
                                                                ].map(perm => {
                                                                    const enabled = user[perm.key] !== false;
                                                                    return (
                                                                        <button key={perm.key}
                                                                            onClick={() => handleUpdatePermissions(user.id, { [perm.key]: !enabled })}
                                                                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${enabled
                                                                                ? 'bg-green-500/5 border-green-500/20 hover:border-green-500/30'
                                                                                : 'bg-red-500/5 border-red-500/20 hover:border-red-500/30'}`}>
                                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${enabled ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                                                                                {enabled ? <Unlock className="w-4 h-4 text-green-400" /> : <Lock className="w-4 h-4 text-red-400" />}
                                                                            </div>
                                                                            <div>
                                                                                <p className={`text-xs font-medium ${enabled ? 'text-green-400' : 'text-red-400'}`}>{perm.label}</p>
                                                                                <p className="text-[10px] text-muted">{perm.desc}</p>
                                                                            </div>
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}

                    {/* ACADEMIC */}
                    {activeTab === 'academic' && (
                        <motion.div key="academic" initial="hidden" animate="show" exit={{ opacity: 0 }} variants={stagger}>
                            {/* Regulations */}
                            <div className="mb-8">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-semibold text-heading flex items-center gap-2"><Shield className="w-4 h-4 text-violet-400" /> Regulations</h3>
                                    <button onClick={() => setShowRegForm(!showRegForm)} className="p-1.5 bg-violet-600/10 text-violet-400 rounded-lg hover:bg-violet-600/20"><Plus className="w-4 h-4" /></button>
                                </div>
                                <AnimatePresence>
                                    {showRegForm && (
                                        <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden" onSubmit={handleCreateRegulation}>
                                            <div className="bg-card border border-theme rounded-xl p-4 mb-4 flex flex-wrap gap-2 items-end">
                                                <div className="flex-1 min-w-[120px]"><label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Code</label>
                                                    <input value={newReg.code} onChange={e => setNewReg({ ...newReg, code: e.target.value })} placeholder="R22" className="w-full px-3 py-2 bg-input border border-theme rounded-lg text-heading text-sm focus:border-violet-500/50 focus:outline-none" /></div>
                                                <div className="flex-1 min-w-[180px]"><label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Name</label>
                                                    <input value={newReg.name} onChange={e => setNewReg({ ...newReg, name: e.target.value })} placeholder="Regulation 2022" className="w-full px-3 py-2 bg-input border border-theme rounded-lg text-heading text-sm focus:border-violet-500/50 focus:outline-none" /></div>
                                                <div className="w-24"><label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Year</label>
                                                    <input type="number" value={newReg.start_year} onChange={e => setNewReg({ ...newReg, start_year: +e.target.value })} className="w-full px-3 py-2 bg-input border border-theme rounded-lg text-heading text-sm focus:border-violet-500/50 focus:outline-none" /></div>
                                                <button type="submit" className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-500">Create</button>
                                            </div>
                                        </motion.form>
                                    )}
                                </AnimatePresence>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {regulations.map(reg => (
                                        <motion.div key={reg.id} variants={fadeUp} className="bg-card border border-theme rounded-xl p-4 group">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-heading font-semibold text-sm">{reg.code}</p>
                                                    <p className="text-xs text-muted">{reg.name} · {reg.start_year}</p>
                                                </div>
                                                <div className="flex gap-1">
                                                    <button onClick={() => { fetchCourses(reg.id); }} className="p-1.5 text-muted hover:text-violet-400 transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                                                    <button onClick={() => handleDeleteRegulation(reg.id)} className="p-1.5 text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>

                            {/* Courses */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-semibold text-heading flex items-center gap-2"><GraduationCap className="w-4 h-4 text-purple-400" /> Courses</h3>
                                    <button onClick={() => setShowCourseForm(!showCourseForm)} className="p-1.5 bg-violet-600/10 text-violet-400 rounded-lg hover:bg-violet-600/20"><Plus className="w-4 h-4" /></button>
                                </div>
                                <AnimatePresence>
                                    {showCourseForm && (
                                        <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden" onSubmit={handleCreateCourse}>
                                            <div className="bg-card border border-theme rounded-xl p-4 mb-4 flex flex-wrap gap-2 items-end">
                                                <div className="flex-1 min-w-[150px]"><label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Regulation</label>
                                                    <select value={newCourse.regulation_id} onChange={e => setNewCourse({ ...newCourse, regulation_id: e.target.value })}
                                                        className="w-full px-3 py-2 bg-input border border-theme rounded-lg text-heading text-sm focus:border-violet-500/50 focus:outline-none">
                                                        <option value="">Select</option>
                                                        {regulations.map(r => <option key={r.id} value={r.id}>{r.code}</option>)}
                                                    </select></div>
                                                <div className="flex-1 min-w-[180px]"><label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Name</label>
                                                    <input value={newCourse.name} onChange={e => setNewCourse({ ...newCourse, name: e.target.value })} placeholder="CSE AIML" className="w-full px-3 py-2 bg-input border border-theme rounded-lg text-heading text-sm focus:border-violet-500/50 focus:outline-none" /></div>
                                                <div className="w-24"><label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Code</label>
                                                    <input value={newCourse.code} onChange={e => setNewCourse({ ...newCourse, code: e.target.value })} placeholder="CSE" className="w-full px-3 py-2 bg-input border border-theme rounded-lg text-heading text-sm focus:border-violet-500/50 focus:outline-none" /></div>
                                                <div className="w-20"><label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Sems</label>
                                                    <input type="number" value={newCourse.total_semesters} onChange={e => setNewCourse({ ...newCourse, total_semesters: +e.target.value })} className="w-full px-3 py-2 bg-input border border-theme rounded-lg text-heading text-sm focus:border-violet-500/50 focus:outline-none" /></div>
                                                <button type="submit" className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-500">Create</button>
                                            </div>
                                        </motion.form>
                                    )}
                                </AnimatePresence>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {courses.map(c => (
                                        <motion.div key={c.id} variants={fadeUp} className="bg-card border border-theme rounded-xl p-4 group">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-heading font-semibold text-sm">{c.name}</p>
                                                    <p className="text-xs text-muted">{c.code} · {c.total_semesters} semesters</p>
                                                </div>
                                                <button onClick={() => handleDeleteCourse(c.id)} className="p-1.5 text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* SUBJECTS */}
                    {activeTab === 'subjects' && (
                        <motion.div key="subjects" initial="hidden" animate="show" exit={{ opacity: 0 }} variants={stagger}>
                            {subjects.length === 0 ? (
                                <div className="text-center py-16 border border-dashed border-theme rounded-2xl">
                                    <BookOpen className="w-12 h-12 text-faint mx-auto mb-3" /><p className="text-muted">No subjects created yet</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {subjects.map(sub => (
                                        <motion.div key={sub.id} variants={fadeUp} className="bg-card border border-theme rounded-xl p-4">
                                            <p className="text-heading font-semibold text-sm">{sub.name}</p>
                                            <p className="text-xs text-muted mt-0.5">{sub.code} · Y{sub.year} S{sub.semester} {sub.section && `· Sec ${sub.section}`}</p>
                                            <p className="text-xs text-muted mt-1">Teacher: <span className="text-body">{sub.profiles?.full_name || 'Unknown'}</span></p>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* BULK STUDENTS */}
                    {activeTab === 'bulk' && (
                        <motion.div key="bulk" initial="hidden" animate="show" exit={{ opacity: 0 }} variants={stagger}>
                            <div className="max-w-lg mx-auto">
                                <div className="bg-card border border-theme rounded-2xl p-6 space-y-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-8 h-8 rounded-lg bg-violet-600/10 flex items-center justify-center">
                                            <UserPlus className="w-4 h-4 text-violet-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-heading font-semibold text-sm">Create Student Accounts</h3>
                                            <p className="text-xs text-muted">Bulk-create student auth accounts by roll number range</p>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs uppercase tracking-wider text-muted mb-1.5 font-medium">Roll Number Prefix</label>
                                        <input value={bulkPrefix} onChange={e => setBulkPrefix(e.target.value.toUpperCase())} placeholder="e.g. 23011P05"
                                            className="w-full px-3 py-2.5 bg-input border border-theme rounded-xl text-heading text-sm placeholder-faint focus:outline-none focus:border-violet-500/50 uppercase" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs uppercase tracking-wider text-muted mb-1.5 font-medium">Start No.</label>
                                            <input type="number" value={bulkStart} onChange={e => setBulkStart(e.target.value)} placeholder="01"
                                                className="w-full px-3 py-2.5 bg-input border border-theme rounded-xl text-heading text-sm placeholder-faint focus:outline-none focus:border-violet-500/50" />
                                        </div>
                                        <div>
                                            <label className="block text-xs uppercase tracking-wider text-muted mb-1.5 font-medium">End No.</label>
                                            <input type="number" value={bulkEnd} onChange={e => setBulkEnd(e.target.value)} placeholder="60"
                                                className="w-full px-3 py-2.5 bg-input border border-theme rounded-xl text-heading text-sm placeholder-faint focus:outline-none focus:border-violet-500/50" />
                                        </div>
                                    </div>

                                    <div className="border-t border-theme pt-3">
                                        <p className="text-xs text-muted font-medium uppercase tracking-wider mb-2">Academic Context (optional)</p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <select value={bulkRegulation} onChange={e => { setBulkRegulation(e.target.value); fetchCourses(e.target.value); }}
                                                className="px-3 py-2 bg-input border border-theme rounded-lg text-heading text-sm focus:border-violet-500/50 focus:outline-none">
                                                <option value="">Regulation</option>
                                                {regulations.map(r => <option key={r.id} value={r.id}>{r.code}</option>)}
                                            </select>
                                            <select value={bulkCourse} onChange={e => setBulkCourse(e.target.value)}
                                                className="px-3 py-2 bg-input border border-theme rounded-lg text-heading text-sm focus:border-violet-500/50 focus:outline-none">
                                                <option value="">Course</option>
                                                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                            <div>
                                                <label className="block text-[10px] text-muted uppercase mb-1">Year</label>
                                                <input type="number" min={1} max={6} value={bulkYear} onChange={e => setBulkYear(+e.target.value)}
                                                    className="w-full px-3 py-2 bg-input border border-theme rounded-lg text-heading text-sm focus:border-violet-500/50 focus:outline-none" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-muted uppercase mb-1">Semester</label>
                                                <input type="number" min={1} max={2} value={bulkSemester} onChange={e => setBulkSemester(+e.target.value)}
                                                    className="w-full px-3 py-2 bg-input border border-theme rounded-lg text-heading text-sm focus:border-violet-500/50 focus:outline-none" />
                                            </div>
                                        </div>
                                    </div>

                                    {bulkPrefix && bulkStart && bulkEnd && (() => {
                                        const s = parseInt(bulkStart), e = parseInt(bulkEnd);
                                        if (!isNaN(s) && !isNaN(e) && s <= e) {
                                            const count = e - s + 1;
                                            return (
                                                <div className="bg-violet-600/5 border border-violet-500/10 rounded-xl p-3">
                                                    <p className="text-xs text-muted">
                                                        Will create <span className="text-violet-400 font-bold">{count}</span> accounts:
                                                        <span className="text-heading font-mono ml-1">{bulkPrefix}{String(s).padStart(2, '0')}</span> → <span className="text-heading font-mono">{bulkPrefix}{String(e).padStart(2, '0')}</span>
                                                    </p>
                                                    <p className="text-[10px] text-muted mt-1">Default password: <code className="text-violet-400">test1234</code>. Existing roll numbers will be skipped.</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}

                                    <button onClick={handleBulkCreate} disabled={bulkLoading}
                                        className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:from-violet-500 hover:to-purple-500 transition-all disabled:opacity-50 shadow-lg shadow-violet-600/20">
                                        {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                                        {bulkLoading ? 'Creating...' : 'Create Student Accounts'}
                                    </button>

                                    {bulkResult && (
                                        <div className="bg-card border border-theme rounded-xl p-4 space-y-2">
                                            <p className="text-sm text-heading font-semibold">Results</p>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-2 text-center">
                                                    <p className="text-green-400 font-bold text-lg">{bulkResult.total_created}</p>
                                                    <p className="text-muted">Created</p>
                                                </div>
                                                <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-2 text-center">
                                                    <p className="text-amber-400 font-bold text-lg">{bulkResult.total_skipped}</p>
                                                    <p className="text-muted">Skipped</p>
                                                </div>
                                            </div>
                                            {bulkResult.errors?.length > 0 && (
                                                <div className="text-xs text-red-400 mt-2">
                                                    {bulkResult.errors.map((e, i) => <p key={i}>{e.roll_number}: {e.error}</p>)}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <ChangePassword isOpen={showChangePassword} onClose={() => setShowChangePassword(false)} />
        </div>
    );
};

export default AdminDashboard;
