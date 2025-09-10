
exports.up = function(knex) {
  // Note: This migration requires the h3 extension to be manually installed in local dev
  // Production environments (Heroku) don't support h3, so this is for local testing only
  
  // Add H3 generated column at resolution 7 for geospatial searches
  return knex.raw(`
    ALTER TABLE locations 
    ADD COLUMN search_h3_r7 TEXT 
        GENERATED ALWAYS AS (
          CASE 
            WHEN center IS NOT NULL 
            THEN h3_lat_lng_to_cell(point(ST_X(center::geometry), ST_Y(center::geometry)), 7)
            ELSE NULL 
          END
        ) STORED
  `)
  .then(() => {
    return knex.raw('CREATE INDEX locations_search_h3_r7_index ON locations (search_h3_r7)')
  })
}

exports.down = function(knex) {
  return knex.raw('DROP INDEX IF EXISTS locations_search_h3_r7_index;')
    .then(() => knex.raw('ALTER TABLE locations DROP COLUMN IF EXISTS search_h3_r7;'))
}
