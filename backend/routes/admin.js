import express from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { createClient } from '@supabase/supabase-js';
import { validateRequest } from '../middleware/validateRequest.js';
import { z } from 'zod';
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();
router.use(requireAuth);

// Admin middleware
const requireAdmin = async (req, res, next) => {
    try {
        const { data: profile, error } = await req.supabase
            .from('profiles').select('role').eq('id', req.user.sub).single();
        if (error || profile?.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        next();
    } catch (err) {
        res.status(500).json({ error: 'Server error verifying role.' });
    }
};

router.use(requireAdmin);

// Service-role client for admin operations (bypass RLS)
const supabaseService = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

// 1. System Statistics
router.get('/stats', async (req, res) => {
    try {
        const { data, error } = await req.supabase.rpc('get_system_stats');
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Get All Users
router.get('/users', async (req, res) => {
    try {
        let query = req.supabase
            .from('profiles')
            .select('*, regulations(code), courses(name, code)')
            .order('created_at', { ascending: false });

        if (req.query.role) query = query.eq('role', req.query.role);
        if (req.query.courseId) query = query.eq('course_id', req.query.courseId);
        if (req.query.regulationId) query = query.eq('regulation_id', req.query.regulationId);
        if (req.query.search) {
            query = query.or(`full_name.ilike.%${req.query.search}%,roll_number.ilike.%${req.query.search}%`);
        }

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

// 3. Update User Role (support both PUT and PATCH)
const handleRoleUpdate = async (req, res) => {
    try {
        const { role } = req.body;
        if (req.params.id === req.user.sub && role !== 'admin') {
            return res.status(400).json({ error: 'Cannot demote yourself' });
        }
        const { data, error } = await req.supabase
            .from('profiles')
            .update({ role })
            .eq('id', req.params.id)
            .select()
            .single();
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const roleValidation = validateRequest({
    body: z.object({ role: z.enum(['student', 'teacher', 'admin']) })
});

router.put('/users/:id/role', roleValidation, handleRoleUpdate);
router.patch('/users/:id/role', roleValidation, handleRoleUpdate);

// 3a. Delete User
router.delete('/users/:id', async (req, res) => {
    try {
        if (req.params.id === req.user.sub) {
            return res.status(400).json({ error: 'Cannot delete yourself' });
        }
        const { error } = await supabaseService.auth.admin.deleteUser(req.params.id);
        if (error) throw error;

        const { error: profileError } = await req.supabase
            .from('profiles')
            .delete()
            .eq('id', req.params.id);
        if (profileError) throw profileError;

        res.json({ message: 'User deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3b. Reset Password
router.patch('/users/:id/password', validateRequest({
    body: z.object({ password: z.string().min(6, 'Password must be at least 6 characters') })
}), async (req, res) => {
    try {
        const { password } = req.body;
        const { error } = await supabaseService.auth.admin.updateUserById(req.params.id, { password });
        if (error) throw error;
        res.json({ message: 'Password updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3c. Update Teacher Permissions
router.patch('/users/:id/permissions', validateRequest({
    body: z.object({
        can_create_subjects: z.boolean().optional(),
        can_edit_subjects: z.boolean().optional(),
        can_delete_subjects: z.boolean().optional()
    })
}), async (req, res) => {
    try {
        const allowedKeys = ['can_create_subjects', 'can_edit_subjects', 'can_delete_subjects'];
        const updates = {};
        for (const key of allowedKeys) {
            if (typeof req.body[key] === 'boolean') updates[key] = req.body[key];
        }
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No valid permissions provided' });
        }
        const { data, error } = await req.supabase
            .from('profiles')
            .update(updates)
            .eq('id', req.params.id)
            .select()
            .single();
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Create Student Account
router.post('/students', validateRequest({
    body: z.object({
        roll_number: z.string().min(1, 'Roll number is required'),
        full_name: z.string().min(1, 'Full name is required'),
        regulation_id: z.string().uuid().optional().nullable(),
        course_id: z.string().uuid().optional().nullable(),
        current_year: z.number().int().min(1).max(6).optional().nullable(),
        current_semester: z.number().int().min(1).max(2).optional().nullable()
    })
}), async (req, res) => {
    try {
        const { roll_number, full_name, regulation_id, course_id, current_year, current_semester } = req.body;

        // Check if roll number already exists
        const { data: existing } = await req.supabase
            .from('profiles')
            .select('id')
            .eq('roll_number', roll_number)
            .single();

        if (existing) {
            return res.status(409).json({ error: `Student with roll number ${roll_number} already exists` });
        }

        // Create auth user with roll number as email (internal mapping)
        const internalEmail = `${roll_number.toLowerCase()}@attendease.local`;
        const tempPassword = `AE_${roll_number}_${Date.now()}`;

        // For now, just create/update the profile directly
        // Full auth user creation requires service_role key
        // Instead, update existing profile if found, or return instructions
        const { data: profile, error: profileError } = await req.supabase
            .from('profiles')
            .select('id')
            .eq('roll_number', roll_number)
            .maybeSingle();

        if (profile) {
            // Update existing
            const { data, error } = await req.supabase
                .from('profiles')
                .update({
                    full_name,
                    regulation_id: regulation_id || null,
                    course_id: course_id || null,
                    current_year: current_year || null,
                    current_semester: current_semester || null
                })
                .eq('id', profile.id)
                .select()
                .single();
            if (error) throw error;
            res.json({ message: 'Student profile updated', data });
        } else {
            // Return guidance — full user creation needs service_role
            res.status(200).json({
                message: 'Roll number not found. Student must first sign up via Google OAuth, then admin can assign their roll number.',
                roll_number,
                action_required: 'assign_roll_number'
            });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Assign Roll Number to Existing User
router.put('/users/:id/roll-number', validateRequest({
    body: z.object({
        roll_number: z.string().min(1, 'Roll number is required'),
        regulation_id: z.string().uuid().optional().nullable(),
        course_id: z.string().uuid().optional().nullable(),
        current_year: z.number().int().min(1).max(6).optional().nullable(),
        current_semester: z.number().int().min(1).max(2).optional().nullable()
    })
}), async (req, res) => {
    try {
        const { roll_number, regulation_id, course_id, current_year, current_semester } = req.body;

        const update = { roll_number };
        if (regulation_id) update.regulation_id = regulation_id;
        if (course_id) update.course_id = course_id;
        if (current_year) update.current_year = current_year;
        if (current_semester) update.current_semester = current_semester;

        const { data, error } = await req.supabase
            .from('profiles')
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

// 6. Advance Student Semester
router.put('/students/:id/semester', validateRequest({
    body: z.object({
        current_year: z.number().int().min(1).max(6),
        current_semester: z.number().int().min(1).max(2)
    })
}), async (req, res) => {
    try {
        const { current_year, current_semester } = req.body;

        const { data, error } = await req.supabase
            .from('profiles')
            .update({ current_year, current_semester })
            .eq('id', req.params.id)
            .select()
            .single();
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. Get All Subjects (with teacher + enrollment count)
router.get('/subjects', async (req, res) => {
    try {
        const { data, error } = await req.supabase
            .from('subjects')
            .select(`
                *,
                regulations(code, name),
                courses(name, code),
                profiles!subjects_teacher_id_fkey(full_name),
                subject_enrollments(count)
            `)
            .order('year').order('semester').order('name');
        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 8. Bulk Create Students by Roll Number Range
router.post('/students/bulk-range', validateRequest({
    body: z.object({
        prefix: z.string().min(1),
        start: z.union([z.string(), z.number()]),
        end: z.union([z.string(), z.number()]),
        regulation_id: z.string().uuid().optional().nullable(),
        course_id: z.string().uuid().optional().nullable(),
        current_year: z.number().int().min(1).max(6).optional().nullable(),
        current_semester: z.number().int().min(1).max(2).optional().nullable()
    })
}), async (req, res) => {
    try {
        const { prefix, start, end, regulation_id, course_id, current_year, current_semester } = req.body;

        const startNum = parseInt(start);
        const endNum = parseInt(end);
        if (isNaN(startNum) || isNaN(endNum) || startNum > endNum) {
            return res.status(400).json({ error: 'Invalid range: start must be <= end' });
        }
        if (endNum - startNum + 1 > 200) {
            return res.status(400).json({ error: 'Maximum 200 students per batch' });
        }

        const created = [];
        const skipped = [];
        const errors = [];

        for (let i = startNum; i <= endNum; i++) {
            const padWidth = String(end).length;
            const rollNo = `${prefix.toUpperCase()}${String(i).padStart(padWidth, '0')}`;

            if (rollNo.length !== 10) {
                errors.push({ roll_number: rollNo, error: 'Roll number must be exactly 10 characters long' });
                continue;
            }

            // Check if student already exists
            const { data: existing } = await supabaseService
                .from('profiles')
                .select('id, roll_number')
                .eq('roll_number', rollNo)
                .maybeSingle();

            if (existing) {
                skipped.push(rollNo);
                continue;
            }

            // Create auth account
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

            // Update profile with academic context
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

            created.push(rollNo);
        }

        res.status(201).json({ created, skipped, errors, total_created: created.length, total_skipped: skipped.length });
    } catch (err) {
        console.error('[admin/students/bulk-range]', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
