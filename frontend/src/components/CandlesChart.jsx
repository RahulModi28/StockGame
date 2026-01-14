import React, { useState, useEffect } from 'react';
import ReactApexChart from 'react-apexcharts';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { getCandles } from '../api';

const CandlesChart = ({ companyId }) => {
    const [series, setSeries] = useState([]);
    const [options, setOptions] = useState({
        chart: {
            type: 'candlestick',
            height: 350,
            toolbar: {
                show: true,
                tools: {
                    download: false,
                    selection: true,
                    zoom: true,
                    zoomin: true,
                    zoomout: true,
                    pan: true,
                    reset: true
                },
                autoSelected: 'pan'
            },
            zoom: {
                enabled: true,
                type: 'x',
                autoScaleYaxis: true
            },
            animations: {
                enabled: false
            }
        },
        title: {
            text: 'Price History (1m Candles)',
            align: 'left',
            style: {
                color: '#fff'
            }
        },
        xaxis: {
            type: 'datetime',
            labels: {
                style: {
                    colors: '#9ca3af'
                }
            }
        },
        yaxis: {
            tooltip: {
                enabled: true
            },
            labels: {
                style: {
                    colors: '#9ca3af'
                },
                formatter: (value) => `$${value.toFixed(2)}`
            }
        },
        grid: {
            borderColor: '#374151'
        },
        plotOptions: {
            candlestick: {
                colors: {
                    upward: '#10b981', // Green
                    downward: '#ef4444' // Red
                }
            }
        },
        tooltip: {
            theme: 'dark'
        }
    });

    const initialZoomSet = React.useRef(false);

    useEffect(() => {
        const fetchCandles = async () => {
            if (!companyId) return;
            try {
                const res = await getCandles(companyId);
                // API returns [{time, open, high, low, close}, ...]
                // ApexCharts expects [{x: date, y: [O, H, L, C]}]
                const data = res.data.map(c => ({
                    x: new Date(c.time * 1000), // Convert API unix timestamp (seconds) to JS Date
                    y: [c.open, c.high, c.low, c.close]
                }));

                setSeries([{
                    name: 'Price',
                    data: data
                }]);

                // Set initial zoom to last 60 candles on first load
                if (!initialZoomSet.current && data.length > 0) {
                    const lastTime = data[data.length - 1].x.getTime();
                    // 60 candles * 60 seconds (approx) or just take 60th item from end
                    // Safe approach: index based
                    const startIndex = Math.max(0, data.length - 60);
                    const startTime = data[startIndex].x.getTime();

                    setOptions(prev => ({
                        ...prev,
                        xaxis: {
                            ...prev.xaxis,
                            min: startTime,
                            max: lastTime
                        }
                    }));
                    initialZoomSet.current = true;
                }
            } catch (err) {
                console.error("Failed to fetch candles:", err);
            }
        };

        fetchCandles();
        const interval = setInterval(fetchCandles, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, [companyId]);

    return (
        <div id="chart" className="w-full h-full">
            <ReactApexChart options={options} series={series} type="candlestick" height="100%" />
        </div>
    );
};

export default CandlesChart;
