import { GeoJsonLayer } from '@deck.gl/layers'

/** Boundary tooltip: spaces are labeled as spaces, groups as groups. */
function areaMessage (group, t) {
  const label = group.type === 'space' ? 'Space area: {{name}}' : 'Group area: {{name}}'
  return t ? t(label, { name: group.name }) : label.replace('{{name}}', group.name)
}

/** One boundary layer. Empty sets are skipped so deck does not keep a blank layer. */
function polygonLayer (id, groups, onHover, t) {
  const data = groups.filter(group => group.geoShape).map(group => {
    return {
      geometry: group.geoShape || {},
      message: areaMessage(group, t),
      properties: { name: group.name },
      type: 'GroupShape'
    }
  })
  if (data.length === 0) return null

  return new GeoJsonLayer({
    id,
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

/**
 * Group boundaries, then space boundaries. Later deck.gl layers paint on top,
 * so a space area stays above the parent group area that contains it.
 */
export function createPolygonLayerFromGroups ({ groups, onHover, t }) {
  const spaces = groups.filter(group => group.type === 'space')
  const otherGroups = groups.filter(group => group.type !== 'space')
  return [
    polygonLayer('geojson-layer-groups', otherGroups, onHover, t),
    polygonLayer('geojson-layer-spaces', spaces, onHover, t)
  ].filter(Boolean)
}
