import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session: s }, error }) => {
            if (error || !s?.user) {
                setUser(null);
                setProfile(null);
                setSession(null);
                setLoading(false);
                return;
            }
            setUser(s.user);
            setSession(s);
            fetchProfile(s.user.id);
        }).catch(() => setLoading(false));

        const { data: authListener } = supabase.auth.onAuthStateChange(
            async (event, s) => {
                if (event === 'SIGNED_OUT') {
                    setUser(null);
                    setProfile(null);
                    setSession(null);
                    setLoading(false);
                    return;
                }
                if (s?.user) {
                    setUser(s.user);
                    setSession(s);
                    await fetchProfile(s.user.id);
                } else {
                    setUser(null);
                    setProfile(null);
                    setSession(null);
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
            } else {
                setProfile(null);
            }
        } catch (error) {
            console.error('Failed to fetch profile', error);
            setProfile(null);
        } finally {
            setLoading(false);
        }
    };

    // Login with email and password
    const login = async (email, password) => {
        return supabase.auth.signInWithPassword({ email, password });
    };

    // Sign up new users
    const signUp = async (email, password, metadata) => {
        return supabase.auth.signUp({
            email,
            password,
            options: {
                data: metadata
            }
        });
    };

    const logout = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            setUser(null);
            setProfile(null);
            setSession(null);
            setLoading(false);
        }
    };

    // Get the access token for API calls
    const getAccessToken = () => session?.access_token || null;

    return (
        <AuthContext.Provider value={{
            user,
            profile,
            session,
            login,
            signUp,
            logout,
            loading,
            getAccessToken
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
