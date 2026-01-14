import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getPortfolio, getCompanies, getNews, placeTrade, buyInsiderTip, createLimitOrder, getLimitOrders, cancelLimitOrder, updateLimitOrder } from '../api';
import TradeModal from '../components/TradeModal';
import { PieChart, Wallet, TrendingUp, ArrowUp, ArrowDown, Clock, Lock, Zap, Menu, X, DollarSign, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../components/ui/card';
import MarketChart from '../components/MarketChart';





const CountdownTimer = ({ targetDate }) => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = new Date().getTime();
            const target = new Date(targetDate).getTime();
            const distance = target - now;

            if (distance < 0) {
                return "00:00";
            }

            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        };

        // Initial set
        setTimeLeft(calculateTimeLeft());

        const timer = setInterval(() => {
            const left = calculateTimeLeft();
            setTimeLeft(left);
            if (left === "00:00") clearInterval(timer);
        }, 1000);

        return () => clearInterval(timer);
    }, [targetDate]);

    return <>{timeLeft}</>;
};

const Dashboard = () => {
    const { user } = useAuth();
    const [portfolio, setPortfolio] = useState(null);
    const [companies, setCompanies] = useState([]);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('positions');
    const [stockFilter, setStockFilter] = useState('ALL'); // 'ALL', 'GAINERS', 'LOSERS'

    // Interactivity State
    const [selectedStock, setSelectedStock] = useState(null);
    const [realtimePrice, setRealtimePrice] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalType, setModalType] = useState('BUY'); // 'BUY' or 'SELL'
    const [tradeLoading, setTradeLoading] = useState(false);
    const [news, setNews] = useState([]);

    // Notification State
    const [showNotification, setShowNotification] = useState(false);
    const [notificationData, setNotificationData] = useState(null);
    const lastNewsIdRef = React.useRef(0);
    const [closingTime, setClosingTime] = useState(null);
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        if (!closingTime) return;

        const timer = setInterval(() => {
            const now = new Date().getTime();
            const distance = new Date(closingTime).getTime() - now;

            if (distance < 0) {
                clearInterval(timer);
                setClosingTime(null);
                setTimeLeft('CLOSED');
                return;
            }

            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            setTimeLeft(`${minutes}m ${seconds}s`);
        }, 1000);

        return () => clearInterval(timer);
    }, [closingTime]);

    // State for blocking polling during active updates
    const isUpdatingRef = useRef(false);
    const lastSessionStartRef = useRef(null);

    useEffect(() => {
        if (user?.id) {
            loadData();
            // Poll for real-time updates
            const interval = setInterval(() => {
                if (!isUpdatingRef.current) {
                    refreshMarketData();
                }
            }, 5000); // 5 seconds
            return () => clearInterval(interval);
        }
    }, [user]);

    const refreshMarketData = async () => {
        if (isUpdatingRef.current) return; // double check

        try {
            // Fetch companies independently to ensure price updates
            try {
                const statusRes = await getMarketStatus();
                // Check if session restarted
                const newSessionStart = statusRes.data.session_start_time;
                if (lastSessionStartRef.current && newSessionStart && newSessionStart !== lastSessionStartRef.current) {
                    console.log("Session Reset Detected. Reloading...");
                    window.location.reload();
                    return;
                }
                if (newSessionStart) {
                    lastSessionStartRef.current = newSessionStart;
                }

                setIsMarketOpen(statusRes.data.is_open);
                setChaosMode(statusRes.data.chaos_enabled);

                // --- Circuit Breaker & Halt Checks ---
                const companiesRes = await getCompanies();
                setCompanies(companiesRes.data);

                // Update selectedStock with new data
                setSelectedStock(prev => {
                    if (!prev) return null;
                    const updated = companiesRes.data.find(c => c.id === prev.id);
                    return updated || prev;
                });
            } catch (compError) {
                console.error("Failed to fetch companies:", compError);
            }

            // Fetch News (Non-blocking)
            try {
                const newsRes = await getNews();
                const alertCandidates = (newsRes.data || []);
                const displayNews = alertCandidates.filter(item =>
                    !item.headline.startsWith("⚠️ MARKET CLOSING") &&
                    !item.headline.startsWith("WHALE ALERT")
                );
                setNews(displayNews);

                if (alertCandidates.length > 0) {
                    const latest = alertCandidates[0];
                    if (latest.id > lastNewsIdRef.current) {
                        lastNewsIdRef.current = latest.id;
                        if (latest.is_breaking) {
                            setNotificationData({
                                mode: 'ALERT',
                                headline: latest.headline,
                                subtext: `Market Alert • ${new Date().toLocaleTimeString()}`
                            });
                            setShowNotification(true);
                            setTimeout(() => setShowNotification(false), 10000);
                        }
                    }
                }
            } catch (newsError) {
                console.warn("Failed to fetch news:", newsError);
            }

            // Refresh portfolio and orders (Non-blocking)
            if (user?.id) {
                try {
                    const [portfolioRes, ordersRes] = await Promise.all([
                        getPortfolio(user.id),
                        getLimitOrders(user.id)
                    ]);
                    setPortfolio(portfolioRes.data);
                    // Only update orders if we're not dragging/updating (redundant but safe)
                    if (!isUpdatingRef.current) {
                        setOrders(ordersRes.data);
                    }
                } catch (portError) {
                    console.warn("Failed to fetch portfolio/orders:", portError);
                }
            }
        } catch (error) {
            console.error("Critical error in refreshLoop:", error);
        }
    };



    // Set default selected stock when companies load
    useEffect(() => {
        if (companies.length > 0 && !selectedStock) {
            setSelectedStock(companies[0]);
        }
    }, [companies]);

    // Update companies list with realtime price to sync cards
    useEffect(() => {
        if (selectedStock && realtimePrice) {
            setCompanies(prev => prev.map(c =>
                c.id === selectedStock.id
                    ? { ...c, current_price: realtimePrice }
                    : c
            ));
        }
    }, [realtimePrice, selectedStock?.id]);

    // Reset realtime price when selection changes
    useEffect(() => {
        setRealtimePrice(null);
    }, [selectedStock?.id]);

    const loadData = async () => {
        try {
            // Load critical data first to unblock render
            const [portfolioRes, companiesRes, ordersRes] = await Promise.all([
                getPortfolio(user.id),
                getCompanies(),
                getLimitOrders(user.id)
            ]);
            setPortfolio(portfolioRes.data);
            setCompanies(companiesRes.data);
            setOrders(ordersRes.data);
            setLoading(false); // Enable UI immediately

            // Load non-critical data in background
            try {
                const newsRes = await getNews();
                const allNews = newsRes.data || [];
                // Set lastNewsId from the raw feed so we don't re-trigger old alerts
                const latestNews = allNews;

                if (latestNews.length > 0) {
                    lastNewsIdRef.current = latestNews[0].id;

                    // Check if the latest is a closing alert and if it's still valid
                    const latest = latestNews[0];
                    const closeMatch = latest.headline.match(/⚠️ MARKET CLOSING IN (\d+) MINUTES!/);
                    if (closeMatch) {
                        const minutes = parseInt(closeMatch[1]);
                        // Fix: Backend sends naive UTC string, frontend parses as local. Append 'Z' to force UTC.
                        let dateStr = latest.released_at || latest.created_at || new Date().toISOString();
                        if (!dateStr.endsWith('Z')) dateStr += 'Z';

                        const releaseTime = new Date(dateStr).getTime();
                        const targetTime = releaseTime + (minutes * 60 * 1000);

                        if (targetTime > Date.now()) {
                            setClosingTime(targetTime);
                        }
                    }
                }

                // For display, also hide market closing alerts and whale alerts
                const displayNews = allNews.filter(item =>
                    !item.headline.startsWith("⚠️ MARKET CLOSING") &&
                    !item.headline.startsWith("WHALE ALERT")
                );
                setNews(displayNews);
            } catch (newsError) {
                console.warn('Background news fetch failed:', newsError);
            }
        } catch (error) {
            console.error('Failed to load critical data:', error);
            setLoading(false); // Ensure we don't get stuck in loading state
        }
    };

    const handleUpdateOrder = async (orderId, newPrice) => {
        const orderToUpdate = orders.find(o => o.id === orderId);
        if (!orderToUpdate) return;

        // 1. BLOCK POLLING & Optimistic Update
        isUpdatingRef.current = true;

        // Store original state for rollback
        const oldOrders = [...orders];
        const roundedPrice = parseFloat(newPrice.toFixed(2));

        // Optimistically update the UI line to the new price immediately
        setOrders(prev => prev.map(o =>
            o.id === orderId ? { ...o, trigger_price: roundedPrice } : o
        ));

        try {
            // 2. Perform Backend Operations
            // A. Cancel Old
            await cancelLimitOrder(user.id, orderId);

            // B. Create New
            const newOrderPayload = {
                company_id: orderToUpdate.company_id,
                type: orderToUpdate.type,
                quantity: orderToUpdate.quantity,
                trigger_price: roundedPrice
            };

            const res = await createLimitOrder(user.id, newOrderPayload);
            const createdOrder = res.data;

            // 3. Confirm Update in State (Replace Old ID with New ID)
            // This prevents "snapping" because we seamlessly swap the order object
            setOrders(prev => prev.map(o =>
                o.id === orderId ? createdOrder : o
            ).filter(o => o.id !== orderId || o === createdOrder)); // Safety filter

        } catch (error) {
            console.error("Failed to move order:", error);
            setOrders(oldOrders); // Revert on failure
            alert(`Failed to update order: ${error.message}`);
        } finally {
            isUpdatingRef.current = false;
        }
    };

    const handleCancelOrder = async (orderId) => {
        try {
            await cancelLimitOrder(user.id, orderId);
            await loadData();
        } catch (error) {
            console.error("Failed to cancel order:", error);
            alert("Failed to cancel order");
        }
    };


    const handleTradeClick = (type, stock = null) => {
        if (stock) setSelectedStock(stock);
        setModalType(type);
        setIsModalOpen(true);
    };

    const executeTrade = async (quantity, stopLoss, takeProfit) => {
        if (!selectedStock) return;
        setTradeLoading(true);
        try {
            // 1. Place the main trade
            await placeTrade(user.id, {
                company_id: selectedStock.id,
                type: modalType.toLowerCase(),
                quantity: quantity
            });

            // 2. Create Limit Orders (Stop Loss / Take Profit) if applicable
            // Only applicable for BUY orders (protecting the long position)
            if (modalType === 'BUY' && (stopLoss || takeProfit)) {
                const promises = [];
                if (stopLoss) {
                    promises.push(createLimitOrder(user.id, {
                        company_id: selectedStock.id,
                        type: "STOP_LOSS",
                        trigger_price: stopLoss,
                        quantity: quantity
                    }));
                }
                if (takeProfit) {
                    promises.push(createLimitOrder(user.id, {
                        company_id: selectedStock.id,
                        type: "TAKE_PROFIT",
                        trigger_price: takeProfit,
                        quantity: quantity
                    }));
                }
                await Promise.all(promises);
            }

            await loadData(); // Reload all data to update portfolio/cash

            // Check for High Value Trade Notification
            const totalValue = selectedStock.current_price * quantity;
            if (totalValue > 20000) {
                setNotificationData({
                    type: modalType.toLowerCase() === 'buy' ? 'bought' : 'sold',
                    value: totalValue,
                    ticker: selectedStock.ticker
                });
                setShowNotification(true);
                setTimeout(() => setShowNotification(false), 15000);
            }

            setIsModalOpen(false);

            // Optional: Success notification could go here
        } catch (error) {
            console.error('Trade failed:', error);
            alert('Trade failed: ' + (error.response?.data?.detail || error.message));
        } finally {
            setTradeLoading(false);
        }
    };

    const handleBuyIntel = async () => {
        if (!confirm('Buy Insider Intel for $5,000?')) return;
        try {
            await buyInsiderTip(user.id);
            await loadData();
            alert('Intel purchased! Check your email or notifications.');
        } catch (error) {
            alert('Failed to buy intel: ' + (error.response?.data?.detail || 'Insufficient funds'));
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-gray-500">Loading...</div>
            </div>
        );
    }

    const totalEquity = portfolio?.total_equity || 0;
    const cashBalance = portfolio?.cash_balance || 0;
    const portfolioValue = totalEquity - cashBalance;
    const profitLoss = portfolio?.total_profit_loss || 0;
    // Calculate percentage based on initial investment (Equity - P&L)
    const initialInvestment = totalEquity - profitLoss;
    const profitLossPercentage = initialInvestment > 0 ? ((profitLoss / initialInvestment) * 100).toFixed(2) : '0.00';

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-background overflow-x-hidden">
            <main className="p-4 md:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8">
                    {/* Main Content */}
                    <div className="space-y-8 min-w-0">
                        {/* Welcome Section */}
                        {/* Welcome Section */}
                        <div>
                            <div className="mb-6">
                                <h1 className="text-2xl md:text-3xl font-semibold mb-2 text-gray-900 dark:text-white">
                                    👋 Hi {user?.name || 'User'}, Welcome Back
                                </h1>
                                <p className="text-gray-500 dark:text-gray-400">Trusted your money with small risk</p>
                            </div>

                            {/* KPI Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Total Equity Card */}
                                <div className="bg-gradient-to-br from-orange-400 to-orange-500 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
                                    {/* Decorative bubble */}
                                    <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full"></div>

                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                            <PieChart className="w-6 h-6" />
                                        </div>
                                        <span className="text-white/90">Total Equity</span>
                                    </div>
                                    <div className="mt-6">
                                        <div className="text-3xl font-semibold mb-2">
                                            ${(portfolioValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                        <div className="text-white/60 text-sm">Holdings Value</div>
                                    </div>
                                </div>

                                {/* Cash Balance Card */}
                                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
                                    {/* Decorative bubble */}
                                    <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full"></div>

                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                            <Wallet className="w-6 h-6" />
                                        </div>
                                        <span className="text-white/90">Cash Balance</span>
                                    </div>
                                    <div className="mt-6">
                                        <div className="text-3xl font-semibold mb-2">
                                            ${(portfolio?.cash_balance || cashBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                        <div className="text-white/70 text-sm">Available funds</div>
                                    </div>
                                </div>

                                {/* Portfolio Value Card */}
                                <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
                                    {/* Decorative bubble */}
                                    <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full"></div>

                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                                            <TrendingUp className="w-6 h-6" />
                                        </div>
                                        <span className="text-white/90">Portfolio Value</span>
                                    </div>
                                    <div className="mt-6">
                                        <div className="text-3xl font-semibold mb-2">
                                            ${(portfolio?.total_equity || totalEquity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                        <div className="text-white/70 text-sm flex items-center gap-1">
                                            <ArrowUp className={`w-4 h-4 ${profitLoss < 0 ? 'rotate-180' : ''}`} />
                                            <span>{Math.abs(profitLossPercentage)}% All Time Return</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Chart Section */}
                        <div className="bg-white dark:bg-card p-8 rounded-xl shadow-sm border border-gray-100 dark:border-border">
                            {/* Clean Header - Matching Screenshot */}
                            <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h2 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                                            {selectedStock?.ticker || 'SELECT'}
                                        </h2>
                                        {selectedStock?.is_halted ? (
                                            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                                                <span className="relative flex h-2 w-2">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                                </span>
                                                <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wide">
                                                    TRADING HALTED
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-green-100 text-green-600 dark:bg-green-500/10 dark:text-green-400 uppercase tracking-wide">
                                                LIVE
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-baseline gap-3">
                                        <span className="text-6xl font-extrabold text-gray-900 dark:text-white tracking-tighter">
                                            ${(realtimePrice || selectedStock?.current_price)?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                                        </span>
                                        <span className="text-sm font-bold text-emerald-500 tracking-wide uppercase mb-2">
                                            Current Price
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        {(() => {
                                            const current = realtimePrice || selectedStock?.current_price || 0;
                                            const open = selectedStock?.opening_price || current || 1;
                                            const diff = current - open;
                                            const pct = ((diff / open) * 100).toFixed(2);
                                            const isPos = diff >= 0;
                                            return (
                                                <>
                                                    <span className={`text-lg font-bold ${isPos ? 'text-emerald-500' : 'text-red-500'}`}>
                                                        {isPos ? '+' : ''}{pct}%
                                                    </span>
                                                    <span className="text-sm font-medium text-gray-400">Today</span>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>

                                <div className="flex gap-4 mb-2">
                                    <button
                                        onClick={() => handleTradeClick('BUY')}
                                        disabled={!selectedStock || selectedStock?.is_halted}
                                        className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-bold px-12 py-4 rounded-xl transition-all shadow-lg shadow-green-500/20 active:scale-95"
                                    >
                                        BUY
                                    </button>
                                    <button
                                        onClick={() => handleTradeClick('SELL')}
                                        disabled={!selectedStock || selectedStock?.is_halted}
                                        className="bg-white dark:bg-card border-2 border-red-500 text-red-500 hover:bg-red-50 disabled:opacity-50 text-sm font-bold px-12 py-4 rounded-xl transition-all active:scale-95"
                                    >
                                        SELL
                                    </button>
                                </div>
                            </div>

                            {/* Scrolling News Ticker */}
                            <div className="relative w-full bg-gray-50 dark:bg-gray-800/50 rounded-lg overflow-hidden border border-gray-100 dark:border-gray-700 mb-8 h-10 flex items-center">
                                <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-gray-50 dark:from-gray-800 to-transparent z-10" />
                                <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-gray-50 dark:from-gray-800 to-transparent z-10" />

                                <motion.div
                                    className="flex items-center gap-12 whitespace-nowrap pl-4"
                                    animate={{ x: [0, -1000] }}
                                    transition={{
                                        repeat: Infinity,
                                        duration: 40,
                                        ease: "linear",
                                        repeatType: "loop"
                                    }}
                                >
                                    {news.length > 0 ? news.concat(news).map((item, i) => ( // Duplicate for seamless loop
                                        <div key={i} className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                            <span>{item.headline || item.title}</span>
                                            <span className="text-gray-400 opacity-60 ml-1">
                                                - {new Date(item.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    )) : (
                                        <div className="flex items-center gap-8 text-xs font-medium text-gray-500">
                                            <span>Waiting for market news...</span>
                                            <span>Global markets awaiting opening bells...</span>
                                            <span>Analyst ratings expected shortly...</span>
                                        </div>
                                    )}
                                </motion.div>
                            </div>

                            <div className="h-[400px] w-full relative overflow-hidden flex items-center justify-center">
                                {selectedStock?.id ? (
                                    <MarketChart
                                        key={selectedStock.id}
                                        companyId={selectedStock.id}
                                        orders={orders.filter(o => o.company_id === selectedStock.id)}
                                        currentPosition={portfolio?.holdings?.find(h => h.company?.id === selectedStock.id)}
                                        onCancelOrder={handleCancelOrder}
                                        onUpdateOrder={handleUpdateOrder}
                                        onPriceUpdate={(price) => setRealtimePrice(price)}
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-gray-500">
                                        Select a stock to view chart
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Holdings Section */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.5 }}
                        >
                            {/* Trading Panel - Replaces Holdings */}
                            <div className="bg-white dark:bg-card p-6 rounded-xl shadow-lg">
                                {/* Tabs Navigation */}
                                <div className="flex gap-6 border-b border-gray-200 dark:border-gray-700 mb-6">
                                    {['Positions', 'Orders', 'History'].map((tab) => (
                                        <button
                                            key={tab}
                                            className={`pb-3 px-1 text-sm font-medium transition-colors relative ${activeTab === tab.toLowerCase()
                                                ? 'text-gray-900 dark:text-white'
                                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                                }`}
                                            onClick={() => setActiveTab(tab.toLowerCase())}
                                        >
                                            {tab}
                                            {activeTab === tab.toLowerCase() && (
                                                <motion.div
                                                    layoutId="activeTab"
                                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900 dark:bg-white"
                                                />
                                            )}
                                        </button>
                                    ))}
                                </div>

                                {/* Positions Table */}
                                {(activeTab === 'positions' || activeTab === 'viewed') && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-gray-200 dark:border-gray-700">
                                                    <th className="py-2 px-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Symbol</th>
                                                    <th className="py-2 px-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Qty</th>
                                                    <th className="py-2 px-3 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Avg. Price</th>
                                                    <th className="py-2 px-3 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Value</th>
                                                    <th className="py-2 px-3 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">P&L</th>
                                                    <th className="py-2 px-3 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {portfolio?.holdings && portfolio.holdings.length > 0 ? (
                                                    portfolio.holdings.map((position, index) => (
                                                        <tr key={index} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                            <td className="py-3 px-3 font-bold text-sm text-gray-900 dark:text-white">
                                                                {position.company?.ticker || position.company?.name || 'UNKNOWN'}
                                                            </td>
                                                            <td className="py-3 px-3 text-sm text-gray-900 dark:text-gray-300">
                                                                {position.quantity}
                                                            </td>
                                                            <td className="py-3 px-3 text-right text-sm text-gray-900 dark:text-gray-300">
                                                                ${position.average_buy_price?.toLocaleString()}
                                                            </td>
                                                            <td className="py-3 px-3 text-right text-sm text-gray-900 dark:text-gray-300">
                                                                ${position.current_value?.toLocaleString()}
                                                            </td>
                                                            <td className={`py-3 px-3 text-right font-bold text-sm ${position.profit_loss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                                {position.profit_loss >= 0 ? '+' : ''}${Math.abs(position.profit_loss).toLocaleString()}
                                                            </td>
                                                            <td className="py-3 px-3 text-right">
                                                                <button
                                                                    onClick={() => {
                                                                        const ticker = position.company?.ticker;
                                                                        const stock = companies.find(c => c.ticker === ticker);
                                                                        handleTradeClick('SELL', stock || {
                                                                            id: position.company?.id,
                                                                            ticker: ticker,
                                                                            name: position.company?.name,
                                                                            current_price: position.company?.current_price
                                                                        });
                                                                    }}
                                                                    className="text-xs border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-1 rounded transition-colors"
                                                                >
                                                                    Close
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan="6" className="text-center py-8 text-gray-500">
                                                            No active positions found
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Active Orders Table (Pending Limit Orders) */}
                                {activeTab === 'orders' && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-gray-200 dark:border-gray-700">
                                                    <th className="py-2 px-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Symbol</th>
                                                    <th className="py-2 px-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Type</th>
                                                    <th className="py-2 px-3 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Qty</th>
                                                    <th className="py-2 px-3 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Trigger Price</th>
                                                    <th className="py-2 px-3 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {orders && orders.length > 0 ? (
                                                    orders.map((order, index) => {
                                                        const company = companies.find(c => c.id === order.company_id);
                                                        return (
                                                            <tr key={index} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                                <td className="py-3 px-3 font-bold text-sm text-gray-900 dark:text-white">
                                                                    {company?.ticker || 'UNKNOWN'}
                                                                </td>
                                                                <td className={`py-3 px-3 text-sm font-semibold uppercase ${order.type === 'STOP_LOSS' ? 'text-red-500' : 'text-emerald-500'}`}>
                                                                    {order.type.replace('_', ' ')}
                                                                </td>
                                                                <td className="py-3 px-3 text-right text-sm text-gray-900 dark:text-gray-300">
                                                                    {order.quantity}
                                                                </td>
                                                                <td className="py-3 px-3 text-right text-sm text-gray-900 dark:text-gray-300">
                                                                    ${parseFloat(order.trigger_price).toFixed(2)}
                                                                </td>
                                                                <td className="py-3 px-3 text-right">
                                                                    <button
                                                                        onClick={() => handleCancelOrder(order.id)}
                                                                        className="text-xs border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1 rounded transition-colors"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                ) : (
                                                    <tr>
                                                        <td colSpan="5" className="text-center py-8 text-gray-500">
                                                            No active orders found
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* History Table (All Executed Trades) */}
                                {activeTab === 'history' && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-gray-200 dark:border-gray-700">
                                                    <th className="py-2 px-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Time</th>
                                                    <th className="py-2 px-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Symbol</th>
                                                    <th className="py-2 px-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Type</th>
                                                    <th className="py-2 px-3 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Qty</th>
                                                    <th className="py-2 px-3 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Price</th>
                                                    <th className="py-2 px-3 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {portfolio?.recent_trades && portfolio.recent_trades.length > 0 ? (
                                                    portfolio.recent_trades.map((trade, index) => (
                                                        <tr key={index} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                            <td className="py-3 px-3 text-sm text-gray-500 dark:text-gray-400">
                                                                {new Date(trade.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                <span className="text-xs text-gray-400 block">{new Date(trade.timestamp).toLocaleDateString()}</span>
                                                            </td>
                                                            <td className="py-3 px-3 font-bold text-sm text-gray-900 dark:text-white">
                                                                {trade.ticker}
                                                            </td>
                                                            <td className={`py-3 px-3 text-sm font-semibold uppercase ${trade.type === 'buy' ? 'text-green-600' : 'text-red-600'}`}>
                                                                {trade.type}
                                                            </td>
                                                            <td className="py-3 px-3 text-right text-sm text-gray-900 dark:text-gray-300">
                                                                {trade.quantity}
                                                            </td>
                                                            <td className="py-3 px-3 text-right text-sm text-gray-900 dark:text-gray-300">
                                                                ${trade.price.toLocaleString()}
                                                            </td>
                                                            <td className="py-3 px-3 text-right text-sm text-gray-900 dark:text-gray-300">
                                                                ${(trade.price * trade.quantity).toLocaleString()}
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan="6" className="text-center py-8 text-gray-500">
                                                            No trade history found
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>

                    {/* Sidebar */}
                    <aside className="lg:sticky lg:top-8 lg:h-fit space-y-6">
                        {/* Stocks List Component */}
                        <div className="bg-white dark:bg-card p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-border">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Stocks</h3>
                                <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                                    {['ALL', 'GAINERS', 'LOSERS'].map((tab) => (
                                        <button
                                            key={tab}
                                            onClick={() => setStockFilter(tab)}
                                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${stockFilter === tab
                                                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
                                                }`}
                                        >
                                            {tab.charAt(0) + tab.slice(1).toLowerCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                                {companies.filter(c => {
                                    if (stockFilter === 'ALL') return true;
                                    const change = c.current_price - (c.opening_price || c.current_price);
                                    return stockFilter === 'GAINERS' ? change > 0 : change < 0;
                                }).sort((a, b) => { // Sort by magnitude of change if filtered
                                    if (stockFilter === 'ALL') return 0; // Default order (usually ID or ticker)
                                    const getPct = (c) => (c.current_price - (c.opening_price || c.current_price)) / (c.opening_price || c.current_price);
                                    return stockFilter === 'GAINERS' ? getPct(b) - getPct(a) : getPct(a) - getPct(b);
                                }).map((company, index) => {
                                    // Calculate real-time change
                                    const openingPrice = company.opening_price || company.current_price;
                                    const changeAmount = company.current_price - openingPrice;
                                    const changePercent = ((changeAmount / openingPrice) * 100).toFixed(2);
                                    const isPositive = changeAmount >= 0;

                                    const colors = ['bg-blue-500', 'bg-pink-500', 'bg-orange-500', 'bg-red-500', 'bg-blue-600', 'bg-blue-700', 'bg-gray-900'];

                                    return (
                                        <div
                                            key={company.ticker}
                                            onClick={() => setSelectedStock(company)}
                                            className={`flex items-center justify-between group cursor-pointer p-2 rounded-lg transition-colors ${selectedStock?.ticker === company.ticker ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 ${colors[index % colors.length]} rounded-full flex items-center justify-center text-white text-sm font-medium`}>
                                                    {company.ticker.substring(0, 2)}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors truncate max-w-[120px]">
                                                        {company.name}
                                                    </p>
                                                    <p className="text-xs text-gray-500">{company.ticker}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                    ${company.current_price?.toLocaleString()}
                                                </p>
                                                <p className={`text-xs ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                                                    {isPositive ? '+' : ''}{changePercent}%
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Market Intelligence */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.5, delay: 0.6 }}
                        >
                            <div className="bg-gradient-to-br from-[#a855f7] to-[#7c3aed] p-6 md:p-8 rounded-xl relative overflow-hidden shadow-xl text-white">
                                <Lock className="absolute right-6 top-1/2 -translate-y-1/2 w-32 h-32 text-white/10 rotate-12" strokeWidth={1.5} />

                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center">
                                            <Zap className="w-5 h-5 text-purple-900" fill="currentColor" />
                                        </div>
                                        <h3 className="text-xl font-bold">Insider Trading Network</h3>
                                    </div>
                                    <p className="text-purple-100 mb-6 max-w-lg">
                                        Get ahead of the market. Purchase exclusive information about upcoming volatility events.
                                    </p>
                                    <button
                                        onClick={handleBuyIntel}
                                        className="w-full bg-white text-purple-600 font-semibold py-3 px-6 rounded-lg hover:bg-gray-100 transition-colors shadow-md"
                                    >
                                        Buy Intel ($5,000)
                                    </button>
                                </div>
                            </div>
                        </motion.div>

                        {/* Market News */}
                        <div className="bg-white dark:bg-card p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-border">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Market News</h3>
                                <button className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">See all</button>
                            </div>
                            <div className="space-y-4">
                                {news.map((item, index) => (
                                    <div key={index} className="group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 p-2 rounded-lg transition-colors">
                                        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1 group-hover:text-purple-600 transition-colors line-clamp-2">
                                            {item.headline || item.title || 'Market Update'}
                                        </h4>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <span>{item.source || 'Market News'}</span>
                                            <span>•</span>
                                            <div className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {new Date(item.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </aside>
                </div >
            </main >

            {/* High Value Trade Notification */}
            < AnimatePresence >
                {showNotification && notificationData && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, x: 0 }}
                        animate={{ opacity: 1, y: 0, x: 0 }}
                        exit={{ opacity: 0, y: 20, x: 0 }}
                        className="fixed bottom-6 right-6 z-50 bg-white text-gray-900 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 border border-gray-100 max-w-md"
                    >
                        <div className={`w-10 h-10 ${notificationData.mode === 'ALERT' ? 'bg-red-500' : 'bg-green-500'} rounded-full flex items-center justify-center shrink-0`}>
                            {notificationData.mode === 'ALERT' ? (
                                <AlertCircle className="w-6 h-6 text-white" />
                            ) : (
                                <DollarSign className="w-6 h-6 text-white" />
                            )}
                        </div>
                        <div>
                            <h4 className="font-bold text-lg">{notificationData.mode === 'ALERT' ? 'Market Alert' : 'High Value Trade!'}</h4>
                            {notificationData.mode === 'ALERT' ? (
                                <p className="text-sm text-gray-700 font-medium">
                                    {notificationData.headline}
                                </p>
                            ) : (
                                <p className="text-sm text-gray-500">
                                    Team {user?.name || 'User'} has {notificationData.type} shares worth <span className="text-green-600 font-bold">${notificationData.value.toLocaleString()}</span> of {notificationData.ticker}
                                </p>
                            )}
                        </div>
                        <button onClick={() => setShowNotification(false)} className="ml-auto text-gray-400 hover:text-gray-900">
                            <X className="w-5 h-5" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence >

            {/* Persistent Market Timer */}
            < AnimatePresence >
                {closingTime && (
                    <motion.div
                        initial={{ opacity: 0, y: -50, x: '-50%' }}
                        animate={{ opacity: 1, y: 0, x: '-50%' }}
                        exit={{ opacity: 0, y: -20, x: '-50%' }}
                        className="fixed top-6 left-1/2 z-50 bg-red-600 text-white px-8 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-red-400/50 backdrop-blur-sm"
                    >
                        <AlertCircle className="w-5 h-5 animate-pulse" />
                        <span className="font-bold whitespace-nowrap">MARKET CLOSING IN:</span>
                        <span className="font-mono font-bold text-xl min-w-[80px] text-center bg-red-800/20 rounded px-2">
                            {timeLeft}
                        </span>
                    </motion.div>
                )}
            </AnimatePresence >

            <TradeModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                type={modalType}
                stock={selectedStock}
                currentPrice={selectedStock?.current_price}
                onConfirm={executeTrade}
                loading={tradeLoading}
                availableShares={
                    portfolio?.holdings?.find(
                        (h) => h.company?.id === selectedStock?.id
                    )?.quantity || 0
                }
                avgCost={
                    portfolio?.holdings?.find(
                        (h) => h.company?.id === selectedStock?.id
                    )?.average_buy_price || 0
                }
                cashBalance={portfolio?.cash_balance || 0}
            />
        </div >
    );
};

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Dashboard Error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
                    <h1 className="text-4xl font-bold mb-4">Something went wrong.</h1>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-blue-600 px-6 py-2 rounded-lg hover:bg-blue-700 transition"
                    >
                        Reload Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

const DashboardWithBoundary = () => (
    <ErrorBoundary>
        <Dashboard />
    </ErrorBoundary>
);

export default DashboardWithBoundary;
