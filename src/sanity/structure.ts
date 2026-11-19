import type {StructureResolver} from 'sanity/structure'

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Content')
    .items([
      // Opportunities - organized by listing type and country
      S.listItem()
        .title('Opportunities')
        .child(
          S.list()
            .title('Opportunities')
            .items([
              // Off-market properties (portal only)
              S.listItem()
                .title('🔒 Off-market Properties')
                .child(
                  S.documentTypeList('opportunity')
                    .title('Off-market Properties')
                ),

              S.divider(),

              // Auction properties
              S.listItem()
                .title('🔨 Auction Properties')
                .child(
                  S.documentTypeList('auctionProperty')
                    .title('Auction Properties')
                ),

              S.divider(),

              // Available by Country - grouped by country
              S.listItem()
                .title('🌍 Available by Country')
                .child(
                  S.list()
                    .title('Available by Country')
                    .items([
                      S.listItem()
                        .title('Kenya')
                        .child(
                          S.documentTypeList('property')
                            .title('Kenya Properties')
                        ),

                      S.listItem()
                        .title('United Kingdom')
                        .child(
                          S.documentTypeList('ukProperty')
                            .title('UK Properties')
                        ),

                      S.listItem()
                        .title('United Arab Emirates')
                        .child(
                          S.documentTypeList('uaeProperty')
                            .title('UAE Properties')
                        ),

                      S.listItem()
                        .title('Singapore')
                        .child(
                          S.documentTypeList('sgProperty')
                            .title('Singapore Properties')
                        ),

                      S.listItem()
                        .title('United States')
                        .child(
                          S.documentTypeList('usProperty')
                            .title('US Properties')
                        ),
                    ])
                ),

              S.divider(),

              // All opportunities (flat list for admin overview)
              S.documentTypeListItem('opportunity')
                .title('All Opportunities (Flat List)'),
            ])
        ),

      S.documentTypeListItem('brief').title('Investment Briefs'),
      S.divider(),
      S.documentTypeListItem('documentAsset').title('Data-room Documents'),
      S.divider(),
      S.documentTypeListItem('marketReport').title('Market Intelligence'),
      S.divider(),
      S.documentTypeListItem('landingContent').title('Landing Page'),
    ])