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
    }
};
