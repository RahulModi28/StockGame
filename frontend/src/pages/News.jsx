import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Newspaper, Search, Clock, TrendingUp, ExternalLink } from 'lucide-react';

// --- MOCK DATA ---
const NEWS_ARTICLES = [
    {
        id: 1,
        title: "Tech Stocks Rally as AI Boom Continues to Drive Market Growth",
        summary: "Major technology companies see significant gains as artificial intelligence investments fuel optimism among investors. NVIDIA and Microsoft lead the charge.",
        source: "Financial Times",
        category: "Technology",
        time: "2 hours ago",
        image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=400&fit=crop",
        sentiment: "positive"
    },
    {
        id: 2,
        title: "Federal Reserve Signals Potential Interest Rate Adjustments in Q2",
        summary: "Fed officials hint at possible monetary policy changes as inflation metrics show mixed signals across different sectors of the economy.",
        source: "Bloomberg",
        category: "Economy",
        time: "4 hours ago",
        image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&h=400&fit=crop",
        sentiment: "neutral"
    },
    {
        id: 3,
        title: "Tesla Announces Record Quarterly Deliveries Despite Market Challenges",
        summary: "Electric vehicle maker exceeds analyst expectations with strong Q1 performance, stock jumps 5% in after-hours trading.",
        source: "Reuters",
        category: "Automotive",
        time: "6 hours ago",
        image: "https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=800&h=400&fit=crop",
        sentiment: "positive"
    },
    {
        id: 4,
        title: "Banking Sector Faces Headwinds as Loan Defaults Rise",
        summary: "Regional banks report increased default rates on commercial real estate loans, raising concerns about sector stability.",
        source: "Wall Street Journal",
        category: "Finance",
        time: "8 hours ago",
        image: "https://images.unsplash.com/photo-1541354329998-f4d9a9f9297f?w=800&h=400&fit=crop",
        sentiment: "negative"
    },
    {
        id: 5,
        title: "Pharmaceutical Giants Unveil Breakthrough Cancer Treatment",
        summary: "Leading biotech companies announce promising clinical trial results for innovative cancer therapy, shares surge on the news.",
        source: "CNBC",
        category: "Healthcare",
        time: "10 hours ago",
        image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&h=400&fit=crop",
        sentiment: "positive"
    },
    {
        id: 6,
        title: "E-Commerce Sales Show Slowdown as Consumer Spending Softens",
        summary: "Major online retailers report weaker than expected quarterly results amid changing consumer behavior and economic uncertainty.",
        source: "MarketWatch",
        category: "Retail",
        time: "12 hours ago",
        image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=400&fit=crop",
        sentiment: "negative"
    },
    {
        id: 7,
        title: "Renewable Energy Stocks Gain Momentum on Policy Support",
        summary: "Green energy companies benefit from new government initiatives and increased institutional investment in sustainable solutions.",
        source: "The Economist",
        category: "Energy",
        time: "14 hours ago",
        image: "https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=800&h=400&fit=crop",
        sentiment: "positive"
    },
    {
        id: 8,
        title: "Semiconductor Shortage Continues to Impact Global Supply Chains",
        summary: "Chip manufacturers struggle to meet demand as automotive and electronics industries compete for limited production capacity.",
        source: "TechCrunch",
        category: "Technology",
        time: "1 day ago",
        image: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=400&fit=crop",
        sentiment: "negative"
    },
    {
        id: 9,
        title: "Gold Prices Reach New Highs Amid Economic Uncertainty",
        summary: "Precious metals see increased demand as investors seek safe-haven assets during volatile market conditions.",
        source: "Barron's",
        category: "Commodities",
        time: "1 day ago",
        image: "https://images.unsplash.com/photo-1610375461246-83df859d849d?w=800&h=400&fit=crop",
        sentiment: "neutral"
    }
];

const CATEGORIES = ['All', 'Technology', 'Economy', 'Finance', 'Healthcare', 'Automotive', 'Retail', 'Energy', 'Commodities'];

const getSentimentColor = (sentiment) => {
    switch (sentiment) {
        case 'positive': return 'text-green-600 bg-green-50 border-green-200';
        case 'negative': return 'text-red-600 bg-red-50 border-red-200';
        default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
};

import { getNews } from '../api';

// ... (keep constants like CATEGORIES) 

const News = () => {
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');

    useEffect(() => {
        const fetchNews = async () => {
            try {
                const response = await getNews();
                const mappedNews = response.data
                    .filter(item => !item.headline.startsWith("WHALE ALERT")) // Hide Alerts from News Feed
                    .map(item => ({
                        id: item.id,
                        title: item.headline,
                        // If backend doesn't have summary/image/source, mock or use default
                        summary: item.summary || "Click to read the full story and analysis of this market-moving event.",
                        source: "MarketWire",
                        category: item.sector_impacted || "General",
                        time: new Date(item.released_at).toLocaleString(),
                        image: item.image_url || "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&h=400&fit=crop",
                        sentiment: item.impact_score > 0 ? 'positive' : (item.impact_score < 0 ? 'negative' : 'neutral')
                    }));
                setNews(mappedNews);
            } catch (error) {
                console.error("Failed to fetch news:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchNews();
    }, []);

    // Filter Logic
    const filteredArticles = news.filter(article => {
        const matchesSearch = article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            article.summary.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = categoryFilter === 'All' || article.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    const featuredArticle = filteredArticles.length > 0 ? filteredArticles[0] : null;
    const gridArticles = filteredArticles.length > 1 ? filteredArticles.slice(1) : [];

    if (loading) return <div className="p-8 text-center text-gray-500">Loading News...</div>;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-background p-4 md:p-8 space-y-6">

            {/* 1. Header Section */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <Newspaper className="w-8 h-8 text-blue-600" />
                        Market News
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Stay updated with the latest financial news and market insights</p>
                </div>
            </div>

            {/* 2. Search and Filters Section */}
            <Card className="p-6 bg-white dark:bg-card">
                <div className="space-y-4">
                    <div className="relative">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <Input
                            type="text"
                            placeholder="Search news articles..."
                            className="pl-10 w-full"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {CATEGORIES.map(category => (
                            <Button
                                key={category}
                                size="sm"
                                variant={categoryFilter === category ? 'default' : 'outline'}
                                onClick={() => setCategoryFilter(category)}
                            >
                                {category}
                            </Button>
                        ))}
                    </div>
                </div>
            </Card>

            {/* Content Section */}
            {filteredArticles.length === 0 ? (
                // 3. No Results State
                <Card className="p-12 bg-white dark:bg-card text-center">
                    <Newspaper className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No articles found</h3>
                    <p className="text-gray-500">Try adjusting your search or filter to find what you're looking for.</p>
                </Card>
            ) : (
                <>
                    {/* 4. Featured Article Section */}
                    {featuredArticle && (
                        <Card className="overflow-hidden bg-white dark:bg-card">
                            <div className="grid grid-cols-1 lg:grid-cols-2">
                                <div className="relative h-64 lg:h-auto">
                                    <img
                                        src={featuredArticle.image}
                                        alt={featuredArticle.title}
                                        className="absolute inset-0 w-full h-full object-cover"
                                    />
                                    <div className={`absolute top-4 left-4 inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${getSentimentColor(featuredArticle.sentiment)}`}>
                                        {featuredArticle.sentiment === 'positive' && <TrendingUp className="w-4 h-4" />}
                                        <span className="capitalize">{featuredArticle.sentiment}</span>
                                    </div>
                                </div>
                                <div className="p-6 lg:p-8">
                                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                                        <span className="font-medium text-blue-600">{featuredArticle.source}</span>
                                        <span>•</span>
                                        <Clock className="w-4 h-4" />
                                        <span>{featuredArticle.time}</span>
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">{featuredArticle.title}</h2>
                                    <p className="text-gray-600 dark:text-gray-300 mb-4">{featuredArticle.summary}</p>
                                    <Button>
                                        Read Full Article <ExternalLink className="w-4 h-4 ml-2" />
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* 5. News Grid Section */}
                    {gridArticles.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {gridArticles.map(article => (
                                <Card key={article.id} className="overflow-hidden hover:shadow-lg transition-shadow bg-white dark:bg-card cursor-pointer">
                                    <div className="relative h-48">
                                        <img
                                            src={article.image}
                                            alt={article.title}
                                            className="absolute inset-0 w-full h-full object-cover"
                                        />
                                        <div className={`absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${getSentimentColor(article.sentiment)}`}>
                                            {article.sentiment === 'positive' && <TrendingUp className="w-3 h-3" />}
                                            <span className="capitalize">{article.sentiment}</span>
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                            <span className="font-medium text-blue-600">{article.source}</span>
                                            <span>•</span>
                                            <Clock className="w-3 h-3" />
                                            <span>{article.time}</span>
                                        </div>
                                        <h3 className="font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">{article.title}</h3>
                                        <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3 mb-3">{article.summary}</p>
                                        <Button variant="ghost" size="sm" className="w-full">
                                            Read More <ExternalLink className="w-3 h-3 ml-2" />
                                        </Button>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default News;
