import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

export const requireAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // First, try to verify as a custom AttendEase JWT (for students)
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            if (decoded.iss === 'attendease' && decoded.read_only === true) {
                // This is a read-only student token
                req.user = {
                    sub: decoded.sub,
                    roll_number: decoded.roll_number,
                    role: decoded.role,
                    read_only: true
                };

                // Enforce read-only: students can only make GET requests
                if (req.method !== 'GET') {
                    return res.status(403).json({ error: 'Students have read-only access' });
                }

                // Create an admin supabase client for data fetching (since student has no Supabase session)
                req.supabase = createClient(
                    process.env.SUPABASE_URL,
                    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
                );

                return next();
            }
        } catch (jwtErr) {
            // Not a custom JWT, fall through to Supabase verification
        }

        // Fall through: verify as a Supabase JWT (for teachers/admins)
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

        if (error || !user) {
            console.log('[AUTH] Supabase auth.getUser failed:', error?.message);
            return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }

        req.user = {
            sub: user.id,
            email: user.email,
            user_metadata: user.user_metadata,
            role: user.role,
            read_only: false
        };

        req.supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
            global: {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        });

        next();
    } catch (err) {
        console.log('[AUTH] Unexpected error:', err.message);
        return res.status(401).json({ error: 'Unauthorized: ' + err.message });
    }
};
