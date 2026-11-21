import type {InsightArticle} from './types'

/** Research & data — the Forbes/Harvard/McKinsey/CBRE/Knight Frank/LoopNet evidence base, read the differential way. */
export const research: InsightArticle[] = [
  {
    slug: 'harvard-housing-research-2026',
    title: "Harvard's Housing Research in 2026: What CRE Investors Should Actually Take From It",
    dek:
      'Existing-home sales at three-decade lows, rising inventories, declining rents, record cost burdens. The Joint Center\u2019s 2026 editions are the most sober data in housing — here is what translates to commercial underwriting.',
    category: 'Research & Data',
    tags: ['Harvard JCHS', 'housing market 2026', 'rent trends', 'rental housing demand', 'market research'],
    author: {name: 'Mark Muriithi', role: 'Managing Director · Differential Underwriter'},
    publishedAt: '2026-11-19',
    updatedAt: '2026-11-19',
    sources: [
      {outlet: 'Harvard JCHS', title: "The State of the Nation's Housing 2026", url: 'https://www.jchs.harvard.edu/state-nations-housing-2026'},
      {outlet: 'Harvard JCHS', title: 'Joint Center for Housing Studies', url: 'https://www.jchs.harvard.edu'},
    ],
    blocks: [
      {
        kind: 'p',
        text: 'The Harvard Joint Center for Housing Studies publishes the closest thing housing has to an unweighted audit: no fund to raise, no portfolio to flatter, no narrative to sell. Its 2026 editions carry three findings commercial investors should actually price: sales of existing homes sitting at three-decade lows with inventories rising; rents declining as demand has shifted; and cost burdens for both renters and owners continuing to climb. None of these is a verdict on any specific asset. All of them are context for the assumptions your pro forma is quietly making.',
      },
      {kind: 'h3', text: 'The single-family freeze supports rental demand — to a limit'},
      {
        kind: 'p',
        text: 'When existing-home sales sit at three-decade lows, households that would have bought stay renting for longer. For income residential, that is a structural demand tailwind. But the Joint Center\u2019s rental research shows the other edge of the same blade: record-high cost burdens among renters cap the rent growth the market can actually absorb. A demand tailwind you cannot price is not an underwriting input — it is a reason to stress flat rents and still clear your DSCR floor.',
      },
      {kind: 'h3', text: 'Rents declined. Your escalations should be able to survive that.'},
      {
        kind: 'p',
        text: 'The Center\u2019s America\u2019s Rental Housing 2026 edition records a record number of cost-burdened renters, modest declines in new-lease rents, and vacancy ticking up — supply caught demand. Underwrite accordingly: rent escalation assumptions of 3–5% a year are conventions, not laws. The differential desk runs the stabilized case at flat rents for the first re-leasing cycle, and lets any real escalation be upside rather than oxygen.',
      },
      {kind: 'h3', text: 'The remodeling signal is a capex signal'},
      {
        kind: 'p',
        text: 'Homeowner improvement spending is expected to reach roughly $518 billion by the end of 2026, per the Center\u2019s projections. Owners reinvest in space; builders price accordingly. For commercial buyers the transmission is direct: fit-out contributions, landlord works and re-leasing capex compete for the same trades and the same inflation. Your re-leasing programme cost — fit-out per square foot on the space to be re-let, plus downtime — should be priced at today\u2019s costs, not the broker deck\u2019s vintage.',
      },
      {kind: 'h3', text: 'Context is not a verdict'},
      {
        kind: 'p',
        text: 'The differential method exists because national series never decide a deal. The asset-specific rent roll outranks the national rent index; the submarket vacancy trend outranks the national vacancy rate; the tenant\u2019s own credit outranks the macro credit cycle. Harvard\u2019s data earns a place in the file as the market layer of the mastery map — the context against which the asset\u2019s evidence is tested — and nowhere further.',
      },
      {
        kind: 'callout',
        title: 'The differential read',
        text: 'Take the demand tailwind, stress the escalations at zero, price the capex at today\u2019s invoices — then let the asset\u2019s own rent roll, arrears and estoppels overrule every national number.',
      },
    ],
    faqs: [
      {
        q: 'What does Harvard\u2019s 2026 housing research say?',
        a: 'The Joint Center\u2019s State of the Nation\u2019s Housing 2026 reports existing-home sales at three-decade lows with inventories rising and rents declining, while cost burdens continue climbing for renters and owners alike. The America\u2019s Rental Housing 2026 edition adds a record number of cost-burdened renters, modest new-lease rent declines and rising vacancy.',
      },
      {
        q: 'Is rental demand still strong in 2026?',
        a: 'Yes, structurally — frozen for-sale markets keep households renting longer — but affordability is the binding constraint: record cost burdens cap the rent growth that demand alone can deliver. Underwrite flat rents for the first re-leasing cycle and treat escalation as upside.',
      },
    ],
  },
  {
    slug: 'mckinsey-ai-commercial-real-estate',
    title: "McKinsey Says AI Could Add $110–180 Billion to Real Estate. Here's Where.",
    dek:
      'The estimate is real — and so is the catch in the report\u2019s own title: the industry must change to reap the benefits. Underwriting is where the value pools first, because that is where the data hurts most.',
    category: 'Research & Data',
    tags: ['McKinsey', 'AI in real estate', 'proptech', 'underwriting automation', 'data quality'],
    author: {name: 'Mark Muriithi', role: 'Managing Director · Differential Underwriter'},
    publishedAt: '2026-11-14',
    updatedAt: '2026-11-14',
    sources: [
      {
        outlet: 'McKinsey & Company',
        title: 'Generative AI can change real estate — but the industry must change to reap the benefits',
        url: 'https://www.mckinsey.com/industries/real-estate/our-insights/generative-ai-can-change-real-estate-but-the-industry-must-change-to-reap-the-benefits',
      },
    ],
    blocks: [
      {
        kind: 'p',
        text: 'McKinsey\u2019s estimate, based on work by the McKinsey Global Institute, is that generative AI could generate $110 billion to $180 billion or more in value for real estate. Buried in the title of the analysis is the honest caveat: "but the industry must change to reap the benefits." Anyone who has underwritten from a data room knows exactly what that means. The industry\u2019s raw material — rent rolls as scanned PDFs, T-12s in eighteen-column spreadsheets, leases nobody abstracts — is the obstacle the technology is meant to clear.',
      },
      {kind: 'h3', text: 'Where the value actually pools first'},
      {
        kind: 'p',
        text: 'Not in marketing brochures. The first and largest capture is in the underwriting stack: extracting structured income data from documents, reconciling rent roll against trailing statements, generating the sensitivity grids that used to take analysts days, and summarising what a data room does and does not contain. The firms that win are the ones whose internal data discipline lets the tools see straight — garbage in, hallucinated analysis out.',
      },
      {kind: 'h3', text: 'Computation is cheap now. Evidence is the moat.'},
      {
        kind: 'p',
        text: 'The consequence for competitive underwriting is counterintuitive: the modelling layer stops being an advantage at all. Any desk can run a hundred scenarios by lunchtime — this site\u2019s public engine does the arithmetic in one request. The durable edge migrates to what computation cannot fake: whether the rent roll reconciles, whether the estoppels exist, whether the capex register was actually sighted. Differential Underwriting leans into precisely that: rank hypotheses, then settle them with evidence only a human on site and in the registry can gather.',
      },
      {kind: 'h3', text: 'What the tools still cannot do'},
      {
        kind: 'ul',
        items: [
          'Walk the building — the generator vibration and the roof condition do not appear in any dataset.',
          'Read a title — registry integrity is a jurisdiction-by-jurisdiction human discipline.',
          'Collect an estoppel — a tenant\u2019s confirmation is a legal instrument, not a language task.',
          'Judge the tenant\u2019s business — credit is a story with a P&L, not a probability from a spreadsheet.',
        ],
      },
      {
        kind: 'callout',
        title: 'The differential read',
        text: 'Use the machines for arithmetic and extraction; keep the verdict, the site visit and the registry for humans. The method decides which is which — that is the whole point of having one.',
      },
    ],
    faqs: [
      {
        q: 'How much value could AI add to real estate?',
        a: 'McKinsey, based on McKinsey Global Institute analysis, estimates generative AI could generate $110 billion to $180 billion or more in value for real estate — concentrated in data-heavy functions like underwriting, leasing analysis and asset management, contingent on the industry restructuring its data.',
      },
      {
        q: 'Will AI replace real estate underwriters?',
        a: 'The arithmetic and extraction layers, yes; the verdict layer, no. Modelling is already commoditising, which moves the advantage to evidence gathering — site inspections, title verification, estoppels, tenant credit judgement — and to the written method that decides which questions the models should answer.',
      },
    ],
  },
  {
    slug: 'cbre-2026-commercial-real-estate-outlook',
    title: "CBRE's 2026 Outlook: +16% Investment Volume and the Cap-Rate Road Map",
    dek:
      'CBRE expects U.S. investment volume up 16% in 2026 and most cap rates 5–15bp tighter, with long-term yields near 4%. Useful context — and a lesson in why the band beats the point.',
    category: 'Research & Data',
    tags: ['CBRE', '2026 outlook', 'cap rates', 'investment volume', 'capital markets'],
    author: {name: 'Mark Muriithi', role: 'Managing Director · Differential Underwriter'},
    publishedAt: '2026-11-06',
    updatedAt: '2026-11-06',
    sources: [
      {
        outlet: 'CBRE',
        title: 'U.S. Real Estate Market Outlook 2026 — Capital Markets',
        url: 'https://www.cbre.com/insights/books/us-real-estate-market-outlook-2026/capital-markets',
      },
      {outlet: 'CBRE', title: 'U.S. Cap Rate Survey H1 2026', url: 'https://www.cbre.com/insights/reports/us-cap-rate-survey-h1-2026'},
      {outlet: 'CBRE', title: 'CBRE Insights & Research', url: 'https://www.cbre.com/insights'},
    ],
    blocks: [
      {
        kind: 'p',
        text: 'CBRE\u2019s 2026 U.S. outlook calls the turn the 2025 data already hinted at: commercial real estate investment activity expected to increase 16% in 2026 — roughly $562 billion, near the pre-pandemic 2015–2019 average — with cap rates for most property types expected to tighten by 5 to 15 basis points and long-term yields anchored around 4%. For a deal written this quarter, three implications travel well beyond the American market.',
      },
      {kind: 'h3', text: 'Read the volume headline carefully — it contains two mega-deals'},
      {
        kind: 'p',
        text: 'CBRE\u2019s own insights desk flagged that Q3 2026\u2019s 98% year-over-year jump to $257.8 billion was driven by two entity-level transactions totalling $104 billion. Headline volume can double while the price of an individual asset barely moves. The differential habit: separate entity-level mega-flow from asset-level pricing before deciding what "the market is doing" means for the building in front of you.',
      },
      {kind: 'h3', text: '5–15bp of compression is noise next to your error band'},
      {
        kind: 'p',
        text: 'The cap-rate survey draws on 3,600 estimates across more than 50 U.S. markets, with the 10-year peaking mid-May at 4.67%. Against that, an expected 5–15bp drift is a rounding error beside the honest uncertainty of any single asset — which is why the differential desk underwrites a ±50bp band on the stabilized value and negotiates the band, never a point. Macro forecasts set the weather; the band sets the coat.',
      },
      {kind: 'h3', text: 'A ~4% base rate resets the debt constant math'},
      {
        kind: 'p',
        text: 'With long-term yields near 4%, all-in commercial debt costs in deep markets sit in the mid-single digits — but in frontier markets they remain double digits. The universal translation is the annual debt constant: total annual debt service per unit of loan, at the actual rate and amortisation. It converts any DSCR floor into a maximum supportable loan, and it is the number that vetoes prices long before your own walk-away does. Size from income downward; let the price follow.',
      },
      {
        kind: 'callout',
        title: 'The differential read',
        text: 'Volume tells you competition is returning. Cap-rate drift tells you the weather. Your band, your DSCR floor and your offer ladder tell you what to do about it. Write the latter before reading the former.',
      },
    ],
    faqs: [
      {
        q: 'What is the 2026 commercial real estate outlook?',
        a: 'CBRE expects U.S. investment activity up 16% in 2026 to roughly $562 billion — near the 2015–2019 pre-pandemic average — with cap rates for most property types 5–15bp tighter and long-term yields around 4%. Q3 2026 volume of $257.8 billion was inflated by two entity-level transactions totalling $104 billion.',
      },
      {
        q: 'Are cap rates compressing in 2026?',
        a: 'CBRE\u2019s H1 2026 U.S. Cap Rate Survey — 3,600 estimates across 50+ markets — points to modest compression of 5–15 basis points for most property types, with quality assets expected to compress further. Underwrite a ±50bp band on your own stabilized value rather than a single point estimate.',
      },
    ],
  },
  {
    slug: 'knight-frank-wealth-report-takeaways',
    title: "Knight Frank's Wealth Report: CRE Up 12% and the UHNWI Map",
    dek:
      'The 20th edition records commercial real estate investment up 12% across all major sectors — and quietly documents where the next direct-deal buyers are being minted.',
    category: 'Research & Data',
    tags: ['Knight Frank', 'Wealth Report 2026', 'UHNWI', 'commercial real estate investment', 'private capital'],
    author: {name: 'Mark Muriithi', role: 'Managing Director · Differential Underwriter'},
    publishedAt: '2026-10-28',
    updatedAt: '2026-11-02',
    sources: [
      {outlet: 'Knight Frank', title: 'The Wealth Report 2026', url: 'https://www.knightfrank.com/research/reports/wealthreport'},
      {
        outlet: 'Knight Frank',
        title: 'The Wealth Report 2025 (PDF)',
        url: 'https://apac.knightfrank.com/hubfs/Research%20Reports/Residential/Report%20PDFs/Knight%20Frank_The%20Wealth%20Report%202025.pdf',
      },
    ],
    blocks: [
      {
        kind: 'p',
        text: 'Twenty editions in, Knight Frank\u2019s Wealth Report has become the closest thing the private-capital world has to a census. The 2026 edition records commercial real estate investment up 12% across the last year — growth the firm notes was reflected across all the major sectors — and, more durably, tracks where the buyer pool itself is being manufactured: the United States created 41% of all new UHNWIs in the latest measured period, lifting its share of the global UHNWI population from 33% to 35% between 2021 and 2026.',
      },
      {kind: 'h3', text: 'The 12% is a competition signal'},
      {
        kind: 'p',
        text: 'Rising volume in a recovering market means the thin-bid period is closing. The deals that could be bought at distressed basis with no competition are increasingly being bought at recovering basis with some. For a direct investor the response is not speed — it is selection discipline: the differential spread has to be wider than the competition\u2019s information advantage, or there is no reason for you to be the buyer at all.',
      },
      {kind: 'h3', text: 'Where the new capital is minted'},
      {
        kind: 'p',
        text: 'A UHNWI population growing fastest in the United States — and diversifying across other regions — means demand for institutional-quality direct assets continues to broaden. The 2025 edition\u2019s family-office research had already flagged the vehicle: direct real estate at 22.5% of the typical portfolio, more than four in ten planning to grow it, and entry budgets for commercial deals clustering in the $20–30 million band — the size range where direct mandates actually clear.',
      },
      {kind: 'h3', text: 'The report as a market-map input'},
      {
        kind: 'p',
        text: 'The desk\u2019s use for wealth research is narrow and disciplined: it fills the institutional-capital dimension of the market mastery map — who buys at exit, at what size band, at what hurdle. It never substitutes for the asset\u2019s own evidence. Wealth reports tell you about the buyer pool of 2031; the rent roll tells you about the income of 2027. Underwrite the second, plan the first.',
      },
      {
        kind: 'callout',
        title: 'The differential read',
        text: 'A rising market pays for the seller\u2019s story. Your job is unchanged in every weather: rank the explanations, test the ones that move value, and buy only where the spread survives the crowd\u2019s return.',
      },
    ],
    faqs: [
      {
        q: 'What does Knight Frank\u2019s 2026 Wealth Report say about commercial real estate?',
        a: 'Commercial real estate investment grew 12% year-on-year, reflected across all major sectors. The report — its 20th edition — also tracks the United States creating 41% of new UHNWIs, lifting the U.S. share of the global UHNWI population from 33% to 35% between 2021 and 2026.',
      },
      {
        q: 'How much are family offices allocating to direct real estate?',
        a: 'Knight Frank\u2019s 2025 edition measured direct real estate at 22.5% of the typical family office portfolio, with more than four in ten intending to grow the allocation, and commercial entry budgets typically budgeted in the $20–30 million range.',
      },
    ],
  },
  {
    slug: 'loopnet-vs-institutional-sourcing',
    title: 'LoopNet vs Institutional Deal Sourcing: What UHNW Capital Misses on Marketplaces',
    dek:
      'Thirteen million visitors a month and $205 billion of deals in 2025 — LoopNet is the largest CRE marketplace on earth. Here is what it does brilliantly, what it structurally cannot show you, and how serious capital uses it without being used by it.',
    category: 'Research & Data',
    tags: ['LoopNet', 'CoStar', 'commercial real estate listings', 'off-market', 'deal sourcing', 'UHNWI'],
    author: {name: 'Mark Muriithi', role: 'Managing Director · Differential Underwriter'},
    publishedAt: '2026-11-20',
    updatedAt: '2026-11-20',
    featured: true,
    sources: [
      {outlet: 'LoopNet', title: 'CoStar Data Advantage — LoopNet', url: 'https://www.loopnet.com/solutions/costar-data-advantage'},
      {outlet: 'CoStar Group', title: 'LoopNet — brand page', url: 'https://www.costargroup.com/about-us/brands/loopnet'},
    ],
    blocks: [
      {
        kind: 'p',
        text: 'Respect the numbers before criticising them. LoopNet — owned by CoStar Group — carries about 13 million monthly unique visitors, six times the traffic of its closest competitor, and was responsible for $205 billion in deals during 2025. Listings on it lease or sell 14% faster on average than comparable assets off it. For an owner moving ordinary space at market price, it is genuinely excellent infrastructure. The question this article answers is narrower: for capital deploying eight-to-nine figures into income assets, what does a marketplace structurally show you, and what does it structurally hide?',
      },
      {kind: 'h3', text: 'What a listing is, by definition'},
      {
        kind: 'p',
        text: 'A listing is a seller\u2019s story with a price attached. It is assembled by the party with the strongest incentive to present the asset at its most optimistic defensible: headline yield from gross income, occupancy at its best month, capex deferred below a visible line, and the photographs of the one renovated lobby. This is not dishonesty — it is the job description of marketing. But it means the one thing you most need, the reconciliation of the asking price to the asset\u2019s own evidence, is precisely the thing the format cannot contain.',
      },
      {kind: 'h3', text: 'The marketplace premium'},
      {
        kind: 'p',
        text: 'Efficient markets price efficiently: an asset marketed to 13 million monthly visitors is marketed to every competitor you have. What you gain in speed — and 14% faster is a real, measured gain — you pay for in basis: fully-exposed assets clear at the consensus price, because the consensus is literally the mechanism. The differential investor\u2019s return comes from the spread between consensus and underwritten reality; a marketplace is where that spread is smallest by construction. Off-market flow, auction-sourced assets and criteria-matched briefs exist because that is where the spread still lives.',
      },
      {kind: 'h3', text: 'Marketplace versus mandate desk'},
      {
        kind: 'table',
        head: ['Dimension', 'LoopNet marketplace', 'Murivest mandate desk'],
        rows: [
          ['What you see', 'The seller\u2019s story: headline figures, best-month occupancy, photography', 'The asset\u2019s evidence: rent roll, T-12, estoppels, title, capex register'],
          ['Underwriting', 'None attached — analysis is your problem after the call', 'Differential Underwriting attached to every brief before capital moves'],
          ['Access', 'Open to anyone with a browser', 'Verification-gated: KYC/AML, classification, NDA, graduated tiers'],
          ['Price formation', 'Consensus — every rival sees the same listing', 'Offer ladder anchored in bps of defensible stabilized yield'],
          ['Best used for', 'Market scanning, rent evidence, comparable inventory', 'Acquisition verdicts, off-market access, mandate execution'],
        ],
      },
      {kind: 'h3', text: 'Use both — for different jobs'},
      {
        kind: 'p',
        text: 'The serious play is not boycotting the marketplace; it is refusing to confuse scanning with underwriting. LoopNet is a magnificent research instrument: rent evidence, inventory cycles, submarket absorption, the speed at which comparable space clears. The desk\u2019s own market maps are partly built on exactly this public evidence. But when the same platform becomes your acquisition channel, you are buying the crowd\u2019s price with the crowd\u2019s information — and hoping the rent roll nobody reconciled turns out fine. It usually does not.',
      },
      {
        kind: 'callout',
        title: 'The differential read',
        text: 'Marketplaces optimise for the seller\u2019s speed at the consensus price. Mandates optimise for the buyer\u2019s basis at the underwritten price. Know which job you are doing today, and use the right machine for it.',
      },
    ],
    faqs: [
      {
        q: 'Is LoopNet good for commercial real estate investors?',
        a: 'As a research and market-scanning instrument, yes — roughly 13 million monthly visitors, $205 billion of deals in 2025, and listings that lease or sell 14% faster on average. As an acquisition channel for large direct capital, its open format shows the seller\u2019s story at the consensus price, with no attached underwriting — the spread serious buyers hunt is smallest precisely there.',
      },
      {
        q: 'What is the alternative to LoopNet for serious investors?',
        a: 'Verification-gated institutional sourcing: off-market and auction-sourced flow, criteria-matched briefs with underwriting attached, and mandate-based execution with data-room evidence — rent roll reconciliations, estoppels, title and capex registers rather than listing pages.',
      },
      {
        q: 'How big is LoopNet?',
        a: 'About 13 million monthly global unique visitors — six times its closest competitor — responsible for approximately $205 billion in deals during 2025, per CoStar Group and LoopNet\u2019s own platform data.',
      },
    ],
  },
  {
    slug: 'forbes-billionaires-real-estate-lessons',
    title: "Forbes' Billionaires List Is a Real Estate Syllabus: Five Transferable Lessons",
    dek:
      'A record $20.1 trillion across 400 more billionaires than last year — and the property chapter keeps compounding. Read as a curriculum rather than a ranking, the list teaches five things any direct investor can apply.',
    category: 'Research & Data',
    tags: ['Forbes billionaires', 'real estate wealth', 'billionaire lessons', 'wealth building', 'commercial property'],
    author: {name: 'Mark Muriithi', role: 'Managing Director · Differential Underwriter'},
    publishedAt: '2026-11-17',
    updatedAt: '2026-11-17',
    sources: [
      {outlet: 'Forbes', title: "The World's Billionaires List", url: 'https://www.forbes.com/billionaires'},
      {outlet: 'Forbes', title: 'Donald Bren — profile', url: 'https://www.forbes.com/profile/donald-bren'},
      {
        outlet: 'Forbes',
        title: 'The definitive net worth of Donald Trump',
        url: 'https://www.forbes.com/sites/danalexander/article/the-definitive-networth-of-donaldtrump',
      },
    ],
    blocks: [
      {
        kind: 'p',
        text: 'Forbes\u2019 2026 billionaires list counts 400 more members than 2025 — worth a record $20.1 trillion, up $4 trillion in a year. Read vertically rather than horizontally, the property chapter of that list is a curriculum: five recurring patterns that survive, and one lesson about what Forbes\u2019 own accountants can and cannot see.',
      },
      {kind: 'h3', text: 'Lesson 1 — Income compounds, trophies oscillate'},
      {
        kind: 'p',
        text: 'The top of the property chapter is not the loudest name in it. Donald Bren — $19.8 billion by Forbes\u2019 real-time tracker, on roughly 129 million square feet of Irvine Company income space — never needed a television network. Compare the volatility of a brand-led, trophy-heavy portfolio against a rent roll quietly compounding for fifty years, and the pattern is unambiguous: the income compounds, the story oscillates.',
      },
      {kind: 'h3', text: 'Lesson 2 — The big fortunes were built in downcycles'},
      {
        kind: 'p',
        text: 'Zell\u2019s $3 billion scavenging run after 1973, the distressed basis of every era\u2019s property chapters — the list\u2019s property fortunes cluster around acquisitions made when capital was absent. The recovery headlines you read today were written by buyers nobody was competing with five years earlier.',
      },
      {kind: 'h3', text: 'Lesson 3 — Debt is a tool that prices your discipline'},
      {
        kind: 'p',
        text: 'The same list contains both the greatest leverage successes and the greatest deleveraging fires. The difference was never conviction — everyone has conviction. It was whether debt was sized to the income\u2019s own coverage (a DSCR floor, a debt constant, a maximum supportable loan) or to the ambition of the moment.',
      },
      {kind: 'h3', text: 'Lesson 4 — One map, mastered, beats ten markets, visited'},
      {
        kind: 'p',
        text: 'Bren\u2019s Irvine. Zell\u2019s categories. The pattern repeats because it works: concentration of knowledge, diversification only where the knowledge travels. Underwriting is a local sport — the mastery map (tenure, zoning, tax, debt market, buyer pool) is built market by market, and it is the asset the other investors cannot buy.',
      },
      {kind: 'h3', text: 'Lesson 5 — Read the footnotes: the wealth that is visible is not the whole story'},
      {
        kind: 'p',
        text: 'Forbes\u2019 definitive accounting is the honest version of a famously contestable number — its September 2026 estimate places Trump\u2019s directly-held real estate at about $1.1 billion inside a broader valuation. Every fortune on the list carries a band, an assumption set and an auditor\u2019s caveat. So does every pro forma you will ever write. The lesson is to treat every number — net worth, asking price, year-one yield — as a claim with a methodology behind it, and to read the methodology.',
      },
      {
        kind: 'callout',
        title: 'The differential read',
        text: 'Five lessons, one sentence: buy income at a controlled basis, finance it within the income\u2019s coverage, know one map deeply, buy in the downcycle — and read the footnotes before you believe the number.',
      },
    ],
    faqs: [
      {
        q: 'How many billionaires are there in 2026?',
        a: 'Forbes\u2019 2026 list counts 400 more billionaires than 2025 — a record cohort worth a combined $20.1 trillion, up $4 trillion year-on-year. Real estate remains one of the densest chapters of the list.',
      },
      {
        q: 'Who is the richest real estate billionaire?',
        a: 'Donald Bren — chairman and owner of the Irvine Company — at $19.8 billion by Forbes\u2019 real-time tracker as of late November 2026, on roughly 129 million square feet of income-producing space.',
      },
    ],
  },
]
