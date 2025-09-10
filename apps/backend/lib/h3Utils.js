/**
 * Generate SQL WHERE clause for H3 bounding box search using h3_polygon_to_cells
 * @param {Array} boundingBox - Array of two PointInput objects [southwest, northeast]
 * @param {string} columnName - Name of the H3 column (default: 'search_h3_r7')
 * @param {number} resolution - H3 resolution level (default: 7)
 * @returns {Object} Object with sql string and bindings array for knex
 */
export function generateH3BoundingBoxWhereClause(boundingBox, columnName = 'search_h3_r7', resolution = 7) {
  if (!boundingBox || boundingBox.length !== 2) {
    return {
      sql: '1=0', // No matches
      bindings: []
    }
  }

  const [southwest, northeast] = boundingBox
  
  if (!southwest.lat || !southwest.lng || !northeast.lat || !northeast.lng) {
    return {
      sql: '1=0', // No matches
      bindings: []
    }
  }

  // Use h3_polygon_to_cells with ST_MakeEnvelope to get H3 cells covering the bounding box
  const sql = `${columnName}::h3index = ANY(
    SELECT h3_polygon_to_cells(
      ST_MakeEnvelope(?, ?, ?, ?, 4326)::geometry,
      ?
    )
  )`
  
  return {
    sql,
    bindings: [southwest.lng, southwest.lat, northeast.lng, northeast.lat, resolution]
  }
}
