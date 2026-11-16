#!/usr/bin/env node
/**
 * Generate PWA icons from an inline SVG (deep forest green field, ivory M,
 * restrained gold rule — the portal's visual language).
 *   node scripts/generate-icons.mjs
 * Outputs public/icons/icon-192.png, icon-512.png, icon-maskable-512.png,
 * badge-96.png.
 */
import sharp from 'sharp'
import {mkdirSync} from 'node:fs'

const GREEN_DEEP = '#0E2A1C'
const GOLD = '#B8956B'
const IVORY = '#FAF9F6'

const iconSvg = (padding) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${GREEN_DEEP}"/>
  <text x="256" y="300" font-family="Georgia, 'Times New Roman', serif" font-size="230" fill="${IVORY}" text-anchor="middle" dominant-baseline="middle">M</text>
  <rect x="${216 - padding}" y="330" width="${80 + padding * 2}" height="8" fill="${GOLD}"/>
</svg>`

const badgeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <rect width="96" height="96" rx="14" fill="${GREEN_DEEP}"/>
  <path d="M48 24a15 15 0 0 0-15 15v13l-6 8h42l-6-8V39a15 15 0 0 0-15-15z" fill="${IVORY}"/>
  <path d="M41 66a7 7 0 0 0 14 0" fill="none" stroke="${IVORY}" stroke-width="4" stroke-linecap="round"/>
</svg>`

mkdirSync('public/icons', {recursive: true})

await sharp(Buffer.from(iconSvg(0))).resize(192, 192).png().toFile('public/icons/icon-192.png')
await sharp(Buffer.from(iconSvg(0))).resize(512, 512).png().toFile('public/icons/icon-512.png')
// Maskable: keep content inside the safe zone (20% padding).
await sharp(Buffer.from(iconSvg(52))).resize(512, 512).png().toFile('public/icons/icon-maskable-512.png')
await sharp(Buffer.from(badgeSvg)).resize(96, 96).png().toFile('public/icons/badge-96.png')

console.log('icons written to public/icons/')
