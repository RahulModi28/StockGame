import React, { useState, useEffect } from 'react';
import * as api from '../api';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Switch } from '../components/ui/switch';
import { Bomb, DollarSign, Activity, Users, AlertTriangle, Newspaper, Gavel, Search, RefreshCw, Clock, Play } from 'lucide-react';

const Admin = () => {
    const [activeTab, setActiveTab] = useState('market');
    const [msg, setMsg] = useState('');

    // Market State
    const [isMarketOpen, setIsMarketOpen] = useState(true);
    const [isChaosEnabled, setIsChaosEnabled] = useState(false);
    const [volatility, setVolatility] = useState(1.0);
    const [overrideTicker, setOverrideTicker] = useState(''); // We need ID, but tickers easier. For now let's use ID or fetch companies.
    const [companies, setCompanies] = useState([]);

    // User State
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [adjustmentAmount, setAdjustmentAmount] = useState(0);

    // Analytics State
    const [whales, setWhales] = useState([]);

    // News State
    const [headline, setHeadline] = useState('');
    const [impact, setImpact] = useState(0.0);

    useEffect(() => {
        loadCompanies();
        loadMarketStatus();
    }, []);

    const [marketCycle, setMarketCycle] = useState({ trend: 'SIDEWAYS', phase: 'ACCUMULATION' });

    const loadMarketStatus = async () => {
        try {
            const res = await api.getMarketStatus();
            setIsMarketOpen(res.data.is_open);
            setIsChaosEnabled(res.data.chaos_enabled);

            // Load Cycle
            const cycleRes = await api.getMarketCycle();
            setMarketCycle(cycleRes.data);
        } catch (err) {
            console.error("Failed to load market status");
        }
    };

    const loadCompanies = async () => {
        try {
            const res = await api.getCompanies();
            setCompanies(res.data);
        } catch (err) {
            console.error("Failed to load companies");
        }
    };

    const showMsg = (message, type = 'success') => {
        setMsg(message);
        setTimeout(() => setMsg(''), 3000);
    };

    // --- Market Controls ---
    const handleMarketToggle = async () => {
        try {
            const newState = !isMarketOpen;
            await api.setMarketStatus(newState);
            setIsMarketOpen(newState);
            showMsg(`Market ${newState ? 'Opened' : 'Closed'}`);
        } catch (err) { showMsg('Failed to toggle market', 'error'); }
    };

    const handleChaosToggle = async (checked) => {
        try {
            await api.setChaosMode(checked);
            setIsChaosEnabled(checked);
            showMsg(checked ? 'Chaos Mode ENABLED 😈' : 'Chaos Mode Disabled 😇');
        } catch (err) { showMsg('Failed to update chaos mode', 'error'); }
    };

    const handleVolatilityChange = async (val) => {
        setVolatility(val); // optimistic
        try {
            await api.setVolatility(parseFloat(val));
        } catch (err) { console.error(err); }
    };



    // --- Sector Trends ---
    const [sectorTrends, setSectorTrends] = useState({});

    const loadSectorTrends = async () => {
        try {
            const res = await api.getSectorTrends();
            setSectorTrends(res.data);
        } catch (err) { console.error('Failed to load sector trends'); }
    }

    const handleSectorTrend = async (sector, trend) => {
        try {
            await api.setSectorTrend(sector, trend);
            showMsg(`${sector} set to ${trend}`);
            // Optimistic update
            setSectorTrends(prev => ({ ...prev, [sector]: trend }));
        } catch (err) { showMsg(`Failed to set trend for ${sector}`, 'error'); }
    };

    const triggerDividend = async (companyId) => {
        try {
            await api.triggerDividend(companyId, 2.0);
            showMsg('💰 Dividends Paid!');
        } catch (err) { showMsg('Error paying dividends', 'error'); }
    };

    const handlePriceOverride = async (companyId, currentPrice) => {
        const newPrice = prompt(`Enter new price for company (Current: $${currentPrice})`);
        if (!newPrice) return;

        try {
            await api.setStockPrice(companyId, parseFloat(newPrice));
            showMsg('Price Overridden');
            loadCompanies();
        } catch (err) { showMsg('Failed to override price', 'error'); }
    };

    // --- User Management ---
    const loadUsers = async () => {
        try {
            const res = await api.getAllUsers();
            setUsers(res.data);
        } catch (err) { showMsg("Failed to load users", 'error'); }
    };

    const handleBalanceAdjust = async (type) => {
        if (!selectedUser) return;
        try {
            await api.adjustBalance(selectedUser.id, parseFloat(adjustmentAmount), type);
            showMsg(`Balance ${type === 'CREDIT' ? 'Added' : 'Deducted'}`);
            loadUsers(); // refresh
        } catch (err) { showMsg('Failed to adjust balance', 'error'); }
    };

    const handleMakeAdmin = async () => {
        if (!selectedUser) return;
        if (!window.confirm(`Are you sure you want to make ${selectedUser.name} an Admin?`)) return;
        try {
            await api.makeAdmin(selectedUser.id);
            showMsg(`User ${selectedUser.name} promoted to Admin`);
            loadUsers();
        } catch (err) { showMsg('Failed to promote user', 'error'); }
    };

    const handleRemoveAdmin = async () => {
        if (!selectedUser) return;
        if (!window.confirm(`Are you sure you want to demote ${selectedUser.name}? They will lose admin privileges.`)) return;
        try {
            await api.removeAdmin(selectedUser.id);
            showMsg(`User ${selectedUser.name} demoted`);
            loadUsers();
        } catch (err) { showMsg('Failed to demote user', 'error'); }
    };

    const handleBan = async (user, status) => {
        try {
            await api.banUser(user.id, status);
            showMsg(`User ${user.name} ${status ? 'Banned' : 'Unbanned'}`);
            loadUsers();
        } catch (err) { showMsg('Failed to ban user', 'error'); }
    };

    // --- Whale Alerts ---
    const loadWhales = async () => {
        try {
            const res = await api.getWhaleAlerts();
            setWhales(res.data);
        } catch (err) { console.error(err); }
    };

    useEffect(() => {
        if (activeTab === 'analytics') {
            loadWhales();
            const interval = setInterval(loadWhales, 2000);
            return () => clearInterval(interval);
        }
        if (activeTab === 'users') {
            loadUsers();
        }
        if (activeTab === 'market') {
            loadSectorTrends();
            // Optional: poll trends too if multiple admins
        }
    }, [activeTab]);

    // --- News ---
    const postNews = async () => {
        try {
            await api.createNews({
                headline: headline,
                impact_score: parseFloat(impact),
                is_breaking: false
            });
            showMsg('News Published');
            setHeadline('');
            setImpact(0.0);
        } catch (err) { showMsg('Failed to post news', 'error'); }
    };

    // Session Management Text
    const [minutesToClose, setMinutesToClose] = useState('');

    const handleStartSession = async () => {
        if (!window.confirm("WARNING: This will RESET all stock prices to their original values and OPEN the market. Are you sure?")) return;
        try {
            const res = await api.startSession();
            showMsg(res.data.message);
            setIsMarketOpen(true);
            loadSectorTrends(); // Reset trends
        } catch (error) {
            showMsg("Failed to start session: " + error.message, 'error');
        }
    };

    const handleEndSession = async (useTimer = false) => {
        const delay = useTimer ? parseInt(minutesToClose) : 0;
        if (useTimer && (isNaN(delay) || delay <= 0)) {
            showMsg("Please enter a valid number of minutes.", 'error');
            return;
        }

        try {
            const res = await api.endSession(delay);
            showMsg(res.data.message);
            if (!useTimer) setIsMarketOpen(false);
        } catch (error) {
            showMsg("Failed to End Session: " + error.message, 'error');
        }
    };

    if (activeTab === 'loading') return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-background text-gray-500 dark:text-gray-400">Loading Admin...</div>;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-background p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <Activity className="text-blue-600" />
                        Game Master Console
                    </h1>
                    {msg && (
                        <div className="bg-blue-600 text-white px-4 py-2 rounded-lg animate-fade-in">
                            {msg}
                        </div>
                    )}
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsList className="bg-white dark:bg-card p-1 rounded-xl border border-gray-200 dark:border-border w-full justify-start">
                        <TabsTrigger value="market" className="data-[state=active]:bg-gray-100 dark:data-[state=active]:bg-gray-800 dark:text-gray-300 dark:data-[state=active]:text-white">Market Control</TabsTrigger>
                        <TabsTrigger value="users" className="data-[state=active]:bg-gray-100 dark:data-[state=active]:bg-gray-800 dark:text-gray-300 dark:data-[state=active]:text-white">User Management</TabsTrigger>
                        <TabsTrigger value="analytics" className="data-[state=active]:bg-gray-100 dark:data-[state=active]:bg-gray-800 dark:text-gray-300 dark:data-[state=active]:text-white">Whale Search (Analytics)</TabsTrigger>
                        <TabsTrigger value="news" className="data-[state=active]:bg-gray-100 dark:data-[state=active]:bg-gray-800 dark:text-gray-300 dark:data-[state=active]:text-white">Newsroom</TabsTrigger>
                    </TabsList>

                    {/* MARKET CONTROL TAB */}
                    <TabsContent value="market" className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            {/* Session Control */}
                            <Card className="p-6 bg-white dark:bg-card space-y-6 col-span-1 md:col-span-2 lg:col-span-1">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
                                        <Clock className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Session Control</h2>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex gap-4">
                                        <Button
                                            onClick={handleStartSession}
                                            className="w-full bg-green-600 hover:bg-green-700 text-white"
                                        >
                                            <Play className="w-4 h-4 mr-2" />
                                            Start New Session
                                        </Button>
                                    </div>

                                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                                        <h3 className="text-sm font-semibold mb-3 text-gray-500">End Session</h3>
                                        <div className="flex gap-4 mb-3">
                                            <Button
                                                variant="destructive"
                                                onClick={() => handleEndSession(false)}
                                                className="flex-1"
                                                disabled={!isMarketOpen}
                                            >
                                                End Immediately
                                            </Button>
                                        </div>

                                        <div className="flex gap-2 items-center">
                                            <Input
                                                type="number"
                                                placeholder="Minutes"
                                                value={minutesToClose}
                                                onChange={(e) => setMinutesToClose(e.target.value)}
                                                className="w-24"
                                                disabled={!isMarketOpen}
                                            />
                                            <Button
                                                variant="outline"
                                                onClick={() => handleEndSession(true)}
                                                className="flex-1"
                                                disabled={!isMarketOpen}
                                            >
                                                End in X Minutes
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            {/* General Controls */}
                            <Card className="p-6 bg-white dark:bg-card">
                                <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                                    <Activity className="w-5 h-5" /> Global Settings
                                </h3>
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-secondary rounded-lg">
                                        <div>
                                            <p className="font-medium">Market Status (N/A in Local)</p>
                                            <p className="text-xs text-gray-500">Halt or Resume all trading</p>
                                        </div>
                                        <Switch checked={isMarketOpen} onCheckedChange={handleMarketToggle} />
                                    </div>

                                    {/* Dow Theory Cycle Display */}
                                    <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900 rounded-lg">
                                        <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-2">Dow Theory Cycle</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-xs text-blue-600 dark:text-blue-400">Primary Trend</p>
                                                <p className="text-lg font-bold text-blue-900 dark:text-blue-100">{marketCycle?.trend || 'LOADING...'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-blue-600 dark:text-blue-400">Current Phase</p>
                                                <p className="text-lg font-bold text-blue-900 dark:text-blue-100">{marketCycle?.phase || 'LOADING...'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-secondary rounded-lg">
                                        <div>
                                            <p className="font-medium flex items-center gap-2">
                                                Risk of Chaos
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 font-bold">
                                                    DANGEROUS
                                                </span>
                                            </p>
                                            <p className="text-xs text-gray-500">Enable random rapid price fluctuations (Chaos Mode)</p>
                                        </div>
                                        <Switch checked={isChaosEnabled} onCheckedChange={handleChaosToggle} className="data-[state=checked]:bg-orange-600" />
                                    </div>



                                    <div>
                                        <label className="block text-sm font-medium mb-2">Volatility Factor ({volatility})</label>
                                        <input
                                            type="range"
                                            min="0.1"
                                            max="3.0"
                                            step="0.1"
                                            value={volatility}
                                            onChange={(e) => handleVolatilityChange(e.target.value)}
                                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                        />
                                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                                            <span>Calm</span>
                                            <span>Normal</span>
                                            <span>Chaotic</span>
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            {/* Sector Control */}
                            <Card className="p-6 bg-white dark:bg-card">
                                <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-purple-600" /> Sector Control
                                </h3>
                                <div className="space-y-6">
                                    {["Technology", "Finance", "Consumer", "Automotive", "Healthcare"].map(sector => (
                                        <div key={sector} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-secondary rounded-lg">
                                            <span className="font-medium text-gray-800 dark:text-gray-200 w-32">{sector}</span>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    className={`${sectorTrends[sector] === 'BULL' ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-green-100 text-green-700 hover:bg-green-200'} border border-green-200`}
                                                    onClick={() => handleSectorTrend(sector, 'BULL')}
                                                >
                                                    Bull 📈
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    className={`${sectorTrends[sector] === 'SIDEWAYS' ? 'bg-gray-600 text-white hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} border border-gray-200`}
                                                    onClick={() => handleSectorTrend(sector, 'SIDEWAYS')}
                                                >
                                                    Sideways ↔️
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    className={`${sectorTrends[sector] === 'BEAR' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-red-100 text-red-700 hover:bg-red-200'} border border-red-200`}
                                                    onClick={() => handleSectorTrend(sector, 'BEAR')}
                                                >
                                                    Bear 📉
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Card>


                        </div>

                        {/* Company Specific Actions */}
                        <Card className="p-6 bg-white dark:bg-card">
                            <h3 className="text-lg font-semibold mb-4">Company Overrides</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="p-3">Company</th>
                                            <th className="p-3">Price</th>
                                            <th className="p-3">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {companies.map(c => (
                                            <tr key={c.id} className="border-b last:border-0">
                                                <td className="p-3 font-medium">{c.name} ({c.ticker})</td>
                                                <td className="p-3">${c.current_price?.toFixed(2)}</td>
                                                <td className="p-3 flex gap-2">
                                                    <Button size="sm" variant="outline" onClick={() => triggerDividend(c.id)}>
                                                        Pay Dividend
                                                    </Button>
                                                    <Button size="sm" variant="outline" onClick={() => handlePriceOverride(c.id, c.current_price)}>
                                                        Set Price
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </TabsContent>

                    {/* USER MANAGEMENT TAB */}
                    <TabsContent value="users" className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* User List */}
                            <Card className="lg:col-span-2 p-6 bg-white dark:bg-card">
                                <div className="flex justify-between mb-4">
                                    <h3 className="text-lg font-semibold">Users</h3>
                                    <div className="flex gap-2">
                                        <div className="relative">
                                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                                            <Input
                                                placeholder="Search users..."
                                                className="pl-8 h-9"
                                                value={overrideTicker}
                                                onChange={(e) => setOverrideTicker(e.target.value)}
                                            />
                                        </div>
                                        <Button size="sm" variant="outline" onClick={loadUsers}><RefreshCw className="w-4 h-4" /></Button>
                                    </div>
                                </div>
                                <div className="overflow-y-auto max-h-[500px]">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b bg-gray-50 dark:bg-secondary border-gray-200 dark:border-gray-700">
                                                <th className="p-3 text-left">ID</th>
                                                <th className="p-3 text-left">Name</th>
                                                <th className="p-3 text-left">Email</th>
                                                <th className="p-3 text-right">Cash</th>
                                                <th className="p-3 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {users.filter(u => !overrideTicker || u.name.toLowerCase().includes(overrideTicker.toLowerCase())).map(u => (
                                                <tr
                                                    key={u.id}
                                                    className={`border-b border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/10 ${selectedUser?.id === u.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                                                    onClick={() => setSelectedUser(u)}
                                                >
                                                    <td className="p-3 text-sm text-gray-500 dark:text-gray-400">#{u.id}</td>
                                                    <td className="p-3 font-medium text-gray-900 dark:text-white">
                                                        {u.name} {u.is_admin && <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded ml-1">ADMIN</span>}
                                                    </td>
                                                    <td className="p-3 text-sm text-gray-500 dark:text-gray-400">{u.email || '-'}</td>
                                                    <td className="p-3 text-right font-mono text-gray-700 dark:text-gray-300">${u.cash_balance.toLocaleString()}</td>
                                                    <td className="p-3 text-right">
                                                        <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelectedUser(u); }}>
                                                            <Search className="w-4 h-4" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>

                            {/* Detailed Actions */}
                            <Card className="p-6 lg:col-span-1 h-fit bg-white dark:bg-card">
                                {selectedUser ? (
                                    <div className="space-y-6">
                                        <div>
                                            <h3 className="text-xl font-bold">{selectedUser.name}</h3>
                                            <p className="text-sm text-gray-500">ID: {selectedUser.id}</p>
                                            <p className="text-2xl font-mono mt-2">${selectedUser.cash_balance.toLocaleString()}</p>
                                        </div>

                                        <div className="space-y-2 pt-4 border-t">
                                            <label className="text-sm font-medium">Adjust Balance</label>
                                            <div className="flex gap-2">
                                                <Input
                                                    type="number"
                                                    placeholder="Amount"
                                                    value={adjustmentAmount}
                                                    onChange={(e) => setAdjustmentAmount(e.target.value)}
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <Button onClick={() => handleBalanceAdjust('CREDIT')} className="bg-green-600 hover:bg-green-700 w-full text-white">Credit</Button>
                                                <Button onClick={() => handleBalanceAdjust('DEBIT')} className="bg-red-600 hover:bg-red-700 w-full text-white">Fine</Button>
                                            </div>
                                            <div className="pt-2">
                                                {selectedUser.is_admin ? (
                                                    <Button onClick={handleRemoveAdmin} variant="outline" className="w-full border-orange-200 text-orange-600 hover:bg-orange-50 dark:border-orange-900 dark:text-orange-400 dark:hover:bg-orange-900/20">
                                                        <Activity className="w-4 h-4 mr-2" /> Demote Admin
                                                    </Button>
                                                ) : (
                                                    <Button onClick={handleMakeAdmin} variant="outline" className="w-full border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/20">
                                                        <Activity className="w-4 h-4 mr-2" /> Make as Admin
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t">
                                            <Button variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleBan(selectedUser, true)}>
                                                <Gavel className="w-4 h-4 mr-2" /> Ban User
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-gray-500">
                                        <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                        <p>Select a user to view actions</p>
                                    </div>
                                )}
                            </Card>
                        </div>
                    </TabsContent>

                    {/* ANALYTICS TAB (Whale Alert) */}
                    <TabsContent value="analytics" className="space-y-6">
                        <Card className="p-6 bg-white dark:bg-card">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                        <AlertTriangle className="text-yellow-500" /> Whale Monitor
                                    </h3>
                                    <p className="text-sm text-gray-500">Real-time trades over $20,000</p>
                                </div>
                                <div className="text-xs font-mono bg-gray-100 px-3 py-1 rounded">
                                    LIVE FEED
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b-2 border-gray-200">
                                            <th className="p-3 text-left">Time</th>
                                            <th className="p-3 text-left">User</th>
                                            <th className="p-3 text-left">Ticker</th>
                                            <th className="p-3 text-left">Type</th>
                                            <th className="p-3 text-right">Qty</th>
                                            <th className="p-3 text-right">Value</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {whales.length > 0 ? (
                                            whales.map((whale, idx) => (
                                                <tr key={idx} className="hover:bg-yellow-50 dark:hover:bg-yellow-900/10 transition-colors">
                                                    <td className="p-3 text-sm text-gray-500">
                                                        {new Date(whale.time).toLocaleTimeString()}
                                                    </td>
                                                    <td className="p-3 font-medium">{whale.user}</td>
                                                    <td className="p-3 font-bold">{whale.ticker}</td>
                                                    <td className={`p-3 uppercase font-bold text-xs ${whale.type === 'buy' ? 'text-green-600' : 'text-red-600'}`}>
                                                        {whale.type}
                                                    </td>
                                                    <td className="p-3 text-right">{whale.quantity}</td>
                                                    <td className="p-3 text-right font-mono font-bold text-gray-900 dark:text-gray-100">
                                                        ${whale.value.toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="6" className="text-center py-12 text-gray-500 italic">
                                                    No large trades detected yet...
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </TabsContent>

                    {/* NEWSROOM TAB */}
                    <TabsContent value="news" className="space-y-6">
                        <Card className="p-6 max-w-2xl mx-auto bg-white dark:bg-card">
                            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                <Newspaper className="w-5 h-5" /> Fabricate News
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Headline</label>
                                    <Input
                                        placeholder="e.g. 'Tech Sector Booms after AI breakthrough'"
                                        value={headline}
                                        onChange={(e) => setHeadline(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Impact Score (-1.0 to 1.0)</label>
                                    <Input
                                        type="number"
                                        step="0.1"
                                        value={impact}
                                        onChange={(e) => setImpact(e.target.value)}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Negative = Bearish, Positive = Bullish</p>
                                </div>
                                <Button onClick={postNews} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                                    Publish to Wire
                                </Button>
                            </div>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
};

export default Admin;
