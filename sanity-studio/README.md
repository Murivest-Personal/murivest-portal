# Murivest Capital Portal — Sanity Studio

This studio is the content source for the portal. **All properties (opportunities), orderable investment briefs, data-room documents and market intelligence are uploaded here** — the Next.js portal ships with no sample content and renders purposeful empty states until content is published.

## Setup

```bash
cd sanity-studio
cp .env.example .env          # set SANITY_STUDIO_PROJECT_ID
npm install
npm run dev                   # http://localhost:3333
```

Create the project at [sanity.io/manage](https://www.sanity.io/manage) if you don't have one yet. Use a **private dataset** (`production`) — every document carries an access tier and the portal reads with a server-side token.

## Deploy the studio for Murivest staff

```bash
npm run deploy                # hosts the studio on *.sanity.studio
```

## Connect the portal

In the Next.js app root `.env`:

```
SANITY_PROJECT_ID=your-project-id
SANITY_DATASET=production
SANITY_API_READ_TOKEN=<read token from sanity.io/manage>
```

The portal fetches content server-side only (GROQ, `@sanity/client`). The read token never reaches the browser.

## Content types

| Type | Purpose | Gating |
| --- | --- | --- |
| `opportunity` | Commercial real estate / alternative opportunities shown in **Discover** | `accessTier` controls listing visibility; financial fields, lease profile, rationale & risks are Tier 2+ |
| `brief` | Orderable private / institutional briefs in **Orders** | `accessTier` controls who may order; prices per format (digital / hard copy) |
| `document` | Secure data-room files in **Documents** | `accessTier` + optional per-investor/per-organisation grants; streamed through the portal's audited route — asset URLs are never exposed |
| `marketReport` | **Market Intelligence** research & commentary | `accessTier` |
| `landingContent` | Singleton controlling landing page hero copy | Public |

## Rules of the house

1. **Never estimate financial fields.** Leave a field empty rather than publishing an invented number — the portal renders "not disclosed" instead.
2. Publish with the `published` flag — drafts are invisible to the portal.
3. Opportunity documents should be referenced from the opportunity (`documents` field) **and** published as `document` type so the data room can enforce its own tier gating.
