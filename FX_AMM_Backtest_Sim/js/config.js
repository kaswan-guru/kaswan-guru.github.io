const Config = {
    // defaults
    pool: {
        initialWealthUSD: 10000000, // 10 Million USD
        feeTier: 0.0005, // 5 bps
    },
    
    // Gurufin Specific
    gurufin: {
        aMax: 500,
        aMin: 10,
        delta0: 0.01 // 1%
    },
    
    // Curve Specific
    curve: {
        aFixed: 200
    },

    // Simulation
    sim: {
        dailyVolumePct: 0.05, // 5% daily volume
        days: 365,
        stepsPerDay: 4, // 6-hour blocks for fast sim, or 24 for hourly
        volatility: 0.10, // Annualized Volatility
        drift: 0.0,
        initialPrice: 1400, // KRW/USD
        recenterFreq: 1 // Recenter every N steps
    }
};
