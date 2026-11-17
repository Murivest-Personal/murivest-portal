import {type SchemaTypeDefinition} from 'sanity'
import opportunity from './opportunity'
import brief from './brief'
import documentSchema from './document'
import marketReport from './marketReport'
import landingContent from './landingContent'

export const schema = {
  types: [opportunity, brief, documentSchema, marketReport, landingContent] as SchemaTypeDefinition[],
}