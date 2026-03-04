import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// Create a single admin supabase client for token verification
const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

export const requireAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // Use Supabase's own auth to verify the token
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

        if (error || !user) {
            console.log('[AUTH] Supabase auth.getUser failed:', error?.message);
            return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }

        // Set user info on the request (matching the shape the routes expect)
        req.user = {
            sub: user.id,
            email: user.email,
            user_metadata: user.user_metadata,
            role: user.role
        };

        // Create an authenticated supabase client for this request to enforce RLS
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
