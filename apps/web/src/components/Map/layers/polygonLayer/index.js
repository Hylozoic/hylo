import { GeoJsonLayer } from '@deck.gl/layers'

/** Boundary tooltip: spaces are labeled as spaces, groups as groups. */
function areaMessage (group, t) {
  const label = group.type === 'space' ? 'Space area: {{name}}' : 'Group area: {{name}}'
  return t ? t(label, { name: group.name }) : label.replace('{{name}}', group.name)
}

export function createPolygonLayerFromGroups ({ groups, onHover, t }) {
  const data = groups.filter(group => group.geoShape).map(group => {
    return {
      geometry: group.geoShape || {},
      message: areaMessage(group, t),
      properties: { name: group.name },
      type: 'GroupShape'
    }
  })

  return new GeoJsonLayer({
    id: 'geojson-layer',
    data,
    pickable: true,
    stroked: true,
    filled: true,
    extruded: false,
    pointType: 'circle',
    getPointRadius: 100,
    getFillColor: [64, 161, 221, 65],
    lineWidthScale: 20,
    lineWidthMinPixels: 1,
    getLineColor: [60, 100, 180, 100],
    getLineWidth: 1,
    onHover
  })
}
