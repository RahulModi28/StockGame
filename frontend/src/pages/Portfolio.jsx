import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, BarChart3, Activity } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { placeTrade, getPortfolio } from '../api';
import TradeModal from '../components/TradeModal';

// --- MOCK DATA ---
const PORTFOLIO_SUMMARY = {
    total_value: 100112.75,
    total_cost: 95200.00,
    total_gain_loss: 4912.75,
    gain_loss_percent: 5.16,
    holdings_count: 5
};

const PERFORMANCE_DATA = [
    { month: 'Jan', value: 95000 },
    { month: 'Feb', value: 97500 },
    { month: 'Mar', value: 96200 },
    { month: 'Apr', value: 98800 },
    { month: 'May', value: 99500 },
    { month: 'Jun', value: 100112.75 },
];

const ALLOCATION_DATA = [
    { name: 'AAPL', value: 26.8, color: '#3b82f6' },
    { name: 'MSFT', value: 28.1, color: '#8b5cf6' },
    { name: 'GOOGL', value: 27.9, color: '#ec4899' },
    { name: 'NVDA', value: 14.9, color: '#f59e0b' },
    { name: 'TSLA', value: 2.4, color: '#10b981' },
];

const HOLDINGS_DATA = [
    { symbol: 'AAPL', name: 'Apple Inc.', shares: 150, avg_price: 165.50, current_price: 178.52, total_value: 26778.00, total_cost: 24825.00, gain_loss: 1953.00, return_pct: 7.87 },
    { symbol: 'MSFT', name: 'Microsoft Corporation', shares: 75, avg_price: 350.20, current_price: 374.85, total_value: 28113.75, total_cost: 26265.00, gain_loss: 1848.75, return_pct: 7.04 },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', shares: 200, avg_price: 135.80, current_price: 139.68, total_value: 27936.00, total_cost: 27160.00, gain_loss: 776.00, return_pct: 2.86 },
    { symbol: 'NVDA', name: 'NVIDIA Corporation', shares: 30, avg_price: 480.00, current_price: 495.22, total_value: 14856.60, total_cost: 14400.00, gain_loss: 456.60, return_pct: 3.17 },
    { symbol: 'TSLA', name: 'Tesla Inc.', shares: 10, avg_price: 255.00, current_price: 242.84, total_value: 2428.40, total_cost: 2550.00, gain_loss: -121.60, return_pct: -4.77 },
];

const Portfolio = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [portfolioData, setPortfolioData] = useState(null);

    // Trade Modal State
    const [selectedStock, setSelectedStock] = useState(null);
    const [modalType, setModalType] = useState('BUY');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [tradeLoading, setTradeLoading] = useState(false);

    // Fetch Portfolio Data
    useEffect(() => {
        const fetchPortfolio = async () => {
            if (!user) return;
            try {
                const response = await getPortfolio(user.id);
                setPortfolioData(response.data);
            } catch (error) {
                console.error("Failed to fetch portfolio:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchPortfolio();
    }, [user]);

    const handleTradeClick = (holding, type) => {
        const tradeStock = {
            id: holding.company.id,
            ticker: holding.company.ticker,
            name: holding.company.name,
            current_price: holding.company.current_price,
            availableShares: holding.quantity
        };
        setSelectedStock(tradeStock);
        setModalType(type); // Keep uppercase for UI modal state if needed, but convert for API
        setIsModalOpen(true);
    };

    const executeTrade = async (quantity) => {
        if (!selectedStock) return;
        setTradeLoading(true);
        try {
            await placeTrade(user.id, {
                company_id: selectedStock.id,
                type: modalType.toLowerCase(), // Convert 'BUY'/'SELL' to 'buy'/'sell'
                quantity: quantity
            });
            alert(`Successfully ${modalType === 'BUY' ? 'purchased' : 'sold'} ${quantity} shares of ${selectedStock.ticker}`);
            setIsModalOpen(false);
            // Refresh portfolio
            const response = await getPortfolio(user.id);
            setPortfolioData(response.data);
        } catch (error) {
            console.error('Trade failed:', error);
            alert('Trade failed: ' + (error.response?.data?.detail || error.message));
        } finally {
            setTradeLoading(false);
        }
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-background">
            <p className="text-xl text-gray-500">Loading Portfolio...</p>
        </div>;
    }

    if (!portfolioData) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-background">
            <p className="text-xl text-red-500">Failed to load portfolio data.</p>
        </div>;
    }

    // Calculations based on API data
    const totalCost = portfolioData.holdings.reduce((sum, h) => sum + (h.quantity * h.average_buy_price), 0);
    const totalGainLoss = portfolioData.portfolio_value - totalCost;
    const gainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

    // Asset Allocation for Pie Chart
    const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'];
    const allocationData = portfolioData.holdings.map((h, i) => ({
        name: h.company.ticker,
        value: parseFloat(((h.current_value / portfolioData.portfolio_value) * 100).toFixed(1)),
        color: COLORS[i % COLORS.length]
    })).filter(item => item.value > 0);

    // Mock Performance Data (since backend doesn't store history yet)
    const PERFORMANCE_DATA = [
        { month: 'Start', value: 100000 }, // Initial cash
        { month: 'Now', value: portfolioData.total_equity }
    ];

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-background p-4 md:p-8 space-y-6">

            {/* 1. Portfolio Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Total Value */}
                <Card className="p-6 bg-white dark:bg-card">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-gray-500">Portfolio Value</p>
                        <DollarSign className="w-5 h-5 text-blue-500" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        ${portfolioData.portfolio_value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Market value of holdings</p>
                </Card>

                {/* Unrealized P&L (Paper Gains) */}
                <Card className="p-6 bg-white dark:bg-card">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-gray-500">Unrealized P&L</p>
                        {portfolioData.unrealized_pnl >= 0 ?
                            <TrendingUp className="w-5 h-5 text-green-500" /> :
                            <TrendingDown className="w-5 h-5 text-red-500" />
                        }
                    </div>
                    <p className={`text-xl font-bold ${portfolioData.unrealized_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {portfolioData.unrealized_pnl >= 0 ? '+' : '-'}${Math.abs(portfolioData.unrealized_pnl).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Open Positions</p>
                </Card>

                {/* Realized P&L (Banked) */}
                <Card className="p-6 bg-white dark:bg-card">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-gray-500">Realized P&L</p>
                        <DollarSign className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                    </div>
                    <p className={`text-xl font-bold ${portfolioData.realized_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {portfolioData.realized_pnl >= 0 ? '+' : '-'}${Math.abs(portfolioData.realized_pnl).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Closed Trades</p>
                </Card>

                {/* Cash Balance */}
                <Card className="p-6 bg-white dark:bg-card">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-gray-500">Cash Balance</p>
                        <DollarSign className="w-5 h-5 text-green-500" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        ${portfolioData.cash_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Available for trading</p>
                </Card>

                {/* Holdings Count */}
                <Card className="p-6 bg-white dark:bg-card">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-gray-500">Holdings</p>
                        <Activity className="w-5 h-5 text-orange-500" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {portfolioData.holdings.length}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Active positions</p>
                </Card>
            </div>

            {/* 2. Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Performance Chart */}
                <Card className="p-6 bg-white dark:bg-card">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Portfolio Performance</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={PERFORMANCE_DATA}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                                <XAxis
                                    dataKey="month"
                                    stroke="#6b7280"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#6b7280"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(val) => `$${val / 1000}k`}
                                    domain={['auto', 'auto']}
                                />
                                <RechartsTooltip
                                    contentStyle={{
                                        backgroundColor: '#fff',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '8px',
                                        color: '#111827'
                                    }}
                                    formatter={(value) => [`$${value.toLocaleString()}`, 'Value']}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="value"
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    dot={{ fill: '#3b82f6', r: 4 }}
                                    activeDot={{ r: 6 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Asset Allocation Chart */}
                <Card className="p-6 bg-white dark:bg-card">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Asset Allocation</h3>
                    <div className="h-[300px] w-full flex items-center justify-center">
                        {allocationData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={allocationData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={2}
                                        dataKey="value"
                                    >
                                        {allocationData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip
                                        formatter={(value, name) => [`${value}%`, name]}
                                        contentStyle={{
                                            backgroundColor: '#fff',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '8px'
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="text-gray-400">No holdings to display</div>
                        )}
                    </div>
                    {/* Legend Helper */}
                    <div className="flex flex-wrap gap-4 justify-center mt-[-20px]">
                        {allocationData.map(item => (
                            <div key={item.name} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                                    {item.name} {item.value}%
                                </span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* 3. Holdings Table Section */}
            <Card className="overflow-hidden bg-white dark:bg-card">
                <div className="p-6 border-b border-gray-200 dark:border-border">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Holdings</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-border">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider text-left">Symbol</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider text-right">Shares</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider text-right">Avg Price</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider text-right">Current Price</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider text-right">Total Value</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider text-right">Gain/Loss</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider text-right">Return %</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {portfolioData.holdings.map((holding) => {
                                // Calculate percentages locally to ensure they display correctly
                                const holdingGainLoss = holding.profit_loss;
                                const holdingCost = holding.quantity * holding.average_buy_price;
                                const holdingReturnPct = holdingCost !== 0 ? (holdingGainLoss / holdingCost * 100) : 0;

                                return (
                                    <tr key={holding.company.ticker} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div>
                                                <p className="font-semibold text-gray-900 dark:text-white">{holding.company.ticker}</p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">{holding.company.name}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-gray-900 dark:text-gray-300">{holding.quantity}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 dark:text-gray-400">
                                            ${holding.average_buy_price.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-gray-900 dark:text-white">
                                            ${holding.company.current_price.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-gray-900 dark:text-white">
                                            ${holding.current_value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-right font-medium ${holdingGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {holdingGainLoss >= 0 ? '+' : ''}${Math.abs(holdingGainLoss).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${holdingReturnPct >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                {holdingReturnPct >= 0 ? '+' : ''}{holdingReturnPct.toFixed(2)}%
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <div className="flex gap-2 justify-center">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleTradeClick(holding, 'BUY')}
                                                >
                                                    Buy
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleTradeClick(holding, 'SELL')}
                                                >
                                                    Sell
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>

            <TradeModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                type={modalType}
                stock={selectedStock}
                currentPrice={selectedStock?.current_price}
                onConfirm={executeTrade}
                loading={tradeLoading}
            />
        </div>
    );
};

export default Portfolio;
