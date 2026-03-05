import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useAcademic } from '../context/AcademicContext';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';
import ChangePassword from '../components/ChangePassword';
import {
    BookOpen, Users, Calendar, Download, Plus, Trash2, Search,
    LogOut, ChevronRight, Check, X, Loader2, Lock, UserPlus, Key
} from 'lucide-react';
import { toast } from 'sonner';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const TeacherDashboard = () => {
    const { profile, session, logout } = useAuth();
    const { regulations, courses, fetchCourses } = useAcademic();
    const { isDark } = useTheme();
    const headers = { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' };

    // Permissions from profile
    const canCreate = profile?.can_create_subjects !== false;
    const canEdit = profile?.can_edit_subjects !== false;
    const canDelete = profile?.can_delete_subjects === true;

    const [subjects, setSubjects] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState(null);
    const [students, setStudents] = useState([]);
    const [absentIds, setAbsentIds] = useState(new Set());
    const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newSubject, setNewSubject] = useState({ regulation_id: '', course_id: '', year: 1, semester: 1, name: '', code: '', section: '' });
    const [newRollNumber, setNewRollNumber] = useState('');
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkPrefix, setBulkPrefix] = useState('');
    const [bulkStart, setBulkStart] = useState('');
    const [bulkEnd, setBulkEnd] = useState('');
    const [bulkLoading, setBulkLoading] = useState(false);
    const [showChangePassword, setShowChangePassword] = useState(false);

    const fetchSubjects = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/subjects`, { headers });
            const data = await res.json();
            setSubjects(Array.isArray(data) ? data : []);
        } catch { toast.error('Failed to load subjects'); }
        finally { setLoading(false); }
    }, [session?.access_token]);

    useEffect(() => { if (session?.access_token) fetchSubjects(); }, [session?.access_token]);

    const fetchStudents = async (subjectId) => {
        try {
            const res = await fetch(`${API_BASE}/api/subjects/${subjectId}/students`, { headers });
            const data = await res.json();
            setStudents(Array.isArray(data) ? data : []);
        } catch { toast.error('Failed to load roster'); }
    };

    const fetchAbsences = async (subjectId, date) => {
        try {
            const res = await fetch(`${API_BASE}/api/attendance?subjectId=${subjectId}&date=${date}`, { headers });
            const data = await res.json();
            setAbsentIds(new Set((data || []).map(a => a.student_id)));
        } catch { /* silent */ }
    };

    const handleSelectSubject = async (sub) => {
        setSelectedSubject(sub);
        await fetchStudents(sub.id);
        await fetchAbsences(sub.id, attendanceDate);
    };

    const toggleAbsent = (sid) => setAbsentIds(prev => { const n = new Set(prev); n.has(sid) ? n.delete(sid) : n.add(sid); return n; });

    const saveAttendance = async () => {
        if (!selectedSubject) return;
        setSaving(true);
        try {
            const res = await fetch(`${API_BASE}/api/attendance`, {
                method: 'POST', headers,
                body: JSON.stringify({ subjectId: selectedSubject.id, date: attendanceDate, absentStudentIds: Array.from(absentIds) })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast.success('Attendance saved!');
        } catch (err) { toast.error(err.message); }
        finally { setSaving(false); }
    };

    const handleCreateSubject = async (e) => {
        e.preventDefault();
        if (!canCreate) return toast.error('You do not have permission to create subjects');
        try {
            const res = await fetch(`${API_BASE}/api/subjects`, { method: 'POST', headers, body: JSON.stringify(newSubject) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast.success('Subject created'); setShowCreateForm(false);
            setNewSubject({ regulation_id: '', course_id: '', year: 1, semester: 1, name: '', code: '', section: '' });
            fetchSubjects();
        } catch (err) { toast.error(err.message); }
    };

    const handleAddStudent = async () => {
        if (!newRollNumber || !selectedSubject) return;
        try {
            const res = await fetch(`${API_BASE}/api/subjects/${selectedSubject.id}/students`, { method: 'POST', headers, body: JSON.stringify({ roll_number: newRollNumber }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast.success('Student added'); setNewRollNumber('');
            fetchStudents(selectedSubject.id);
        } catch (err) { toast.error(err.message); }
    };

    const handleRemoveStudent = async (stuId) => {
        try { await fetch(`${API_BASE}/api/subjects/${selectedSubject.id}/students/${stuId}`, { method: 'DELETE', headers }); toast.success('Removed'); fetchStudents(selectedSubject.id); }
        catch { toast.error('Failed'); }
    };

    const handleDeleteSubject = async (subId) => {
        if (!canDelete) return toast.error('You do not have permission to delete subjects');
        try {
            await fetch(`${API_BASE}/api/subjects/${subId}`, { method: 'DELETE', headers }); toast.success('Deleted'); fetchSubjects();
            if (selectedSubject?.id === subId) setSelectedSubject(null);
        } catch { toast.error('Failed'); }
    };

    const handleExport = async (subId) => {
        try {
            const res = await fetch(`${API_BASE}/api/subjects/${subId}/export`, { headers });
            const blob = await res.blob(); const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'attendance.csv'; a.click();
        } catch { toast.error('Export failed'); }
    };

    const handleBulkAdd = async () => {
        if (!selectedSubject || !bulkPrefix || !bulkStart || !bulkEnd) return toast.error('Fill all fields');
        setBulkLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/subjects/${selectedSubject.id}/students/bulk`, {
                method: 'POST', headers,
                body: JSON.stringify({ prefix: bulkPrefix, start: bulkStart, end: bulkEnd })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast.success(`Enrolled ${data.total_enrolled} students (${data.total_created} new accounts created)`);
            if (data.errors?.length > 0) toast.warning(`${data.errors.length} errors occurred`);
            setShowBulkModal(false);
            fetchStudents(selectedSubject.id);
        } catch (err) { toast.error(err.message); }
        finally { setBulkLoading(false); }
    };

    const bulkPreview = () => {
        if (!bulkPrefix || !bulkStart || !bulkEnd) return [];
        const s = parseInt(bulkStart), e = parseInt(bulkEnd);
        if (isNaN(s) || isNaN(e) || s > e) return [];
        const count = e - s + 1;
        const padWidth = bulkEnd.length;
        return { count, first: `${bulkPrefix.toUpperCase()}${String(s).padStart(padWidth, '0')}`, last: `${bulkPrefix.toUpperCase()}${String(e).padStart(padWidth, '0')}` };
    };

    const filteredStudents = students.filter(s => {
        if (!searchQuery) return true;
        return (s.profiles?.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (s.profiles?.roll_number || '').toLowerCase().includes(searchQuery.toLowerCase());
    });

    const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
    const fadeUp = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } };

    return (
        <div className="min-h-screen bg-page">
            <header className="sticky top-0 z-50 nav-bg backdrop-blur-xl border-b border-theme">
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-violet-500" />
                        <span className="text-sm font-bold text-heading tracking-tight">ATTENDEASE</span>
                        <span className="text-xs text-muted">/ Teacher</span>
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
                {/* Permission notice */}
                {(!canCreate || !canEdit) && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4 flex items-center gap-2 text-xs text-amber-400">
                        <Lock className="w-4 h-4" />
                        <span>Some actions are restricted by your admin. {!canCreate && 'Cannot create subjects.'} {!canEdit && 'Cannot edit subjects.'}</span>
                    </div>
                )}

                <div className="flex gap-6 flex-col lg:flex-row">
                    {/* Left: Subject List */}
                    <div className="lg:w-80 shrink-0">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-semibold text-heading flex items-center gap-2"><BookOpen className="w-4 h-4 text-violet-400" /> My Subjects</h2>
                            {canCreate && (
                                <button onClick={() => setShowCreateForm(!showCreateForm)} className="p-1.5 bg-violet-600/10 text-violet-400 rounded-lg hover:bg-violet-600/20 transition-colors">
                                    <Plus className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        <AnimatePresence>
                            {showCreateForm && canCreate && (
                                <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden" onSubmit={handleCreateSubject}>
                                    <div className="bg-card border border-theme rounded-xl p-4 mb-4 space-y-3">
                                        <select value={newSubject.regulation_id} onChange={e => { setNewSubject({ ...newSubject, regulation_id: e.target.value, course_id: '' }); fetchCourses(e.target.value); }}
                                            className="w-full px-3 py-2 bg-input border border-theme rounded-lg text-heading text-sm focus:border-violet-500/50 focus:outline-none">
                                            <option value="">Select Regulation</option>
                                            {regulations.map(r => <option key={r.id} value={r.id}>{r.code} — {r.name}</option>)}
                                        </select>
                                        <select value={newSubject.course_id} onChange={e => setNewSubject({ ...newSubject, course_id: e.target.value })}
                                            className="w-full px-3 py-2 bg-input border border-theme rounded-lg text-heading text-sm focus:border-violet-500/50 focus:outline-none">
                                            <option value="">Select Course</option>
                                            {courses.filter(c => c.regulation_id === newSubject.regulation_id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                        <div className="grid grid-cols-2 gap-2">
                                            <select value={newSubject.year} onChange={e => setNewSubject({ ...newSubject, year: +e.target.value })}
                                                className="px-3 py-2 bg-input border border-theme rounded-lg text-heading text-sm focus:border-violet-500/50 focus:outline-none">
                                                {[1, 2, 3, 4, 5].map(y => <option key={y} value={y}>Year {y}</option>)}
                                            </select>
                                            <select value={newSubject.semester} onChange={e => setNewSubject({ ...newSubject, semester: +e.target.value })}
                                                className="px-3 py-2 bg-input border border-theme rounded-lg text-heading text-sm focus:border-violet-500/50 focus:outline-none">
                                                <option value={1}>Sem 1</option><option value={2}>Sem 2</option>
                                            </select>
                                        </div>
                                        <input value={newSubject.name} onChange={e => setNewSubject({ ...newSubject, name: e.target.value })}
                                            placeholder="Subject Name" className="w-full px-3 py-2 bg-input border border-theme rounded-lg text-heading text-sm placeholder-faint focus:border-violet-500/50 focus:outline-none" />
                                        <div className="grid grid-cols-2 gap-2">
                                            <input value={newSubject.code} onChange={e => setNewSubject({ ...newSubject, code: e.target.value })}
                                                placeholder="Code" className="px-3 py-2 bg-input border border-theme rounded-lg text-heading text-sm placeholder-faint focus:border-violet-500/50 focus:outline-none" />
                                            <input value={newSubject.section} onChange={e => setNewSubject({ ...newSubject, section: e.target.value })}
                                                placeholder="Section" className="px-3 py-2 bg-input border border-theme rounded-lg text-heading text-sm placeholder-faint focus:border-violet-500/50 focus:outline-none" />
                                        </div>
                                        <button type="submit" className="w-full py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-500 transition-colors">Create Subject</button>
                                    </div>
                                </motion.form>
                            )}
                        </AnimatePresence>

                        {loading ? (
                            <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-card rounded-xl animate-pulse" />)}</div>
                        ) : subjects.length === 0 ? (
                            <div className="text-center py-8 border border-dashed border-theme rounded-xl">
                                <BookOpen className="w-8 h-8 text-faint mx-auto mb-2" /><p className="text-muted text-sm">No subjects yet</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {subjects.map(sub => (
                                    <motion.div key={sub.id} whileHover={{ x: 2 }} onClick={() => handleSelectSubject(sub)}
                                        className={`bg-card border rounded-xl p-3 cursor-pointer group transition-all ${selectedSubject?.id === sub.id ? 'border-violet-500/30 bg-violet-600/5' : 'border-theme hover:border-violet-500/10'}`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-heading font-medium truncate">{sub.name}</p>
                                                <p className="text-xs text-muted flex items-center gap-1.5 mt-0.5"><span>{sub.code}</span>{sub.section && <span>· Sec {sub.section}</span>}<span>· Y{sub.year} S{sub.semester}</span></p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button onClick={(e) => { e.stopPropagation(); handleExport(sub.id); }} className="p-1.5 text-muted hover:text-violet-400 transition-colors opacity-0 group-hover:opacity-100"><Download className="w-3.5 h-3.5" /></button>
                                                {canDelete && <button onClick={(e) => { e.stopPropagation(); handleDeleteSubject(sub.id); }} className="p-1.5 text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5" /></button>}
                                                <ChevronRight className="w-4 h-4 text-muted" />
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right: Attendance marking */}
                    <div className="flex-1 min-w-0">
                        {!selectedSubject ? (
                            <div className="flex items-center justify-center h-96 border border-dashed border-theme rounded-2xl">
                                <div className="text-center"><BookOpen className="w-12 h-12 text-faint mx-auto mb-3" /><p className="text-muted">Select a subject to mark attendance</p></div>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                                    <div>
                                        <h2 className="text-lg font-bold text-heading">{selectedSubject.name}</h2>
                                        <p className="text-xs text-muted">{selectedSubject.code}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input type="date" value={attendanceDate} onChange={e => { setAttendanceDate(e.target.value); fetchAbsences(selectedSubject.id, e.target.value); }}
                                            className="px-3 py-2 bg-card border border-theme rounded-lg text-heading text-sm focus:border-violet-500/50 focus:outline-none" />
                                        <button onClick={saveAttendance} disabled={saving}
                                            className="px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-violet-600/20">
                                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                            {saving ? 'Saving...' : 'Save'}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 mb-4">
                                    <span className="text-xs text-muted">Absent: <span className="text-red-400 font-bold">{absentIds.size}</span> / {students.length}</span>
                                    <span className="text-xs text-muted">Present: <span className="text-green-400 font-bold">{students.length - absentIds.size}</span></span>
                                    {canEdit && (
                                        <div className="ml-auto flex items-center gap-2">
                                            <input value={newRollNumber} onChange={e => setNewRollNumber(e.target.value.toUpperCase())} placeholder="Add by Roll No"
                                                className="px-3 py-1.5 bg-card border border-theme rounded-lg text-heading text-xs focus:border-violet-500/50 focus:outline-none w-36"
                                                onKeyDown={e => e.key === 'Enter' && handleAddStudent()} />
                                            <button onClick={handleAddStudent} className="p-1.5 bg-violet-600/10 text-violet-400 rounded-lg hover:bg-violet-600/20"><Plus className="w-4 h-4" /></button>
                                            <button onClick={() => setShowBulkModal(true)} className="px-3 py-1.5 bg-violet-600/10 text-violet-400 rounded-lg hover:bg-violet-600/20 text-xs font-medium flex items-center gap-1">
                                                <UserPlus className="w-3.5 h-3.5" /> Bulk Add
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="relative mb-4">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search students..."
                                        className="w-full pl-10 pr-4 py-2.5 bg-card border border-theme rounded-xl text-heading text-sm placeholder-faint focus:border-violet-500/50 focus:outline-none" />
                                </div>

                                {filteredStudents.length === 0 ? (
                                    <div className="text-center py-12 border border-dashed border-theme rounded-xl">
                                        <Users className="w-8 h-8 text-faint mx-auto mb-2" /><p className="text-muted text-sm">No students enrolled</p>
                                    </div>
                                ) : (
                                    <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                                        {filteredStudents.map(s => {
                                            const isAbsent = absentIds.has(s.student_id);
                                            return (
                                                <motion.div key={s.student_id} variants={fadeUp} onClick={() => toggleAbsent(s.student_id)}
                                                    className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 select-none ${isAbsent ? 'bg-red-500/10 border-red-500/30' : 'bg-card border-theme hover:border-violet-500/10'}`}>
                                                    <div className="flex items-center justify-between">
                                                        <div className="min-w-0">
                                                            <p className="text-sm text-heading font-medium truncate">{s.profiles?.full_name}</p>
                                                            <p className="text-xs text-muted font-mono">{s.profiles?.roll_number}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {isAbsent && <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] font-bold uppercase">Absent</span>}
                                                            {canEdit && <button onClick={(e) => { e.stopPropagation(); handleRemoveStudent(s.student_id); }} className="p-1 text-faint hover:text-red-400 transition-colors"><X className="w-3.5 h-3.5" /></button>}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </motion.div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Bulk Add Modal */}
            <AnimatePresence>
                {showBulkModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
                        onClick={() => setShowBulkModal(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="w-full max-w-md mx-4 bg-elevated border border-violet-500/10 rounded-2xl p-6 shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-5">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-violet-600/10 flex items-center justify-center">
                                        <UserPlus className="w-4 h-4 text-violet-400" />
                                    </div>
                                    <h3 className="text-heading font-semibold text-sm">Add Students in Bulk</h3>
                                </div>
                                <button onClick={() => setShowBulkModal(false)} className="p-1.5 text-muted hover:text-heading rounded-lg transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="space-y-3">
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

                                {(() => {
                                    const preview = bulkPreview();
                                    if (preview && preview.count) {
                                        return (
                                            <div className="bg-violet-600/5 border border-violet-500/10 rounded-xl p-3">
                                                <p className="text-xs text-muted">
                                                    Will generate <span className="text-violet-400 font-bold">{preview.count}</span> roll numbers:
                                                    <span className="text-heading font-mono ml-1">{preview.first}</span> → <span className="text-heading font-mono">{preview.last}</span>
                                                </p>
                                                {/* <p className="text-[10px] text-muted mt-1">Students not in DB will be auto-created with password <code className="text-violet-400">test1234</code></p> */}
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}

                                <button onClick={handleBulkAdd} disabled={bulkLoading}
                                    className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:from-violet-500 hover:to-purple-500 transition-all disabled:opacity-50 shadow-lg shadow-violet-600/20">
                                    {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                                    {bulkLoading ? 'Adding Students...' : 'Add Students'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <ChangePassword isOpen={showChangePassword} onClose={() => setShowChangePassword(false)} />
        </div>
    );
};

export default TeacherDashboard;

