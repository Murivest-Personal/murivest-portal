#!/usr/bin/env python3
"""Independent verification of the Investment Studio finance engine.

Scenario (as entered in the browser):
  price=5,000,000  acquisition costs 0%  LTV 60%  rate 9.5%  term/amort 20 yrs
  io 0  gross income 600,000  opex 150,000  growth 0  hold 5 yrs
  exit cap 8%  selling costs 0%
Expected app outputs (observed): total capital 5,000,000 · equity required 2,000,000
  NOI 450,000 · DSCR 1.32x · levered IRR 12.9% · equity multiple 1.75x
"""
P = 5_000_000
LTV = 0.60
RATE = 0.095
AMORT = 20
GROSS, OPEX = 600_000, 150_000
HOLD = 5
EXIT_CAP = 0.08

loan = P * LTV
equity = P - loan
noi = GROSS - OPEX

# Annuual debt service (annuity, annual compounding)
i = RATE
ann = loan * i / (1 - (1 + i) ** -AMORT)
dscr = noi / ann

# Balance at end of year 5
bal = loan
for _ in range(5):
    interest = bal * i
    principal = ann - interest
    bal -= principal

exit_value = noi / EXIT_CAP  # NOI constant (zero growth)
net_exit = exit_value - bal
total_dist = sum(noi - ann for _ in range(HOLD)) + net_exit
em = total_dist / equity

# IRR by bisection
flows = [-equity] + [noi - ann] * (HOLD - 1) + [noi - ann + net_exit]
def npv(r):
    return sum(cf / (1 + r) ** t for t, cf in enumerate(flows))
lo, hi = -0.9, 10.0
for _ in range(200):
    mid = (lo + hi) / 2
    if npv(lo) * npv(mid) < 0: hi = mid
    else: lo = mid
irr = (lo + hi) / 2

print(f"total capital requirement = {P:,.0f}   (app: 5,000,000)")
print(f"equity required           = {equity:,.0f}   (app: 2,000,000)")
print(f"NOI year 1                = {noi:,.0f}   (app: 450,000)")
print(f"debt service              = {ann:,.0f}")
print(f"DSCR                      = {dscr:.2f}x  (app: 1.32x)")
print(f"loan balance at exit      = {bal:,.0f}")
print(f"exit value                = {exit_value:,.0f}")
print(f"equity multiple           = {em:.2f}x  (app: 1.75x)")
print(f"levered IRR               = {irr*100:.1f}%  (app: 12.9%)")
