import express from 'express';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { requireAuth } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();

const lookupLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 login lookups per 15 minutes
    message: { error: 'Too many login attempts from this IP, please try again after 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
});

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const supabaseAuth = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

// POST /api/auth/student-lookup — Password-less student login via Roll Number
// Returns a read-only JWT token (not a Supabase session)
router.post('/student-lookup', lookupLimiter, validateRequest({
    body: z.object({
        roll_number: z.string().min(1, 'Roll number is required')
    })
}), async (req, res) => {
    try {
        const { roll_number } = req.body;

        const formattedRoll = roll_number.trim().toUpperCase();

        // Look up the student profile by roll number
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select(`
                id, full_name, role, roll_number,
                regulation_id, course_id, current_year, current_semester,
                regulations(id, code, name),
                courses(id, name, code, type, total_semesters)
            `)
            .eq('roll_number', formattedRoll)
            .maybeSingle();

        if (profileError) throw profileError;
        if (!profile) {
            return res.status(404).json({ error: `No student found with roll number ${formattedRoll}` });
        }

        if (profile.role !== 'student') {
            return res.status(403).json({ error: 'This endpoint is for students only' });
        }

        // Create a read-only JWT (expires in 24 hours)
        const token = jwt.sign(
            {
                sub: profile.id,
                roll_number: formattedRoll,
                role: 'student',
                read_only: true,
                iss: 'attendease'
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            profile
        });
    } catch (err) {
        console.error('[auth/student-lookup]', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/change-password — Change password for the logged-in user (teachers/admins only)
router.post('/change-password', requireAuth, validateRequest({
    body: z.object({
        new_password: z.string().min(6, 'New password must be at least 6 characters')
    })
}), async (req, res) => {
    try {
        // Block students from changing password
        if (req.user.read_only) {
            return res.status(403).json({ error: 'Students cannot change password' });
        }

        const { new_password } = req.body;

        const userId = req.user.sub;

        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            password: new_password
        });

        if (error) throw error;

        res.json({ message: 'Password changed successfully' });
    } catch (err) {
        console.error('[auth/change-password]', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
