import type {ScenarioInputs} from '@/lib/validation'

/**
 * ============================================================================
 * MURIVEST INVESTMENT STUDIO — FINANCIAL ENGINE
 * ============================================================================
 * Pure functions. No external data. Every output derives from investor
 * inputs and is labelled ILLUSTRATIVE in the UI — these are underwriting
 * aids, not advice, not verified figures.
 *
 * CONVENTIONS
 *   • Annual periods, end-of-year cash flows.
 *   • Debt: interest-only for ioYears, then straight annuity over the
 *     remaining amortisation window. Interest rate is nominal annual.
 *   • LTV is computed on the purchase price.
 *   • NOI = gross income − operating expenses (pre-tax, pre-debt).
 *   • Exit via direct cap (exit NOI ÷ exit cap rate) or a given exit value.
 * ============================================================================
 */

export interface YearRow {
  year: number
  grossIncome: number
  opex: number
  noi: number
  debtService: number
  interestPortion: number
  principalPortion: number
  loanBalanceEnd: number
  cashFlowAfterDebt: number
  cumulativeCashFlow: number
}

export interface ScenarioResult {
  // Acquisition
  price: number
  acquisitionCosts: number
  totalCapitalRequirement: number
  // Financing
  loanAmount: number
  equityRequired: number
  // Capital gap
  equityAvailable: number
  capitalGap: number
  gapPctOfRequirement: number
  executableNow: boolean
  // Income metrics (year 1)
  noi: number
  grossYieldPct: number
  netYieldPct: number
  // Debt metrics (year 1)
  annualDebtService: number
  dscr: number | null
  // Returns
  cashOnCashPct: number | null
  simplePaybackYears: number | null
  unleveredPaybackYears: number | null
  totalDistributions: number
  netExitProceeds: number
  exitValue: number
  equityMultiple: number | null
  irrPct: number | null
  unleveredIrrPct: number | null
  // Projections
  years: YearRow[]
}

const r2 = (n: number) => Math.round(n * 100) / 100

function annuityPayment(principal: number, annualRatePct: number, years: number): number {
  if (years <= 0) return 0
  const i = annualRatePct / 100
  if (i === 0) return principal / years
  return (principal * i) / (1 - Math.pow(1 + i, -years))
}

/** Annual debt service & schedule with an interest-only period. */
function debtServiceForYear(loan: number, ratePct: number, amortYears: number, ioYears: number, year: number) {
  const i = ratePct / 100
  if (loan <= 0) return {payment: 0, interest: 0, principal: 0, balanceEnd: 0}
  if (year <= ioYears) {
    return {payment: loan * i, interest: loan * i, principal: 0, balanceEnd: loan}
  }
  const remainingAmort = Math.max(amortYears - ioYears, 1)
  const payment = annuityPayment(loan, ratePct, remainingAmort)
  // Walk the schedule to the start of this year
  let balance = loan
  for (let y = ioYears + 1; y < year; y++) {
    const interest = balance * i
    const principal = Math.min(payment - interest, balance)
    balance -= principal
  }
  const interest = balance * i
  const principal = Math.min(payment - interest, balance)
  return {payment: payment, interest, principal, balanceEnd: Math.max(balance - principal, 0)}
}

/** IRR via bisection on NPV (robust for these cash flow profiles). */
export function irr(cashFlows: number[]): number | null {
  const npv = (rate: number) => cashFlows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + rate, t), 0)
  let low = -0.9
  let high = 10
  let fLow = npv(low)
  let fHigh = npv(high)
  if (fLow * fHigh > 0) return null
  for (let iter = 0; iter < 200; iter++) {
    const mid = (low + high) / 2
    const fMid = npv(mid)
    if (Math.abs(fMid) < 1e-7) return mid
    if (fLow * fMid < 0) {
      high = mid
      fHigh = fMid
    } else {
      low = mid
      fLow = fMid
    }
  }
  return (low + high) / 2
}

export function computeScenario(input: ScenarioInputs): ScenarioResult {
  const price = input.price || 0
  const acquisitionCosts = price * (input.acquisitionCostsPct / 100)
  const totalCapitalRequirement = price + acquisitionCosts
  const loanAmount = input.useDebt ? price * (input.ltvPct / 100) : 0
  const equityRequired = totalCapitalRequirement - loanAmount
  const equityAvailable = input.equityAvailable ?? 0
  const capitalGap = Math.max(equityRequired - equityAvailable, 0)
  const gapPctOfRequirement = totalCapitalRequirement > 0 ? (capitalGap / totalCapitalRequirement) * 100 : 0

  const years: YearRow[] = []
  let cumulative = 0
  let gross = input.grossIncome || 0
  let opex = input.opex || 0
  const hold = Math.max(1, Math.round(input.holdYears))

  for (let y = 1; y <= hold; y++) {
    if (y > 1) {
      gross *= 1 + input.growthPct / 100
      opex *= 1 + input.opexGrowthPct / 100
    }
    const noi = gross - opex
    const debt = debtServiceForYear(loanAmount, input.interestRatePct, input.amortizationYears, input.ioYears, y)
    const cashFlowAfterDebt = noi - debt.payment
    cumulative += cashFlowAfterDebt
    years.push({
      year: y,
      grossIncome: r2(gross),
      opex: r2(opex),
      noi: r2(noi),
      debtService: r2(debt.payment),
      interestPortion: r2(debt.interest),
      principalPortion: r2(debt.principal),
      loanBalanceEnd: r2(debt.balanceEnd),
      cashFlowAfterDebt: r2(cashFlowAfterDebt),
      cumulativeCashFlow: r2(cumulative),
    })
  }

  const noiYear1 = (input.grossIncome || 0) - (input.opex || 0)
  const debtYear1 = debtServiceForYear(loanAmount, input.interestRatePct, input.amortizationYears, input.ioYears, 1)
  const finalYear = years[years.length - 1]

  // ---- Exit ----------------------------------------------------------------
  const exitNoi = finalYear ? finalYear.noi : noiYear1
  let exitValue: number
  if (input.exitValueMode === 'exit_value' && input.exitValue != null) {
    exitValue = input.exitValue * Math.pow(1 + input.exitGrowthPct / 100, 0) // explicit value used as given
  } else if (input.exitValueMode === 'cap_rate' && input.exitCapRatePct != null && input.exitCapRatePct > 0) {
    exitValue = exitNoi / (input.exitCapRatePct / 100)
  } else {
    exitValue = price * Math.pow(1 + input.exitGrowthPct / 100, hold)
  }
  const sellingCosts = exitValue * (input.sellingCostsPct / 100)
  const loanBalanceAtExit = finalYear ? finalYear.loanBalanceEnd : loanAmount
  const netExitProceeds = exitValue - sellingCosts - loanBalanceAtExit

  // ---- Returns ---------------------------------------------------------------
  const totalOperatingCash = years.reduce((s, y) => s + y.cashFlowAfterDebt, 0)
  const totalDistributions = totalOperatingCash + netExitProceeds
  const equityMultiple = equityRequired > 0 ? totalDistributions / equityRequired : null

  const leveredFlows = [-equityRequired, ...years.map((y) => y.cashFlowAfterDebt)]
  leveredFlows[leveredFlows.length - 1] += netExitProceeds
  const irrPct = equityRequired > 0 ? irr(leveredFlows) : null

  const unleveredFlows = [-totalCapitalRequirement, ...years.map((y) => y.noi)]
  unleveredFlows[unleveredFlows.length - 1] += exitValue - sellingCosts
  const unleveredIrrPct = irr(unleveredFlows)

  // Payback: first year cumulative after-debt cash flow covers equity invested
  let simplePaybackYears: number | null = null
  let acc = 0
  for (const y of years) {
    acc += y.cashFlowAfterDebt
    if (acc >= equityRequired) {
      simplePaybackYears = y.year
      break
    }
  }
  const unleveredPaybackYears = noiYear1 > 0 ? totalCapitalRequirement / noiYear1 : null

  return {
    price: r2(price),
    acquisitionCosts: r2(acquisitionCosts),
    totalCapitalRequirement: r2(totalCapitalRequirement),
    loanAmount: r2(loanAmount),
    equityRequired: r2(equityRequired),
    equityAvailable: r2(equityAvailable),
    capitalGap: r2(capitalGap),
    gapPctOfRequirement: r2(gapPctOfRequirement),
    executableNow: capitalGap <= 0.005,
    noi: r2(noiYear1),
    grossYieldPct: price > 0 ? r2(((input.grossIncome || 0) / price) * 100) : 0,
    netYieldPct: price > 0 ? r2((noiYear1 / price) * 100) : 0,
    annualDebtService: r2(debtYear1.payment),
    dscr: debtYear1.payment > 0 ? r2(noiYear1 / debtYear1.payment) : null,
    cashOnCashPct: equityRequired > 0 && !input.useDebt ? r2((noiYear1 / equityRequired) * 100) : equityRequired > 0 ? r2(((noiYear1 - debtYear1.payment) / equityRequired) * 100) : null,
    simplePaybackYears,
    unleveredPaybackYears: unleveredPaybackYears ? r2(unleveredPaybackYears) : null,
    totalDistributions: r2(totalDistributions),
    netExitProceeds: r2(netExitProceeds),
    exitValue: r2(exitValue),
    equityMultiple: equityMultiple ? r2(equityMultiple) : null,
    irrPct: irrPct != null ? r2(irrPct * 100) : null,
    unleveredIrrPct: unleveredIrrPct != null ? r2(unleveredIrrPct * 100) : null,
    years,
  }
}

// ---------------------------------------------------------------------------
// Capital-gap & structure analysis
// ---------------------------------------------------------------------------

export interface FinancingPathway {
  label: string
  ltvPct: number
  loanAmount: number
  equityRequired: number
  residualGap: number
  executable: boolean
  dscr: number | null
  cashOnCashPct: number | null
  irrPct: number | null
}

/**
 * For each illustrative LTV point (and the investor's rate assumption),
 * show whether the deal becomes executable and what return emerges.
 * The Studio never dismisses an opportunity merely because stated equity
 * is below the asking price — it shows the structure that could work.
 */
export function capitalGapPathways(input: ScenarioInputs, ltvPoints: number[] = [0, 40, 50, 60, 65, 70, 75]): FinancingPathway[] {
  const price = input.price || 0
  const costs = price * (input.acquisitionCostsPct / 100)
  const total = price + costs
  return ltvPoints.map((ltv) => {
    const variant: ScenarioInputs = {
      ...input,
      useDebt: ltv > 0,
      ltvPct: ltv,
    }
    const result = computeScenario(variant)
    return {
      label: ltv === 0 ? 'All-cash' : `${ltv}% LTV`,
      ltvPct: ltv,
      loanAmount: result.loanAmount,
      equityRequired: result.equityRequired,
      residualGap: result.capitalGap,
      executable: result.executableNow,
      dscr: result.dscr,
      cashOnCashPct: result.cashOnCashPct,
      irrPct: result.irrPct,
    }
  })
}

// ---------------------------------------------------------------------------
// Sensitivity / stress testing
// ---------------------------------------------------------------------------

export interface SensitivityCell {
  rowValue: number
  colValue: number
  value: number | null
}

export interface SensitivityGrid {
  rowLabel: string
  colLabel: string
  metric: 'irr' | 'cash_on_cash' | 'dscr'
  rows: number[]
  cols: number[]
  cells: SensitivityCell[][]
}

export function sensitivityGrid(
  input: ScenarioInputs,
  metric: 'irr' | 'cash_on_cash' | 'dscr',
  rowAxis: 'rate' | 'exit_cap' | 'ltv',
  colAxis: 'rate' | 'exit_cap' | 'ltv',
  rowValues: number[],
  colValues: number[],
): SensitivityGrid {
  const cells = rowValues.map((rowValue) =>
    colValues.map((colValue) => {
      const variant: ScenarioInputs = {...input}
      if (rowAxis === 'rate') variant.interestRatePct = rowValue
      if (rowAxis === 'exit_cap') variant.exitCapRatePct = rowValue
      if (rowAxis === 'ltv') variant.ltvPct = rowValue
      if (colAxis === 'rate') variant.interestRatePct = colValue
      if (colAxis === 'exit_cap') variant.exitCapRatePct = colValue
      if (colAxis === 'ltv') variant.ltvPct = colValue
      const result = computeScenario(variant)
      const value =
        metric === 'irr' ? result.irrPct : metric === 'cash_on_cash' ? result.cashOnCashPct : result.dscr
      return {rowValue, colValue, value}
    }),
  )
  const axisLabel = (a: 'rate' | 'exit_cap' | 'ltv') =>
    a === 'rate' ? 'Interest rate %' : a === 'exit_cap' ? 'Exit cap rate %' : 'LTV %'
  return {
    rowLabel: axisLabel(rowAxis),
    colLabel: axisLabel(colAxis),
    metric,
    rows: rowValues,
    cols: colValues,
    cells,
  }
}
