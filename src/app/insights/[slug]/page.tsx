import type {Metadata} from 'next'
import Link from 'next/link'
import {notFound} from 'next/navigation'
import {ArrowLeft, ArrowRight, ArrowUpRight} from 'lucide-react'
import {
  ARTICLES,
  AUTHOR,
  articleBySlug,
  articleNeighbours,
  readMinutes,
} from '@/components/content/insights'
import type {InsightBlock} from '@/components/content/insights'
import {COMPANY} from '@/lib/constants'
import {fmtDate} from '@/lib/format'
import LandingHeader from '@/components/marketing/LandingHeader'
import {AuthModalProvider} from '@/components/marketing/AuthModalProvider'

export function generateStaticParams() {
  return ARTICLES.map((a) => ({slug: a.slug}))
}

export async function generateMetadata({params}: {params: Promise<{slug: string}>}): Promise<Metadata> {
  const {slug} = await params
  const article = articleBySlug(slug)
  if (!article) return {title: 'Insights'}
  return {
    title: article.title,
    description: article.dek,
    keywords: article.tags,
    alternates: {canonical: `/insights/${article.slug}`},
    openGraph: {
      title: article.title,
      description: article.dek,
      type: 'article',
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      authors: [AUTHOR.name],
      section: article.category,
      tags: article.tags,
    },
    robots: {index: true, follow: true},
  }
}

function Block({block}: {block: InsightBlock}) {
  switch (block.kind) {
    case 'h3':
      return (
        <h3 className="mt-12 font-display text-2xl leading-snug text-primary">{block.text}</h3>
      )
    case 'p':
      return <p className="mt-5 text-[15px] leading-7 text-foreground/85">{block.text}</p>
    case 'ul':
      return (
        <ul className="mt-5 grid gap-3">
          {block.items.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-[15px] leading-7 text-foreground/85">
              <span className="mt-3 h-1 w-1 flex-shrink-0 rounded-full bg-gold" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      )
    case 'ol':
      return (
        <ol className="mt-5 grid list-none gap-3">
          {block.items.map((item, i) => (
            <li key={item} className="flex items-start gap-3 text-[15px] leading-7 text-foreground/85">
              <span className="tabular mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[3px] border border-gold/40 text-[10px] font-semibold text-gold">
                {i + 1}
              </span>
              {item}
            </li>
          ))}
        </ol>
      )
    case 'quote':
      return (
        <blockquote className="mt-10 border-l-2 border-gold pl-6">
          <p className="font-display text-lg italic leading-relaxed text-primary">{block.text}</p>
          {block.cite ? <cite className="mt-2 block text-[11px] not-italic uppercase tracking-[0.14em] text-muted-foreground">{block.cite}</cite> : null}
        </blockquote>
      )
    case 'callout':
      return (
        <aside className="mt-10 rounded-[16px] border border-gold/40 bg-gold/5 p-6 sm:p-7">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">{block.title}</div>
          <p className="mt-3 text-[15px] leading-7 text-foreground/85">{block.text}</p>
        </aside>
      )
    case 'table':
      return (
        <figure className="mt-8">
          <div className="overflow-x-auto rounded-[16px] border border-border bg-card shadow-[var(--shadow-card)]">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {block.head.map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="tabular align-top">
                {block.rows.map((row, i) => (
                  <tr key={i} className={i < block.rows.length - 1 ? 'border-b border-border/60' : ''}>
                    {row.map((cell, j) => (
                      <td key={j} className={`px-4 py-3.5 leading-6 ${j === 0 ? 'font-medium text-primary' : 'text-foreground/80'}`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {block.caption ? <figcaption className="mt-2 text-[10px] text-muted-foreground">{block.caption}</figcaption> : null}
        </figure>
      )
  }
}

export default async function InsightArticlePage({params}: {params: Promise<{slug: string}>}) {
  const {slug} = await params
  const article = articleBySlug(slug)
  if (!article) notFound()

  const {prev, next} = articleNeighbours(article.slug)
  const minutes = readMinutes(article)

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.dek,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    inLanguage: 'en',
    author: {
      '@type': 'Person',
      name: AUTHOR.name,
      jobTitle: AUTHOR.role,
      worksFor: {'@type': 'Organization', name: COMPANY.legalName, url: COMPANY.siteUrl},
    },
    publisher: {
      '@type': 'Organization',
      name: COMPANY.legalName,
      url: COMPANY.siteUrl,
      description: COMPANY.description,
    },
    articleSection: article.category,
    keywords: article.tags.join(', '),
    mainEntityOfPage: {'@type': 'WebPage', '@id': `${COMPANY.siteUrl.replace(/\/$/, '')}/insights/${article.slug}`},
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {'@type': 'ListItem', position: 1, name: 'Insights', item: `${COMPANY.siteUrl.replace(/\/$/, '')}/insights`},
      {'@type': 'ListItem', position: 2, name: article.category, item: `${COMPANY.siteUrl.replace(/\/$/, '')}/insights`},
      {'@type': 'ListItem', position: 3, name: article.title},
    ],
  }

  const faqJsonLd = article.faqs
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: article.faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: {'@type': 'Answer', text: f.a},
        })),
      }
    : null

  return (
    <AuthModalProvider>
      {faqJsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(faqJsonLd)}} /> : null}
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(articleJsonLd)}} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(breadcrumbJsonLd)}} />

      <div className="flex min-h-screen flex-col bg-background">
        <LandingHeader isAuthenticated={false} />

        <main className="flex-1">
          {/* ============== ARTICLE HEADER ============== */}
          <section className="bg-forest-deep text-ivory">
            <div className="mx-auto max-w-3xl px-6 py-14 lg:py-20">
              <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-ivory/50">
                <Link href="/insights" className="transition-colors hover:text-gold">Insights</Link>
                <span aria-hidden="true">/</span>
                <span>{article.category}</span>
              </nav>
              <span className="inline-block rounded-[3px] border border-gold/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold">
                {article.category}
              </span>
              <h1 className="mt-5 font-display text-3xl leading-[1.15] sm:text-4xl">{article.title}</h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-ivory/70">{article.dek}</p>
              <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] uppercase tracking-[0.14em] text-ivory/45">
                <span>{AUTHOR.name} · {AUTHOR.role}</span>
                <span aria-hidden="true">·</span>
                <span>{fmtDate(article.publishedAt)}</span>
                <span aria-hidden="true">·</span>
                <span>{minutes} min read</span>
              </div>
            </div>
          </section>

          {/* ============== BODY ============== */}
          <article className="mx-auto max-w-3xl px-6 py-12 lg:py-16">
            {article.blocks.map((block, i) => (
              <Block key={i} block={block} />
            ))}

            {/* Author card */}
            <div className="mt-14 rounded-[16px] border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-display text-lg text-primary">{AUTHOR.name}</div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{AUTHOR.role}</div>
              </div>
              <div className="gold-rule mt-3 w-12" aria-hidden="true" />
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{AUTHOR.bio}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/differential-underwriting"
                  className="inline-flex items-center gap-2 border border-gold/40 bg-gold/10 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary transition-colors hover:border-gold hover:text-gold"
                >
                  The method <ArrowUpRight className="h-3.5 w-3.5 text-gold" />
                </Link>
                <Link
                  href="/underwriting-calculator"
                  className="inline-flex items-center gap-2 border border-border px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary transition-colors hover:border-gold hover:text-gold"
                >
                  Run your own underwrite
                </Link>
              </div>
            </div>

            {/* Sources */}
            {article.sources.length > 0 ? (
              <section className="mt-10">
                <div className="eyebrow">Sources & further reading</div>
                <ul className="mt-4 grid gap-3">
                  {article.sources.map((s) => (
                    <li key={s.url} className="text-sm">
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="group flex items-start gap-2 text-muted-foreground transition-colors hover:text-primary"
                      >
                        <ArrowUpRight className="mt-1 h-3.5 w-3.5 flex-shrink-0 text-gold" aria-hidden="true" />
                        <span>
                          <span className="font-medium text-primary group-hover:text-gold">{s.outlet}</span>
                          <span className="mx-1.5 text-muted-foreground/50" aria-hidden="true">—</span>
                          {s.title}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground/70">
                  Figures and dates are as reported by the cited sources at publication. Where this desk adds its own
                  assumptions, the text flags them as illustrative and subject to verification at the transaction date.
                </p>
              </section>
            ) : null}

            {/* FAQs */}
            {article.faqs?.length ? (
              <section className="mt-12">
                <div className="eyebrow">Questions this article answers</div>
                <div className="mt-4 divide-y divide-border border border-border bg-card">
                  {article.faqs.map((f) => (
                    <details key={f.q} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-sm font-semibold text-primary">
                        {f.q}
                        <span className="mt-1 h-px w-6 flex-shrink-0 bg-gold transition-transform group-open:rotate-45" aria-hidden="true" />
                      </summary>
                      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                    </details>
                  ))}
                </div>
              </section>
            ) : null}

            {/* CTA band */}
            <section className="mt-14 border border-gold/40 bg-gold/5 p-8 text-center sm:p-10">
              <div className="eyebrow mb-3">The desk behind the method</div>
              <h2 className="font-display text-2xl text-primary">Test it on your own property.</h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Enter your asset&rsquo;s location, income, lease, owner and building specifics in the public engine — then
                request private access for the mandate-grade version: the data room, the rule-outs and the verdict.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  href="/underwriting-calculator"
                  className="press-scale inline-flex items-center gap-2 rounded-[9999px] bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground transition-colors hover:bg-forest-deep"
                >
                  Run the underwriting engine <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/billionaire-real-estate"
                  className="press-scale inline-flex items-center gap-2 rounded-[9999px] border border-border px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary transition-colors hover:border-gold hover:text-gold"
                >
                  The UHNW desk
                </Link>
              </div>
            </section>

            {/* Prev / next */}
            <nav aria-label="More insights" className="mt-12 grid gap-4 border-t border-border pt-8 sm:grid-cols-2">
              {prev ? (
                <Link href={`/insights/${prev.slug}`} className="group rounded-[16px] border border-border bg-card p-5 transition-colors hover:border-gold/50">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    <ArrowLeft className="h-3 w-3" /> Previous
                  </div>
                  <div className="mt-2 text-sm font-semibold leading-snug text-primary group-hover:text-gold">{prev.title}</div>
                </Link>
              ) : (
                <span />
              )}
              {next ? (
                <Link href={`/insights/${next.slug}`} className="group rounded-[16px] border border-border bg-card p-5 text-right transition-colors hover:border-gold/50 sm:col-start-2">
                  <div className="flex items-center justify-end gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    Next <ArrowRight className="h-3 w-3" />
                  </div>
                  <div className="mt-2 text-sm font-semibold leading-snug text-primary group-hover:text-gold">{next.title}</div>
                </Link>
              ) : null}
            </nav>
          </article>
        </main>

        {/* ============== FOOTER ============== */}
        <footer className="mt-auto border-t border-border bg-forest-deep py-8 text-ivory">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 text-[10px] uppercase tracking-[0.18em] text-ivory/40 sm:flex-row sm:items-center sm:justify-between lg:px-10">
            <span>© {new Date().getFullYear()} {COMPANY.legalName} · Differential Underwriting · Mandate-only</span>
            <span className="flex items-center gap-4">
              <Link href="/differential-underwriting" className="transition-colors hover:text-gold">Method</Link>
              <Link href="/underwriting-calculator" className="transition-colors hover:text-gold">Calculator</Link>
              <Link href="/insights" className="transition-colors hover:text-gold">Insights</Link>
            </span>
          </div>
        </footer>
      </div>
    </AuthModalProvider>
  )
}
