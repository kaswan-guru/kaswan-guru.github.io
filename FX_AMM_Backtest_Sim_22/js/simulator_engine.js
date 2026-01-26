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
        // Instantiate the 3 Comparison Models based on Config
        let models = [];

        // 1. Gurufin (Fixed)
        models.push(new ModelGurufin(wealth, initialPrice));

        // 2. Curve Variant
        const curveType = config.sim.modelCurveType || 'curve_norm';
        if (curveType === 'curve_stable') {
            models.push(new ModelCurveStable(wealth, initialPrice));
        } else if (curveType === 'curve_crypto') {
            models.push(new ModelCurveCryptoV2(wealth, initialPrice));
        } else {
            models.push(new ModelCurve(wealth, initialPrice));
        }

        // 3. Uniswap Variant
        const uniswapType = config.sim.modelUniswapType || 'uniswap_v2';
        if (uniswapType === 'uniswap_std') {
            models.push(new ModelUniswapStandard(wealth, initialPrice));
        } else {
            models.push(new ModelUniswap(wealth, initialPrice));
        }

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

                // 1.b Update Internal Price Scale (for Curve Crypto V2)
                // Curve V2 replays purely on internal state (reserves ratio), not external oracle
                if (model.updatePriceScale) {
                    model.updatePriceScale();
                }

                // --- 1.5. Arbitrage Step ---
                // Determine target price for arbitrage
                let targetOracle = oraclePrice;
                if (model.getTargetPrice) {
                    // Start of specific logic for Stable model to use internal random oracle
                    targetOracle = model.getTargetPrice();
                }

                // Simulates arbitrageurs closing the gap between Pool Price and Oracle Price.
                // This is critical to prevent "Drift" and infinite halts in Gurufin.
                let arbStats = this.runArbitrage(model, targetOracle, config.pool.feeTier);
                stat.feesUSD += arbStats.fee;
                stat.volumeUSD += arbStats.vol;

                // 2. Generate Random Trading Volume
                // Volume is derived from a % of TVL (from Config)
                let volumeUSD = (wealth * config.sim.dailyVolumePct) / config.sim.stepsPerDay;

                // Add noise to volume (random 50% ~ 150% of target)
                let randomVol = volumeUSD * (0.5 + Math.random());
                let direction = Math.random() > 0.5; // True = Buy KRW (Input USD), False = Sel KRW

                let amountIn = randomVol;

                if (!direction) {
                     // If Input is KRW (or Asset B), convert approximate USD value to Asset B amount
                     if (model.type === "StableSwap-Peg") {
                         // 1:1 conversion for stable pair
                         amountIn = randomVol;
                     } else {
                         amountIn = randomVol * oraclePrice;
                     }
                }

                // 3. Execute Swap
                // Returns 0 if blocked (Gurufin RFQ mode)
                let amountOut = model.swap(amountIn, direction);

                // 4. Record Fees & Volume
                if (amountOut > 0) {
                    let tradeValueUSD;
                    if (model.type === "StableSwap-Peg") {
                        tradeValueUSD = amountIn; // Both sides are roughly USD
                    } else {
                        tradeValueUSD = direction ? amountIn : (amountIn / oraclePrice);
                    }

                    let feeCollected = tradeValueUSD * config.pool.feeTier;

                    stat.feesUSD += feeCollected;
                    stat.volumeUSD += tradeValueUSD;
                } else {
                    // Track how often the model halts (Gurufin Safe Mode)
                    if (model.type === "Gurufin") {
                         stat.haltCount++;
                    }
                }

                // 5. Valuation & Performance Metrics
                let currentValuation = model.getValuation(oraclePrice);
                let hodlValue = initialUSD + (initialKRW / oraclePrice); // Value if we just held coins

                // FIX: currentValuation (based on reserves) already includes accumulated fees
                // because model.swap() adds full input to reserves but pays out (input * (1-fee)).
                // Therefore, adding stat.feesUSD again would be double-counting.
                let lpValue = currentValuation;

                // Impermanent Loss %
                // (LP Value / HODL Value) - 1
                let ilPct = ((currentValuation / hodlValue) - 1) * 100;

                // Store Step Data
                const state = model.getState();
                stat.history.push({
                    t: stepData.t,
                    day: stepData.day,
                    price: oraclePrice,
                    lpValue: Number(lpValue) || 0,
                    resUSD: Number(state.resUSD) || 0,
                    resKRW: Number(state.resKRW) || 0,
                    hodlValue: hodlValue,
                    ilPct: ilPct,
                    feeUSD: stat.feesUSD,
                    halted: amountOut === 0 && randomVol > 0
                });

            });
        }
        
        return { stats, data };
    },

    /**
     * Executes arbitrage trades to align Model Price with Oracle Price.
     * Uses a simple iterative approach to converge the pool ratio (resKRW/resUSD) to oraclePrice.
     */
    runArbitrage: function(model, oraclePrice, feeTier) {
        let totalVol = 0;
        let totalFee = 0;

        // Determine Arb Strategy Parameters
        let maxLoops = 3;
        let convergenceFactor = 0.5;

        // Config is global, but ideally should be passed. We can access 'Config' directly here as it's global scope in this project structure.
        const strategy = Config.sim.arbStrategy || "87";

        if (strategy === "100") {
            // "Efficient" Market: Bots compete until price matches oracle perfectly.
            // We iterate more times to ensure full convergence.
            maxLoops = 10;
            convergenceFactor = 0.6; // Slightly more aggressive
        } else if (strategy === "50") {
            // "Passive" Market: Slow bots or high friction. Only close half the gap.
            maxLoops = 1;
            convergenceFactor = 0.5;
        } else {
            // "Balanced" (Current Default): ~87.5% convergence
            maxLoops = 3;
            convergenceFactor = 0.5;
        }

        // Try up to maxLoops passes to converge
        for (let k = 0; k < maxLoops; k++) {
            let currentPrice = model.resKRW / model.resUSD;
            let ratio = currentPrice / oraclePrice;

            // Threshold: If price dev < fee, no arb opportunity.
            // We use 1.5x fee as a trigger threshold (Buffer).
            if (Math.abs(ratio - 1) < feeTier * 1.5) break;

            let amountIn = 0;
            let isBuyKRW = false; // Default: Input KRW (Sell KRW)

            if (ratio > 1) {
                // Ratio > 1 means Pool Price (KRW/USD) > Oracle Price.
                // Example: Pool 1500 > Oracle 1400.
                // Pool gives MORE KRW per USD. USD is overvalued in Pool.
                // Arb Strategy: Sell USD to Pool (Input USD) to Buy cheap KRW.
                // Therefore, isBuyKRW = true (Buying KRW).

                let targetKRW = model.resUSD * oraclePrice;
                let surplusKRW = model.resKRW - targetKRW;
                amountIn = (surplusKRW / currentPrice) * convergenceFactor; // Use variable factor
                isBuyKRW = true;
            } else {
                // Ratio < 1 means Pool Price < Oracle Price.
                // Example: Pool 1300 < Oracle 1400.
                // Pool asks LESS KRW for USD. USD is undervalued (cheap) in Pool.
                // Arb Strategy: Buy USD from Pool (Input KRW).
                // Therefore, isBuyKRW = false.

                let targetUSD = model.resKRW / oraclePrice;
                let surplusUSD = model.resUSD - targetUSD;
                amountIn = (surplusUSD * currentPrice) * convergenceFactor;
                isBuyKRW = false;
            }

            if (amountIn <= 0) break;

            let amountOut = model.swap(amountIn, isBuyKRW);

            if (amountOut === 0) break; // Halted or failed

            let tradeValueUSD = isBuyKRW ? amountIn : (amountIn / oraclePrice);
            totalVol += tradeValueUSD;
            totalFee += tradeValueUSD * feeTier;
        }

        return { vol: totalVol, fee: totalFee };
    }
};
