import {type SchemaTypeDefinition} from 'sanity'
import opportunity from './opportunity'
import brief from './brief'
import documentSchema from './document'
import marketReport from './marketReport'
import landingContent from './landingContent'
import property from './property'
import ukProperty from './ukProperty'
import uaeProperty from './uaeProperty'
import sgProperty from './sgProperty'
import usProperty from './usProperty'
import {auctionProperty} from './auctionProperty'

export const schema = {
  types: [opportunity, brief, documentSchema, marketReport, landingContent, property, ukProperty, uaeProperty, sgProperty, usProperty, auctionProperty] as SchemaTypeDefinition[],
}