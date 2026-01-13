class ModelGurufin {
    constructor(initialWealthUSD, initialPrice) {
        this.name = "Gurufin (Dynamic A)";
        this.type = "Gurufin";
        
        const wealthPerSide = initialWealthUSD / 2;
        this.resUSD = wealthPerSide;
        this.resKRW = wealthPerSide * initialPrice;
        
        this.aMax = Config.gurufin.aMax;
        this.aMin = Config.gurufin.aMin;
        this.delta0 = Config.gurufin.delta0;
        
        this.p0 = initialPrice;
        this.fee = Config.pool.feeTier;
        
        this.isHalted = false;
    }

    /**
     * Updates the Oracle Price. 
     * In Gurufin, this recenters the 'Virtual Peg'.
     */
    setOraclePrice(p) {
        this.p0 = p;
    }

    /**
     * Executes a Swap with Dynamic Amplification.
     * 1. Normalize Reserves using Oracle Price p0 (to 1:1 space)
     * 2. Calculate Deviation (Delta) and Determine A_eff
     * 3. Run StableSwap with A_eff
     * 4. Denormalize Results
     */
    swap(amountInRaw, isBuyKRW) {
        if (this.isHalted) return 0;

        const sqrtP0 = Math.sqrt(this.p0);
        let rInNorm, rOutNorm, dInNorm;

        
        let poolPrice = this.resKRW / this.resUSD;
        let p0 = this.p0;
        
        
        const { A_eff, delta } = MathCore.getAEff(poolPrice, p0, this.aMax, this.aMin, this.delta0);

        
        
        if (delta > 0.02) {
             return 0; 
        }

        
        if (isBuyKRW) { 
            
            rInNorm = this.resUSD * sqrtP0;
            rOutNorm = this.resKRW / sqrtP0;
            dInNorm = amountInRaw * sqrtP0;
        } else {
            
            rInNorm = this.resKRW / sqrtP0;
            rOutNorm = this.resUSD * sqrtP0;
            dInNorm = amountInRaw / sqrtP0;
        }

        
        const dOutNorm = MathCore.getAmountOutCurveRaw(dInNorm, rInNorm, rOutNorm, A_eff, this.fee);

        
        let amountOutRaw;
        if (isBuyKRW) {
            
            amountOutRaw = dOutNorm * sqrtP0;
            this.resUSD += amountInRaw;
            this.resKRW -= amountOutRaw;
        } else {
            
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
           p0: this.p0
        };
    }
}
