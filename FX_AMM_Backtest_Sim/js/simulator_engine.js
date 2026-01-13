const SimulatorEngine = {
    
    /**
     * Main Simulation Loop
     * @param {Array} data - Array of hourly price steps {t, day, price}
     * @param {Object} config - Configuration object with model params
     */
    run: function(data, config) {
        
        // --- Initialization ---
        let initialPrice = config.sim.initialPrice;
        let wealth = config.pool.initialWealthUSD;
        
        // Instantiate the 3 Comparison Models
        let models = [
            new ModelUniswap(wealth, initialPrice),
            new ModelCurve(wealth, initialPrice),
            new ModelGurufin(wealth, initialPrice)
        ];
        
        // Statistics Containers
        let stats = models.map(m => ({
            name: m.name,
            feesUSD: 0,
            volumeUSD: 0,
            history: [],
            haltCount: 0
        }));

        // HODL Reference: Half USD, Half KRW held statically from start
        // Value = InitialUSD + (InitialKRW / CurrentChoice)
        // Note: For simplicity, InitialKRW is calculated at start price.
        const initialUSD = wealth / 2;
        const initialKRW = (wealth / 2) * initialPrice;
        
        // --- Time Step Loop (Hourly 1 year = 8760 steps) ---
        for (let i = 0; i < data.length; i++) {
            let stepData = data[i];
            let oraclePrice = stepData.price;
            
            models.forEach((model, idx) => {
                let stat = stats[idx];
                
                // 1. Update Oracle Price (for Gurufin/Curve Normalized)
                // This triggers "Virtual Rescentering" in Gurufin logic (p0 update)
                if (model.setOraclePrice) {
                    model.setOraclePrice(oraclePrice);
                }

                // 2. Generate Random Trading Volume
                // Volume is derived from a % of TVL (from Config)
                let volumeUSD = (wealth * config.sim.dailyVolumePct) / config.sim.stepsPerDay; 
                
                // Add noise to volume (random 50% ~ 150% of target)
                let randomVol = volumeUSD * (0.5 + Math.random()); 
                let direction = Math.random() > 0.5; // True = Buy KRW (Input USD), False = Sel KRW

                let amountIn = randomVol; 
                
                if (!direction) {
                     // If Input is KRW, convert approximate USD value to KRW amount
                     amountIn = randomVol * oraclePrice;
                }
                
                // 3. Execute Swap
                // Returns 0 if blocked (Gurufin RFQ mode)
                let amountOut = model.swap(amountIn, direction);
                
                // 4. Record Fees & Volume
                if (amountOut > 0) {
                    let tradeValueUSD = direction ? amountIn : (amountIn / oraclePrice);
                    let feeCollected = tradeValueUSD * config.pool.feeTier;
                    
                    stat.feesUSD += feeCollected;
                    stat.volumeUSD += tradeValueUSD;
                } else {
                    // Track how often the model halts (Gurufin Safe Mode)
                    if (model.type === "Gurufin" && model.haltCount !== undefined) {
                         stat.haltCount++;
                    }
                }

                // 5. Valuation & Performance Metrics
                let currentValuation = model.getValuation(oraclePrice);
                let hodlValue = initialUSD + (initialKRW / oraclePrice); // Value if we just held coins
                
                let lpValue = currentValuation + stat.feesUSD; // Current Pool Value + Accumulated Fees
                
                // Impermanent Loss %
                // (LP Value excluding fees / HODL Value) - 1
                let ilPct = ((currentValuation / hodlValue) - 1) * 100;

                // Store Step Data
                stat.history.push({
                    t: stepData.t,
                    day: stepData.day,
                    price: oraclePrice,
                    lpValue: lpValue,
                    hodlValue: hodlValue,
                    ilPct: ilPct,
                    feeUSD: stat.feesUSD,
                    halted: amountOut === 0 && randomVol > 0
                });

            });
        }
        
        return { stats, data };
    }
};
