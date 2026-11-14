import {cn} from '@/lib/utils'
import type {PortableTextBlock} from '@/lib/sanity/types'

/**
 * Minimal Portable Text renderer for Sanity-authored long-form content
 * (investment rationale, market intelligence bodies). Handles the block
 * styles the Murivest studio schemas produce; anything else renders as
 * plain paragraph text.
 */

type Mark = {type: string} | string

export default function PortableBlocks({blocks, className}: {blocks: unknown[] | null | undefined; className?: string}) {
  if (!Array.isArray(blocks) || blocks.length === 0) return null
  return (
    <div className={cn('space-y-4 text-sm leading-relaxed text-muted-foreground', className)}>
      {blocks.map((raw, i) => {
        const block = raw as {_key?: string; _type?: string; style?: string; children?: {_key?: string; text?: string; marks?: Mark[]}[]; listItem?: string; level?: number}
        if (!block || block._type !== 'block' || !block.children) return null
        const text = block.children.map((c) => c.text || '').join('')
        if (!text.trim()) return null

        if (block.listItem === 'bullet') {
          return (
            <ul key={block._key || i} className="ml-1 space-y-1.5">
              <li className="flex items-start gap-2.5">
                <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rotate-45 bg-gold" aria-hidden="true" />
                <span className="text-sm leading-relaxed text-muted-foreground">{text}</span>
              </li>
            </ul>
          )
        }

        switch (block.style) {
          case 'h1':
          case 'h2':
            return (
              <h3 key={block._key || i} className="pt-2 font-display text-xl text-primary">
                {text}
              </h3>
            )
          case 'h3':
          case 'h4':
            return (
              <h4 key={block._key || i} className="pt-1 font-display text-lg text-primary">
                {text}
              </h4>
            )
          case 'blockquote':
            return (
              <blockquote key={block._key || i} className="border-l-2 border-gold/60 pl-4 font-display text-lg italic text-primary">
                {text}
              </blockquote>
            )
          default:
            return (
              <p key={block._key || i} className="text-sm leading-relaxed text-muted-foreground">
                {text}
              </p>
            )
        }
      })}
    </div>
  )
}
