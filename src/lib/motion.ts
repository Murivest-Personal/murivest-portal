/**
 * The single source of motion truth for the Murivest portal.
 *
 * Global curve: cubic-bezier(0.25, 0.1, 0.25, 1) — weighted and
 * deliberate, never playful. Timing tiers (micro / small / medium /
 * cinematic) mirror the CSS tokens in globals.css; springs drive any
 * directly manipulated element (drawers, panels, toggles, CTAs).
 */
import type { Transition } from 'framer-motion'

/** Institutional easing curve — used everywhere, in seconds for Framer. */
export const EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1]

/** Interactive spring — gentle settle, never a bounce. */
export const SPRING: Transition = { type: 'spring', stiffness: 340, damping: 32, mass: 0.9 }

/** Softer spring for large surfaces (drawers, sheets). */
export const SPRING_SOFT: Transition = { type: 'spring', stiffness: 320, damping: 30, mass: 1 }

/** Timing tiers in seconds (Framer Motion). */
export const TIMING = {
  /** hover, press, focus */
  micro: 0.2,
  /** card lift, dropdown, tooltip */
  small: 0.25,
  /** panel expand, drawer, modal */
  medium: 0.48,
  /** reporting / document-timeline surfaces only */
  cinematic: 0.7,
} as const
