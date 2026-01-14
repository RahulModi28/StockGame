import React, { useState, useEffect, useRef } from 'react';
import { createChart, CandlestickSeries, AreaSeries } from 'lightweight-charts';
import { getCandles } from '../api';
import { useTheme } from '../context/ThemeContext';

/**
 * Advanced TradingView-style Chart Component
 * Features:
 * - Draggable Entry, Target, Stop Loss lines
 * - Real-time Risk/Reward Calculation
 * - Live P&L display
 * - Stale-closure free Drag System
 */
const MarketChart = ({ companyId, orders = [], currentPosition, onCancelOrder, onUpdateOrder, onPriceUpdate }) => {
    const { isDarkMode } = useTheme();
    const containerRef = useRef(null);

    // Core Chart Refs
    const chartRef = useRef(null);
    const seriesRef = useRef(null);
    const linesRef = useRef({}); // Map<id, IPriceLine>

    // State
    const [tooltip, setTooltip] = useState(null); // { x, y, price, pnl, rr, type }
    const [isDragging, setIsDragging] = useState(false);
    const [chartType, setChartType] = useState(() => localStorage.getItem('chartType') || 'candle'); // 'candle' | 'area'

    // Refs for Event Handlers (Prevent Stale Closures)
    const activeDragRef = useRef(null); // { id, originalPrice, quantity, type }
    const ordersRef = useRef(orders);
    const positionRef = useRef(currentPosition);
    const handlersRef = useRef({ onUpdateOrder, onCancelOrder });

    // Constants
    const COLORS = {
        background: 'transparent',
        text: isDarkMode ? '#d1d5db' : '#374151',
        grid: isDarkMode ? '#374151' : '#e5e7eb',
        up: '#26a69a',
        down: '#ef5350',
        stop: '#ef5350',
        target: '#26a69a',
        entry: '#3b82f6'
    };

    // Sync Refs
    useEffect(() => { ordersRef.current = orders; }, [orders]);
    useEffect(() => { positionRef.current = currentPosition; }, [currentPosition]);
    useEffect(() => { handlersRef.current = { onUpdateOrder, onCancelOrder }; }, [onUpdateOrder, onCancelOrder]);

    // -------------------------------------------------------------------------
    // 1. Chart Initialization
    // -------------------------------------------------------------------------
    useEffect(() => {
        if (!containerRef.current) return;

        const chart = createChart(containerRef.current, {
            layout: { background: { type: 'solid', color: COLORS.background }, textColor: COLORS.text },
            grid: { vertLines: { color: COLORS.grid }, horzLines: { color: COLORS.grid } },
            width: containerRef.current.clientWidth,
            height: 350,
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
                barSpacing: 10, // Fixed width to prevent giant candles
                minBarSpacing: 5
            },
            crosshair: { mode: 1 }
        });

        let series;
        if (chartType === 'candle') {
            series = chart.addSeries(CandlestickSeries, {
                upColor: COLORS.up, downColor: COLORS.down,
                borderVisible: false, wickUpColor: COLORS.up, wickDownColor: COLORS.down
            });
        } else {
            series = chart.addSeries(AreaSeries, {
                topColor: 'rgba(38, 166, 154, 0.56)',
                bottomColor: 'rgba(38, 166, 154, 0.04)',
                lineColor: COLORS.up,
                lineWidth: 2,
            });
        }

        chartRef.current = chart;
        seriesRef.current = series;

        // Resize Handler
        const handleResize = () => {
            if (chartRef.current) {
                chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
            }
        };
        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [chartType]); // Re-run when type changes

    // Save Preference
    useEffect(() => {
        localStorage.setItem('chartType', chartType);
    }, [chartType]);

    // -------------------------------------------------------------------------
    // 2. Data Streaming & Updates
    // -------------------------------------------------------------------------
    useEffect(() => {
        if (!chartRef.current) return;
        // Theme updates
        chartRef.current.applyOptions({
            layout: { textColor: COLORS.text },
            grid: { vertLines: { color: COLORS.grid }, horzLines: { color: COLORS.grid } }
        });
    }, [isDarkMode, COLORS]);

    useEffect(() => {
        const fetchData = async () => {
            if (!companyId || !seriesRef.current) return;
            try {
                const res = await getCandles(companyId);
                if (res.data && Array.isArray(res.data)) {
                    const data = res.data
                        .map(d => {
                            if (chartType === 'area') return { time: d.time, value: d.close };
                            return { time: d.time, open: d.open, high: d.high, low: d.low, close: d.close };
                        })
                        .sort((a, b) => a.time - b.time);
                    seriesRef.current.setData(data);
                    // allow auto-scroll but don't force fit to content
                }
            } catch (e) { console.error("Chart data error", e); }
        };
        fetchData();

        // Real-time Stream
        const API_URL = `http://${window.location.hostname}:8000`;
        const es = new EventSource(`${API_URL}/market/stream/${companyId}`);
        es.onmessage = (e) => {
            const data = JSON.parse(e.data);
            if (seriesRef.current) seriesRef.current.update(data);
            if (onPriceUpdate) onPriceUpdate(data.close);
        };
        return () => es.close();
    }, [companyId, chartType, onPriceUpdate]);

    // -------------------------------------------------------------------------
    // 3. Line Management (Entry, TP, SL)
    // -------------------------------------------------------------------------
    useEffect(() => {
        if (!seriesRef.current) return;

        // A. Entry Line (Position)
        if (currentPosition) {
            const entryId = 'entry-line';
            let line = linesRef.current[entryId];
            console.log("Rendering entry line:", currentPosition.average_buy_price);
            if (!line) {
                line = seriesRef.current.createPriceLine({
                    price: parseFloat(currentPosition.average_buy_price),
                    color: COLORS.entry,
                    lineWidth: 1,
                    lineStyle: 2, // Dashed
                    axisLabelVisible: true,
                    title: `Avg Entry (${currentPosition.quantity})`,
                    draggable: false
                });
                linesRef.current[entryId] = line;
            } else {
                line.applyOptions({
                    price: parseFloat(currentPosition.average_buy_price),
                    title: `Avg Entry (${currentPosition.quantity})`
                });
            }
        }

        // B. Order Lines (TP / SL)
        const currentOrderIds = new Set(orders.map(o => o.id));

        // Remove old
        Object.keys(linesRef.current).forEach(key => {
            if (key !== 'entry-line' && !currentOrderIds.has(parseInt(key))) {
                seriesRef.current.removePriceLine(linesRef.current[key]);
                delete linesRef.current[key];
            }
        });

        // Add/Update
        orders.forEach(order => {
            // Skip update if currently dragging this specific line (to prevent jitter)
            if (activeDragRef.current && activeDragRef.current.id === order.id) return;

            let line = linesRef.current[order.id];
            const isSL = order.type === 'STOP_LOSS';
            const price = parseFloat(order.trigger_price);

            if (!line) {
                line = seriesRef.current.createPriceLine({
                    price: price,
                    color: isSL ? COLORS.stop : COLORS.target,
                    lineWidth: 2,
                    lineStyle: 0, // Solid
                    axisLabelVisible: true,
                    title: `${isSL ? 'SL' : 'TP'} ${order.quantity}`,
                });
                linesRef.current[order.id] = line;
            } else {
                line.applyOptions({
                    price,
                    title: `${isSL ? 'SL' : 'TP'} ${order.quantity}`
                });
            }
        });

    }, [orders, currentPosition, isDragging]);

    // -------------------------------------------------------------------------
    // 4. Advanced Interaction (Drag & Hit Test)
    // -------------------------------------------------------------------------
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleMouseMove = (e) => {
            if (!seriesRef.current) return;
            const rect = container.getBoundingClientRect();
            const y = e.clientY - rect.top;

            // --- Dragging Logic ---
            if (activeDragRef.current) {
                const newPrice = seriesRef.current.coordinateToPrice(y);
                if (newPrice === null) return;

                // 1. Update Line Visually
                const line = linesRef.current[activeDragRef.current.id];
                if (line) line.applyOptions({ price: newPrice });

                // 2. Calculate Stats needed for Tooltip
                const entry = positionRef.current?.average_buy_price ? parseFloat(positionRef.current.average_buy_price) : newPrice;
                const diff = newPrice - entry; // Assuming LONG position logic
                const pnl = diff * activeDragRef.current.quantity;

                // Risk/Reward Calculation
                let rrRatio = null;
                const otherOrders = ordersRef.current.filter(o => o.id !== activeDragRef.current.id);
                // Simple heuristic: if I am SL, find a TP for THIS stock (assumed unique per position for now, or filter by latest)
                const isSL = activeDragRef.current.type === 'STOP_LOSS';
                // Note: company_id check might be needed if multiple stocks orders mixed? Prolly not given implementation.
                const companion = otherOrders.find(o => o.type === (isSL ? 'TAKE_PROFIT' : 'STOP_LOSS'));

                if (companion) {
                    const companionPrice = parseFloat(companion.trigger_price);
                    // R:R = Reward / Risk
                    const risk = isSL ? (entry - newPrice) : (entry - companionPrice);
                    const reward = isSL ? (companionPrice - entry) : (newPrice - entry);

                    if (risk > 0) {
                        // Basic Abs check to avoid negative ratio confusion if Entry is not between SL and TP
                        rrRatio = (Math.abs(reward) / Math.abs(risk)).toFixed(2);
                    }
                }

                activeDragRef.current.currentPrice = newPrice;

                setTooltip({
                    x: e.clientX,
                    y: e.clientY,
                    price: newPrice,
                    pnl: pnl,
                    rr: rrRatio,
                    type: activeDragRef.current.type
                });
                return;
            }

            // --- Hover Logic (Cursor & Tooltip) ---
            const HIT_PIXELS = 10;
            let found = null;

            ordersRef.current.forEach(order => {
                const orderY = seriesRef.current.priceToCoordinate(order.trigger_price);
                if (orderY && Math.abs(y - orderY) < HIT_PIXELS) {
                    found = order;
                }
            });

            if (found) {
                container.style.cursor = 'ns-resize';

                // Calculate Stats for Hovered Order
                const price = parseFloat(found.trigger_price);

                const entry = positionRef.current?.average_buy_price ? parseFloat(positionRef.current.average_buy_price) : price;
                const diff = price - entry;
                const pnl = diff * found.quantity;

                // Risk/Reward Calculation
                let rrRatio = null;
                const otherOrders = ordersRef.current.filter(o => o.id !== found.id);
                const isSL = found.type === 'STOP_LOSS';
                const companion = otherOrders.find(o => o.type === (isSL ? 'TAKE_PROFIT' : 'STOP_LOSS'));

                if (companion) {
                    const companionPrice = parseFloat(companion.trigger_price);
                    const risk = isSL ? (entry - price) : (entry - companionPrice);
                    const reward = isSL ? (companionPrice - entry) : (price - entry);

                    if (Math.abs(risk) > 0.0001) { // Avoid division by zero
                        rrRatio = (Math.abs(reward) / Math.abs(risk)).toFixed(2);
                    }
                }

                setTooltip({
                    x: e.clientX,
                    y: e.clientY,
                    price: price,
                    pnl: pnl,
                    rr: rrRatio,
                    type: found.type
                });
            } else {
                container.style.cursor = 'crosshair';
                setTooltip(null);
            }
        };

        const handleMouseDown = (e) => {
            // Hit Test again to start drag
            if (!seriesRef.current) return;
            const rect = container.getBoundingClientRect();
            const y = e.clientY - rect.top;

            ordersRef.current.forEach(order => {
                const orderY = seriesRef.current.priceToCoordinate(order.trigger_price);
                if (orderY && Math.abs(y - orderY) < 10) {
                    setIsDragging(true);
                    activeDragRef.current = { ...order, currentPrice: order.trigger_price };
                    chartRef.current.applyOptions({ crosshair: { mode: 0 } }); // Hide crosshair
                    e.preventDefault();
                }
            });
        };

        const handleMouseUp = () => {
            if (activeDragRef.current) {
                // EXECUTE UPDATE
                const { id, currentPrice } = activeDragRef.current;
                handlersRef.current.onUpdateOrder(id, currentPrice);

                // Reset
                activeDragRef.current = null;
                setIsDragging(false);
                setTooltip(null);
                chartRef.current.applyOptions({ crosshair: { mode: 1 } });
            }
        };

        container.addEventListener('mousemove', handleMouseMove);
        container.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            container.removeEventListener('mousemove', handleMouseMove);
            container.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    // -------------------------------------------------------------------------
    // 5. Render
    // -------------------------------------------------------------------------
    return (
        <div className="relative w-full h-full select-none group">
            <div ref={containerRef} className="w-full h-full" />

            {/* Chart Type Toggle */}
            <div className="absolute top-2 left-2 flex bg-gray-800/80 backdrop-blur-sm rounded-lg p-0.5 border border-gray-700 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={() => setChartType('candle')}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${chartType === 'candle' ? 'bg-gray-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
                >
                    Candles
                </button>
                <button
                    onClick={() => setChartType('area')}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${chartType === 'area' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
                >
                    Line
                </button>
            </div>

            {/* Advanced Floating Tooltip */}
            {tooltip && (
                <div
                    className="fixed z-50 pointer-events-none bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-3 text-sm flex flex-col gap-1 min-w-[140px]"
                    style={{ left: tooltip.x + 15, top: tooltip.y - 40 }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between gap-4 border-b border-gray-700 pb-2 mb-2">
                        <span className={`font-bold ${tooltip.type === 'STOP_LOSS' ? 'text-red-400' : 'text-green-400'}`}>
                            {tooltip.type === 'STOP_LOSS' ? 'STOP LOSS' : 'TARGET'}
                        </span>
                        <span className="font-mono text-white text-base">${tooltip.price.toFixed(2)}</span>
                    </div>

                    {/* Stats */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-400 font-medium">Est. P&L</span>
                            <span className={`font-mono font-bold ${tooltip.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {tooltip.pnl >= 0 ? '+' : ''}${tooltip.pnl.toFixed(2)}
                            </span>
                        </div>
                        {tooltip.rr && (
                            <div className="flex justify-between items-center text-xs border-t border-gray-800 pt-1 mt-1">
                                <span className="text-gray-400">Risk/Reward</span>
                                <span className="font-mono text-amber-400 font-bold">{tooltip.rr}R</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MarketChart;