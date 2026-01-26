# FX-AMM 은행 LP 1년(365일) 일별 IL·Fee 시뮬레이션 시나리오

## 0) 목적과 산출물

### 목적

- 은행(LP) 관점에서 통화별/규모별(10억·50억·100억·200억·500억) 유동성 공급 시 일별(365일) 비영구적손실(IL)과 수수료 수익(Fee Income)을 산출
- 동일한 FX 시계열/거래량 가정 하에 AMM 모델(예: CPMM/StableSwap/Gurufin Dynamic)별 손익·리스크 구조 비교
- 운영 정책(오라클 리센터링, ±2% 밴드에서 RFQ-only, 차익거래 효율, 리밸런싱 허용 여부)이 결과에 미치는 영향 평가

### 최종 산출물(권장)

- 일별 로그(365행) × [통화쌍/모델/규모/거래량 시나리오]
- 요약 리포트
  - 연간 누적 Fee, 연간 누적/최대 IL, Fee-IL 순효과
  - 최대 드로우다운(peak-to-trough), 일간 PnL 변동성, 95%/99% VaR(일간)
  - 규모별(10억→500억) 리스크/수익 탄력도

## 1) 풀 구성(은행 LP 상품 정의)

은행이 운용하기 쉬운 구조로 KRGX를 기준통화(Base)로 두고 FX 풀을 분리

- Pool A: KRGX/USGX (KRW/USD)
- Pool B: KRGX/JPGX (KRW/JPY)
- Pool C: KRGX/EUGX (KRW/EUR)
- Pool D: KRGX/PHGX (KRW/PHP)

IL은 상대가격이 필요한 지표이므로, 실무 시뮬레이션 단위는 보통 '통화쌍 풀'로 구성

## 2) 유동성 투입 규모(10억~500억) 해석

### 기본안(권장): 양쪽 50:50 가치 예치

각 풀에 대해 규모 S(원화 환산)가 주어지면

- KRGX 예치: S/2 (KRW)
- 상대코인 예치: (S/2) / FX₀ (해당 통화의 KRW per 1 unit)

### 대안(비권장): 한쪽만 예치 후 스왑으로 조달

- 초기 불균형으로 슬리피지/IL 추정이 왜곡될 수 있어 비교 목적에는 비권장

## 3) 입력 데이터(지난 1년, Daily)

### (A) FX 시계열(필수)

- KRW/USD, KRW/JPY, KRW/EUR, KRW/PHP
- 빈도: Daily close 또는 지정 시각 mid
- 결측 처리 정책(고정): 전일 종가 유지 / 보간(오프쇼어·선물 등) 중 택 1

### (B) 거래량 시계열(필수: Fee 추정)

거래량은 아래 3개 시나리오로 둠

- Conservative: 일 거래량 = TVL × 1~2%
- Base: 일 거래량 = TVL × 5%
- Aggressive: 일 거래량 = TVL × 10~20%

(선택) 변동성-거래량 연동

- Volume_t = TVL × (v0 + k·|r_t|), r_t = FX 일간 수익률

### (C) Fee/분배 파라미터(정책 입력)

- AMM swap fee f (예: 0.05%)
- (선택) 은행/리테일 스프레드
- (선택) 프로토콜 fee 분배: share_LP (예: 80% LP / 20% Protocol)

## 4) 시뮬레이션 룰(은행 관점 운영정책 포함)

### 공통 룰(모든 모델)

- Day 0: 오라클(mid) 기준으로 풀을 정확히 세팅
- Day t(1..365) 반복:
  1. 새로운 오라클 FX_t 반영
  2. 당일 거래량 Volume_t 발생(방향 비율 포함 가능)
  3. AMM 곡선에 따라 체결/슬리피지/가격충격 계산 → Fee_t 산출
  4. 차익거래(arb) 가정 적용
     - 즉시 복귀(100%) 또는 부분 복귀(예: 50%)
  5. Day-end 풀 잔고(x_t, y_t) 확정
  6. 오라클 FX_t 기준 평가로 IL_t 산출

### 스펙/운영 정책 옵션

- Oracle band ±2%: |deviation|>2%면 AMM disabled (RFQ-only)
  - 이 날의 AMM Fee=0 또는 RFQ 수익(별도 입력) 적용
- Oracle recenter (예: 10분 주기)
  - 일 단위 단순화: "매일 1회 recenter"
  - 정교화: "일중 N회 recenter(예: 144회)"

## 5) IL 계산(일별)

각 풀(예: KRGX/USGX)에서 Day t

- LP 포지션 가치(오라클 환산): V^LP_t = value(x_t, y_t | FX_t)
- HODL 가치(초기 보유 유지 가정): V^HODL_t = value(x_0, y_0 | FX_t)
- IL_t:
  - IL_t = (V^LP_t / V^HODL_t) - 1

손실을 음수로 표시할지(−) 또는 손실 크기를 양수로 표시할지(+)는 리포팅 정책으로 고정

## 6) Fee 수익 계산(일별)

- 거래량(명목): Volume_t (KRW 환산 또는 입력통화 기준 중 하나로 고정)
- Fee 율: f
- LP 분배: share_LP
- Fee_t = Volume_t × f × share_LP

(선택) 방향/슬리피지 반영해 "실제 체결 notional"로 재산정 가능

## 7) 모델별 시나리오(동일 입력으로 비교)

각 풀(A~D)에 대해 병렬 실행

- Model 1: Uniswap V2 (CPMM)
- Model 2: Curve/StableSwap (고정 A, 예: A=200)
- Model 3: Gurufin Dynamic (A_eff = f(δ))
- (선택) Model 4: RFQ-only (밴드 밖/스트레스 대안)

## 8) 실험 매트릭스(권장)

- 4 pools × 3 models × 5 sizes × 3 volume scenarios = 180 runs
- 여기에 arb 효율(100%/50%) 2개 추가 시 360 runs

## 9) 일별 로그 스키마(권장 컬럼)

- Date
- Pair (KRW/USD, KRW/JPY, KRW/EUR, KRW/PHP)
- Model (V2/Curve/Gurufin/RFQ)
- Size (10억/50억/100억/200억/500억)
- Oracle_FX_t
- PoolPrice_Begin_t / PoolPrice_End_t
- Deviation_Begin_t (δ_log, δ_pct)
- Volume_t (notional)
- Fee_t (KRW)
- Reserves_x_t (KRGX), Reserves_y_t (상대코인)
- V_LP_t (KRW), V_HODL_t (KRW)
- IL_t (%)
- Daily_PnL_t (정의 고정 필요: 예) Fee_t + (V_LP_t - V_LP_{t-1})
- Status (OK / NearBand / RFQOnly / CalcFail)

## 10) 은행 관점 스트레스/규제 친화 추가 시나리오(권장)

- 급변일(테일 이벤트) 라벨링: 최대손실/복구기간 측정
- 변동성↑ + 거래량↑ 동시 발생 시나리오
- |δ|>2% 밴드 밖에서 AMM 중단(RFQ-only) 정책 효과 비교
- 리밸런싱 허용/금지 비교(일별 종료 후 외부 시장에서 재균형 가능 여부)