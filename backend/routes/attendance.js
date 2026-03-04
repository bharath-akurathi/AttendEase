import express from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(requireAuth);

// GET attendance records (filter by subjectId, date, studentId)
router.get('/', async (req, res) => {
    const { supabase } = req;
    const { subjectId, date, studentId } = req.query;

    try {
        let query = supabase
            .from('absence_records')
            .select('*, profiles!absence_records_student_id_fkey(full_name, roll_number)');

        if (subjectId && subjectId !== 'undefined') query = query.eq('subject_id', subjectId);
        if (date && date !== 'undefined') query = query.eq('date', date);
        if (studentId && studentId !== 'undefined') query = query.eq('student_id', studentId);

        const { data, error } = await query.order('date', { ascending: false });
        if (error) {
            console.error('[ATTENDANCE GET]', error.message, error.details, error.hint);
            throw error;
        }
        res.json(data || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET attendance history/summary for a student (used by student dashboard)
router.get('/history', async (req, res) => {
    const { supabase, user } = req;
    const { year, semester, courseId, regulationId } = req.query;

    try {
        const { data, error } = await supabase.rpc('get_student_attendance', {
            p_student_id: user.sub,
            p_year: year && year !== 'undefined' ? parseInt(year) : null,
            p_semester: semester && semester !== 'undefined' ? parseInt(semester) : null,
            p_course_id: courseId && courseId !== 'undefined' ? courseId : null,
            p_regulation_id: regulationId && regulationId !== 'undefined' ? regulationId : null
        });

        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST submit/replace absences for subject + date (idempotent)
router.post('/', async (req, res) => {
    const { supabase, user } = req;
    const { subjectId, date, absentStudentIds } = req.body;

    // Check role
    const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.sub).single();

    if (profile?.role !== 'teacher' && profile?.role !== 'admin') {
        return res.status(403).json({ error: 'Only teachers can mark attendance' });
    }

    if (!subjectId || !date) {
        return res.status(400).json({ error: 'subjectId and date required' });
    }

    try {
        // Delete existing records for this subject+date
        const { error: deleteError } = await supabase
            .from('absence_records')
            .delete()
            .eq('subject_id', subjectId)
            .eq('date', date);
        if (deleteError) throw deleteError;

        // Insert new absence records
        if (absentStudentIds && absentStudentIds.length > 0) {
            const records = absentStudentIds.map(studentId => ({
                subject_id: subjectId,
                student_id: studentId,
                date: date,
                marked_by: user.sub
            }));

            const { error: insertError } = await supabase
                .from('absence_records')
                .insert(records);
            if (insertError) throw insertError;

            return res.status(201).json({
                message: 'Attendance saved successfully',
                count: records.length
            });
        }

        res.json({ message: 'Attendance saved (no absences)', count: 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
