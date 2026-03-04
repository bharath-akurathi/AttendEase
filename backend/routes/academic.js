import express from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(requireAuth);

// Helper: check admin role
const requireAdmin = async (req, res, next) => {
    const { data: profile } = await req.supabase
        .from('profiles').select('role').eq('id', req.user.sub).single();
    if (profile?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// =========== REGULATIONS ===========

// GET all regulations
router.get('/regulations', async (req, res) => {
    try {
        const { data, error } = await req.supabase
            .from('regulations')
            .select('*')
            .order('code');
        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST create regulation (admin)
router.post('/regulations', requireAdmin, async (req, res) => {
    try {
        const { code, name } = req.body;
        if (!code || !name) return res.status(400).json({ error: 'code and name required' });

        const { data, error } = await req.supabase
            .from('regulations')
            .insert({ code: code.toUpperCase(), name })
            .select()
            .single();
        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT update regulation (admin)
router.put('/regulations/:id', requireAdmin, async (req, res) => {
    try {
        const { code, name, is_active } = req.body;
        const update = {};
        if (code !== undefined) update.code = code.toUpperCase();
        if (name !== undefined) update.name = name;
        if (is_active !== undefined) update.is_active = is_active;

        const { data, error } = await req.supabase
            .from('regulations')
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

// DELETE regulation (admin)
router.delete('/regulations/:id', requireAdmin, async (req, res) => {
    try {
        const { error } = await req.supabase
            .from('regulations')
            .delete()
            .eq('id', req.params.id);
        if (error) throw error;
        res.json({ message: 'Regulation deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =========== COURSES ===========

// GET courses (filter by regulationId)
router.get('/courses', async (req, res) => {
    try {
        let query = req.supabase
            .from('courses')
            .select('*, regulations(code, name)')
            .order('name');

        if (req.query.regulationId) {
            query = query.eq('regulation_id', req.query.regulationId);
        }

        const { data, error } = await query;
        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST create course (admin)
router.post('/courses', requireAdmin, async (req, res) => {
    try {
        const { regulation_id, name, code, type, total_semesters } = req.body;
        if (!regulation_id || !name || !code) {
            return res.status(400).json({ error: 'regulation_id, name, and code required' });
        }

        const { data, error } = await req.supabase
            .from('courses')
            .insert({
                regulation_id,
                name,
                code: code.toUpperCase(),
                type: type || 'btech',
                total_semesters: total_semesters || 8
            })
            .select()
            .single();
        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT update course (admin)
router.put('/courses/:id', requireAdmin, async (req, res) => {
    try {
        const { name, code, type, total_semesters, is_active } = req.body;
        const update = {};
        if (name !== undefined) update.name = name;
        if (code !== undefined) update.code = code.toUpperCase();
        if (type !== undefined) update.type = type;
        if (total_semesters !== undefined) update.total_semesters = total_semesters;
        if (is_active !== undefined) update.is_active = is_active;

        const { data, error } = await req.supabase
            .from('courses')
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

// DELETE course (admin)
router.delete('/courses/:id', requireAdmin, async (req, res) => {
    try {
        const { error } = await req.supabase
            .from('courses')
            .delete()
            .eq('id', req.params.id);
        if (error) throw error;
        res.json({ message: 'Course deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
