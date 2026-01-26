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

    renderCompositionChart: function(canvasId, resultData) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        if (this.charts[canvasId]) this.charts[canvasId].destroy();

        // Get final state
        const models = resultData.stats;
        const labels = models.map(m => m.name);

        const lastHistoryIdx = models[0].history.length - 1;

        // Final Price (for conversion of KRW part to USD)
        // If Model is StableSwap Peg (USDT/USDC), rate is ~1.0.
        // If FX, rate is the final Oracle Price.

        // Data Arrays
        const dataUSD = [];
        const dataKRW_in_USD = [];

        models.forEach(m => {
            const finalState = m.history[lastHistoryIdx];
            const finalOracle = finalState.price; // KRW/USD or 1.0 (if StablePeg uses internal?)

            // Check if model is Stable Peg type to decide conversion rate?
            // Actually, simulator engine passes 'oraclePrice' to history.
            // For StableSwap-Peg, we modified swapping but 'oraclePrice' logged in history
            // is still the FX global oracle.
            // But wait, StableSwap-Peg treats resKRW as ~1 USD.
            // Let's use the model type to differentiate.

            // However, chart manager doesn't see model type directly in 'stats' usually, but 'name' is there.
            // Or we simply check the values.

            const isStablePeg = m.name.includes("USDT/USDC");
            const valUSD = finalState.resUSD;
            const valKRW_Converted = isStablePeg ? finalState.resKRW : finalState.resKRW / finalOracle;

            dataUSD.push(Number(valUSD) || 0);
            dataKRW_in_USD.push(Number(valKRW_Converted) || 0);
        });

        this.charts[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'USD Reserves',
                        data: dataUSD,
                        backgroundColor: '#3b82f6',
                    },
                    {
                        label: 'Counter-Asset (KRW/USDC) Value in USD',
                        data: dataKRW_in_USD,
                        backgroundColor: '#ef4444',
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: { display: true, text: 'Final Asset Composition (USD Value)' },
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
                        stacked: true,
                    },
                    y: {
                        stacked: true,
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
