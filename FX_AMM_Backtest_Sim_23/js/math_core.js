/**
 * FX AMM Math Core
 * Contains pure functions for Curve and Gurufin logic.
 */
const MathCore = {
    
    // --- StableSwap Logic (Curve) ---
    /**
     * Calculates the StableSwap Invariant D using Newton's Method.
     * Equation: A * n^n * sum(x_i) + D = A * n^n * D + D^(n+1) / (n^n * prod(x_i))
     * @param {Array<number>} xp - Array of balances (normalized)
     * @param {number} A - Amplification coefficient
     * @returns {number} D - The invariant value
     */
    getD: function(xp, A) {
        const N_COINS = 2; // Fixed for pairs
        const S = xp[0] + xp[1];
        if (S === 0) return 0;

        let Dprev = 0;
        let D = S;
        // Ann should be A * n^n. For n=2, Ann = A * 4.
        const Ann = A * Math.pow(N_COINS, N_COINS);

        // Newton's method iteration
        for (let i = 0; i < 255; i++) {
            let D_P = D;
            // Iterate directly for N=2
            D_P = (D_P * D) / (xp[0] * N_COINS);
            D_P = (D_P * D) / (xp[1] * N_COINS);

            Dprev = D;
            const numerator = (Ann * S + D_P * N_COINS) * D;
            const denominator = (Ann - 1) * D + (N_COINS + 1) * D_P;
            D = numerator / denominator; // Update step

            if (Math.abs(D - Dprev) <= 1) return D; // Convergence check
        }
        return D;
    },

    /**
     * Calculate new balance of coin j given new balance of coin i.
     * Typically used to find: Output Amount = Old Balance - New Balance
     * @param {number} i - Index of input coin
     * @param {number} j - Index of output coin
     * @param {number} x - New balance of input coin i
     * @param {Array<number>} xp - Current balances
     * @param {number} A - Amplification coefficient
     * @returns {number} y - New balance of output coin j
     */
    getY: function(i, j, x, xp, A) {
        const N_COINS = 2;
        const D = this.getD(xp, A); // Calculate invariant with initial balances
        // Ann should be A * n^n. For n=2, Ann = A * 4.
        const Ann = A * Math.pow(N_COINS, N_COINS);
        let c = D;
        let S = 0;
        let _x = 0;
        let y_prev = 0;
        let y = D;

        // Simplify for 2-coin pool where we know the new x (input side)
        // c = D^(n+1) / (n^n * x) 
        c = (c * D) / (x * N_COINS);
        c = (c * D) / (N_COINS * Ann);

        const b = x + D / Ann;

        // Newton's method to solve for y
        for (let k = 0; k < 255; k++) {
            y_prev = y;
            y = (y * y + c) / (2 * y + b - D);
            if (Math.abs(y - y_prev) <= 1) return y;
        }
        return y;
    },

    /**
     * Wrapper for trading logic using Curve Math.
     * @param {number} dx - Input amount
     * @param {number} x - Input Reserve
     * @param {number} y - Output Reserve
     * @param {number} A - Amplification
     * @param {number} fee - Fee tier (e.g. 0.0004)
     * @returns {number} dy - Output amount
     */
    getAmountOutCurveRaw: function(dx, x, y, A, fee) {
        const xp = [x, y]; // Current state
        const new_x = x + dx; // State after input
        const new_y = this.getY(0, 1, new_x, xp, A); // Calculate new state for y
        const dy = y - new_y; // Output is reduction in y balance
        return dy * (1 - fee); // Apply fee
    },

    // --- Gurufin Logic ---
    
    /**
     * Calculates Dynamic A (A_eff) based on deviation from Oracle Price.
     * Logic: As pool price deviates from p0, A decays from A_max towards A_min.
     * @param {number} poolPrice - Current internal AMM price (y/x)
     * @param {number} p0 - Oracle Reference Price
     * @param {number} aMax - Maximum amplification (at perfect peg)
     * @param {number} aMin - Minimum amplification (at high deviation)
     * @param {number} delta0 - One-sigma deviation threshold (e.g. 1%)
     * @returns {Object} A_eff and current deviaiton delta
     */
    getAEff: function(poolPrice, p0, aMax, aMin, delta0) {
        // Delta is log-distance: |ln(MarketPrice / OraclePrice)|
        const delta = Math.abs(Math.log(poolPrice / p0));
        
        // Gaussian decay function for A
        // A_eff = A_min + (A_max - A_min) * exp( - (delta/delta0)^2 )
        const A_eff = aMin + (aMax - aMin) * Math.exp( - Math.pow(delta / delta0, 2) );
        
        return { A_eff, delta };
    },

    // --- Uniswap V2 Logic ---
    /**
     * Constant Product Market Maker (x*y=k)
     */
    getAmountOutUniswap: function(amountIn, reserveIn, reserveOut, fee) {
        if (amountIn <= 0) return 0;
        const amountInWithFee = amountIn * (1 - fee);
        const numerator = amountInWithFee * reserveOut;
        const denominator = reserveIn + amountInWithFee;
        return numerator / denominator;
    }
};
