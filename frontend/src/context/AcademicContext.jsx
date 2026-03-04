import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

const AcademicContext = createContext({});

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export const AcademicProvider = ({ children }) => {
    const { session } = useAuth();
    const [regulations, setRegulations] = useState([]);
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(false);

    const headers = () => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`
    });

    // Fetch all regulations
    const fetchRegulations = async () => {
        if (!session?.access_token) return;
        try {
            const res = await fetch(`${API_BASE}/api/academic/regulations`, { headers: headers() });
            const data = await res.json();
            setRegulations(data || []);
        } catch (err) {
            console.error('Failed to fetch regulations', err);
        }
    };

    // Fetch courses (optionally by regulation)
    const fetchCourses = async (regulationId) => {
        if (!session?.access_token) return;
        try {
            const url = regulationId
                ? `${API_BASE}/api/academic/courses?regulationId=${regulationId}`
                : `${API_BASE}/api/academic/courses`;
            const res = await fetch(url, { headers: headers() });
            const data = await res.json();
            setCourses(data || []);
        } catch (err) {
            console.error('Failed to fetch courses', err);
        }
    };

    useEffect(() => {
        if (session?.access_token) {
            fetchRegulations();
            fetchCourses();
        }
    }, [session?.access_token]);

    const getCoursesForRegulation = (regId) => courses.filter(c => c.regulation_id === regId);

    return (
        <AcademicContext.Provider value={{
            regulations,
            courses,
            loading,
            fetchRegulations,
            fetchCourses,
            getCoursesForRegulation
        }}>
            {children}
        </AcademicContext.Provider>
    );
};

export const useAcademic = () => useContext(AcademicContext);
