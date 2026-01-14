import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Star } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import TradeModal from '../components/TradeModal';
import { useAuth } from '../context/AuthContext';
import { placeTrade, getCompanies, getPortfolio, getMarketStatus } from '../api';



// STOCKS_DATA is


const SECTORS = ['All', 'Technology', 'Finance', 'Consumer', 'Automotive', 'Healthcare'];

const Market = () => {
    const { user } = useAuth();
    const [companies, setCompanies] = useState([]);
    const [portfolio, setPortfolio] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sectorFilter, setSectorFilter] = useState('All');
    const [sortBy, setSortBy] = useState('gainers'); // Note: 'gainers'/'losers' checks simulated change for now
    const [favorites, setFavorites] = useState(new Set());
    const [isMarketOpen, setIsMarketOpen] = useState(true);

    // Trade Modal State
    const [selectedStock, setSelectedStock] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [tradeLoading, setTradeLoading] = useState(false);

    // Fetch Data
    useEffect(() => {
        const fetchMarketData = async () => {
            try {
                const response = await getCompanies();
                // Map API data to UI structure and add simulated metrics for demo
                const mappedData = response.data.map(company => ({
                    ...company,
                    symbol: company.ticker,
                    // Calculate real change
                    change_amount: company.current_price - (company.opening_price || company.current_price),
                    change_percent: company.opening_price ? ((company.current_price - company.opening_price) / company.opening_price) * 100 : 0,
                    volume: Math.floor(Math.random() * 10000000) + 500000,
                    market_cap: company.current_price * company.total_shares,
                    day_range: `${(company.current_price * 0.95).toFixed(2)} - ${(company.current_price * 1.05).toFixed(2)}`
                }));
                setCompanies(mappedData);
            } catch (error) {
                console.error("Failed to fetch market data:", error);
            } finally {
                setLoading(false);
            }
        };

        const fetchStatus = async () => {
            try {
                const res = await getMarketStatus();
                setIsMarketOpen(res.data.is_open);
            } catch (err) {
                console.error("Failed to fetch market status");
            }
        };

        const fetchPortfolioData = async () => {
            if (user?.id) {
                try {
                    const res = await getPortfolio(user.id);
                    setPortfolio(res.data);
                } catch (err) {
                    console.error("Failed to fetch portfolio for market:", err);
                }
            }
        };

        fetchStatus();
        fetchMarketData();
        fetchPortfolioData();
        // Set up polling interval for "live" prices if desired, or just fetch once
        const interval = setInterval(() => {
            fetchMarketData();
            fetchPortfolioData();
            fetchStatus();
        }, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, []);

    // Toggle Favorite
    const toggleFavorite = (symbol) => {
        const newFavorites = new Set(favorites);
        if (newFavorites.has(symbol)) {
            newFavorites.delete(symbol);
        } else {
            newFavorites.add(symbol);
        }
        setFavorites(newFavorites);
    };

    // Filter & Sort Logic
    const filteredStocks = companies.filter(stock => {
        const matchesSearch = stock.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            stock.symbol.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesSector = sectorFilter === 'All' || stock.sector === sectorFilter;
        return matchesSearch && matchesSector;
    }).sort((a, b) => {
        if (sortBy === 'gainers') return b.change_percent - a.change_percent;
        if (sortBy === 'losers') return a.change_percent - b.change_percent;
        return 0;
    });

    // Trade Handler
    const handleTradeClick = (stock) => {
        const tradeStock = {
            id: stock.id,
            ticker: stock.symbol,
            name: stock.name,
            current_price: stock.current_price,
            availableShares: portfolio?.holdings?.find(h => h.company_id === stock.id)?.quantity || 0
        };
        setSelectedStock(tradeStock);
        setIsModalOpen(true);
    };

    const executeTrade = async (quantity) => {
        if (!selectedStock) return;
        setTradeLoading(true);
        try {
            await placeTrade(user.id, {
                company_id: selectedStock.id,
                type: 'buy',
                quantity: quantity
            });
            alert(`Successfully traded ${quantity} shares of ${selectedStock.ticker}`);
            setIsModalOpen(false);
        } catch (error) {
            console.error('Trade failed:', error);
            alert('Trade failed: ' + (error.response?.data?.detail || error.message));
        } finally {
            setTradeLoading(false);
        }
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-background">
            <p className="text-xl text-gray-500">Loading Market Data...</p>
        </div>;
    }

    // Calculate Sector Performance
    const calculateSectorPerformance = () => {
        if (companies.length === 0) return [];

        const sectors = ['Technology', 'Finance', 'Consumer', 'Automotive', 'Healthcare'];

        return sectors.map(sectorName => {
            const sectorStocks = companies.filter(c => c.sector === sectorName);

            let totalPrice = 0;
            let openingPrice = 0;

            sectorStocks.forEach(stock => {
                const currentPrice = stock.current_price || 0;
                // If opening_price is missing, assume no change (use current_price)
                const opening = stock.opening_price || currentPrice;

                totalPrice += currentPrice;
                openingPrice += opening;
            });

            // Calculate sector change %
            const changePercent = openingPrice > 0
                ? ((totalPrice - openingPrice) / openingPrice) * 100
                : 0;

            return {
                name: sectorName,
                value: totalPrice,
                change: changePercent,
                isPositive: changePercent >= 0
            };
        });
    };

    const sectorIndices = calculateSectorPerformance();

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-background p-4 md:p-8 space-y-6">

            {/* 1. Market Overview Section */}
            <section>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Sector Performance</h2>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    {sectorIndices.map((index, i) => (
                        <Card key={i} className="p-4 bg-white dark:bg-card space-y-2">
                            <p className="text-sm text-gray-500 dark:text-gray-400">{index.name}</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">
                                {index.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            <div className={`flex items-center gap-1 text-sm font-medium ${index.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                {index.isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                                <span>{index.change > 0 ? '+' : ''}{index.change.toFixed(2)}%</span>
                            </div>
                        </Card>
                    ))}
                </div>
            </section>

            {/* 2. Filters and Search Section */}
            <Card className="p-6 bg-white dark:bg-card">
                <div className="space-y-4">
                    {/* Top Row: Search & Sort */}
                    <div className="flex flex-col lg:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <Input
                                type="text"
                                placeholder="Search stocks..."
                                className="pl-10 w-full"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant={sortBy === 'gainers' ? 'default' : 'outline'}
                                onClick={() => setSortBy('gainers')}
                            >
                                <TrendingUp className="w-4 h-4 mr-1" />
                                Top Gainers
                            </Button>
                            <Button
                                size="sm"
                                variant={sortBy === 'losers' ? 'default' : 'outline'}
                                onClick={() => setSortBy('losers')}
                            >
                                <TrendingDown className="w-4 h-4 mr-1" />
                                Top Losers
                            </Button>
                        </div>
                    </div>

                    {/* Bottom Row: Sector Filters */}
                    <div className="flex flex-wrap gap-2">
                        {SECTORS.map((sector) => (
                            <Button
                                key={sector}
                                size="sm"
                                variant={sectorFilter === sector ? 'default' : 'outline'}
                                onClick={() => setSectorFilter(sector)}
                                className="capitalize"
                            >
                                {sector}
                            </Button>
                        ))}
                    </div>
                </div>
            </Card>

            {/* 3. Stocks Table Section */}
            <Card className="overflow-hidden bg-white dark:bg-card">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-border">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider text-left">Stock</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider text-right">Price</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider text-right">Change</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider text-right">Volume</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider text-right">Market Cap</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider text-right">Day Range</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredStocks.map((stock) => (
                                <tr key={stock.symbol} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => toggleFavorite(stock.symbol)}
                                                className="hover:text-yellow-500 transition-colors"
                                            >
                                                <Star
                                                    className={`w-5 h-5 ${favorites.has(stock.symbol) ? 'fill-yellow-500 text-yellow-500' : 'text-gray-400'}`}
                                                />
                                            </button>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-semibold text-gray-900 dark:text-white">{stock.symbol}</p>
                                                    {stock.is_halted && (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 gap-1">
                                                            HALTED
                                                            <HaltTimer targetDate={stock.halted_until} simple />
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">{stock.name}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-gray-900 dark:text-white">
                                        ${stock.current_price.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className={`font-medium ${stock.change_amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {stock.change_amount >= 0 ? '+' : ''}{stock.change_amount.toFixed(2)}
                                        </div>
                                        <div className={`text-sm ${stock.change_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {stock.change_percent >= 0 ? '+' : ''}{stock.change_percent.toFixed(2)}%
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 dark:text-gray-400">{(stock.volume / 1000000).toFixed(1)}M</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 dark:text-gray-400">${(stock.market_cap / 1000000).toFixed(2)}M</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600 dark:text-gray-400">{stock.day_range}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <Button
                                            size="sm"
                                            variant={stock.is_halted ? "destructive" : "outline"}
                                            disabled={!isMarketOpen || stock.is_halted}
                                            onClick={() => handleTradeClick(stock)}
                                        >
                                            {stock.is_halted ? 'Halted' : (isMarketOpen ? 'Trade' : 'Closed')}
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <TradeModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                type="BUY"
                stock={selectedStock}
                currentPrice={selectedStock?.current_price}
                onConfirm={executeTrade}
                loading={tradeLoading}
            />
        </div>
    );
};

// Helper Component for Countdown
const HaltTimer = ({ targetDate, simple = false }) => {
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

    if (simple) return <span className="font-mono">({timeLeft})</span>;
    return <span>TRADING HALTED ({timeLeft})</span>;
};

export default Market;
