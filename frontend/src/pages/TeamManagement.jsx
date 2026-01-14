import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { createInvite, getTeamMembers, removeMember } from '../api';
import { Users, Copy, Check, UserMinus, UserPlus } from 'lucide-react';

const TeamManagement = () => {
    const { user } = useAuth();
    const [members, setMembers] = useState([]);
    const [inviteCode, setInviteCode] = useState('');
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (user?.id) {
            loadMembers();
        }
    }, [user]);

    const loadMembers = async () => {
        try {
            const response = await getTeamMembers(user.id);
            setMembers(response.data);
        } catch (err) {
            console.error('Failed to load members:', err);
        }
    };

    const handleCreateInvite = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await createInvite(user.id);
            setInviteCode(response.data.invite_code);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to create invite');
        } finally {
            setLoading(false);
        }
    };

    const handleCopyInvite = () => {
        navigator.clipboard.writeText(inviteCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleRemoveMember = async (memberEmail) => {
        if (!confirm(`Remove ${memberEmail} from the team?`)) return;

        try {
            await removeMember(user.id, memberEmail);
            loadMembers();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to remove member');
        }
    };

    const isOwner = members.find(m => m.user_email === user?.email)?.role === 'owner';

    return (
        <div className="min-h-screen bg-fintech-bg p-6">
            <div className="max-w-4xl mx-auto">
                <div className="card p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <Users className="text-fintech-primary" size={32} />
                        <h1 className="text-3xl font-bold text-fintech-dark">Team Management</h1>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-fintech-danger p-3 rounded-xl mb-6 text-sm border border-red-100">
                            {error}
                        </div>
                    )}

                    {/* Invite Section - Only for owners */}
                    {isOwner && (
                        <div className="mb-8 p-6 bg-gradient-to-r from-fintech-primary/5 to-indigo-500/5 rounded-xl border border-fintech-primary/20">
                            <h2 className="text-xl font-bold text-fintech-dark mb-4 flex items-center gap-2">
                                <UserPlus size={24} />
                                Invite Team Members
                            </h2>

                            {!inviteCode ? (
                                <button
                                    onClick={handleCreateInvite}
                                    disabled={loading}
                                    className="btn-primary"
                                >
                                    {loading ? 'Generating...' : 'Generate Invite Code'}
                                </button>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="text"
                                            value={inviteCode}
                                            readOnly
                                            className="input-field flex-1 font-mono text-lg"
                                        />
                                        <button
                                            onClick={handleCopyInvite}
                                            className="btn-secondary flex items-center gap-2"
                                        >
                                            {copied ? (
                                                <>
                                                    <Check size={20} />
                                                    Copied!
                                                </>
                                            ) : (
                                                <>
                                                    <Copy size={20} />
                                                    Copy
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    <p className="text-sm text-fintech-muted">
                                        Share this code with your teammates. It expires in 7 days.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Members List */}
                    <div>
                        <h2 className="text-xl font-bold text-fintech-dark mb-4">
                            Team Members ({members.length})
                        </h2>

                        <div className="space-y-3">
                            {members.map((member) => (
                                <div
                                    key={member.user_email}
                                    className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:border-fintech-primary/30 transition-colors"
                                >
                                    <div>
                                        <p className="font-semibold text-fintech-dark">
                                            {member.user_email}
                                        </p>
                                        <p className="text-sm text-fintech-muted">
                                            {member.role === 'owner' ? '👑 Owner' : 'Member'} •
                                            Joined {new Date(member.joined_at).toLocaleDateString()}
                                        </p>
                                    </div>

                                    {isOwner && member.role !== 'owner' && (
                                        <button
                                            onClick={() => handleRemoveMember(member.user_email)}
                                            className="text-fintech-danger hover:bg-red-50 p-2 rounded-lg transition-colors"
                                            title="Remove member"
                                        >
                                            <UserMinus size={20} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TeamManagement;
