import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemas'

/**
 * Murivest Private Capital Portal — content studio.
 *
 *  1. cp .env.example .env  → set SANITY_PROJECT_ID (create at sanity.io/manage)
 *  2. npm install && npm run dev      → author content locally
 *  3. npm run deploy                  → host this studio for Murivest staff
 *
 * All properties, briefs, data-room documents and market intelligence served
 * by the portal are uploaded here — the portal ships with zero sample
 * content and renders purposeful empty states until documents are published.
 */
export default defineConfig({
  name: 'murivest-portal',
  title: 'Murivest Capital Portal',

  projectId: process.env.SANITY_STUDIO_PROJECT_ID || process.env.SANITY_PROJECT_ID || 'your-project-id',
  dataset: process.env.SANITY_STUDIO_DATASET || 'production',

  plugins: [structureTool(), visionTool()],

  schema: {
    types: schemaTypes,
  },
})
