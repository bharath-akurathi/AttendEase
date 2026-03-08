import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export const AuthContext = createContext({});
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    // 'supabase' for teachers/admins, 'student' for roll-number students
    const [authMode, setAuthMode] = useState(null);

    useEffect(() => {
        window.__AUTH_STATE = { user, profile, loading, authMode };
    }, [user, profile, loading, authMode]);

    useEffect(() => {
        // Fallback timeout to prevent infinite loading screens
        const timeout = setTimeout(() => {
            setLoading(prev => {
                if (prev) {
                    console.error('[AuthContext] Loading timed out after 5s! Force releasing loader.');
                    return false;
                }
                return prev;
            });
        }, 3000);

        // Check for stored student session first
        const storedStudent = localStorage.getItem('attendease_student');
        if (storedStudent) {
            try {
                const parsed = JSON.parse(storedStudent);
                if (parsed.token) {
                    const base64Url = parsed.token.split('.')[1];
                    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                    const payload = JSON.parse(atob(base64));
                    if (payload.exp * 1000 < Date.now()) {
                        throw new Error('Token expired');
                    }
                }
                setUser({ id: parsed.profile.id });
                setProfile(parsed.profile);
                setSession({ access_token: parsed.token });
                setAuthMode('student');
                setLoading(false);
                return; // Skip Supabase session check
            } catch { localStorage.removeItem('attendease_student'); }
        }

        // Check Supabase session (for teachers/admins)
        supabase.auth.getSession().then(async ({ data: { session: s }, error }) => {
            if (error || !s?.user) {
                setUser(null);
                setProfile(null);
                setSession(null);
                setLoading(false);
                return;
            }
            setUser(s.user);
            setSession(s);
            // Fetch profile to determine authMode based on role
            const profileData = await fetchProfile(s.user.id); // fetchProfile now returns the profile
            setAuthMode(profileData?.role === 'admin' ? 'admin' : 'teacher');
            setLoading(false); // Set loading to false after profile is fetched and authMode is set
        }).catch(() => setLoading(false));

        const { data: authListener } = supabase.auth.onAuthStateChange(
            async (event, s) => {
                // Ignore Supabase events if we're in student mode
                if (authMode === 'student') return;

                if (event === 'SIGNED_OUT') {
                    setUser(null);
                    setProfile(null);
                    setSession(null);
                    setAuthMode(null);
                    setLoading(false);
                    return;
                }
                if (s?.user) {
                    setUser(s.user);
                    setSession(s);
                    // We only want to fetch profile if we haven't already and aren't about to
                    if (!profile || profile.id !== s.user.id) {
                        const profileData = await fetchProfile(s.user.id);
                        setAuthMode(profileData?.role === 'admin' ? 'admin' : 'teacher');
                    } else {
                        setAuthMode(profile.role === 'admin' ? 'admin' : 'teacher');
                    }
                } else {
                    setUser(null);
                    setProfile(null);
                    setSession(null);
                    setAuthMode(null);
                    setLoading(false);
                }
            }
        );

        return () => {
            if (authListener?.subscription) authListener.subscription.unsubscribe();
        };
    }, []);

    const fetchProfile = async (userId) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select(`
                    *,
                    regulations(id, code, name),
                    courses(id, name, code, type, total_semesters)
                `)
                .eq('id', userId)
                .single();

            if (!error && data) {
                setProfile(data);
                return data;
            } else {
                setProfile(null);
                return null;
            }
        } catch (error) {
            console.error('Failed to fetch profile', error);
            setProfile(null);
            return null;
        } finally {
            setLoading(false);
        }
    };

    // Login with email and password (teachers/admins)
    const login = async (email, password) => {
        return supabase.auth.signInWithPassword({ email, password });
    };

    // Sign up new users (teachers)
    const signUp = async (email, password, metadata) => {
        return supabase.auth.signUp({
            email,
            password,
            options: { data: metadata }
        });
    };

    // Student lookup — password-less, read-only
    const loginWithRollNumber = async (rollNumber) => {
        const res = await fetch(`${API_BASE}/api/auth/student-lookup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roll_number: rollNumber })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Lookup failed');

        // Store in localStorage for persistence
        localStorage.setItem('attendease_student', JSON.stringify(data));

        setUser({ id: data.profile.id });
        setProfile(data.profile);
        setSession({ access_token: data.token });
        setAuthMode('student');
        return data;
    };

    // Change password (teachers/admins only)
    const changePassword = async (newPassword) => {
        const res = await fetch(`${API_BASE}/api/auth/change-password`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session?.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ new_password: newPassword })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to change password');
        return data;
    };

    const logout = () => {
        // Fire-and-forget: don't await signOut — it may hang
        supabase.auth.signOut({ scope: 'local' }).catch(() => { });
        // Immediately clear everything
        localStorage.removeItem('attendease_student');
        for (const key of Object.keys(localStorage)) {
            if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
                localStorage.removeItem(key);
            }
        }
        setUser(null);
        setProfile(null);
        setSession(null);
        setAuthMode(null);
        setLoading(false);
        window.location.href = '/login';
    };

    const getAccessToken = () => session?.access_token || null;

    return (
        <AuthContext.Provider value={{
            user,
            profile,
            session,
            authMode,
            login,
            signUp,
            loginWithRollNumber,
            changePassword,
            logout,
            loading,
            getAccessToken
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
