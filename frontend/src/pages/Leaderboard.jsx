import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Trophy, Medal, Crown, Award, TrendingUp, TrendingDown } from 'lucide-react';

// --- MOCK DATA ---
const LEADERBOARD_DATA = [
    {
        rank: 1,
        name: "Alpha Traders",
        portfolio_value: 1250000,
        total_return: 250000,
        return_pct: 25.00,
        trades_count: 156,
        win_rate: 78.5,
        trend: "up",
        avatar_seed: "Alpha"
    },
    {
        rank: 2,
        name: "Phoenix Capital",
        portfolio_value: 1180000,
        total_return: 180000,
        return_pct: 18.00,
        trades_count: 142,
        win_rate: 72.3,
        trend: "up",
        avatar_seed: "Phoenix"
    },
    {
        rank: 3,
        name: "Titan Investments",
        portfolio_value: 1095000,
        total_return: 95000,
        return_pct: 9.50,
        trades_count: 98,
        win_rate: 68.9,
        trend: "down",
        avatar_seed: "Titan"
    },
    {
        rank: 4,
        name: "Neptune Holdings",
        portfolio_value: 985000,
        total_return: -15000,
        return_pct: -1.50,
        trades_count: 134,
        win_rate: 64.2,
        trend: "down",
        avatar_seed: "Neptune"
    },
    {
        rank: 5,
        name: "Delta Force",
        portfolio_value: 920000,
        total_return: -80000,
        return_pct: -8.00,
        trades_count: 87,
        win_rate: 58.6,
        trend: "down",
        avatar_seed: "Delta"
    },
    {
        rank: 6,
        name: "Echo Ventures",
        portfolio_value: 875000,
        total_return: -125000,
        return_pct: -12.50,
        trades_count: 112,
        win_rate: 55.4,
        trend: "neutral",
        avatar_seed: "Echo"
    },
    {
        rank: 7,
        name: "Bravo Securities",
        portfolio_value: 810000,
        total_return: -190000,
        return_pct: -19.00,
        trades_count: 76,
        win_rate: 52.1,
        trend: "down",
        avatar_seed: "Bravo"
    },
    {
        rank: 8,
        name: "Charlie Group",
        portfolio_value: 765000,
        total_return: -235000,
        return_pct: -23.50,
        trades_count: 93,
        win_rate: 48.3,
        trend: "down",
        avatar_seed: "Charlie"
    }
];

const TIME_FILTERS = [
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'all', label: 'All Time' }
];

const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(val);
};

import { getLeaderboard } from '../api';

const Leaderboard = () => {
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [timeFilter, setTimeFilter] = useState('weekly');

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const response = await getLeaderboard();
                const mappedData = response.data.map((team, index) => ({
                    rank: index + 1,
                    name: team.name,
                    portfolio_value: team.total_value,
                    total_return: team.total_value - 100000,
                    return_pct: ((team.total_value - 100000) / 100000) * 100,
                    trades_count: team.trades_count || 0,
                    win_rate: team.win_rate || 0,
                    trend: team.trend || "neutral",
                    avatar_seed: team.avatar_seed || team.name
                }));
                setLeaderboard(mappedData);
            } catch (error) {
                console.error("Failed to fetch leaderboard:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboard();
    }, []);

    if (loading) return <div className="p-8 text-center">Loading Leaderboard...</div>;

    const topThree = leaderboard.slice(0, 3);
    // ... (keep getRankIcon, getTrendIcon, getPodiumStyles helper functions)

    const getRankIcon = (rank) => {
        if (rank === 1) return <Crown className="w-6 h-6 text-yellow-500" />;
        if (rank === 2) return <Medal className="w-6 h-6 text-gray-400" />;
        if (rank === 3) return <Award className="w-6 h-6 text-amber-700" />;
        return <span className="text-lg font-semibold text-gray-600">#{rank}</span>;
    };

    const getTrendIcon = (trend) => {
        if (trend === 'up') return <TrendingUp className="w-5 h-5 text-green-500 mx-auto" />;
        if (trend === 'down') return <TrendingDown className="w-5 h-5 text-red-500 mx-auto" />;
        return <div className="w-5 h-0.5 bg-gray-400 mx-auto" />;
    };

    const getPodiumStyles = (rank) => {
        if (rank === 1) return {
            gradient: 'from-yellow-50 to-amber-50',
            border: 'border-yellow-200',
            icon: <Crown className="w-6 h-6 text-yellow-500" />
        };
        if (rank === 2) return {
            gradient: 'from-gray-50 to-slate-50',
            border: 'border-gray-200',
            icon: <Medal className="w-6 h-6 text-gray-400" />
        };
        return {
            gradient: 'from-orange-50 to-amber-50',
            border: 'border-orange-200',
            icon: <Award className="w-6 h-6 text-amber-700" />
        };
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-background p-4 md:p-8 space-y-6">

            {/* 1. Header Section */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <Trophy className="w-8 h-8 text-yellow-500" />
                        Leaderboard
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Top performing teams in the trading competition</p>
                </div>

                {/* Time Filters */}
                <div className="flex gap-2 bg-gray-100 dark:bg-card p-1 rounded-lg self-start md:self-auto">
                    {TIME_FILTERS.map(filter => (
                        <Button
                            key={filter.id}
                            size="sm"
                            variant={timeFilter === filter.id ? 'default' : 'ghost'}
                            onClick={() => setTimeFilter(filter.id)}
                            className="text-xs"
                        >
                            {filter.label}
                        </Button>
                    ))}
                </div>
            </div>

            {/* 2. Top 3 Podium Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {topThree.map((team) => {
                    // Map ranks to vibrant solid colors to match Dashboard style
                    const getRankStyle = (rank) => {
                        if (rank === 1) return { bg: 'bg-yellow-500', iconName: 'Gold' };
                        if (rank === 2) return { bg: 'bg-slate-500', iconName: 'Silver' };
                        return { bg: 'bg-amber-600', iconName: 'Bronze' };
                    };
                    const style = getRankStyle(team.rank);

                    return (
                        <div key={team.name} className={`${style.bg} text-white rounded-xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between h-full min-h-[180px]`}>
                            <div className="relative z-10 flex flex-col h-full justify-between">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm shrink-0">
                                        <span className="font-bold text-sm">#{team.rank}</span>
                                    </div>
                                    <span className="text-sm font-medium text-white/90 truncate">{team.name}</span>
                                </div>
                                <div>
                                    <p className="text-[48px] font-semibold tracking-tight leading-none mb-[1px]">
                                        {formatCurrency(team.portfolio_value).replace('.00', '')}
                                    </p>
                                    <p className="text-xs text-white/75 flex items-center gap-1 font-medium mt-1">
                                        {team.return_pct >= 0 ? <TrendingUp className="w-3 h-3" strokeWidth={1.5} /> : <TrendingDown className="w-3 h-3" strokeWidth={1.5} />}
                                        {team.return_pct >= 0 ? '+' : ''}{team.return_pct.toFixed(2)}% Return
                                    </p>
                                </div>
                            </div>
                            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-3xl pointer-events-none" />
                        </div>
                    );
                })}
            </div>

            {/* 3. Full Leaderboard Table Section */}
            <Card className="overflow-hidden bg-white dark:bg-card">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-border">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider text-left">Rank</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider text-left">Team</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider text-right">Portfolio Value</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider text-right">Total Return</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider text-right">Return %</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider text-right">Trades</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider text-right">Win Rate</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider text-center">Trend</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {leaderboard.map((team) => (
                                <tr key={team.name} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center justify-center w-10">
                                            {getRankIcon(team.rank)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <img
                                                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${team.avatar_seed}`}
                                                alt={team.name}
                                                className="w-10 h-10 rounded-full"
                                            />
                                            <span className="font-medium text-gray-900 dark:text-white">{team.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-gray-900 dark:text-white">
                                        {formatCurrency(team.portfolio_value)}
                                    </td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-right font-medium ${team.total_return >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {team.total_return >= 0 ? '+' : ''}{formatCurrency(team.total_return)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${team.return_pct >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                            }`}>
                                            {team.return_pct >= 0 ? '+' : ''}{team.return_pct.toFixed(2)}%
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 dark:text-gray-400">
                                        {team.trades_count}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 dark:text-gray-400">
                                        {team.win_rate.toFixed(1)}%
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        {getTrendIcon(team.trend)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default Leaderboard;
