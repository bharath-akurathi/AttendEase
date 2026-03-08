import express from 'express';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../middleware/authMiddleware.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

const router = express.Router();
router.use(requireAuth);

// Multer config for file uploads (disk storage to prevent Node memory exhaustion)
const upload = multer({
    storage: multer.diskStorage({
        destination: os.tmpdir(),
        filename: (req, file, cb) => {
            const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
            cb(null, `${Date.now()}-${safeName}`);
        }
    }),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Unsupported file type. Only JPEG, PNG, WebP, and PDF are allowed.'), false);
        }
    }
});

// Helper: check if user is teacher or admin by querying profiles
const checkTeacherOrAdmin = async (req) => {
    const { data: profile } = await req.supabase
        .from('profiles')
        .select('role')
        .eq('id', req.user.sub)
        .single();
    return profile?.role === 'teacher' || profile?.role === 'admin';
};

// ────────────────────────────────────────────
// IN-APP TIMETABLE ENTRIES (CRUD)
// ────────────────────────────────────────────

// GET: List timetable entries for the current user
router.get('/', async (req, res) => {
    try {
        let query = req.supabase
            .from('timetables')
            .select('*, subjects(name, code)')
            .order('day_of_week', { ascending: true })
            .order('start_time', { ascending: true });

        if (req.query.subjectId) query = query.eq('subject_id', req.query.subjectId);

        const { data, error } = await query;
        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST: Create a new timetable entry
router.post('/', async (req, res) => {
    if (!await checkTeacherOrAdmin(req)) {
        return res.status(403).json({ error: 'Only teachers and admins can create timetable entries' });
    }

    try {
        const { subject_id, day_of_week, start_time, end_time, room } = req.body;

        if (!subject_id) return res.status(400).json({ error: 'subject_id required' });

        // Validate times
        if (start_time >= end_time) {
            return res.status(400).json({ error: 'Start time must be before end time' });
        }

        const { data, error } = await req.supabase
            .from('timetables')
            .insert([{
                teacher_id: req.user.sub,
                subject_id,
                day_of_week,
                start_time,
                end_time,
                room: room || null
            }])
            .select('*, subjects(name, code)')
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT: Update a timetable entry
router.put('/:id', async (req, res) => {
    if (!await checkTeacherOrAdmin(req)) {
        return res.status(403).json({ error: 'Only teachers and admins can update timetable entries' });
    }

    try {
        const { subject_id, day_of_week, start_time, end_time, room } = req.body;

        if (start_time && end_time && start_time >= end_time) {
            return res.status(400).json({ error: 'Start time must be before end time' });
        }

        const updateData = {};
        if (subject_id !== undefined) updateData.subject_id = subject_id;
        if (day_of_week !== undefined) updateData.day_of_week = day_of_week;
        if (start_time !== undefined) updateData.start_time = start_time;
        if (end_time !== undefined) updateData.end_time = end_time;
        if (room !== undefined) updateData.room = room;

        const { data, error } = await req.supabase
            .from('timetables')
            .update(updateData)
            .eq('id', req.params.id)
            .select('*, subjects(name, code)')
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE: Delete a timetable entry
router.delete('/:id', async (req, res) => {
    if (!await checkTeacherOrAdmin(req)) {
        return res.status(403).json({ error: 'Only teachers and admins can delete timetable entries' });
    }

    try {
        const { error } = await req.supabase
            .from('timetables')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ────────────────────────────────────────────
// TIMETABLE FILE UPLOADS (Photo / PDF)
// ────────────────────────────────────────────

// GET: List uploaded timetable files
router.get('/uploads', async (req, res) => {
    try {
        let query = req.supabase
            .from('timetable_uploads')
            .select('*, profiles(full_name), subjects(name, code)')
            .order('created_at', { ascending: false });

        if (req.query.subjectId) {
            query = query.eq('subject_id', req.query.subjectId);
        }

        const { data, error } = await query;
        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        console.error('[UPLOADS GET]', err.message || err);
        res.status(500).json({ error: err.message });
    }
});

// POST: Upload a timetable file
router.post('/uploads', upload.single('file'), async (req, res) => {
    if (!await checkTeacherOrAdmin(req)) {
        return res.status(403).json({ error: 'Only teachers and admins can upload timetables' });
    }

    if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
    }

    const { title, subjectId } = req.body;
    if (!title) {
        return res.status(400).json({ error: 'Title is required' });
    }

    try {
        const userId = req.user.sub;
        const timestamp = Date.now();
        const safeFilename = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `${userId}/${timestamp}_${safeFilename}`;

        // Step 1: Upload to Supabase Storage via stream
        const fileStream = fs.createReadStream(req.file.path);
        const { data: uploadData, error: uploadError } = await req.supabase
            .storage
            .from('timetable-uploads')
            .upload(storagePath, fileStream, {
                contentType: req.file.mimetype,
                duplex: 'half',
                upsert: false
            });

        // Clean up local temp file
        fs.unlink(req.file.path, (err) => {
            if (err) console.error('[UPLOAD CLEANUP ERROR]', err.message);
        });

        if (uploadError) {
            console.error('[UPLOAD] Storage upload failed:', uploadError.message);
            throw uploadError;
        }
        console.log('[UPLOAD] Storage upload OK:', storagePath);

        // Step 2: Insert metadata into database
        const { data: record, error: dbError } = await req.supabase
            .from('timetable_uploads')
            .insert([{
                uploaded_by: userId,
                subject_id: subjectId || null,
                title,
                file_path: storagePath,
                file_type: req.file.mimetype,
                file_size_bytes: req.file.size
            }])
            .select('*, profiles(full_name), subjects(name, code)')
            .single();

        if (dbError) {
            console.error('[UPLOAD] DB insert failed:', dbError.message);
            throw dbError;
        }
        console.log('[UPLOAD] DB insert OK');

        // Generate a signed URL for immediate access
        const { data: urlData } = await req.supabase
            .storage
            .from('timetable-uploads')
            .createSignedUrl(storagePath, 3600); // 1 hour

        res.status(201).json({
            ...record,
            signedUrl: urlData?.signedUrl || null
        });
    } catch (err) {
        console.error('[UPLOAD ERROR]', err.message || err);
        res.status(500).json({ error: err.message });
    }
});

// GET: Get a single upload with signed URL
router.get('/uploads/:id', async (req, res) => {
    try {
        const { data: record, error } = await req.supabase
            .from('timetable_uploads')
            .select('*, profiles(full_name), subjects(name, code)')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;

        // Generate signed URL
        const { data: urlData } = await req.supabase
            .storage
            .from('timetable-uploads')
            .createSignedUrl(record.file_path, 3600);

        res.json({
            ...record,
            signedUrl: urlData?.signedUrl || null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT: Update upload metadata or replace file
router.put('/uploads/:id', upload.single('file'), async (req, res) => {
    if (!await checkTeacherOrAdmin(req)) {
        return res.status(403).json({ error: 'Only teachers and admins can update uploads' });
    }

    try {
        // Fetch existing record
        const { data: existing, error: fetchError } = await req.supabase
            .from('timetable_uploads')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (fetchError) throw fetchError;

        const updateData = {};
        if (req.body.title !== undefined) updateData.title = req.body.title;
        if (req.body.subjectId !== undefined) updateData.subject_id = req.body.subjectId || null;

        // If a new file is uploaded, replace in storage
        if (req.file) {
            // Delete old file
            await req.supabase.storage.from('timetable-uploads').remove([existing.file_path]);

            // Upload new file via stream
            const userId = req.user.sub;
            const timestamp = Date.now();
            const safeFilename = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
            const newPath = `${userId}/${timestamp}_${safeFilename}`;

            const fileStream = fs.createReadStream(req.file.path);
            const { error: uploadError } = await req.supabase
                .storage
                .from('timetable-uploads')
                .upload(newPath, fileStream, {
                    contentType: req.file.mimetype,
                    duplex: 'half',
                    upsert: false
                });

            // Clean up local temp file
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('[UPLOAD CLEANUP ERROR]', err.message);
            });

            if (uploadError) throw uploadError;

            updateData.file_path = newPath;
            updateData.file_type = req.file.mimetype;
            updateData.file_size_bytes = req.file.size;
        }

        const { data: updated, error: updateError } = await req.supabase
            .from('timetable_uploads')
            .update(updateData)
            .eq('id', req.params.id)
            .select('*, profiles(full_name), subjects(name, code)')
            .single();

        if (updateError) throw updateError;

        // Generate signed URL
        const { data: urlData } = await req.supabase
            .storage
            .from('timetable-uploads')
            .createSignedUrl(updated.file_path, 3600);

        res.json({ ...updated, signedUrl: urlData?.signedUrl || null });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE: Delete upload (file + metadata)
router.delete('/uploads/:id', async (req, res) => {
    if (!await checkTeacherOrAdmin(req)) {
        return res.status(403).json({ error: 'Only teachers and admins can delete uploads' });
    }

    try {
        // Get the record first to find the file path
        const { data: record, error: fetchError } = await req.supabase
            .from('timetable_uploads')
            .select('file_path')
            .eq('id', req.params.id)
            .single();

        if (fetchError) throw fetchError;

        // Delete from storage
        await req.supabase.storage.from('timetable-uploads').remove([record.file_path]);

        // Delete from database
        const { error: deleteError } = await req.supabase
            .from('timetable_uploads')
            .delete()
            .eq('id', req.params.id);

        if (deleteError) throw deleteError;

        res.status(200).json({ message: 'Upload deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Error handler for multer
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File size exceeds the 10 MB limit' });
        }
        return res.status(400).json({ error: err.message });
    }
    if (err.message?.includes('Unsupported file type')) {
        return res.status(400).json({ error: err.message });
    }
    next(err);
});

export default router;
