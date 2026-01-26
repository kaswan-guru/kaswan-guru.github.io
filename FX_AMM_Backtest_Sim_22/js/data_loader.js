const DataLoader = {
    
    /**
     * Generates a synthetic price path using Geometric Brownian Motion (GBM).
     * Used to simulate realistic FX market movements over time.
     * 
     * Formula: S_t = S_{t-1} * exp((drift - 0.5 * sigma^2) * dt + sigma * sqrt(dt) * Z)
     * 
     * @param {number} days - Number of days to simulate (e.g., 365)
     * @param {number} stepsPerDay - Resolution (e.g., 24 for hourly)
     * @param {number} initPrice - Starting price (e.g., 1400 KRW/USD)
     * @param {number} vol - Annual volatility (e.g., 0.10 for 10%)
     * @param {number} drift - Annual drift (e.g., 0 for no trend)
     * @returns {Array} - Array of objects { t: number, day: number, price: number }
     */
    generateGBM: function(days, stepsPerDay, initPrice, vol, drift) {
        const totalSteps = days * stepsPerDay;
        const dt = 1 / (365 * stepsPerDay); // Time step in years
        
        let path = [];
        let currentPrice = initPrice;
        
        for (let i = 0; i <= totalSteps; i++) {
            path.push({
                t: i,
                day: Math.floor(i / stepsPerDay),
                price: currentPrice
            });
            
            // Box-Muller transform for standard normal random variable Z
            const u1 = Math.random();
            const u2 = Math.random();
            const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
            
            // GBM Step
            const returns = (drift - 0.5 * vol * vol) * dt + vol * Math.sqrt(dt) * z;
            currentPrice = currentPrice * Math.exp(returns);
        }
        
        return path;
    },

    getHistoricalData: function() {
        if (typeof HISTORICAL_CSV_2025 === 'undefined') {
            console.error("Historical data file not loaded!");
            return [];
        }
        const dailyData = this.parseCSV(HISTORICAL_CSV_2025);
        const filledDailyData = this.fillMissingDays(dailyData);
        return this.generateHourlyFromDaily(filledDailyData);
    },

    parseCSV: function(csvText) {
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',');
        const data = [];

        // Skip header (i=1)
        for(let i=1; i<lines.length; i++) {
            const row = lines[i].split(',');
            if (row.length < 5) continue;

            // Date,Open,High,Low,Close,Volume
            // 2025-01-02,1473.38,1476.08,1462.74,1473.52,0
            data.push({
                date: row[0],
                open: parseFloat(row[1]),
                high: parseFloat(row[2]),
                low: parseFloat(row[3]),
                close: parseFloat(row[4])
            });
        }
        return data;
    },

    fillMissingDays: function(dailyData) {
        if (!dailyData || dailyData.length === 0) return [];
        const filled = [];

        const toDate = (s) => {
            const [y, m, d] = s.split('-').map(Number);
            return new Date(y, m - 1, d);
        };
        const toStr = (dt) => {
            const y = dt.getFullYear();
            const m = String(dt.getMonth() + 1).padStart(2, '0');
            const d = String(dt.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };

        for (let i = 0; i < dailyData.length; i++) {
            const cur = dailyData[i];
            filled.push(cur);

            if (i === dailyData.length - 1) break;

            const curDate = toDate(cur.date);
            const nextDate = toDate(dailyData[i + 1].date);
            const nextDay = new Date(curDate);
            nextDay.setDate(nextDay.getDate() + 1);

            while (nextDay < nextDate) {
                const prevClose = cur.close;
                filled.push({
                    date: toStr(nextDay),
                    open: prevClose,
                    high: prevClose,
                    low: prevClose,
                    close: prevClose
                });
                nextDay.setDate(nextDay.getDate() + 1);
            }
        }

        return filled;
    },

    generateHourlyFromDaily: function(dailyData) {
        // We assume 24 steps per day
        const stepsPerDay = 24;
        let hourlyData = [];
        let globalStep = 0;

        dailyData.forEach((dayData, dayIndex) => {
            const Open = dayData.open;
            const Close = dayData.close;
            const High = dayData.high;
            const Low = dayData.low;

            // Simple heuristic to generate 24 hourly points fitting the OHLC
            // We pin Open at 0 and Close at 23.
            // We place High and Low at random intermediate hours.
            
            let hHigh = 1 + Math.floor(Math.random() * 22); // 1 to 22
            let hLow = 1 + Math.floor(Math.random() * 22);  // 1 to 22
            
            // Ensure they are not same for better variance, though not strictly required
            if (hHigh === hLow) {
                 if (hHigh < 12) hHigh++; else hHigh--;
            }

            // Create key points
            let points = [
                { h: 0, p: Open },
                { h: 23, p: Close },
                { h: hHigh, p: High },
                { h: hLow, p: Low }
            ];

            // Sort by hour
            points.sort((a, b) => a.h - b.h);

            // Interpolate
            for (let h = 0; h < 24; h++) {
                let price = 0;
                
                // Find segment
                for (let k = 0; k < points.length - 1; k++) {
                    if (h >= points[k].h && h <= points[k+1].h) {
                        const p1 = points[k];
                        const p2 = points[k+1];
                        const ratio = (h - p1.h) / (p2.h - p1.h);
                        // Linear interpolation
                        price = p1.p + (p2.p - p1.p) * ratio;
                        
                        // Add some noise, but keep it constrained somewhat
                        // We don't want to exceed High or go below Low significantly
                        // But since we anchored High and Low, we mainly want noise to not break that.
                        // We'll add small noise only if not at key points
                        if (h !== p1.h && h !== p2.h) {
                             const range = High - Low;
                             const noise = (Math.random() - 0.5) * (range * 0.05); // 5% of range noise
                             price += noise;
                        }
                        break;
                    }
                }
                
                // Clamp final result
                price = Math.max(Low, Math.min(High, price));

                hourlyData.push({
                    t: globalStep,
                    day: dayIndex, // Note: This uses sequential day index from CSV, not calendar day
                    price: price
                });
                globalStep++;
            }
        });

        return hourlyData;
    }
};
