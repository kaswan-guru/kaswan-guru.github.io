class ModelCurveCryptoV2 {
    /**
     * Curve Crypto V2 (Simulated)
     * Simulation Condition 2.0:
     * - Uses a dynamic 'Price Scale' that lags behind market changes.
     * - Does NOT instantly snap normalization to Oracle Price.
     * - Simulates the 'Repricing' mechanism of Curve V2.
     * - Adaptation applies to USGX/KRGX pair.
     */
    constructor(initialWealthUSD, initialPrice) {
        this.name = "Curve (Crypto V2)";
        this.type = "CryptoSwap";

        const wealthPerSide = initialWealthUSD / 2;
        this.resUSD = wealthPerSide;
        this.resKRW = wealthPerSide * initialPrice;

        this.A = Config.curve.aFixed; 
        this.fee = Config.pool.feeTier;

        // Price Scale acts as the internal peg.
        // It initializes at market price but moves successfully based on conditions.
        this.priceScale = initialPrice;
        
        // Lag factor (Repricing speed). Lower = Slower repeg.
        // Real V2 is dynamic; we use a fixed EMA factor for simulation.
        this.repegAlpha = 0.1;
    }

    updatePriceScale() {
        // Curve V2 adjusts its Price Scale towards the Internal Price (based on Reserves).
        // external oraclePrice is NOT used.
        // internalPrice = resKRW / resUSD

        if (this.resUSD > 0) {
            const internalPrice = this.resKRW / this.resUSD;
            this.priceScale = this.priceScale + this.repegAlpha * (internalPrice - this.priceScale);
        }
    }

    swap(amountInRaw, isBuyKRW) {
        // Normalization uses the Internal Price Scale, NOT the Oracle Price.
        const p = this.priceScale;
        const sqrtP = Math.sqrt(p);
        
        let rInNorm, rOutNorm, dInNorm;

        // Normalize state to Price Scale
        if (isBuyKRW) { 
            // In: USD, Out: KRW
            rInNorm = this.resUSD * sqrtP;
            rOutNorm = this.resKRW / sqrtP;
            dInNorm = amountInRaw * sqrtP;
        } else {
            // In: KRW, Out: USD
            rInNorm = this.resKRW / sqrtP;
            rOutNorm = this.resUSD * sqrtP;
            dInNorm = amountInRaw / sqrtP;
        }

        // Execute Swap (Fixed A used as approximation for Crypto Invariant in this region)
        const dOutNorm = MathCore.getAmountOutCurveRaw(dInNorm, rInNorm, rOutNorm, this.A, this.fee);

        let amountOutRaw;
        if (isBuyKRW) {
            // Output KRW
            amountOutRaw = dOutNorm * sqrtP;
            this.resUSD += amountInRaw;
            this.resKRW -= amountOutRaw;
        } else {
            // Output USD
            amountOutRaw = dOutNorm / sqrtP;
            this.resKRW += amountInRaw;
            this.resUSD -= amountOutRaw;
        }

        return amountOutRaw;
    }

    getValuation(currentOraclePrice) {
        return this.resUSD + (this.resKRW / currentOraclePrice);
    }

    getState() {
        return {
           resUSD: this.resUSD,
           resKRW: this.resKRW,
           priceScale: this.priceScale
        };
    }
}
