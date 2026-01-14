
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Card } from '../components/ui/card';
import { Shield, Award, TrendingUp, DollarSign, Activity, User, Mail, Phone, Calendar, Settings } from 'lucide-react';
import { getPortfolio } from '../api';

const Profile = () => {
    const { user } = useAuth();
    const { isDarkMode } = useTheme();
    const [portfolio, setPortfolio] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadProfile = async () => {
            if (user?.id) {
                try {
                    const res = await getPortfolio(user.id);
                    setPortfolio(res.data);
                } catch (err) {
                    console.error("Failed to load portfolio:", err);
                } finally {
                    setLoading(false);
                }
            }
        };
        loadProfile();
    }, [user]);

    const totalEquity = portfolio?.total_equity || 0;
    const cashBalance = portfolio?.cash_balance || 0;
    const portfolioValue = totalEquity - cashBalance;
    const profitLoss = portfolio?.total_profit_loss || 0;
    const initialInvestment = totalEquity - profitLoss;
    const profitLossPercentage = initialInvestment > 0 ? ((profitLoss / initialInvestment) * 100).toFixed(2) : '0.00';
    const activePositionsCount = portfolio?.holdings?.length || 0;
    const holdingTickers = portfolio?.holdings?.map(h => h.company?.ticker).join(', ') || 'None';

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-background p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Profile</h1>
                    <p className="text-gray-600 dark:text-gray-400">Manage your account and trading preferences</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Sidebar - 1 Column */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Profile Card */}
                        <Card className="p-6 bg-white dark:bg-card border-gray-200 dark:border-border flex flex-col items-center text-center shadow-sm">
                            <div className="relative mb-4">
                                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold border-4 border-white dark:border-gray-800 shadow-md">
                                    {user?.name ? user.name.substring(0, 2).toUpperCase() : 'JD'}
                                </div>
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{user?.name || 'John Doe'}</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{user?.is_admin ? 'Administrator' : 'Premium Trader'}</p>

                            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/30 rounded-full mb-6">
                                <Shield className="w-4 h-4 text-green-600 dark:text-green-400" />
                                <span className="text-xs font-medium text-green-700 dark:text-green-400">Verified Account</span>
                            </div>

                            <button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors shadow-sm">
                                Edit Profile
                            </button>
                        </Card>

                        {/* Account Stats Card */}
                        <Card className="p-6 bg-white dark:bg-card border-gray-200 dark:border-border shadow-sm">
                            <h3 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white mb-4">
                                <Award className="w-5 h-5 text-purple-600" />
                                Account Stats
                            </h3>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Member Since</span>
                                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Jan 2024</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Active Trades</span>
                                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{activePositionsCount}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Win Rate</span>
                                    <span className="text-sm font-semibold text-green-600">--%</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Account Tier</span>
                                    <span className="text-sm font-semibold text-purple-600">Premium</span>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Main Content - 2 Columns */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Portfolio Overview Card */}
                        <Card className="p-6 bg-white dark:bg-card border-gray-200 dark:border-border shadow-sm">
                            <h3 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white mb-6">
                                <TrendingUp className="w-5 h-5 text-blue-600" />
                                Portfolio Overview
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <DollarSign className="w-5 h-5 text-blue-600" />
                                        <span className="text-sm text-gray-600 dark:text-gray-400">Total Value</span>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                        {loading ? '...' : `$${totalEquity.toLocaleString()}`}
                                    </p>
                                    <p className={`text-xs mt-1 ${profitLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {profitLoss >= 0 ? '+' : ''}{profitLossPercentage}% all time
                                    </p>
                                </div>

                                <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-green-900/10 border border-green-100 dark:border-green-800 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <TrendingUp className="w-5 h-5 text-green-600" />
                                        <span className="text-sm text-gray-600 dark:text-gray-400">Total Gain</span>
                                    </div>
                                    <p className={`text-2xl font-bold ${profitLoss >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600'}`}>
                                        {loading ? '...' : `${profitLoss >= 0 ? '+' : ''}$${Math.abs(profitLoss).toLocaleString()}`}
                                    </p>
                                    <p className={`text-xs mt-1 ${profitLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                        Realized + Unrealized
                                    </p>
                                </div>

                                <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-purple-900/10 border border-purple-100 dark:border-purple-800 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Activity className="w-5 h-5 text-purple-600" />
                                        <span className="text-sm text-gray-600 dark:text-gray-400">Active Positions</span>
                                    </div>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                        {loading ? '...' : activePositionsCount}
                                    </p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">
                                        {activePositionsCount > 0 ? holdingTickers : 'No active trades'}
                                    </p>
                                </div>
                            </div>
                        </Card>

                        {/* Personal Information Card */}
                        <Card className="p-6 bg-white dark:bg-card border-gray-200 dark:border-border shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                                    <User className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                    Personal Information
                                </h3>
                                <button className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 px-3 py-1 rounded transition-colors">
                                    Edit
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Full Name</label>
                                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-muted/40 rounded-lg">
                                        <User className="w-4 h-4 text-gray-400" />
                                        <span className="text-sm text-gray-900 dark:text-white">{user?.name || 'John Doe'}</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Email Address</label>
                                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-muted/40 rounded-lg">
                                        <Mail className="w-4 h-4 text-gray-400" />
                                        <span className="text-sm text-gray-900 dark:text-white">{user?.email || 'john.doe@example.com'}</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Phone Number</label>
                                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-muted/40 rounded-lg">
                                        <Phone className="w-4 h-4 text-gray-400" />
                                        <span className="text-sm text-gray-900 dark:text-white">+1 (555) 123-4567</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Joined</label>
                                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-muted/40 rounded-lg">
                                        <Calendar className="w-4 h-4 text-gray-400" />
                                        <span className="text-sm text-gray-900 dark:text-white">January 2024</span>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
