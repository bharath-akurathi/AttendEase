import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Lock, X, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';

const ChangePassword = ({ isOpen, onClose }) => {
    const { changePassword } = useAuth();
    const { isDark } = useTheme();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newPassword || !confirmPassword) return toast.error('Please fill all fields');
        if (newPassword !== confirmPassword) return toast.error('Passwords do not match');
        if (newPassword.length < 6) return toast.error('Password must be at least 6 characters');

        setLoading(true);
        try {
            await changePassword(newPassword);
            toast.success('Password changed successfully!');
            setNewPassword('');
            setConfirmPassword('');
            onClose();
        } catch (err) {
            toast.error(err.message || 'Failed to change password');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.2 }}
                        className="w-full max-w-sm mx-4 bg-elevated border border-violet-500/10 rounded-2xl p-6 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-violet-600/10 flex items-center justify-center">
                                    <Lock className="w-4 h-4 text-violet-400" />
                                </div>
                                <h3 className="text-heading font-semibold text-sm">Change Password</h3>
                            </div>
                            <button onClick={onClose} className="p-1.5 text-muted hover:text-heading rounded-lg transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs uppercase tracking-wider text-muted mb-1.5 font-medium">New Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Enter new password"
                                        className="w-full pl-10 pr-4 py-3 bg-input border border-theme rounded-xl text-heading placeholder-faint focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition-all text-sm" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs uppercase tracking-wider text-muted mb-1.5 font-medium">Confirm Password</label>
                                <div className="relative">
                                    <Check className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Re-enter new password"
                                        className="w-full pl-10 pr-4 py-3 bg-input border border-theme rounded-xl text-heading placeholder-faint focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition-all text-sm" />
                                </div>
                            </div>
                            <button type="submit" disabled={loading}
                                className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:from-violet-500 hover:to-purple-500 transition-all disabled:opacity-50 shadow-lg shadow-violet-600/20">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Change Password'}
                            </button>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default ChangePassword;
