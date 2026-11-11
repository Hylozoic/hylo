import React from 'react'
import { render, screen, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import { GroupsList } from './Groups'

const childGroup = {
  id: '9',
  name: 'Gless Network',
  slug: 'gless-network',
  memberStatus: 'not'
}

describe('GroupsList', () => {
  it('links a related group to its own page from the about tab', () => {
    render(
      <GroupsList groups={[childGroup]} />,
      { wrapper: AllTheProviders(undefined, ['/groups/bioregional-commons/about/related-groups']) }
    )

    expect(screen.getByRole('link')).toHaveAttribute('href', '/groups/gless-network')
  })
})
