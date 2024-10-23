import React from 'react'
import { screen } from '@testing-library/react'
import { render, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import MapExplorer from './MapExplorer'

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({}),
  useLocation: () => ({
    pathname: '/map',
    search: '',
  }),
}))

describe('MapExplorer', () => {
  const defaultProps = {
    centerLocation: { lat: 35.442845, lng: 7.916598 },
    fetchPosts: jest.fn(),
    fetchSavedSearches: jest.fn(),
    filters: { featureTypes: { request: true, offer: true } },
    groups: [],
    hideDrawer: false,
    match: { params: {} },
    members: [],
    postsForDrawer: [],
    postsForMap: [],
    routeParams: {},
    storeFetchPostsParam: jest.fn(),
    topics: [],
    zoom: 0,
  }

  it('renders the map container', () => {
    render(
      <AllTheProviders>
        <MapExplorer {...defaultProps} />
      </AllTheProviders>
    )

    expect(screen.getByTestId('map-container')).toBeInTheDocument()
  })

  it('renders the location input', () => {
    render(
      <AllTheProviders>
        <MapExplorer {...defaultProps} />
      </AllTheProviders>
    )

    expect(screen.getByPlaceholderText('Search for a location')).toBeInTheDocument()
  })

  it('renders the feature filters button', () => {
    render(
      <AllTheProviders>
        <MapExplorer {...defaultProps} />
      </AllTheProviders>
    )

    expect(screen.getByText(/Features:/)).toBeInTheDocument()
  })

  it('renders the layers selector button', () => {
    render(
      <AllTheProviders>
        <MapExplorer {...defaultProps} />
      </AllTheProviders>
    )

    expect(screen.getByTestId('layers-selector-button')).toBeInTheDocument()
  })

  it('renders the drawer toggle button', () => {
    render(
      <AllTheProviders>
        <MapExplorer {...defaultProps} />
      </AllTheProviders>
    )

    expect(screen.getByTestId('drawer-toggle-button')).toBeInTheDocument()
  })

  it('renders the MapDrawer when hideDrawer is false', () => {
    render(
      <AllTheProviders>
        <MapExplorer {...defaultProps} hideDrawer={false} />
      </AllTheProviders>
    )

    expect(screen.getByTestId('map-drawer')).toBeInTheDocument()
  })

  it('does not render the MapDrawer when hideDrawer is true', () => {
    render(
      <AllTheProviders>
        <MapExplorer {...defaultProps} hideDrawer={true} />
      </AllTheProviders>
    )

    expect(screen.queryByTestId('map-drawer')).not.toBeInTheDocument()
  })
})
