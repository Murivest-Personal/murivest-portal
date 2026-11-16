'use client'

/**
 * Sanity Studio configuration for the embedded Studio mounted at
 * /src/app/studio/[[...tool]]/page.tsx  →  http://localhost:3000/studio
 */

import { visionTool } from '@sanity/vision'
import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'

import { apiVersion, dataset, projectId } from './src/sanity/env'
import { schema } from './src/sanity/schemaTypes'
import { structure } from './src/sanity/structure'

export default defineConfig({
  // Identity (used in Studio UI + sanity deploy)
  name: 'murivest-portal',
  title: 'Murivest Portal',

  // Where the Studio mounts in the Next.js app
  basePath: '/studio',

  // Project connection (comes from .env.local via src/sanity/env.ts)
  projectId,
  dataset,

  // Content model
  schema,

  plugins: [
    structureTool({ structure }),
    visionTool({ defaultApiVersion: apiVersion }),
  ],

  document: {
    // Keep destructive actions out of the way for regulated content
    actions: (input, context) =>
      ['disclosure', 'reportingPeriod', 'documentAsset'].includes(
        context.schemaType,
      )
        ? input.filter(
            ({ action }) =>
              action &&
              !['delete', 'duplicate'].includes(action),
          )
        : input,
  },
})