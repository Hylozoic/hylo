import { createPolygonLayerFromGroups } from './index'

const shape = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }

describe('createPolygonLayerFromGroups', () => {
  it('draws space areas after the parent group area', () => {
    const layers = createPolygonLayerFromGroups({
      groups: [
        { id: 2, name: 'Oak Park', type: 'space', geoShape: shape },
        { id: 1, name: 'River City', type: 'group', geoShape: shape },
        { id: 3, name: 'No boundary', type: 'space' }
      ],
      t: (label, { name }) => label.replace('{{name}}', name)
    })

    expect(layers.map(layer => layer.id)).toEqual(['geojson-layer-groups', 'geojson-layer-spaces'])
    expect(layers[0].props.data.map(feature => feature.properties.name)).toEqual(['River City'])
    expect(layers[1].props.data.map(feature => feature.properties.name)).toEqual(['Oak Park'])
    expect(layers[1].props.data[0].message).toBe('Space area: Oak Park')
  })
})
