import { z } from 'zod';

export const validateRequest = (schema) => async (req, res, next) => {
    try {
        if (schema.body) {
            req.body = await schema.body.parseAsync(req.body);
        }
        if (schema.query) {
            req.query = await schema.query.parseAsync(req.query);
        }
        if (schema.params) {
            req.params = await schema.params.parseAsync(req.params);
        }
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                error: 'Invalid input',
                details: error.errors.map(e => ({ path: e.path.join('.'), message: e.message }))
            });
        }
        res.status(500).json({ error: 'Internal validation error' });
    }
};
