# FX-AMM Backtest Simulation Implementation Plan

## 1. Project Goal
Develop a sophisticated "Bank LP" backtesting simulator for FX AMMs, comparing Gurufin's Dynamic A model against Curve (Fixed A) and Uniswap V2. The simulation will run on 1-year historical data (simulated hourly) to verify potential PnL, IL, and Fee Income.

## 2. Directory Structure
```
FX_AMM_Backtest_Sim/
├── index.html              # Dashboard & Control Panel
├── css/
│   └── style.css           # UI Styles
├── js/
│   ├── config.js           # Simulation Constants
│   ├── math_core.js        # Core AMM Math (Uniswap, Curve, Gurufin)
│   ├── data_loader.js      # Mock Data Generator (GBM for FX)
│   ├── models/             # AMM Logic Classes
│   │   ├── model_uniswap.js
│   │   ├── model_curve.js
│   │   └── model_gurufin.js
│   ├── simulator_engine.js # Backtest Loop Engine
│   └── chart_manager.js    # Visualization Logic
└── data/                   # (Placeholders for CSVs)
```

## 3. Key Logic Enhancements (vs. simulator3.html)
1.  **Time Resolution**: Supports Hourly steps (8760 steps/year) instead of Daily (365 steps).
2.  **Recentering Logic**:
    -   Pool attempts to recenter to Oracle Price.
    -   Tracks "Realized PnL" from rebalancing (selling high/buying low vs Oracle).
3.  **Arb Logic Refinement**:
    -   Arb trade only executes if `Slippage < Price Deviation`.
    -   Gurufin model naturally blocks Arb when `A_eff` drops (high slippage).
4.  **Normalized Comparison**:
    -   Model 2 (Curve) is explicitly "Normalized StableSwap with Fixed A".
    -   Ensures fair comparison against Gurufin's "Normalized StableSwap with Dynamic A".

## 4. Execution Steps
1.  **Setup**: Create directory structure and basic files.
2.  **Math Core**:Port optimized math functions found in `simulator3.html`.
3.  **Models**: Implement JS classes for each AMM type with a common `swap()` interface.
4.  **Data**: Implement GBM (Geometric Brownian Motion) to generate realistic KRW/USD hourly paths.
5.  **Engine**: Build the loop that feeds price data to models, executes arbs, and records stats.
6.  **UI**: Build a clean dashboard to run parameters and view charts.
