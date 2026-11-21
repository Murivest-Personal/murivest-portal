import type {InsightArticle} from './types'

/** Markets & case studies — the differential applied to real markets. */
export const markets: InsightArticle[] = [
  {
    slug: 'nairobi-cbd-office-underwriting',
    title: 'Underwriting Nairobi CBD Office: A Full Differential Walk-Through',
    dek:
      'A thirteen-storey tower, about 49,000 sq ft, asking KSh 800 million at 40% occupancy. The seven-stage differential, end to end — with every desk assumption flagged as illustrative.',
    category: 'Markets & Case Studies',
    tags: ['Nairobi CBD', 'Kenya commercial property', 'office investment', 'case study', 'differential underwriting'],
    author: {name: 'Mark Muriithi', role: 'Managing Director · Differential Underwriter'},
    publishedAt: '2026-11-21',
    updatedAt: '2026-11-21',
    featured: true,
    sources: [],
    blocks: [
      {
        kind: 'p',
        text: 'This is the desk\u2019s reference case: a live-format Nairobi CBD opportunity used to train the method end to end — a thirteen-storey commercial tower with three basement levels on about 0.055 hectares at the corner of Moi Avenue and Moktar Daddah Street, roughly 49,000 sq ft of office and commercial space, a 99-year leasehold from March 1998, and an asking price of KSh 800 million. The marketing claims a fully-let income of KSh 8.6 million a month. The critical disclosure sits lower on the page: occupancy is 40%, following the departure of an anchor tenant — a university. Every assumption the desk adds below is flagged as illustrative, to be replaced by evidence as a data room opens.',
      },
      {kind: 'h3', text: 'Stage 1–2 — the presenting asset and the vitals'},
      {
        kind: 'table',
        head: ['Measure', 'Computation (from the claims as given)', 'Value'],
        rows: [
          ['Gross potential rent', '8.6M × 12', '103.2M p.a.'],
          ['Rent per sq ft per month', '8.6M ÷ 49,000', '≈175.5'],
          ['Basis per sq ft at asking', '800M ÷ 49,000', '≈16,327'],
          ['Gross yield at asking, fully let', '103.2M ÷ 800M', '12.9%'],
          ['In-place income at 40%', '103.2M × 0.40', '41.28M p.a.'],
          ['Unexpired leasehold term', 'to 1 March 2097', '≈70.3 years'],
        ],
      },
      {
        kind: 'p',
        text: 'The vitals also record what is absent: no rent roll, no T-12, no service charge accounts, no arrears position, no capex register, no comparables, no explanation of the university\u2019s departure. Each absence becomes a diligence demand. The leasehold term — comfortably above typical institutional lending thresholds — is noted as a term that will begin to decay in value and debt tenor once it falls through the 65-to-70-year window.',
      },
      {kind: 'h3', text: 'Stage 3 — the hypothesis register'},
      {
        kind: 'table',
        head: ['#', 'Hypothesis', 'The test that could kill it'],
        rows: [
          ['H1', 'The 8.6M/month claim is gross and includes recoveries or one-offs', 'Rent roll and T-12 reconciliation, line by line'],
          ['H2', 'Costs are understated; recoveries fail against empty floors', 'Opex ratio in the T-12; recovery shortfall on the vacant 60%'],
          ['H3', 'The university\u2019s exit signals structural demand shift, not churn', 'Exit interview; competing CBD lettings; absorption data'],
          ['H4', 'CBD office demand is weakening against newer submarkets', 'Submarket vacancy and rental trend series; supply pipeline'],
          ['H5', 'Leasehold structure constrains financing and the buyer pool', 'Lender soundings on unexpired term; lease covenants'],
          ['H6', 'Deferred capex hides behind "well-maintained"', 'Independent engineer\u2019s survey; statutory inspection records'],
        ],
      },
      {kind: 'h3', text: 'Stage 5 — three competing explanations of value (illustrative)'},
      {
        kind: 'table',
        head: ['Scenario', 'Occupancy', 'Opex', 'NOI', 'Cap', 'Less programme', 'Net value'],
        rows: [
          ['A — seller\u2019s story', '100%', '30%', '72.24M', '9.0%', '—', '802.7M'],
          ['B — in-place reality', '40%', '45%', '22.70M', '9.0%', '—', '252.3M'],
          ['C — stabilised case', '85% by month 30', '35%', '57.02M', '9.0%', '67.3M', '566.2M'],
        ],
      },
      {
        kind: 'p',
        text: 'The re-leasing programme in Scenario C is priced honestly: fit-out contributions of about KSh 2,000 per sq ft across the 22,050 sq ft to be re-let (44.1M) plus six months of gross rent across that space for downtime, rent-free and commissions (23.2M). Stress-tested across the cap-rate band, the differential value sits in a roughly 533M–603M band. The single most important sentence in the case: even at 100% occupancy net of the programme, the value reaches only about 655.6M — the asking price sits above the curve at every occupancy level. It is not a valuation; it is an aspiration capitalised.',
      },
      {kind: 'h3', text: 'Stage 6–7 — the debt verdict and the ladder'},
      {
        kind: 'p',
        text: 'On illustrative debt of 14% over 15 years amortising monthly, the annual debt constant is about 15.98%. The maximum supportable loan at a 1.30× DSCR floor is roughly 274.5M — an implied LTV of about 48.5% at the differential price. At a conventional 60% LTV of the asking price, coverage is 0.74× stabilised and 0.30× in-place: the debt market\u2019s own verdict on the 800M price. The ladder therefore reads: opening offer about 500M (11.4% stabilised yield), target zone 550–570M (10.4–10.0%), hard walk-away 600M (9.5%) with conditions precedent — certified rent roll and T-12 reconciling the 8.6M claim, tenant estoppels, an independent structural and MEP survey, an official title search on the parcel, verified rates and arrears, and KYC/AML clearance of the seller entity.',
      },
      {kind: 'h3', text: 'What generalises beyond Nairobi'},
      {
        kind: 'p',
        text: 'The Nairobi-specific layer — 99-year leaseholds, county-level zoning and rates, urban stamp duty at the transfer rate, VAT on commercial rents, a KES debt market sized on coverage rather than collateral — belongs to the market mastery map and must be re-verified at every transaction date. The method does not generalise because Nairobi is special; it generalises because every market has exactly this kind of map, and every deal has exactly this kind of story to test against it. Run your own version of this walk-through — Nairobi or anywhere else — in the public engine on this site.',
      },
      {
        kind: 'callout',
        title: 'The differential spread',
        text: 'Consensus 800M against an underwritten 566.2M: a spread of roughly 233.8M — 29.2% of the asking price, and the entire reason the file is worth a desk\u2019s time. All figures illustrative pending a data room; the verdict is re-run on evidence alone.',
      },
    ],
    faqs: [
      {
        q: 'Is Nairobi CBD office a good investment in 2026?',
        a: 'Depends entirely on the basis. Emerging-market CBD office can clear near 9–10% cap rates against double-digit debt costs — which means income coverage, not appreciation, decides the return. A fully-let story priced like the desk\u2019s worked example (12.9% gross headline yield, 40% actual occupancy) is a trap at almost any price below the asking; the same tower underwritten at a stabilised case, with the re-leasing programme priced honestly and debt sized to a 1.30× DSCR floor, is a defensible file in the right band.',
      },
      {
        q: 'What cap rate applies to Nairobi CBD office?',
        a: 'The desk\u2019s illustrative band is 8.5–9.5% for CBD office in an emerging market with double-digit debt costs — against KES facilities near 14%. The honest method is to underwrite the band, not a point, and to verify against actual comparable transactions in the submarket before any offer, because transaction-level yield data in the market is thin and primary diligence carries a premium.',
      },
    ],
  },
]
