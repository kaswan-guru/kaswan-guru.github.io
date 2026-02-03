const ChartManager = {
    charts: {},

    init: function() {
        if (typeof Chart === 'undefined') {
            console.warn("Chart.js not defined.");
            return;
        }
        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.color = '#64748b';
    },

    renderPerformanceChart: function(canvasId, resultData) {
        const ctx = document.getElementById(canvasId).getContext('2d');

        if (this.charts[canvasId]) this.charts[canvasId].destroy();

        const step = resultData.config.sim.stepsPerDay;
        const labels = resultData.data.map(d => `Day ${d.day}`).filter((_, i) => i % step === 0);

        let allValues = [];

        const datasets = resultData.stats.map((stat, idx) => {
            const history = stat.history.filter((_, i) => i % step === 0);
            const dataPoints = history.map(h => h.lpValue);
            allValues = allValues.concat(dataPoints); // Collect for Min/Max

            const colors = ['#e11d48', '#16a34a', '#4f46e5'];

            return {
                label: stat.name,
                data: dataPoints,
                borderColor: colors[idx],
                backgroundColor: colors[idx],
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.1
            };
        });

        const hodlData = resultData.stats[0].history.filter((_, i) => i % step === 0).map(h => h.hodlValue);
        allValues = allValues.concat(hodlData);

        datasets.push({
            label: "HODL",
            data: hodlData,
            borderColor: '#94a3b8',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0
        });

        // Determine Min/Max for detailed view
        const yMin = Math.min(...allValues);
        const yMax = Math.max(...allValues);
        const padding = (yMax - yMin) * 0.05; // 5% padding of the range

        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    title: { display: true, text: 'Portfolio Value (USD) over Time' },
                    tooltip: {
                         callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                         ticks: { maxTicksLimit: 12 }
                    },
                    y: {
                        min: yMin - padding,
                        max: yMax + padding
                    }
                }
            }
        });
    },

    renderILChart: function(canvasId, resultData) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        if (this.charts[canvasId]) this.charts[canvasId].destroy();

        const step = resultData.config.sim.stepsPerDay;
        let allValues = [];
        const datasets = resultData.stats.map((stat, idx) => {
            const colors = ['#e11d48', '#16a34a', '#4f46e5'];
            const dataPoints = stat.history.filter((_, i) => i % step === 0).map(h => h.ilPct);
            allValues = allValues.concat(dataPoints);

            return {
                label: stat.name,
                data: dataPoints,
                borderColor: colors[idx],
                borderWidth: 2,
                pointRadius: 0
            };
        });

        // Determine Min/Max for IL
        const yMin = Math.min(...allValues);
        const yMax = Math.max(...allValues);
        const range = yMax - yMin;
        const padding = (range === 0 ? 0.1 : range * 0.1);

        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: resultData.data.map(d => d.day).filter((_, i) => i % step === 0),
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: 'Impermanent Loss (%)' }
                },
                scales: {
                    y: {
                        min: yMin - padding,
                        max: yMax + padding,
                         ticks: {
                            callback: function(value) {
                                return value.toFixed(4) + "%";
                            }
                        }
                    }
                }
            }
        });
    },

    renderPriceChart: function(canvasId, resultData) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        if (this.charts[canvasId]) this.charts[canvasId].destroy();

        const labels = resultData.data.map(d => d.day).filter((_, i) => i % resultData.config.sim.stepsPerDay === 0);
        const priceData = resultData.data.map(d => d.price).filter((_, i) => i % resultData.config.sim.stepsPerDay === 0);

        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Exchange Rate (KRW/USD)',
                    data: priceData,
                    borderColor: '#0f172a',
                    borderWidth: 1,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: 'Exchange Rate' }
                }
            }
        });
    },

    renderReserveRatioChart: function(canvasId, resultData) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        if (this.charts[canvasId]) this.charts[canvasId].destroy();

        const step = resultData.config.sim.stepsPerDay;
        const labels = resultData.data.map(d => `Day ${d.day}`).filter((_, i) => i % step === 0);

        const datasets = resultData.stats.map((stat, idx) => {
            const history = stat.history.filter((_, i) => i % step === 0);
            const dataPoints = history.map(h => h.reserveRatio);

            const colors = ['#e11d48', '#16a34a', '#4f46e5'];

            return {
                label: stat.name,
                data: dataPoints,
                borderColor: colors[idx],
                backgroundColor: colors[idx],
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.1
            };
        });

        const oracleData = resultData.data.filter((_, i) => i % step === 0).map(d => d.price);
        datasets.push({
            label: "Oracle Price",
            data: oracleData,
            borderColor: '#94a3b8',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0
        });

        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    title: { display: true, text: 'Reserve Ratio (KRW/USD) over Time' },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y.toFixed(2);
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { maxTicksLimit: 12 }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Reserve Ratio (KRW/USD)'
                        }
                    }
                }
            }
        });
    },

    renderSlippageChart: function(canvasId, resultData) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        if (this.charts[canvasId]) this.charts[canvasId].destroy();

        const step = resultData.config.sim.stepsPerDay;

        const datasets = resultData.stats.map((stat, idx) => {
            const slippageData = stat.slippageHistory || [];

            const aggregatedData = [];
            const labels = [];

            for (let day = 0; day <= Math.max(...slippageData.map(s => Math.floor(s.t / step))); day++) {
                const daySlippages = slippageData.filter(s => Math.floor(s.t / step) === day);
                if (daySlippages.length > 0) {
                    const avgSlippage = daySlippages.reduce((sum, s) => sum + Math.abs(s.slippage), 0) / daySlippages.length;
                    aggregatedData.push(avgSlippage);
                    if (idx === 0) labels.push(`Day ${day}`);
                } else {
                    aggregatedData.push(null);
                    if (idx === 0) labels.push(`Day ${day}`);
                }
            }

            const colors = ['#e11d48', '#16a34a', '#4f46e5'];

            return {
                label: stat.name,
                data: aggregatedData,
                borderColor: colors[idx],
                backgroundColor: colors[idx],
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.1,
                spanGaps: true
            };
        });

        const labels = [];
        const maxDay = Math.max(...resultData.stats.flatMap(s =>
            (s.slippageHistory || []).map(h => Math.floor(h.t / step))
        ));
        for (let day = 0; day <= maxDay; day++) {
            labels.push(`Day ${day}`);
        }

        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    title: { display: true, text: 'Average Daily Slippage (%) over Time' },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y.toFixed(4) + '%';
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { maxTicksLimit: 12 }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Slippage (%)'
                        }
                    }
                }
            }
        });
    },

    renderAssetCompositionChart: function(canvasId, modelType, resultData) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        if (this.charts[canvasId]) this.charts[canvasId].destroy();

        const modelIndex = modelType === 'gurufin' ? 0 : (modelType === 'curve' ? 1 : 2);
        const stat = resultData.stats[modelIndex];

        const step = resultData.config.sim.stepsPerDay;
        const labels = stat.history.map(h => `Day ${h.day}`).filter((_, i) => i % step === 0);

        const usdData = stat.history.filter((_, i) => i % step === 0).map(h => h.resUSD);
        const krwInUsdData = stat.history.filter((_, i) => i % step === 0).map(h => {
            const isStablePeg = stat.name.includes("USDT/USDC");
            return isStablePeg ? h.resKRW : h.resKRW / h.price;
        });

        const modelColors = {
            'gurufin': { usd: '#3b82f6', krw: '#f59e0b' },
            'curve': { usd: '#10b981', krw: '#f59e0b' },
            'uniswap': { usd: '#8b5cf6', krw: '#f59e0b' }
        };

        const colors = modelColors[modelType];

        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'USD Reserves',
                        data: usdData,
                        borderColor: colors.usd,
                        backgroundColor: colors.usd + '20',
                        fill: true,
                        tension: 0.1
                    },
                    {
                        label: 'KRW Reserves (in USD)',
                        data: krwInUsdData,
                        borderColor: colors.krw,
                        backgroundColor: colors.krw + '20',
                        fill: true,
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    title: {
                        display: true,
                        text: `${stat.name} - Asset Composition Over Time (USD Value)`
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('en-US', {
                                        style: 'currency',
                                        currency: 'USD'
                                    }).format(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { maxTicksLimit: 12 }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Value (USD)'
                        },
                        ticks: {
                            callback: function(value) {
                                return '$' + (value / 1000000).toFixed(1) + 'M';
                            }
                        }
                    }
                }
            }
        });
    }
};
