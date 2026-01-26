class ModelCurveStable {
    /**
     * Curve StableSwap (USDT/USDC Style)
     * Simulation Condition 2.0:
     * - No normalization against FX Oracle.
     * - Operates on two Stablecoins (A & B), both ~ $1.
     * - Total wealth is split 50/50.
     * - Arbitrage targets a randomly generated exchange rate ~ 1.0.
     */
    constructor(initialWealthUSD, initialPrice) {
        this.name = "Curve (USDT/USDC)";
        this.type = "StableSwap-Peg";

        // Initial setup: Split wealth into two "USD-like" assets.
        // Ignore initialPrice (FX Rate) for reserves, only use wealth.
        const wealthPerSide = initialWealthUSD / 2;
        this.resUSD = wealthPerSide;
        this.resKRW = wealthPerSide;

        // StableSwap Parameter
        this.A = Config.curve.aFixed;
        this.fee = Config.pool.feeTier;

        // Internal "Oracle" for the stable pair (USDT/USDC rate)
        // Starts at 1.0
        this.internalOracle = 1.0;
    }

    // Called by Simulator checks if it needs FX Oracle (It doesn't)
    setOraclePrice(p) {
        // Curve Stable ignores the FX Oracle (KRW/USD) because it trades USD/USD.
        // However, we simulate the "External Market" for these stablecoins here.
        // We randomly drift the internal peg around 1.0 to simulate stablecoin wobble.

        // Random drift between 0.9995 and 1.0005
        const drift = (Math.random() - 0.5) * 0.001;
        this.internalOracle = 1.0 + drift;
    }

    swap(amountInRaw, isBuyB) {
        // isBuyB means Input USD, Output KRW.
        // USD ~ USDT, KRW ~ USDC

        // Standard Curve Swap (Raw)
        // We use the same math core but with raw reserves since they are 1:1 nominal.

        let amountOut;

        if (isBuyB) {
            // In: USD, Out: KRW
            amountOut = MathCore.getAmountOutCurveRaw(amountInRaw, this.resUSD, this.resKRW, this.A, this.fee);
            this.resUSD += amountInRaw;
            this.resKRW -= amountOut;
        } else {
            // In: KRW, Out: USD
            amountOut = MathCore.getAmountOutCurveRaw(amountInRaw, this.resKRW, this.resUSD, this.A, this.fee);
            this.resKRW += amountInRaw;
            this.resUSD -= amountOut;
        }

        return amountOut;
    }

    getValuation(currentFXOraclePrice) {
        // Valuation in USD.
        // Since both USD and KRW are ~ $1 USD.
        // Total Value = ResUSD + ResKRW.
        return this.resUSD + this.resKRW;
    }

    // Explicitly define target price for Arbitrage logic in Simulator
    getTargetPrice() {
        return this.internalOracle;
    }

    getState() {
        return {
           resUSD: this.resUSD,
           resKRW: this.resKRW,
           A: this.A,
           p: this.internalOracle
        };
    }
}
