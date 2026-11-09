import { buildClusterLayerData } from './index'

describe('buildClusterLayerData', () => {
  it('includes posts that have a location center', () => {
    const data = buildClusterLayerData({
      posts: [
        { id: 1, type: 'request', title: 'Has a place', locationObject: { center: { lat: 37.7, lng: -122.4 } } },
        { id: 2, type: 'offer', title: 'No place', locationObject: null }
      ],
      members: []
    })
    expect(data).toEqual([
      expect.objectContaining({ id: 1, type: 'request', coordinates: [-122.4, 37.7] })
    ])
  })

  it('appends newly fetched located posts', () => {
    const first = buildClusterLayerData({
      posts: [
        { id: 1, type: 'request', title: 'Near', locationObject: { center: { lat: 37.7, lng: -122.4 } } }
      ],
      members: []
    })
    const afterZoomOut = buildClusterLayerData({
      posts: [
        { id: 1, type: 'request', title: 'Near', locationObject: { center: { lat: 37.7, lng: -122.4 } } },
        { id: 9, type: 'offer', title: 'Far', locationObject: { center: { lat: 38.1, lng: -122.0 } } }
      ],
      members: []
    })
    expect(first).toHaveLength(1)
    expect(afterZoomOut).toHaveLength(2)
    expect(afterZoomOut.map(d => d.id)).toEqual([1, 9])
  })
})
