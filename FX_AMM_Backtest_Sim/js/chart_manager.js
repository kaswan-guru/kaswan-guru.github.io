const ChartManager = {
    charts: {},

    init: function() {
        
        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.color = '#64748b';
    },

    renderPerformanceChart: function(canvasId, resultData) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        
        if (this.charts[canvasId]) this.charts[canvasId].destroy();

        const labels = resultData.data.map(d => `Day ${d.day}`);
        
        
        const datasets = resultData.stats.map((stat, idx) => {
            const history = stat.history;
            const dataPoints = history.map(h => h.lpValue); 
            
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
        datasets.push({
            label: "HODL",
            data: hodlData,
            borderColor: '#94a3b8',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0
        });

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
                        beginAtZero: false
                    }
                }
            }
        });
    },
    
    renderILChart: function(canvasId, resultData) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        if (this.charts[canvasId]) this.charts[canvasId].destroy();
        
        const datasets = resultData.stats.map((stat, idx) => {
            const colors = ['#e11d48', '#16a34a', '#4f46e5']; 
            return {
                label: stat.name,
                data: stat.history.map(h => h.ilPct),
                borderColor: colors[idx],
                borderWidth: 2,
                pointRadius: 0
            };
        });

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
                }
            }
        });
    }
};
