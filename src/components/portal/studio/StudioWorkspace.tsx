'use client'

import {useState} from 'react'
import {cn} from '@/lib/utils'
import type {CriteriaInput, ScenarioInputs} from '@/lib/validation'
import CriteriaPanel from './CriteriaPanel'
import ScenarioBuilder, {NEUTRAL_INPUTS} from './ScenarioBuilder'
import SavedScenarios, {type SavedScenarioRow} from './SavedScenarios'

type Tab = 'model' | 'criteria' | 'saved'

export default function StudioWorkspace({
  initialCriteria,
  savedScenarios,
  initialTab,
  prefill,
  prefillSource,
  equityDefault,
}: {
  initialCriteria: CriteriaInput | null
  savedScenarios: SavedScenarioRow[]
  initialTab?: Tab
  prefill?: Partial<ScenarioInputs> | null
  prefillSource?: {sanityId: string; title: string} | null
  equityDefault?: number | null
}) {
  const [tab, setTab] = useState<Tab>(initialTab || 'model')

  return (
    <div>
      <div className="mb-6 grid grid-cols-3 border border-border bg-card text-center text-[11px] uppercase tracking-[0.14em]">
        {(
          [
            ['model', 'Model & scenarios'],
            ['criteria', 'Investment criteria'],
            ['saved', 'Saved analyses'],
          ] as const
        ).map(([key, lbl]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn('px-2 py-3 transition-colors', tab === key ? 'bg-gold/10 font-semibold text-primary' : 'text-muted-foreground hover:text-primary')}
          >
            {lbl}
            {key === 'saved' && savedScenarios.length > 0 ? <span className="ml-1.5 text-gold">({savedScenarios.length})</span> : null}
          </button>
        ))}
      </div>

      {tab === 'model' ? (
        <ScenarioBuilder prefill={prefill ?? undefined} prefillSource={prefillSource} equityDefault={equityDefault} />
      ) : null}
      {tab === 'criteria' ? <CriteriaPanel initial={initialCriteria} /> : null}
      {tab === 'saved' ? <SavedScenarios initial={savedScenarios} /> : null}
    </div>
  )
}

export {NEUTRAL_INPUTS}
