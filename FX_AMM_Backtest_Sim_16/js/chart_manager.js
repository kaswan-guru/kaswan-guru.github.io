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

        const labels = resultData.data.map(d => `Day ${d.day}`);

        let allValues = [];

        const datasets = resultData.stats.map((stat, idx) => {
            const history = stat.history;
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

        const hodlData = resultData.stats[0].history.map(h => h.hodlValue);
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
                labels: labels.filter((_, i) => i % resultData.config.sim.stepsPerDay === 0),
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

        let allValues = [];
        const datasets = resultData.stats.map((stat, idx) => {
            const colors = ['#e11d48', '#16a34a', '#4f46e5'];
            const dataPoints = stat.history.map(h => h.ilPct);
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
                labels: resultData.data.map(d => d.day).filter((_, i) => i % resultData.config.sim.stepsPerDay === 0),
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

        const dataPoints = resultData.data.map(d => d.price);
        
        const labels = resultData.data.map(d => d.t % resultData.config.sim.stepsPerDay === 0 ? `Day ${d.day}` : '');

        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: resultData.data.map((d, i) => i), 
                datasets: [{
                    label: 'KRW/USD Exchange Rate',
                    data: dataPoints,
                    borderColor: '#0ea5e9', 
                    backgroundColor: '#0ea5e9',
                    borderWidth: 1,
                    pointRadius: 0,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    title: { display: true, text: 'Exchange Rate' },
                    tooltip: {
                         callbacks: {
                            title: function(context) {
                                
                                const idx = context[0].parsed.x;
                                const day = Math.floor(idx / (resultData.config.sim.stepsPerDay || 24));
                                const hour = idx % (resultData.config.sim.stepsPerDay || 24);
                                return `Day ${day} Hour ${hour}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { 
                            callback: function(val, index) {
                                
                                const day = Math.floor(val / 24);
                                if (val % (24 * 30) === 0) return `Day ${day}`; 
                                return '';
                            },
                             maxTicksLimit: 12 
                        }
                    },
                    y: {
                        beginAtZero: false
                    }
                }
            }
        });
    }
};
