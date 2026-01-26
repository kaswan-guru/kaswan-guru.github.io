/**
 * Uniswap V2 "Standard" Model
 * Simulation Condition 2.0:
 * - Standard XY=K Invariant.
 * - NO Recentering of parameters.
 * - NO Normalization against Oracle.
 * - Operates purely on Reserves and Arbitrage.
 */
class ModelUniswapStandard {
    constructor(initialWealthUSD, initialPrice) {
        this.name = "Uniswap V2 (Standard)";
        this.type = "CPMM-Standard";

        const wealthPerSide = initialWealthUSD / 2;
        this.resUSD = wealthPerSide;
        this.resKRW = wealthPerSide * initialPrice; 
        
        this.fee = Config.pool.feeTier;
    }

    swap(amountIn, isBuyKRW) {
        let amountOut;
        if (isBuyKRW) {
            
            amountOut = MathCore.getAmountOutUniswap(amountIn, this.resUSD, this.resKRW, this.fee);
            this.resUSD += amountIn;
            this.resKRW -= amountOut;
        } else {
            
            amountOut = MathCore.getAmountOutUniswap(amountIn, this.resKRW, this.resUSD, this.fee);
            this.resKRW += amountIn;
            this.resUSD -= amountOut;
        }
        return amountOut;
    }
    
    getValuation(currentOraclePrice) {
        return this.resUSD + (this.resKRW / currentOraclePrice);
    }
    
    getState() {
        return {
           resUSD: this.resUSD,
           resKRW: this.resKRW,
           price: this.resKRW / this.resUSD
        };
    }
}
