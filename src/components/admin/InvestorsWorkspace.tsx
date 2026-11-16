'use client'

import {useCallback, useEffect, useMemo, useState} from 'react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {Download, Loader2, Search} from 'lucide-react'
import {fmtMoney, fmtNumber, relativeTime} from '@/lib/format'
import {adminData} from './client'
import {inputClass} from './client'
import {SectionCard, StatusPill, DataTable, EmptyState} from './ui'

export interface InvestorRow {
  userId: string
  email: string
  fullName: string | null
  status: string
  classification: string
  verificationStatus: string
  kycStatus: string
  amlStatus: string
  accessTier: string
  ndaAccepted: boolean
  source: string | null
  countryResidence: string | null
  organisationName: string | null
  totalCapacity: number | null
  capitalCurrency: string
  createdAt: string
  lastLoginAt: string | null
  orderCount: number
  revenueUsd: number
  activeMandates: number
}

const CLASSIFICATIONS = [
  {value: '', label: 'All types'},
  {value: 'uhnwi', label: 'UHNWI'},
  {value: 'institutional_rep', label: 'Institutional'},
  {value: 'individual', label: 'Private individual'},
]
const VERIFICATIONS = [
  {value: '', label: 'All statuses'},
  {value: 'unverified', label: 'Unverified'},
  {value: 'email_verified', label: 'Email verified'},
  {value: 'profile_submitted', label: 'Profile submitted'},
  {value: 'kyc_pending', label: 'KYC pending'},
  {value: 'in_review', label: 'In review'},
  {value: 'verified', label: 'Verified'},
  {value: 'rejected', label: 'Rejected'},
]

export default function InvestorsWorkspace({initial, canExport}: {initial: InvestorRow[]; canExport: boolean}) {
  const router = useRouter()
  const [rows, setRows] = useState<InvestorRow[]>(initial)
  const [q, setQ] = useState('')
  const [classification, setClassification] = useState('')
  const [verification, setVerification] = useState('')
  const [dormant, setDormant] = useState(false)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await adminData<{investors: InvestorRow[]}>('investors', {
      ...(q ? {q} : {}),
      ...(classification ? {classification} : {}),
      ...(verification ? {verification} : {}),
      ...(dormant ? {dormant: '1'} : {}),
    })
    if (res.ok && res.data) setRows(res.data.investors)
    setLoading(false)
  }, [q, classification, verification, dormant])

  useEffect(() => {
    const t = setTimeout(() => void load(), 250)
    return () => clearTimeout(t)
  }, [load])

  const summary = useMemo(() => {
    const verified = rows.filter((r) => r.verificationStatus === 'verified').length
    const uhnwi = rows.filter((r) => r.classification === 'uhnwi').length
    const inst = rows.filter((r) => r.classification === 'institutional_rep').length
    const revenue = rows.reduce((a, r) => a + r.revenueUsd, 0)
    return {verified, uhnwi, inst, revenue}
  }, [rows])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryTile label="Investors listed" value={fmtNumber(rows.length)} />
        <SummaryTile label="Verified" value={fmtNumber(summary.verified)} />
        <SummaryTile label="UHNWI / Institutional" value={`${fmtNumber(summary.uhnwi)} / ${fmtNumber(summary.inst)}`} />
        <SummaryTile label="Recognised revenue" value={fmtMoney(summary.revenue)} />
      </div>

      <SectionCard
        title="Investor register"
        description="Complete profiles, verification standing, capacity and relationship owners"
        actions={
          <>
            {loading ? <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">refreshing…</span> : null}
            {canExport ? (
              <a href="/api/admin/export?dataset=investors" className="inline-flex items-center gap-1.5 border border-border px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-primary hover:border-gold hover:text-gold">
                <Download className="h-3 w-3" /> CSV
              </a>
            ) : null}
          </>
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input className={`${inputClass} pl-9`} placeholder="Search name, email, country…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search investors" />
          </div>
          <select className={inputClass} value={classification} onChange={(e) => setClassification(e.target.value)} aria-label="Filter by type">
            {CLASSIFICATIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <select className={inputClass} value={verification} onChange={(e) => setVerification(e.target.value)} aria-label="Filter by verification">
            {VERIFICATIONS.map((v) => (
              <option key={v.value} value={v.value}>{v.label}</option>
            ))}
          </select>
          <label className="inline-flex cursor-pointer items-center gap-2 border border-border px-3 py-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={dormant} onChange={(e) => setDormant(e.target.checked)} className="accent-forest" />
            Dormant only (60+ days)
          </label>
        </div>

        {rows.length === 0 ? (
          <EmptyState title="No investors match" description="Adjust the filters, or share the portal to begin onboarding UHNWI and institutional investors." />
        ) : (
          <DataTable head={['Investor', 'Verification', 'Tier / NDA', 'Capacity', 'Engagement', 'Registered']}>
            {rows.map((r) => (
              <tr key={r.userId} className="group hover:bg-accent/30">
                <td className="pl-0 pr-3 align-top">
                  <Link href={`/admin/investors/${r.userId}`} className="font-medium text-primary group-hover:text-gold">
                    {r.fullName || r.email}
                  </Link>
                  <div className="text-[10px] text-muted-foreground">{r.email}</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <StatusPill status={r.classification === 'uhnwi' ? 'verified' : r.classification === 'institutional_rep' ? 'in_review' : 'individual'} label={r.classification === 'institutional_rep' ? 'Institutional' : r.classification === 'uhnwi' ? 'UHNWI' : 'Individual'} />
                    {r.status !== 'active' ? <StatusPill status={r.status} /> : null}
                  </div>
                </td>
                <td className="px-3 align-top">
                  <StatusPill status={r.verificationStatus} />
                  <div className="mt-1 text-[10px] text-muted-foreground">KYC {r.kycStatus.replace('_', ' ')} · AML {r.amlStatus.replace('_', ' ')}</div>
                </td>
                <td className="px-3 align-top">
                  <span className="text-xs text-primary">{r.accessTier.replace('_', ' ')}</span>
                  <div className="text-[10px] text-muted-foreground">{r.ndaAccepted ? 'NDA accepted' : 'NDA pending'}</div>
                </td>
                <td className="px-3 align-top text-xs tabular-nums">
                  {r.totalCapacity != null ? fmtMoney(r.totalCapacity, r.capitalCurrency, {compact: true}) : <span className="text-muted-foreground">—</span>}
                  {r.organisationName ? <div className="text-[10px] text-muted-foreground">{r.organisationName}</div> : null}
                </td>
                <td className="px-3 align-top text-xs">
                  <span className="tabular-nums">{fmtNumber(r.orderCount)} orders</span>
                  <div className="text-[10px] text-muted-foreground">
                    {fmtNumber(r.activeMandates)} mandates · {r.revenueUsd > 0 ? fmtMoney(r.revenueUsd, 'USD', {compact: true}) : '—'} revenue
                  </div>
                </td>
                <td className="px-3 align-top text-xs text-muted-foreground">
                  {relativeTime(r.createdAt)}
                  <div className="text-[10px]">login {r.lastLoginAt ? relativeTime(r.lastLoginAt) : 'never'}</div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </SectionCard>
    </div>
  )
}

function SummaryTile({label, value}: {label: string; value: string}) {
  return (
    <div className="rounded-card border border-border bg-card shadow-card p-4">
      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-xl text-primary tabular-nums">{value}</div>
    </div>
  )
}
