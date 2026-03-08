import express from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { z } from 'zod';

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

        const limit = parseInt(req.query.limit);
        const offset = parseInt(req.query.offset);
        if (!isNaN(limit)) {
            const start = isNaN(offset) ? 0 : offset;
            query = query.range(start, start + limit - 1);
        }

        const { data, error } = await query;
        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST create subject
router.post('/', validateRequest({
    body: z.object({
        regulation_id: z.string().uuid(),
        course_id: z.string().uuid(),
        year: z.union([z.string(), z.number()]),
        semester: z.union([z.string(), z.number()]),
        name: z.string().min(1),
        code: z.string().min(1),
        section: z.string().optional().nullable(),
        credits: z.number().optional().nullable()
    })
}), async (req, res) => {
    try {
        if (!await checkTeacherOrAdmin(req)) {
            return res.status(403).json({ error: 'Teachers/admins only' });
        }

        const { regulation_id, course_id, year, semester, name, code, section, credits } = req.body;

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
router.put('/:id', validateRequest({
    body: z.object({
        name: z.string().min(1).optional(),
        code: z.string().min(1).optional(),
        section: z.string().optional().nullable(),
        credits: z.number().optional().nullable(),
        is_active: z.boolean().optional(),
        teacher_id: z.string().uuid().optional().nullable()
    })
}), async (req, res) => {
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
            .update({ is_active: false })
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
router.post('/:id/students', validateRequest({
    body: z.object({
        roll_number: z.string().min(1, 'roll_number required'),
        student_name: z.string().optional()
    })
}), async (req, res) => {
    try {
        if (!await checkTeacherOrAdmin(req)) {
            return res.status(403).json({ error: 'Teachers/admins only' });
        }

        const { roll_number, student_name } = req.body;

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

// POST bulk add students (supports roll_numbers array OR prefix+start+end range)
router.post('/:id/students/bulk', validateRequest({
    body: z.object({
        roll_numbers: z.array(z.string()).optional(),
        prefix: z.string().optional(),
        start: z.union([z.string(), z.number()]).optional(),
        end: z.union([z.string(), z.number()]).optional(),
        regulation_id: z.string().uuid().optional().nullable(),
        course_id: z.string().uuid().optional().nullable(),
        current_year: z.number().int().min(1).max(6).optional().nullable(),
        current_semester: z.number().int().min(1).max(2).optional().nullable()
    })
}), async (req, res) => {
    try {
        if (!await checkTeacherOrAdmin(req)) {
            return res.status(403).json({ error: 'Teachers/admins only' });
        }

        const { roll_numbers, prefix, start, end, regulation_id, course_id, current_year, current_semester } = req.body;
        let rollList = [];

        if (prefix !== undefined && start !== undefined && end !== undefined) {
            // Range mode: generate roll numbers
            const startNum = parseInt(start);
            const endNum = parseInt(end);
            if (isNaN(startNum) || isNaN(endNum) || startNum > endNum) {
                return res.status(400).json({ error: 'Invalid range' });
            }
            if (endNum - startNum + 1 > 200) {
                return res.status(400).json({ error: 'Maximum 200 students per batch' });
            }
            // Use the digit width of the original 'end' input to preserve formatting
            const padWidth = String(end).length;
            for (let i = startNum; i <= endNum; i++) {
                rollList.push(`${prefix.toUpperCase()}${String(i).padStart(padWidth, '0')}`);
            }
        } else if (roll_numbers && Array.isArray(roll_numbers) && roll_numbers.length > 0) {
            rollList = roll_numbers.map(r => r.trim().toUpperCase());
        } else {
            return res.status(400).json({ error: 'Provide roll_numbers array OR prefix+start+end' });
        }

        // Service-role client for creating accounts
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseService = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
        );

        const created = [];
        const enrolled = [];
        const skipped = [];
        const errors = [];

        for (const rollNo of rollList) {
            if (!/^[0-9]{2}[A-Z0-9]{2}1[A-Z][A-Z0-9]{4}$/.test(rollNo) && !/^[0-9]{2}[A-Z0-9]{2}5[A-Z][A-Z0-9]{4}$/.test(rollNo) && rollNo.length !== 10) {
                // Modified regex slightly to be flexible just in case, while keeping length 10
                if (rollNo.length !== 10 || !/^[A-Z0-9]{10}$/.test(rollNo)) {
                    errors.push({ roll_number: rollNo, error: 'Roll number must be exactly 10 alphanumeric characters' });
                    continue;
                }
            }

            // Check if profile exists
            let { data: student } = await supabaseService
                .from('profiles')
                .select('id, roll_number')
                .eq('roll_number', rollNo)
                .maybeSingle();

            // Auto-create if not found
            if (!student) {
                const email = `${rollNo.toLowerCase()}@student.attendease.local`;
                const { data: authData, error: authError } = await supabaseService.auth.admin.createUser({
                    email,
                    password: crypto.randomUUID() + crypto.randomUUID(),
                    email_confirm: true,
                    user_metadata: {
                        full_name: rollNo,
                        role: 'student',
                        roll_number: rollNo
                    }
                });

                if (authError) {
                    errors.push({ roll_number: rollNo, error: authError.message });
                    continue;
                }

                // Wait for trigger to finish creating the baseline profile
                await new Promise(r => setTimeout(r, 200));

                // Assign academic context to newly created profile
                if (regulation_id || course_id || current_year || current_semester) {
                    await supabaseService
                        .from('profiles')
                        .update({
                            regulation_id: regulation_id || null,
                            course_id: course_id || null,
                            current_year: current_year || null,
                            current_semester: current_semester || null
                        })
                        .eq('id', authData.user.id);
                }

                const { data: newProfile } = await supabaseService
                    .from('profiles')
                    .select('id, roll_number')
                    .eq('id', authData.user.id)
                    .maybeSingle();

                student = newProfile;
                created.push(rollNo);
            } else if (regulation_id || course_id || current_year || current_semester) {
                // If student exists but they provided context via bulk form, we can update it too
                await supabaseService
                    .from('profiles')
                    .update({
                        regulation_id: regulation_id || null,
                        course_id: course_id || null,
                        current_year: current_year || null,
                        current_semester: current_semester || null
                    })
                    .eq('id', student.id);
            }

            if (!student) {
                errors.push({ roll_number: rollNo, error: 'Profile creation failed' });
                continue;
            }

            // Enroll in subject
            const { error: enrollError } = await supabaseService
                .from('subject_enrollments')
                .upsert(
                    { subject_id: req.params.id, student_id: student.id },
                    { onConflict: 'subject_id,student_id', ignoreDuplicates: true }
                );

            if (enrollError) {
                errors.push({ roll_number: rollNo, error: enrollError.message });
            } else {
                enrolled.push(rollNo);
            }
        }

        res.status(201).json({
            total_enrolled: enrolled.length,
            total_created: created.length,
            skipped,
            errors,
            created,
            enrolled
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

        // Get total valid class sessions
        const { count: totalClasses, error: countError } = await req.supabase
            .from('class_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('subject_id', req.params.id)
            .eq('status', 'held');
        if (countError) throw countError;



        let csv = 'Roll Number,Name,Total Classes,Total Absences,Attendance %,Absent Dates\n';
        Object.values(studentMap).forEach(s => {
            const abs = s.absences.length;
            const perc = totalClasses > 0 ? (((totalClasses - abs) / totalClasses) * 100).toFixed(2) + '%' : 'N/A';
            csv += `"${s.roll}","${s.name}",${totalClasses},${abs},"${perc}","${s.absences.join('; ')}"\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${subject?.code || 'attendance'}_export.csv"`);
        res.send(csv);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
