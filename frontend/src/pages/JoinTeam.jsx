import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { joinTeam } from '../api';
import { UserPlus, ArrowRight } from 'lucide-react';

const JoinTeam = () => {
    const [inviteCode, setInviteCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { user } = useAuth();

    const handleJoin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await joinTeam(inviteCode.trim());
            // Refresh the page to load the new team
            window.location.href = '/market';
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to join team');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-fintech-bg flex items-center justify-center p-4">
            <div className="card w-full max-w-md p-8">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-fintech-primary to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-6 text-white">
                        <UserPlus size={32} />
                    </div>
                    <h1 className="text-3xl font-bold text-fintech-dark tracking-tight">
                        Join a Team
                    </h1>
                    <p className="text-fintech-muted mt-2 text-center">
                        Enter the invite code shared by your team
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 text-fintech-danger p-3 rounded-xl mb-6 text-sm text-center font-bold border border-red-100">
                        {error}
                    </div>
                )}

                <form onSubmit={handleJoin} className="space-y-6">
                    <div>
                        <label className="text-label block mb-2">Invite Code</label>
                        <input
                            type="text"
                            className="input-field font-mono text-lg"
                            placeholder="TRADE-ABC123"
                            value={inviteCode}
                            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                            required
                        />
                        <p className="text-xs text-fintech-muted mt-2">
                            Format: TRADE-XXXXXX
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !inviteCode}
                        className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                        {loading ? 'Joining...' : 'Join Team'}
                        <ArrowRight size={20} />
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button
                        onClick={() => navigate('/market')}
                        className="text-fintech-primary hover:underline text-sm"
                    >
                        ← Back to Dashboard
                    </button>
                </div>
            </div>
        </div>
    );
};

export default JoinTeam;
