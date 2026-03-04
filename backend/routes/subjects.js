import express from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(requireAuth);

// Helper: check teacher/admin role
const checkTeacherOrAdmin = async (req) => {
    const { data: profile } = await req.supabase
        .from('profiles').select('role').eq('id', req.user.sub).single();
    return profile?.role === 'teacher' || profile?.role === 'admin';
};

// GET subjects (teacher: own, student: enrolled, admin: all)
router.get('/', async (req, res) => {
    try {
        const { data: profile } = await req.supabase
            .from('profiles').select('role').eq('id', req.user.sub).single();

        let query = req.supabase
            .from('subjects')
            .select(`
                *,
                regulations(code, name),
                courses(name, code, type),
                profiles!subjects_teacher_id_fkey(full_name)
            `)
            .eq('is_active', true)
            .order('year').order('semester').order('name');

        // Filter by query params
        if (req.query.regulationId) query = query.eq('regulation_id', req.query.regulationId);
        if (req.query.courseId) query = query.eq('course_id', req.query.courseId);
        if (req.query.year) query = query.eq('year', parseInt(req.query.year));
        if (req.query.semester) query = query.eq('semester', parseInt(req.query.semester));

        if (profile?.role === 'teacher') {
            // Teachers see only their subjects
            query = query.eq('teacher_id', req.user.sub);
        } else if (profile?.role === 'student') {
            // Students see enrolled subjects
            const { data: enrollments } = await req.supabase
                .from('subject_enrollments')
                .select('subject_id')
                .eq('student_id', req.user.sub);
            const subjectIds = (enrollments || []).map(e => e.subject_id);
            if (subjectIds.length === 0) return res.json([]);
            query = query.in('id', subjectIds);
        }
        // admin: no filter, sees all

        const { data, error } = await query;
        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST create subject
router.post('/', async (req, res) => {
    try {
        if (!await checkTeacherOrAdmin(req)) {
            return res.status(403).json({ error: 'Teachers/admins only' });
        }

        const { regulation_id, course_id, year, semester, name, code, section, credits } = req.body;
        if (!regulation_id || !course_id || !year || !semester || !name || !code) {
            return res.status(400).json({ error: 'regulation_id, course_id, year, semester, name, code are required' });
        }

        const { data, error } = await req.supabase
            .from('subjects')
            .insert({
                teacher_id: req.user.sub,
                regulation_id,
                course_id,
                year: parseInt(year),
                semester: parseInt(semester),
                name,
                code: code.toUpperCase(),
                section: section || null,
                credits: credits || 3
            })
            .select()
            .single();
        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT update subject
router.put('/:id', async (req, res) => {
    try {
        if (!await checkTeacherOrAdmin(req)) {
            return res.status(403).json({ error: 'Teachers/admins only' });
        }

        const { name, code, section, credits, is_active, teacher_id } = req.body;
        const update = {};
        if (name !== undefined) update.name = name;
        if (code !== undefined) update.code = code.toUpperCase();
        if (section !== undefined) update.section = section || null;
        if (credits !== undefined) update.credits = credits;
        if (is_active !== undefined) update.is_active = is_active;
        if (teacher_id !== undefined) update.teacher_id = teacher_id;

        const { data, error } = await req.supabase
            .from('subjects')
            .update(update)
            .eq('id', req.params.id)
            .select()
            .single();
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE subject
router.delete('/:id', async (req, res) => {
    try {
        if (!await checkTeacherOrAdmin(req)) {
            return res.status(403).json({ error: 'Teachers/admins only' });
        }

        const { error } = await req.supabase
            .from('subjects')
            .delete()
            .eq('id', req.params.id);
        if (error) throw error;
        res.json({ message: 'Subject deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET enrolled students for a subject
router.get('/:id/students', async (req, res) => {
    try {
        const { data, error } = await req.supabase
            .from('subject_enrollments')
            .select('*, profiles!subject_enrollments_student_id_fkey(id, full_name, roll_number)')
            .eq('subject_id', req.params.id)
            .order('enrolled_at');
        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST add student to subject by roll number
router.post('/:id/students', async (req, res) => {
    try {
        if (!await checkTeacherOrAdmin(req)) {
            return res.status(403).json({ error: 'Teachers/admins only' });
        }

        const { roll_number, student_name } = req.body;
        if (!roll_number) return res.status(400).json({ error: 'roll_number required' });

        // Find student by roll number
        const { data: student } = await req.supabase
            .from('profiles')
            .select('id, full_name')
            .eq('roll_number', roll_number)
            .single();

        if (!student) {
            return res.status(404).json({ error: `Student with roll number ${roll_number} not found` });
        }

        // Enroll
        const { data, error } = await req.supabase
            .from('subject_enrollments')
            .insert({ subject_id: req.params.id, student_id: student.id })
            .select()
            .single();
        if (error) throw error;
        res.status(201).json({ ...data, student });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE remove student from subject
router.delete('/:id/students/:stuId', async (req, res) => {
    try {
        if (!await checkTeacherOrAdmin(req)) {
            return res.status(403).json({ error: 'Teachers/admins only' });
        }

        const { error } = await req.supabase
            .from('subject_enrollments')
            .delete()
            .eq('subject_id', req.params.id)
            .eq('student_id', req.params.stuId);
        if (error) throw error;
        res.json({ message: 'Student removed from subject' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST bulk add students
router.post('/:id/students/bulk', async (req, res) => {
    try {
        if (!await checkTeacherOrAdmin(req)) {
            return res.status(403).json({ error: 'Teachers/admins only' });
        }

        const { roll_numbers } = req.body; // Array of roll numbers
        if (!roll_numbers || !Array.isArray(roll_numbers) || roll_numbers.length === 0) {
            return res.status(400).json({ error: 'roll_numbers array required' });
        }

        // Find all students by roll numbers
        const { data: students } = await req.supabase
            .from('profiles')
            .select('id, roll_number')
            .in('roll_number', roll_numbers);

        if (!students || students.length === 0) {
            return res.status(404).json({ error: 'No matching students found' });
        }

        const records = students.map(s => ({
            subject_id: req.params.id,
            student_id: s.id
        }));

        const { data, error } = await req.supabase
            .from('subject_enrollments')
            .upsert(records, { onConflict: 'subject_id,student_id', ignoreDuplicates: true })
            .select();
        if (error) throw error;

        const notFound = roll_numbers.filter(rn => !students.find(s => s.roll_number === rn));
        res.status(201).json({
            enrolled: data?.length || 0,
            not_found: notFound
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET export attendance as CSV
router.get('/:id/export', async (req, res) => {
    try {
        if (!await checkTeacherOrAdmin(req)) {
            return res.status(403).json({ error: 'Teachers/admins only' });
        }

        // Get subject info
        const { data: subject } = await req.supabase
            .from('subjects').select('name, code').eq('id', req.params.id).single();

        // Get enrolled students
        const { data: enrollments } = await req.supabase
            .from('subject_enrollments')
            .select('student_id, profiles!subject_enrollments_student_id_fkey(full_name, roll_number)')
            .eq('subject_id', req.params.id);

        // Get all absences
        const { data: absences } = await req.supabase
            .from('absence_records')
            .select('student_id, date')
            .eq('subject_id', req.params.id)
            .order('date');

        // Build CSV
        const studentMap = {};
        (enrollments || []).forEach(e => {
            studentMap[e.student_id] = {
                name: e.profiles?.full_name || 'Unknown',
                roll: e.profiles?.roll_number || 'N/A',
                absences: []
            };
        });

        (absences || []).forEach(a => {
            if (studentMap[a.student_id]) {
                studentMap[a.student_id].absences.push(a.date);
            }
        });

        let csv = 'Roll Number,Name,Total Absences,Absent Dates\n';
        Object.values(studentMap).forEach(s => {
            csv += `"${s.roll}","${s.name}",${s.absences.length},"${s.absences.join('; ')}"\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${subject?.code || 'attendance'}_export.csv"`);
        res.send(csv);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
