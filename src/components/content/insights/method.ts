import type {InsightArticle} from './types'

/** Underwriting Method — the evergreen differential articles that carry the house methodology. */
export const method: InsightArticle[] = [
  {
    slug: 'differential-underwriting-explained',
    title: 'Differential Underwriting, Explained: Rank, Test, Rule Out, Price the Spread',
    dek:
      'A deal is not one pro forma — it is a set of competing explanations of value. Rank them, test the ones that move the answer, rule out the ones that fail, and price the gap between consensus and reality.',
    category: 'Underwriting Method',
    tags: ['differential underwriting', 'commercial real estate underwriting', 'deal analysis', 'investment method'],
    author: {name: 'Mark Muriithi', role: 'Managing Director · Differential Underwriter'},
    publishedAt: '2026-11-21',
    updatedAt: '2026-11-21',
    featured: true,
    sources: [
      {outlet: 'CBRE', title: 'U.S. Cap Rate Survey H1 2026', url: 'https://www.cbre.com/insights/reports/us-cap-rate-survey-h1-2026'},
    ],
    blocks: [
      {
        kind: 'p',
        text: 'Conventional underwriting produces one pro forma and negotiates around it. Differential Underwriting produces a ranked set of competing explanations of a deal\u2019s value, tests each against evidence, eliminates the explanations that fail, and prices the spread between the market\u2019s story and the asset\u2019s reality. The output is not a single number. It is a defensible conclusion with a known error band — and a walk-away price written before the negotiation begins.',
      },
      {
        kind: 'p',
        text: 'The method is the professional identity of this desk. It exists because four numbers in every commercial deal never reconcile themselves: what an asset is presented to be, what it earns today, what it could earn stabilised, and what it is worth as an investment. Most market participants price the first one. The differential underwriter\u2019s entire job is the other three — and the distances between them.',
      },
      {kind: 'h3', text: 'What the method is — and is not'},
      {
        kind: 'ul',
        items: [
          'It is: a hypothesis-driven investigation of value; a rule-out procedure for bad assumptions; a pricing discipline that treats the asking price as a claim to be tested.',
          'It is not: a search for reasons to decline every deal; a modelling exercise detached from physical and legal diligence; a delay mechanism. A differential that never converges on a verdict is a failed differential.',
        ],
      },
      {kind: 'h3', text: 'The seven stages every file passes through'},
      {
        kind: 'table',
        head: ['Stage', 'The question asked', 'The output'],
        rows: [
          ['1 · Presenting asset', 'What is being presented — asking price, reported income, occupancy, the seller\u2019s narrative?', 'Deal fact sheet'],
          ['2 · Initial read', 'What does conventional underwriting suggest about the property?', 'Consensus case'],
          ['3 · Differential hypotheses', 'What alternative explanations exist for its performance, valuation, vacancy or pricing?', 'Ranked hypothesis register'],
          ['4 · Investigative testing', 'Do leases, title, comparables, expenses, capex and location support or destroy each hypothesis?', 'Evidence file'],
          ['5 · Rule-out analysis', 'Which assumptions, liabilities and projections are unsupported?', 'Rule-out log'],
          ['6 · Final underwriting', 'What is the defensible NOI, basis, yield, downside exposure and exit?', 'Differential valuation'],
          ['7 · Investment verdict', 'Acquire, renegotiate, restructure, monitor or reject?', 'Differential Verdict memo'],
        ],
      },
      {
        kind: 'p',
        text: 'Stage 3 is the heart of the method — and the stage conventional underwriting skips. The hypothesis register is written before detailed modelling begins, so the model is built to discriminate between explanations rather than to decorate one of them. Each hypothesis carries a test that could kill it. A hypothesis without a falsifiable test is an opinion, and opinions do not underwrite deals.',
      },
      {kind: 'h3', text: 'The three explanations of value'},
      {
        kind: 'p',
        text: 'Every differential holds at least three competing explanations of what an asset is worth. Scenario A is the seller\u2019s story: full occupancy, lean costs, the market cap rate — the asking price\u2019s own implicit model. Scenario B is the in-place reality: today\u2019s occupancy, today\u2019s costs, the same cap rate. Scenario C is the stabilised case: target occupancy by a stated month, market opex, less the full cost of the re-leasing programme. In the desk\u2019s published worked example — a Nairobi CBD tower asking 800 million shillings at 40% occupancy — the three explanations price at roughly 802.7M, 252.3M and 566.2M net of a 67.3M programme. All illustrative; the arithmetic runs in the public engine on this site.',
      },
      {kind: 'h3', text: 'The differential spread is the product'},
      {
        kind: 'p',
        text: 'The spread between the consensus price and the underwritten value is the number that goes on the front page of every verdict memo. In the worked example it is about 233.8 million — 29.2% of the asking price. That spread, not the property photograph, is where institutional return is manufactured: what does this desk know, or do, that the market has not yet priced?',
      },
      {kind: 'h3', text: 'Who runs it'},
      {
        kind: 'p',
        text: 'Differential Underwriting is the house method of Murivest Group Ltd, originated and led by Mark Muriithi, Managing Director and the desk\u2019s Differential Underwriter. The public identity is Differential Underwriting; the research methodology published in notes like this one is Differential Analysis; every mandate closes with a Differential Verdict. Clients see the machinery — the hypothesis register, the rule-out log, the offer ladder — because an inspectable method, not a promise of rigour, is what converts a brand claim into evidence.',
      },
      {
        kind: 'callout',
        title: 'Diagnose before you dollar.',
        text: 'Run the arithmetic on your own property in the public engine — three explanations of value, an offer ladder, debt capacity and rent guidance — then decide whether the deal deserves a full mandate.',
      },
    ],
    faqs: [
      {
        q: 'What is differential underwriting?',
        a: 'A commercial real estate underwriting method that treats a deal\u2019s price and narrative as a claim, ranks the competing explanations of its value and risk (rent, credit, capex, financing, exit), tests the assumptions that actually move the answer, rules out the explanations that fail on evidence, and prices the spread between the market\u2019s story and the asset\u2019s reality. The output is a defensible verdict with a known error band rather than a single pro forma.',
      },
      {
        q: 'How is it different from conventional underwriting?',
        a: 'Conventional underwriting builds one pro forma and negotiates around it. Differential Underwriting writes a hypothesis register before modelling begins, builds the model to discriminate between explanations rather than decorate one, and expresses the conclusion as an offer ladder anchored in basis points of defensible stabilised yield — with the walk-away price fixed before the negotiation starts.',
      },
      {
        q: 'Can I run a differential underwrite myself?',
        a: 'Yes — the public engine on this site computes the core: the three competing explanations of value, the offer ladder, DSCR-based debt capacity and rent guidance. The mandate-grade version adds the evidence layer — rent roll reconciliation, estoppels, title, capex registers — that turns a band into a signed verdict.',
      },
    ],
  },
  {
    slug: 'cap-rate-explained',
    title: 'Cap Rates, Explained the Differential Way (With Worked Examples)',
    dek:
      'The cap rate converts income into value — and runs backwards: what a price implies about itself. Both directions, worked, with the honest band instead of the confident point.',
    category: 'Underwriting Method',
    tags: ['cap rate', 'capitalisation rate', 'property valuation', 'NOI', 'yield'],
    author: {name: 'Mark Muriithi', role: 'Managing Director · Differential Underwriter'},
    publishedAt: '2026-10-24',
    updatedAt: '2026-11-04',
    sources: [
      {outlet: 'CBRE', title: 'U.S. Cap Rate Survey H1 2026', url: 'https://www.cbre.com/insights/reports/us-cap-rate-survey-h1-2026'},
      {
        outlet: 'CBRE',
        title: 'U.S. Real Estate Market Outlook 2026 — Capital Markets',
        url: 'https://www.cbre.com/insights/books/us-real-estate-market-outlook-2026/capital-markets',
      },
    ],
    blocks: [
      {
        kind: 'p',
        text: 'The capitalisation rate is one equation pretending to be two. Read forward, it converts income into value: value equals NOI divided by the cap rate. Read backward, it is what a price confesses about itself: the implied cap rate equals NOI divided by price. Every valuation argument in commercial real estate is one of these two readings, and the discipline lies in knowing which one you are using — because sellers use the forward reading on their best NOI, and buyers should use the backward reading on the seller\u2019s price.',
      },
      {kind: 'h3', text: 'The equation, both ways, worked'},
      {
        kind: 'table',
        head: ['Step', 'Computation', 'Result (illustrative)'],
        rows: [
          ['Stabilised NOI', 'Fully-let income 103.2M × 85% × (1 − 35% opex)', '57.02M p.a.'],
          ['Value at a 9.0% market cap rate', '57.02M ÷ 0.09', '633.5M'],
          ['Value at 8.5% / 9.5% (the honest band)', '57.02M ÷ 0.085 / ÷ 0.095', '671M / 600.2M'],
          ['Implied cap rate of an 800M asking price', '57.02M ÷ 800M', '7.13% — a premium no buyer needs to accept'],
        ],
      },
      {
        kind: 'p',
        text: 'The worked numbers come from this desk\u2019s published example (a Nairobi CBD tower) and are illustrative — the point is the shape: the same NOI spans a 600–671M value band on a ±50bp cap-rate move, while a fully-let story would value the tower\u2019s income at 802.7M. A cap rate is not a fact about a building. It is the market\u2019s current price of the risk in that submarket — and it moves.',
      },
      {kind: 'h3', text: 'Why the desk underwrites a band, never a point'},
      {
        kind: 'p',
        text: 'CBRE\u2019s H1 2026 cap rate survey aggregates 3,600 estimates across more than 50 U.S. markets, and its 2026 outlook expects most property types to move just 5–15 basis points over the year. Macro drift is small; your own uncertainty is not. An honest underwrite expresses the cap rate as a band — typically ±50 basis points — prices the stabilised value at low, central and high, and negotiates the band. A buyer armed with a point estimate negotiates against arithmetic that does not exist.',
      },
      {kind: 'h3', text: 'What the cap rate is not'},
      {
        kind: 'ul',
        items: [
          'It is not your return: it is the price of risk before leverage, tax and time. A 9% cap rate with 14% debt costs is a different animal from the same cap rate at 6% debt.',
          'It is not comparable across conditions: a headline yield on gross income, an unreconciled rent roll or a deferring owner are not the same cap rate as one computed on audited net income.',
          'It is not stable across tenancies: the cap rate that applies to a seven-year WALT tower is not the one that applies to a staggered multi-tenant floor plan with identical NOI.',
        ],
      },
      {
        kind: 'callout',
        title: 'The differential read',
        text: 'Question the consensus: whose NOI, whose cap rate, and what does the price imply when the equation runs backward? Investigate the asset: the reconciled NOI that survives estoppels. Establish the difference: the band, not the point.',
      },
    ],
    faqs: [
      {
        q: 'What is a good cap rate on commercial property?',
        a: 'There is no universally good cap rate — it is the submarket\u2019s price of risk, and it must be compared to comparable evidence, debt cost and the asset\u2019s own quality. Prime gateway offices can clear near 5%; emerging-market CBD offices clear near 9–10%. The test is whether the implied cap rate of the price you are paying can be defended against comparable transactions — and whether it clears your debt constant with margin.',
      },
      {
        q: 'How do you calculate property value from NOI?',
        a: 'Value equals net operating income divided by the market capitalisation rate. Compute NOI in two states — in-place (today\u2019s occupancy and costs) and stabilised (target occupancy at market opex) — then apply a cap-rate band (±50bp) rather than a single point, and net the re-leasing programme off the stabilised case before you negotiate.',
      },
      {
        q: 'Is cap rate the same as ROI?',
        a: 'No. Cap rate prices unlevered, pre-tax income at a point in time; ROI (or IRR, equity multiple, cash-on-cash) measures your actual return after financing structure, tax position and hold period. A high cap rate with expensive debt can produce a negative return on equity; a modest cap rate with cheap, long debt can produce an excellent one.',
      },
    ],
  },
  {
    slug: 'noi-rent-roll-t12-reconciliation',
    title: "NOI Is Not an Opinion: Reconciling the Rent Roll, the T-12 and Reality",
    dek:
      'Reported income, collected income and sustainable income are three different documents — and they never agree. The reconciliation is where diligence either begins or ends.',
    category: 'Underwriting Method',
    tags: ['NOI', 'net operating income', 'rent roll', 'T-12', 'due diligence'],
    author: {name: 'Mark Muriithi', role: 'Managing Director · Differential Underwriter'},
    publishedAt: '2026-10-20',
    updatedAt: '2026-10-20',
    sources: [],
    blocks: [
      {
        kind: 'p',
        text: 'Net operating income is the engine of every commercial valuation, and it is computed in two states for every deal: in-place (today\u2019s occupancy and today\u2019s costs) and stabilised (target occupancy at market opex). The gap between them is the execution value. The gap between either of them and the seller\u2019s NOI is usually the deal\u2019s first differential finding — because the seller\u2019s NOI is not a lie exactly, but it is always a selection.',
      },
      {kind: 'h3', text: 'The three incomes, and why they differ'},
      {
        kind: 'table',
        head: ['Income', 'Where it lives', 'What it tells you'],
        rows: [
          ['Reported income', 'The brochure, the seller\u2019s NOI, "when fully occupied"', 'The story — a claim to be tested, never an input'],
          ['Contract income', 'The certified rent roll', 'What tenants are obliged to pay, suite by suite'],
          ['Collected income', 'The T-12 and the aged arrears report', 'What tenants actually paid, for a full year'],
        ],
      },
      {
        kind: 'p',
        text: 'Contract income exceeds collected income by the arrears ledger. Reported income exceeds contract income by vacancy masks, gross-versus-net presentations, one-off recoveries and the quiet expiry of escalations that were never implemented. The reconciliation — rent roll to T-12 to bank statements to tenant estoppels — is the first hour of any serious diligence, and it is the arithmetic that most often kills a price.',
      },
      {kind: 'h3', text: 'The documents that settle it'},
      {
        kind: 'ol',
        items: [
          'Certified rent roll — tenant, suite, area, rent, commencement, expiry, escalations, deposits — from the managing agent, not the broker.',
          'T-12 income and expense statement — the actual trading year, management or audited.',
          'T-3 operating trend — the direction of travel; a decaying building shows it here first.',
          'Aged arrears report — reported income that was never collected, with days outstanding.',
          'Service charge and recoveries schedule — whether recoveries fund costs or leak into net income.',
          'Tenant estoppels — each income-producing tenant\u2019s own confirmation of what they owe and receive. The estoppel outranks the rent roll wherever they disagree.',
        ],
      },
      {kind: 'h3', text: 'Vacancy is an allowance, not an observation'},
      {
        kind: 'p',
        text: 'The allowance for vacancy and credit loss is the most quietly abused line in any pro forma: it is set by aspiration (5% because that is what lenders like) rather than by evidence (the trailing three years of voids, arrears and non-renewals at this asset). The differential desk computes it from the rent roll\u2019s own expiry schedule and the arrears ledger — then stress-tests it one notch worse. A full building can still lose money; occupancy is not the same as profitability, and a rent roll with 5% vacancy and heavy arrears can be worth less than one at 12% that collects everything.',
      },
      {
        kind: 'callout',
        title: 'The differential read',
        text: 'Reconcile before you model. A seller who cannot produce the rent roll, T-12 and arrears position is selling a story; one who produces them is selling an asset. Requirement discipline is itself a differential signal.',
      },
    ],
    faqs: [
      {
        q: 'What is NOI in commercial real estate?',
        a: 'Net operating income: gross potential rent, minus vacancy and credit loss, minus operating expenses — computed before debt service, capital expenditure and tax. Underwrite it in two states: in-place (today\u2019s occupancy and costs) and stabilised (target occupancy at market operating costs), and net the re-leasing programme off the stabilised case before valuation.',
      },
      {
        q: 'Why doesn\u2019t the rent roll match the T-12?',
        a: 'Because the rent roll shows contractual obligations and the T-12 shows collections: the difference is arrears, non-renewals, vacancies during the year, gross-to-net presentation and one-off recoveries. Reconciling the two — with an aged arrears report and tenant estoppels — is the first test of any income claim in a data room.',
      },
    ],
  },
  {
    slug: 'dscr-maximum-commercial-loan',
    title: 'DSCR and Debt Sizing: How Lenders Decide Your Maximum Loan',
    dek:
      'Lenders do not lend on value — they lend on income. Here is the arithmetic that sets the maximum loan on any commercial property, worked at both a frontier and a gateway rate.',
    category: 'Underwriting Method',
    tags: ['DSCR', 'debt service coverage', 'commercial mortgage', 'loan sizing', 'debt constant'],
    author: {name: 'Mark Muriithi', role: 'Managing Director · Differential Underwriter'},
    publishedAt: '2026-10-16',
    updatedAt: '2026-10-16',
    sources: [
      {
        outlet: 'CBRE',
        title: 'U.S. Real Estate Market Outlook 2026 — Capital Markets',
        url: 'https://www.cbre.com/insights/books/us-real-estate-market-outlook-2026/capital-markets',
      },
    ],
    blocks: [
      {
        kind: 'p',
        text: 'Debt service coverage — net operating income divided by annual debt service — is the lender\u2019s first test and the buyer\u2019s leverage ceiling. Most lenders require 1.20× to 1.30× on stabilised income. That single floor, combined with the debt constant, determines the maximum loan any income can carry — before loan-to-value even enters the conversation. In high-rate environments DSCR constrains deals before LTV does, which is why a price that only works at aggressive leverage is a price the debt market vetoes on your behalf.',
      },
      {kind: 'h3', text: 'The debt constant — the number most buyers never compute'},
      {
        kind: 'p',
        text: 'The annual debt constant is total annual debt service per unit of loan, at the actual rate and amortisation. It rises with rate and falls with term. Two worked illustrations: a frontier-market facility at 14% over 15 years amortising monthly carries an annual constant near 15.98%; a deep-market loan at 6.5% over 30 years carries roughly 7.6%. Same income covers almost exactly twice the loan in the second case — the debt market\u2019s verdict on the price follows immediately.',
      },
      {kind: 'h3', text: 'Maximum loan, worked'},
      {
        kind: 'table',
        head: ['Step', 'Computation (illustrative)', 'Result'],
        rows: [
          ['Stabilised NOI', 'From the reconciled rent roll at target occupancy', '57.02M p.a.'],
          ['Maximum annual debt service at 1.30×', '57.02M ÷ 1.30', '43.86M p.a.'],
          ['Annual debt constant (14%, 15yr, monthly)', 'monthly annuity factor × 12', '15.98%'],
          ['Maximum supportable loan', '43.86M ÷ 0.1598', '274.5M'],
          ['Implied LTV at a 566M purchase', '274.5M ÷ 566M', '48.5% — conservative by design'],
          ['DSCR at 60% LTV of an 800M asking', '57.02M ÷ (480M × 0.1598)', '0.74× — fails; no lender signs'],
        ],
      },
      {
        kind: 'p',
        text: 'The numbers above are the desk\u2019s published worked example — illustrative, but the shape is universal: at the asking price the loan the market would happily quote cannot be serviced by the income; at the differential price the leverage case is conservative. That is what a downside-aware verdict looks like in a high-rate environment: the asset must stand on its income, not on its loan.',
      },
      {kind: 'h3', text: 'Where CBRE\u2019s outlook meets your term sheet'},
      {
        kind: 'p',
        text: 'With long-term yields anchored near 4% in the deepest markets, all-in commercial debt costs there sit in the mid-single digits; frontier markets remain double-digit. The desk\u2019s rule holds in both: stress the debt constant, not just the headline rate — because a 100bp rate move on a 15-year amortising facility changes the constant materially, and it is the constant that prices your DSCR ceiling and therefore your equity cheque.',
      },
      {
        kind: 'callout',
        title: 'The differential read',
        text: 'Size debt from the income downward — maximum loan equals stabilised NOI over the DSCR floor, over the debt constant — never from the price upward. The loan the income can carry is a fact; the loan the price implies is a hope.',
      },
    ],
    faqs: [
      {
        q: 'What DSCR do commercial lenders require?',
        a: 'Typically 1.20× to 1.30× on stabilised net operating income. Below that floor, lenders cut the loan size rather than debate the price — which is why DSCR, not loan-to-value, is usually the binding constraint on deal pricing in high-rate environments.',
      },
      {
        q: 'How much can I borrow on a commercial property?',
        a: 'Maximum loan equals stabilised NOI divided by your DSCR floor, divided by the annual debt constant. Example: 57.02M of NOI at a 1.30× floor and a 15.98% constant supports roughly 274.5M of loan — before any LTV cap, which applies second.',
      },
      {
        q: 'What is an annual debt constant?',
        a: 'Total annual debt service per unit of loan at a given rate and amortisation — the monthly annuity payment factor times twelve. It converts any DSCR floor into a maximum supportable loan, and it is far more decisive for pricing than the headline interest rate.',
      },
    ],
  },
  {
    slug: 'yield-trap-high-cap-rate-deals',
    title: 'The Yield Trap: Why a 12% Cap Rate Can Still Be a Bad Investment',
    dek:
      'A prime CBD tower marketed at a 12.9% gross yield, 40% occupied. Why headline yields trap buyers — and the five questions that disarm them before you do.',
    category: 'Underwriting Method',
    tags: ['yield trap', 'high cap rate', 'investment risk', 'gross yield', 'underwriting discipline'],
    author: {name: 'Mark Muriithi', role: 'Managing Director · Differential Underwriter'},
    publishedAt: '2026-10-12',
    updatedAt: '2026-10-12',
    sources: [],
    blocks: [
      {
        kind: 'p',
        text: 'A headline yield is the seller\u2019s best arithmetic on the seller\u2019s best income. The worked example this desk has published makes the anatomy plain: a CBD tower marketed at a 12.9% gross yield on the asking price — because the fully-let income claim is divided by the price — while the building stands 40% occupied. The same asset\u2019s in-place yield is 2.84%. The stabilised case implies 7.13% at the asking price, against a 9% market cap rate and a double-digit cost of debt. Three yields for one building; the brochure prints one.',
      },
      {kind: 'h3', text: 'Where the yield hides its costs'},
      {
        kind: 'ul',
        items: [
          'Arrears — a yield on contracted rent rather than collected rent is a yield on hope.',
          'Recovery leakage — service charges that fund only part of their costs quietly re-route income to opex.',
          'Deferred capex — lifts, generators and facades that "run fine today" price themselves into your equity tomorrow.',
          'The re-leasing cliff — every expiry carries downtime, fit-out and commissions that the gross yield never shows.',
          'Credit concentration — an anchor tenant is a yield with a single point of failure; ask the university that left the tower above.',
        ],
      },
      {kind: 'h3', text: 'Occupancy is not profitability'},
      {
        kind: 'p',
        text: 'The trap inverts too: a full building can still lose money — fixed costs that do not scale with occupancy, recoveries capped by half-empty leases, escalations that lag inflation. The reverse holds equally: a half-empty tower with a realistic stabilisation path can be a genuine opportunity, because the execution value of closing the occupancy gap — the ΔNOI capitalised at the market cap rate — is arithmetic, not opinion. The yield tells you neither. The reconciliation does.',
      },
      {kind: 'h3', text: 'The five questions that disarm any headline yield'},
      {
        kind: 'ol',
        items: [
          'Whose income — contracted, collected, or stabilised — is in the numerator, and can I see all three?',
          'What occupancy does the yield assume, and what does the rent roll\u2019s expiry schedule say about the next twenty-four months of it?',
          'What opex ratio underlies the "net" figure, and what does the T-12 plus a service-charge audit say it actually is?',
          'What capex is deferring itself into my hold period, and is it in the price or in my equity?',
          'What does the debt constant do to this yield at my DSCR floor — and does the income still cover the walk-away price?',
        ],
      },
      {
        kind: 'callout',
        title: 'The differential read',
        text: 'A high yield is not necessarily an attractive investment. Yield without quality is a trap; quality without a spread is a fair price. The differential finds the third category: quality the market has not yet priced.',
      },
    ],
    faqs: [
      {
        q: 'Is a high cap rate good?',
        a: 'Not by itself. A high cap rate is a high price of risk — it can be a bargain (mispriced quality) or a warning (income that will not survive contact with the rent roll). Test it: reconcile the income behind the headline, check the occupancy and expiry schedule, price the deferred capex and re-leasing cost, and re-run the yield at your own assumptions.',
      },
      {
        q: 'Can a high-yield property still be a bad investment?',
        a: 'Regularly. Gross yields on unverified income, yields net of understated opex, yields that ignore arrears, deferred capex and the re-leasing cliff all overstate the real return. In the desk\u2019s published worked example, a 12.9% gross headline yield sits on an in-place yield of 2.84% and a stabilised 7.13% against a 9% market cap rate — the same building, three yields.',
      },
    ],
  },
  {
    slug: 'commercial-real-estate-due-diligence-checklist',
    title: 'The 14 Documents to Demand Before Any Commercial Real Estate Offer',
    dek:
      'No calculation, no offer — until these fourteen documents are in the file or formally logged as unavailable. A seller who produces the first seven is selling an asset; one who cannot is selling a story.',
    category: 'Underwriting Method',
    tags: ['due diligence', 'data room', 'checklist', 'commercial property documents', 'differential investigation'],
    author: {name: 'Mark Muriithi', role: 'Managing Director · Differential Underwriter'},
    publishedAt: '2026-10-08',
    updatedAt: '2026-10-08',
    sources: [],
    blocks: [
      {
        kind: 'p',
        text: 'A differential is only as strong as the evidence beneath it — so the desk\u2019s first rule is arithmetic-free: no calculation is performed, and no offer is made, until the fourteen requirements below are in the file, or formally logged as unavailable with the gap flagged in the hypothesis register. The list doubles as the data-room index for a formal Differential Investigation, and as the agenda for the first conversation with any seller.',
      },
      {
        kind: 'table',
        head: ['#', 'Requirement', 'What it proves'],
        rows: [
          ['1', 'Certified rent roll', 'Tenant, suite, area, rent, commencement, expiry, escalations, deposits — the contract income, suite by suite'],
          ['2', 'T-12 income and expense statement', 'Actual trading performance over a full twelve months'],
          ['3', 'T-3 operating trend', 'Direction of travel — income and costs rising or falling'],
          ['4', 'Service charge and recoveries schedule', 'Whether recoveries fund costs or leak into net income'],
          ['5', 'Aged arrears report', 'Whether reported income was actually collected'],
          ['6', 'Occupancy and WALT schedule', 'The tenure of the income and the re-leasing horizon'],
          ['7', 'Operating expense breakdown', 'Power, water, security, insurance, rates, staff, maintenance — line by line'],
          ['8', 'Capex register and structural survey', 'Lifts, generator, water, firefighting, facade — priced, not hoped'],
          ['9', 'Title search and leasehold terms', 'Tenure, unexpired term, encumbrances, ground rent, consents'],
          ['10', 'Tenant estoppels and lease abstracts', 'What tenants independently confirm they owe and receive'],
          ['11', 'Debt terms (existing or assumed)', 'Rate, amortisation, covenants, prepayment penalties'],
          ['12', 'Comparable transactions and rents', 'Market cap rates, asking rents and absorption in the submarket'],
          ['13', 'Zoning, plot ratio and approvals', 'What can lawfully be built or changed on the site'],
          ['14', 'Tax position of the transaction', 'VAT on rents, stamp duty on transfer, capital gains on exit'],
        ],
      },
      {kind: 'h3', text: 'The data room\u2019s speed is a signal in itself'},
      {
        kind: 'p',
        text: 'Requirement discipline is the cheapest differential signal available. A seller who cannot produce items one to seven is selling a story; a seller who produces them is selling an asset. The completeness and speed of the data room therefore feeds directly into the risk assessment — and into the offer ladder, because a claim that arrives late is a claim that was not ready.',
      },
      {kind: 'h3', text: 'The three that settle arguments'},
      {
        kind: 'ul',
        items: [
          'Estoppels — where an estoppel and a rent roll disagree, the estoppel wins. It is the tenant\u2019s own version of the rent roll, signed.',
          'Title — verification is by official registry search on the parcel reference and physical occupation checks, never by photocopy.',
          'Tax — the all-in cost of buying, holding and selling is jurisdiction-specific and must be confirmed at the transaction date; it moves the walk-away price.',
        ],
      },
      {
        kind: 'callout',
        title: 'The differential read',
        text: 'Fourteen documents, one hour, no arithmetic — and the deal\u2019s first finding is already on the table: is the file selling an asset or a story?',
      },
    ],
    faqs: [
      {
        q: 'What documents should I ask for before making an offer on commercial property?',
        a: 'At minimum the fourteen-document set: certified rent roll, T-12 and T-3 statements, service charge and recoveries schedule, aged arrears, occupancy and WALT schedule, opex breakdown, capex register and structural survey, title search and leasehold terms, tenant estoppels with lease abstracts, existing debt terms, comparable transactions, zoning and approvals, and the transaction\u2019s tax position.',
      },
      {
        q: 'What is a tenant estoppel and why does it matter?',
        a: 'A estoppel is each income-producing tenant\u2019s own signed confirmation of what they owe and receive under their lease — rent, term, deposits, options and any disputes. Where an estoppel contradicts the seller\u2019s rent roll, the estoppel controls, which is why every serious data room demands one per lease before a price is agreed.',
      },
    ],
  },
]
