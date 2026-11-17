import type {StructureResolver} from 'sanity/structure'

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Content')
    .items([
      S.documentTypeListItem('opportunity').title('Opportunities'),
      S.documentTypeListItem('brief').title('Investment Briefs'),
      S.divider(),
      S.documentTypeListItem('documentAsset').title('Data-room Documents'),
      S.divider(),
      S.documentTypeListItem('marketReport').title('Market Intelligence'),
      S.divider(),
      S.documentTypeListItem('landingContent').title('Landing Page'),
    ])