class ModelCurve {
    /**
     * Normalized StableSwap Model (Fixed A)
     * Differs from Gurufin only by having a constant 'A' regardless of deviation.
     * Uses Oracle P0 for Normalization just like Gurufin to ensure fair comparison.
     */
    constructor(initialWealthUSD, initialPrice) {
        this.name = "Curve (Fixed A)";
        this.type = "StableSwap";

        const wealthPerSide = initialWealthUSD / 2;
        this.resUSD = wealthPerSide;
        this.resKRW = wealthPerSide * initialPrice;

        this.A = Config.curve.aFixed;
        this.fee = Config.pool.feeTier;

        // Curve tracks the Oracle Price for Normalization
        this.p0 = initialPrice;
    }

    setOraclePrice(p) {
        if (Config.sim.recenterCurve) {
            this.p0 = p;
        }
    }

    swap(amountInRaw, isBuyKRW) {
        const sqrtP0 = Math.sqrt(this.p0);
        let rInNorm, rOutNorm, dInNorm;

        // 1. Normalize Reserves & Input
        // Normalization target: Both sides should be roughly equal in value if price == p0
        // standard stable invariant expects x ~= y
        // USD_val = USD * sqrt(p)
        // KRW_val = KRW / sqrt(p)
        // Check: if 1 USD = 1400 KRW, p=1400.
        // USD_val = 1 * 37.4 = 37.4
        // KRW_val = 1400 / 37.4 = 37.4.  Matches!

        if (isBuyKRW) { 
            // In: USD, Out: KRW
            rInNorm = this.resUSD * sqrtP0;
            rOutNorm = this.resKRW / sqrtP0;
            dInNorm = amountInRaw * sqrtP0;
        } else {
            // In: KRW, Out: USD
            rInNorm = this.resKRW / sqrtP0;
            rOutNorm = this.resUSD * sqrtP0;
            dInNorm = amountInRaw / sqrtP0;
        }

        // 2. Execute Swap in Normalized Space
        // Note: Curve logic in math_core needs (dx, x, y, A, fee)
        const dOutNorm = MathCore.getAmountOutCurveRaw(dInNorm, rInNorm, rOutNorm, this.A, this.fee);

        // 3. Update Reserves (Raw)
        // We calculate output first, then update state.
        // We need to know dOutRaw to update state.
        
        let amountOutRaw;
        if (isBuyKRW) {
            // Output is KRW
            amountOutRaw = dOutNorm * sqrtP0;
            this.resUSD += amountInRaw;
            this.resKRW -= amountOutRaw;
        } else {
            // Output is USD
            amountOutRaw = dOutNorm / sqrtP0;
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
           A: this.A,
           p0: this.p0
        };
    }
}
