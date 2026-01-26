# Gurufin FX AMM 시뮬레이터 개발 프로젝트 요약 보고서

## 1. 프로젝트 개요
본 프로젝트는 **Gurufin FX-Adaptive AMM** 모델의 성과를 은행 LP(Liquidity Provider) 관점에서 검증하기 위해 수행되었습니다. Uniswap V2 및 Curve(Fixed A)와의 비교를 통해 **Dynamic A**와 **오라클 기반 정규화**가 FX 변동성 환경에서 비영구적 손실(IL)을 어떻게 변화시키는지 시뮬레이션합니다. 시뮬레이션은 **Hourly(24 steps/day)** 기반이며, **GBM 랜덤 데이터** 또는 **2025년 실제 환율 데이터**를 선택해 실행할 수 있습니다.

## 2. 수행 작업 내역

### 2.1. 시나리오 및 스펙 정리
- **Spec 문서 분석**을 통해 정규화($\sqrt{p_0}$ Transform), $A_{eff}$ 감쇠 곡선, 2% Guard Band 핵심 로직을 정리했습니다.
- 기존 단일 파일 구조(simulator3.html)를 모듈형 구조로 재구성했습니다.
- **Hourly Resolution** 기반 백테스트로 변동성을 세밀하게 반영합니다.

### 2.2. 모듈형 아키텍처 구현 (`FX_AMM_Backtest_Sim`)
```
FX_AMM_Backtest_Sim/
├── index.html
├── Implementation_Plan.md
├── Project_Summary_Report.md
├── css/
│   └── style.css
├── data/
│   ├── usd_krw_exchange_rate_2025.csv
│   └── usd_krw_hourly_60days.csv
└── js/
    ├── config.js
    ├── data_loader.js
    ├── historical_data_2025.js
    ├── math_core.js
    ├── simulator_engine.js
    ├── chart_manager.js
    └── models/
        ├── model_uniswap.js
        ├── model_uniswap_standard.js
        ├── model_curve.js
        ├── model_curve_stable.js
        ├── model_curve_crypto_v2.js
        └── model_gurufin.js
```

### 2.3. 핵심 로직 구현 상세
1. **Math Core (`math_core.js`)**
   - Newton’s Method 기반 Curve Invariant 계산.
   - $A_{eff}$ 가우시안 감쇠 함수 구현.
2. **데이터 처리 (`data_loader.js`)**
   - GBM 기반 1년치 Hourly 데이터 생성.
   - **Historical 2025**: CSV 일별 OHLC를 캘린더 기준으로 결측일을 전일 종가로 채운 뒤 Hourly로 보간하여 사용.
3. **모델 구현 (`models/`)**
   - Uniswap V2: CPMM 기준 모델.
   - Curve: Fixed A + 정규화 StableSwap.
   - Gurufin: Dynamic A + 정규화 StableSwap + 2% Guard Band Halt.
4. **시뮬레이션 엔진 (`simulator_engine.js`)**
   - Oracle 가격 갱신 및 모델별 swap 실행.
   - 간단한 Arb 반복 루프로 가격 괴리 축소(편차 기준으로 3회 내 수렴).

### 2.4. UI 및 시각화
- **Data Source 선택**: Random(GBM) / Historical(2025).
- **차트**: Portfolio Value, IL, Exchange Rate 표시.
- **결과 요약**: 모델별 최종 가치 및 누적 수수료 표시.

## 3. 실행 방법
1. `FX_AMM_Backtest_Sim/index.html`을 브라우저에서 실행합니다.
2. Data Source 및 파라미터를 설정합니다.
3. **Run Simulation** 실행 후 차트 및 요약 정보를 확인합니다.

## 4. 버전 히스토리
- v1.0: 모듈형 구조 및 3개 AMM 모델 기본 구현.
- v1.1: Hourly 시뮬레이션, UI 대시보드, 차트 시각화 추가.
- v1.2: 2025년 실제 데이터(일별) 로드 및 Hourly 보간 기능 추가.
- v1.3: 결측일 캘린더 채움(전일 종가 carry-forward) 추가.
- v1.4: LP 가치 평가 산식 오류 수정 (수수료 중복 합산 제거) 및 Arbitrage 로직 주석 보완.
- v1.5: UI 파라미터 조절 기능 추가 (Curve A Fixed 값, Swap Fee %).
- v1.6: Arbitrage 효율성 조절 기능(100%, 87%, 50%) UI 추가 및 로직 구현.
- v2.0: 비교 모델 다양화
    - **Curve (USDT/USDC)**: FX 오라클을 무시하고 내부 랜덤 페그(1.0)를 따르는 정통 스테이블 코인 모델 추가.
    - **Curve (Crypto V2)**: 오라클을 즉시 반영하지 않고 지연된 Price Scale(이동평균)을 추종하는 리페깅(Repegging) 로직 구현.
    - **Uniswap (Standard)**: 오라클 기반 Recentering이 없는 순수 XY=K 모델 추가.
    - **UI 개선**: 모델 변형 선택(Variant Selector) 기능을 추가하여 다양한 대조군 설정 가능.
- v2.1: 자산 구성 분석 및 안정성 강화
    - **Asset Composition 차트 추가**: 시뮬레이션 종료 시 LP의 최종 보유 자산(USD vs KRW) 비율을 누적 막대 그래프로 시각화.
    - **버그 수정**: Curve Stable 모델 변수명 호환성(resA->resUSD) 수정 및 엔진 스코프 에러 해결.
    - **UI 레이아웃 수정**: 중복 버튼 제거 및 차트 컨테이너 배치 정상화.
    - **안정성**: 데이터 로깅 및 차트 렌더링 시 NaN 방지 로직 추가.
- v2.2: 모델 정교화 및 핵심 옵션 분리
    - **Curve (Crypto V2) 로직 개선**: 기존 외부 오라클 환율(`oraclePrice`) 의존성을 제거하고, 내부 유동성 비율(Internal Price) 기반으로 Price Scale이 업데이트되도록 수정. Curve V2 백서의 Repricing 메커니즘을 보다 정확히 반영.
    - **Recentering 옵션화**: Gurufin 및 Curve Normalized 모델의 매 스텝(Hourly) 오라클 기반 리센터링(Recentering) 기능을 선택형 옵션으로 변경.
    - **UI 추가**: 리센터링 적용 여부를 제어할 수 있는 체크박스(Ref-Price Recenter) UI 추가 (기본값: Off).
