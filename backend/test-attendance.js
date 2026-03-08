require('dotenv').config();
const jwt = require('jsonwebtoken');
const token = jwt.sign({ 
    sub: '374996bd-86db-450d-84fe-0d7e6432dfb9', 
    role: 'teacher', 
    email: 'test@test.com' 
}, process.env.SUPABASE_JWT_SECRET, { expiresIn: '1h' });

fetch('http://localhost:5001/api/attendance', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
        subjectId: '2e57b5e5-bab1-4b2c-a9e9-e6bd3743c217',
        date: '2026-03-08',
        absentStudentIds: [],
        status: 'held'
    })
}).then(res => res.json()).then(console.log).catch(console.error);
