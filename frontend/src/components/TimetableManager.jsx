import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
    Upload, Plus, Trash2, CalendarDays, Loader2, FileImage,
    FileText, Download, X, Eye, Edit3, Clock
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const API_URL = 'http://localhost:5001/api';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.04 } }
};

const item = {
    hidden: { opacity: 0, scale: 0.95, y: 10 },
    show: { opacity: 1, scale: 1, y: 0 }
};

export default function TimetableManager() {
    const [timetables, setTimetables] = useState([]);
    const [uploads, setUploads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState('entries'); // 'entries' or 'uploads'

    // New entry form state
    const [newEntry, setNewEntry] = useState({
        class_name: '', day_of_week: 1, start_time: '09:00', end_time: '10:00'
    });

    // Edit entry state
    const [editingId, setEditingId] = useState(null);
    const [editEntry, setEditEntry] = useState({});

    // Upload form state
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadTitle, setUploadTitle] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    // Preview modal state
    const [previewUrl, setPreviewUrl] = useState(null);
    const [previewType, setPreviewType] = useState(null);

    const getAuthHeaders = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json'
        };
    };

    const getAuthToken = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token;
    };

    // ── Fetch Functions ──
    const fetchTimetables = async () => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`${API_URL}/timetables`, { headers });
            if (!res.ok) throw new Error("Failed to fetch timetables");
            const data = await res.json();
            setTimetables(Array.isArray(data) ? data : []);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchUploads = async () => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`${API_URL}/timetables/uploads`, { headers });
            if (!res.ok) throw new Error("Failed to fetch uploads");
            const data = await res.json();
            setUploads(Array.isArray(data) ? data : []);
        } catch (error) {
            toast.error(error.message);
        }
    };

    useEffect(() => {
        fetchTimetables();
        fetchUploads();
    }, []);

    // ── In-App Entry CRUD ──
    const handleAddEntry = async (e) => {
        e.preventDefault();
        if (newEntry.start_time >= newEntry.end_time) {
            toast.error("Start time must be before end time");
            return;
        }
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`${API_URL}/timetables`, {
                method: 'POST',
                headers,
                body: JSON.stringify(newEntry)
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to add entry");
            }
            toast.success("Timetable entry added");
            setNewEntry({ ...newEntry, class_name: '' });
            fetchTimetables();
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handleUpdate = async (id) => {
        if (editEntry.start_time >= editEntry.end_time) {
            toast.error("Start time must be before end time");
            return;
        }
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`${API_URL}/timetables/${id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(editEntry)
            });
            if (!res.ok) throw new Error("Failed to update");
            toast.success("Entry updated");
            setEditingId(null);
            fetchTimetables();
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handleDelete = async (id) => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`${API_URL}/timetables/${id}`, { method: 'DELETE', headers });
            if (!res.ok) throw new Error("Failed to delete");
            toast.success("Deleted successfully");
            fetchTimetables();
        } catch (error) {
            toast.error(error.message);
        }
    };

    // ── File Upload Functions ──
    const handleFileUpload = async (e) => {
        e.preventDefault();
        if (!uploadFile) {
            toast.error("Please select a file");
            return;
        }
        if (!uploadTitle.trim()) {
            toast.error("Please enter a title");
            return;
        }

        setIsUploading(true);
        try {
            const token = await getAuthToken();
            const formData = new FormData();
            formData.append('file', uploadFile);
            formData.append('title', uploadTitle);

            const res = await fetch(`${API_URL}/timetables/uploads`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Upload failed");
            }

            toast.success("Timetable uploaded successfully!");
            setUploadFile(null);
            setUploadTitle('');
            fetchUploads();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleDeleteUpload = async (id) => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`${API_URL}/timetables/uploads/${id}`, { method: 'DELETE', headers });
            if (!res.ok) throw new Error("Failed to delete upload");
            toast.success("Upload deleted");
            fetchUploads();
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handlePreview = async (id) => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`${API_URL}/timetables/uploads/${id}`, { headers });
            if (!res.ok) throw new Error("Failed to load preview");
            const data = await res.json();
            setPreviewUrl(data.signedUrl);
            setPreviewType(data.file_type);
        } catch (error) {
            toast.error(error.message);
        }
    };

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    if (loading) {
        return (
            <div className="flex justify-center p-10">
                <Loader2 className="animate-spin text-blue-500 w-8 h-8" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* View Switcher */}
            <div className="flex bg-white rounded-2xl shadow-sm border border-slate-200 p-1">
                <button
                    onClick={() => setActiveView('entries')}
                    className={`flex-1 py-2.5 rounded-xl text-sm justify-center font-medium flex items-center gap-2 transition-all ${activeView === 'entries' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                    <CalendarDays className="w-4 h-4" /> Weekly Schedule
                </button>
                <button
                    onClick={() => setActiveView('uploads')}
                    className={`flex-1 py-2.5 rounded-xl text-sm justify-center font-medium flex items-center gap-2 transition-all ${activeView === 'uploads' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                    <Upload className="w-4 h-4" /> Uploaded Timetables
                    {uploads.length > 0 && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeView === 'uploads' ? 'bg-white/20' : 'bg-indigo-100 text-indigo-600'}`}>
                            {uploads.length}
                        </span>
                    )}
                </button>
            </div>

            {/* ── IN-APP ENTRIES VIEW ── */}
            {activeView === 'entries' && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-6">
                        <CalendarDays className="text-indigo-600" />
                        Weekly Timetable
                    </h2>

                    {/* Add Entry Form */}
                    <form onSubmit={handleAddEntry} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
                        <div className="md:col-span-1">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Class Name</label>
                            <input required type="text" value={newEntry.class_name}
                                onChange={e => setNewEntry({ ...newEntry, class_name: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                placeholder="e.g. Physics 101" />
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Day</label>
                            <select value={newEntry.day_of_week}
                                onChange={e => setNewEntry({ ...newEntry, day_of_week: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none">
                                {DAYS.map((day, idx) => <option key={idx} value={idx}>{day}</option>)}
                            </select>
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Start Time</label>
                            <input required type="time" value={newEntry.start_time}
                                onChange={e => setNewEntry({ ...newEntry, start_time: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                        <div className="md:col-span-1">
                            <label className="block text-xs font-semibold text-slate-600 mb-1">End Time</label>
                            <input required type="time" value={newEntry.end_time}
                                onChange={e => setNewEntry({ ...newEntry, end_time: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                        <div className="md:col-span-1">
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.97 }}
                                type="submit"
                                className="w-full bg-indigo-600 text-white font-medium py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-indigo-700 transition shadow-md shadow-indigo-500/20"
                            >
                                <Plus className="w-4 h-4" /> Add
                            </motion.button>
                        </div>
                    </form>

                    {/* Timetable Display */}
                    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
                        {DAYS.map((day, dayIdx) => {
                            const dayClasses = timetables.filter(t => t.day_of_week === dayIdx);
                            if (dayClasses.length === 0) return null;

                            return (
                                <motion.div key={dayIdx} variants={item}>
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">{day}</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                        {dayClasses.map(cls => (
                                            <motion.div
                                                key={cls.id}
                                                variants={item}
                                                whileHover={{ scale: 1.02 }}
                                                className="border border-slate-200 bg-white p-3 rounded-xl flex justify-between items-center group relative overflow-hidden"
                                            >
                                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>
                                                {editingId === cls.id ? (
                                                    <div className="flex-1 flex items-center gap-2 pl-2">
                                                        <input type="text" value={editEntry.class_name}
                                                            onChange={e => setEditEntry({ ...editEntry, class_name: e.target.value })}
                                                            className="text-sm border rounded px-1 py-0.5 w-24" />
                                                        <input type="time" value={editEntry.start_time}
                                                            onChange={e => setEditEntry({ ...editEntry, start_time: e.target.value })}
                                                            className="text-xs border rounded px-1 py-0.5 w-20" />
                                                        <span className="text-slate-400">–</span>
                                                        <input type="time" value={editEntry.end_time}
                                                            onChange={e => setEditEntry({ ...editEntry, end_time: e.target.value })}
                                                            className="text-xs border rounded px-1 py-0.5 w-20" />
                                                        <button onClick={() => handleUpdate(cls.id)}
                                                            className="text-emerald-600 hover:text-emerald-700 text-xs font-bold">Save</button>
                                                        <button onClick={() => setEditingId(null)}
                                                            className="text-slate-400 hover:text-slate-600 text-xs">Cancel</button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="pl-2">
                                                            <p className="font-semibold text-slate-800 text-sm">{cls.class_name}</p>
                                                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                                                <Clock className="w-3 h-3" />
                                                                {cls.start_time?.substring(0, 5)} – {cls.end_time?.substring(0, 5)}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => { setEditingId(cls.id); setEditEntry({ class_name: cls.class_name, start_time: cls.start_time?.substring(0, 5), end_time: cls.end_time?.substring(0, 5), day_of_week: cls.day_of_week }); }}
                                                                className="text-slate-300 hover:text-indigo-500 transition-colors p-1">
                                                                <Edit3 className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button onClick={() => handleDelete(cls.id)}
                                                                className="text-slate-300 hover:text-red-500 transition-colors p-1">
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </motion.div>
                                        ))}
                                    </div>
                                </motion.div>
                            );
                        })}
                        {timetables.length === 0 && (
                            <div className="text-center py-10 text-slate-400 border-2 border-dashed rounded-xl">
                                <CalendarDays className="w-10 h-10 mx-auto opacity-30 mb-3" />
                                <p className="font-medium">No timetable entries yet</p>
                                <p className="text-sm mt-1">Add classes using the form above.</p>
                            </div>
                        )}
                    </motion.div>
                </div>
            )}

            {/* ── UPLOADS VIEW ── */}
            {activeView === 'uploads' && (
                <div className="space-y-6">
                    {/* Upload Form */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-6">
                            <Upload className="text-indigo-600" />
                            Upload Timetable
                        </h2>

                        <form onSubmit={handleFileUpload} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Title</label>
                                    <input
                                        type="text"
                                        value={uploadTitle}
                                        onChange={e => setUploadTitle(e.target.value)}
                                        required
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-slate-50 focus:bg-white transition-all"
                                        placeholder="e.g. Semester 2 Timetable"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">File (Image or PDF)</label>
                                    <div className="relative">
                                        <input
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp,application/pdf"
                                            onChange={e => setUploadFile(e.target.files[0] || null)}
                                            className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700 file:font-medium file:text-sm hover:file:bg-indigo-100 transition-all cursor-pointer"
                                        />
                                    </div>
                                    {uploadFile && (
                                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                            {uploadFile.type.startsWith('image/') ? <FileImage className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                                            {uploadFile.name} ({formatFileSize(uploadFile.size)})
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.97 }}
                                    type="submit"
                                    disabled={isUploading}
                                    className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 shadow-md shadow-indigo-500/20 hover:bg-indigo-700 transition disabled:opacity-70"
                                >
                                    {isUploading ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                                    ) : (
                                        <><Upload className="w-4 h-4" /> Upload Timetable</>
                                    )}
                                </motion.button>
                            </div>
                        </form>
                    </div>

                    {/* Uploaded Files List */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">Uploaded Files</h3>

                        {uploads.length > 0 ? (
                            <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
                                {uploads.map(upload => (
                                    <motion.div
                                        key={upload.id}
                                        variants={item}
                                        className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-200 transition-colors group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2.5 rounded-xl ${upload.file_type?.startsWith('image/') ? 'bg-purple-50 text-purple-600' : 'bg-rose-50 text-rose-600'}`}>
                                                {upload.file_type?.startsWith('image/') ? <FileImage className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-800">{upload.title}</p>
                                                <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                                                    <span>{upload.file_type?.split('/')[1]?.toUpperCase()}</span>
                                                    <span>•</span>
                                                    <span>{formatFileSize(upload.file_size_bytes)}</span>
                                                    <span>•</span>
                                                    <span>{new Date(upload.created_at).toLocaleDateString()}</span>
                                                    {upload.profiles?.full_name && (
                                                        <>
                                                            <span>•</span>
                                                            <span>by {upload.profiles.full_name}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <motion.button
                                                whileHover={{ scale: 1.1 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={() => handlePreview(upload.id)}
                                                className="p-2 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors"
                                                title="Preview"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </motion.button>
                                            <motion.button
                                                whileHover={{ scale: 1.1 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={() => handleDeleteUpload(upload.id)}
                                                className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </motion.button>
                                        </div>
                                    </motion.div>
                                ))}
                            </motion.div>
                        ) : (
                            <div className="text-center py-10 text-slate-400 border-2 border-dashed rounded-xl">
                                <Upload className="w-10 h-10 mx-auto opacity-30 mb-3" />
                                <p className="font-medium">No uploaded timetables</p>
                                <p className="text-sm mt-1">Upload a photo or PDF of your class timetable.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── PREVIEW MODAL ── */}
            <AnimatePresence>
                {previewUrl && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
                        onClick={() => { setPreviewUrl(null); setPreviewType(null); }}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between p-4 border-b border-slate-100">
                                <h3 className="font-bold text-slate-800">Timetable Preview</h3>
                                <div className="flex items-center gap-2">
                                    <a href={previewUrl} target="_blank" rel="noopener noreferrer"
                                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-slate-700">
                                        <Download className="w-4 h-4" />
                                    </a>
                                    <button onClick={() => { setPreviewUrl(null); setPreviewType(null); }}
                                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-slate-700">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-50">
                                {previewType?.startsWith('image/') ? (
                                    <img src={previewUrl} alt="Timetable" className="max-w-full max-h-[70vh] rounded-lg shadow-md object-contain" />
                                ) : (
                                    <iframe src={previewUrl} className="w-full h-[70vh] rounded-lg border border-slate-200" title="PDF Preview" />
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
