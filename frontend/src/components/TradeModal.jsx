import React, { useState, useEffect } from 'react';
import { X, AlertCircle, TrendingUp, TrendingDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const TradeModal = ({ isOpen, onClose, type, stock, currentPrice, onConfirm, loading, availableShares, avgCost = 0, cashBalance = 0 }) => {
    const [quantity, setQuantity] = useState(1);
    const [stopLoss, setStopLoss] = useState('');
    const [takeProfit, setTakeProfit] = useState('');

    // Reset quantity on open
    useEffect(() => {
        if (isOpen) {
            setQuantity(1);
            setStopLoss('');
            setTakeProfit('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    // Calculations
    const total = (Number(quantity) * Number(currentPrice || 0));

    // Buy Logic
    const maxAffordableShares = Math.floor(cashBalance / (currentPrice || 1));
    const remainingFunds = cashBalance - total;

    // Sell Logic
    const profitPerShare = (currentPrice || 0) - avgCost;
    const expectedProfit = profitPerShare * quantity;
    const profitPercent = avgCost > 0 ? ((profitPerShare / avgCost) * 100) : 0;

    // Theme Config
    const isBuy = type === 'BUY';
    const themeColor = isBuy ? 'green' : 'orange';
    const themeGradient = isBuy ? 'from-green-500 to-emerald-600' : 'from-orange-500 to-red-600';
    const buttonGradient = isBuy ? 'bg-green-500 hover:bg-green-600' : 'bg-orange-500 hover:bg-orange-600';
    const lightBg = isBuy ? 'bg-green-50 dark:bg-green-900/10' : 'bg-orange-50 dark:bg-orange-900/10';

    const handleQuantityChange = (val) => {
        let newQty = parseInt(val) || 0;
        const max = isBuy ? maxAffordableShares : availableShares;
        if (newQty > max) newQty = max;
        if (newQty < 0) newQty = 0;
        setQuantity(newQty);
    };

    const handleQuickSelect = (percent) => {
        if (isBuy) {
            // For Buy: quick select presets or max? 
            // Mockup: 10, 50, 100, Max -- logic needs to handle numbers vs strings/percents
            if (percent === 'MAX') {
                setQuantity(maxAffordableShares);
            } else {
                // Treat as absolute numbers for buy based on screenshot? 
                // Actually screenshot shows "50, 100, 1000, 5000"
                // Let's implement logic to handle both percentage strings and absolute numbers
                setQuantity(Math.min(percent, maxAffordableShares));
            }
        } else {
            // For Sell: Percentage of holdings
            const qty = Math.floor((availableShares * (percent / 100)));
            setQuantity(Math.max(1, qty));
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onConfirm(Number(quantity), stopLoss ? Number(stopLoss) : null, takeProfit ? Number(takeProfit) : null);
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-all">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white dark:bg-card rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-gray-800 relative"
                >
                    {/* Header */}
                    <div className={`p-6 border-b border-gray-100 dark:border-gray-800 flex items-center gap-4 ${lightBg}`}>
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg bg-gradient-to-br ${themeGradient} text-white`}>
                            {isBuy ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                {isBuy ? 'Buy Position' : 'Sell Position'}
                            </h3>
                            <p className="text-xs text-gray-500 font-medium">Market Order</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        {/* Stock Info */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                                    {(stock?.ticker || 'ST').substring(0, 2)}
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-900 dark:text-white leading-tight">{stock?.ticker}</h4>
                                    <p className="text-xs text-gray-500 truncate max-w-[100px]">{stock?.name}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-gray-500">Current Price</p>
                                <div className="flex items-center gap-2 justify-end">
                                    <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400">
                                        ${currentPrice?.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Quick Select */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Quick Select</label>
                                {isBuy && (
                                    <button
                                        type="button"
                                        onClick={() => handleQuickSelect('MAX')}
                                        className={`text-xs font-bold text-${themeColor}-600 flex items-center gap-0.5 hover:underline`}
                                    >
                                        MAX <ChevronRight className="w-3 h-3" />
                                    </button>
                                )}
                                {!isBuy && (
                                    <button
                                        type="button"
                                        onClick={() => handleQuickSelect(100)}
                                        className={`text-xs font-bold text-${themeColor}-600 flex items-center gap-0.5 hover:underline`}
                                    >
                                        MAX <ChevronRight className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                                {isBuy ? (
                                    [50, 100, 1000, 5000].map(amt => (
                                        <button
                                            key={amt}
                                            type="button"
                                            onClick={() => handleQuickSelect(amt)}
                                            className="py-2 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-700 hover:border-green-500 hover:text-green-600 dark:hover:text-green-400 bg-white dark:bg-gray-800 transition-colors"
                                        >
                                            {amt}
                                        </button>
                                    ))
                                ) : (
                                    [25, 50, 75, 100].map(pct => (
                                        <button
                                            key={pct}
                                            type="button"
                                            onClick={() => handleQuickSelect(pct)}
                                            className="py-2 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-700 hover:border-orange-500 hover:text-orange-600 dark:hover:text-orange-400 bg-white dark:bg-gray-800 transition-colors"
                                        >
                                            {pct}%
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Quantity Input */}
                        <div>
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                                Quantity to {isBuy ? 'Buy' : 'Sell'}
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={quantity}
                                    onChange={(e) => handleQuantityChange(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-blue-500 rounded-xl p-4 text-2xl font-bold text-gray-900 dark:text-white outline-none transition-all"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">shares</span>
                            </div>
                            <div className="flex justify-between mt-2 text-xs font-medium">
                                <span className={isBuy ? 'text-emerald-600' : 'text-emerald-600'}>
                                    {isBuy ? `Available: $${cashBalance.toLocaleString()}` : `Available: ${availableShares} shares`}
                                </span>
                                <span className="text-gray-500">
                                    {isBuy ? `Max Shares: ${maxAffordableShares}` : `Avg Price: $${avgCost.toLocaleString()}`}
                                </span>
                            </div>
                        </div>

                        {/* SL / TP Inputs (Only for positions) */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                                    Stop Loss ($)
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="Optional"
                                    value={stopLoss}
                                    onChange={(e) => setStopLoss(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-red-500 rounded-xl p-3 font-bold text-gray-900 dark:text-white outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                                    Take Profit ($)
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="Optional"
                                    value={takeProfit}
                                    onChange={(e) => setTakeProfit(e.target.value)}
                                    className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-green-500 rounded-xl p-3 font-bold text-gray-900 dark:text-white outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* Summary Card */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500">Total {isBuy ? 'Cost' : 'Value'}</span>
                                <span className="text-xl font-bold text-gray-900 dark:text-white">
                                    ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-3 flex justify-between items-center">
                                <span className="text-gray-500">{isBuy ? 'Remaining Funds' : 'Expected Profit'}</span>
                                <span className={`font-bold ${isBuy
                                    ? (remainingFunds >= 0 ? 'text-emerald-600' : 'text-red-500')
                                    : (expectedProfit >= 0 ? 'text-emerald-600' : 'text-red-500')
                                    }`}>
                                    {isBuy
                                        ? `$${remainingFunds.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                                        : `${expectedProfit >= 0 ? '+' : ''}$${expectedProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}   (${profitPercent >= 0 ? '+' : ''}${profitPercent.toFixed(2)}%)`
                                    }
                                </span>
                            </div>
                        </div>

                        {/* Tip */}
                        <div className="flex gap-3 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/20">
                            <div className="w-1 bg-blue-500 rounded-full shrink-0" />
                            <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                                <span className="font-bold">💡 Pro Tip:</span> Market orders execute instantly at the best available price. Consider current market conditions.
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="w-full py-3.5 rounded-xl font-bold text-gray-600 dark:text-gray-300 border-2 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading || quantity < 1 || (isBuy && remainingFunds < 0) || stock?.is_halted}
                                className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-95 disabled:active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${buttonGradient} ${loading ? 'opacity-70' : ''}`}
                            >
                                {loading ? 'Processing...' : stock?.is_halted ? (
                                    <HaltTimer targetDate={stock.halted_until} />
                                ) : `CONFIRM ${type} `}
                                {!stock?.is_halted && !loading && <ChevronRight className="w-4 h-4" />}
                            </button>
                        </div>

                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

// Helper Component for Countdown
const HaltTimer = ({ targetDate }) => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        if (!targetDate) return;
        const interval = setInterval(() => {
            const now = new Date().getTime();
            const target = new Date(targetDate).getTime();
            const dist = target - now;

            if (dist < 0) {
                setTimeLeft('RESUMING...');
                clearInterval(interval);
            } else {
                const min = Math.floor((dist % (1000 * 60 * 60)) / (1000 * 60));
                const sec = Math.floor((dist % (1000 * 60)) / 1000);
                setTimeLeft(`${min}:${sec < 10 ? '0' : ''}${sec}`);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [targetDate]);

    return <span>TRADING HALTED ({timeLeft})</span>;
};

export default TradeModal;
