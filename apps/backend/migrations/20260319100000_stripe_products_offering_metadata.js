/**
 * Add stripe_products.metadata for buy button text + sliding scale (moved out of access_grants).
 */

exports.up = async function (knex) {
  await knex.schema.table('stripe_products', function (table) {
    table.jsonb('metadata').notNullable().defaultTo('{}')
      .comment('Presentation / checkout options: buyButtonText, slidingScale (not access scopes)')
  })

  const rows = await knex('stripe_products').select('id', 'access_grants')

  for (const row of rows) {
    let ag = row.access_grants
    if (ag == null) {
      ag = {}
    } else if (typeof ag === 'string') {
      try {
        ag = JSON.parse(ag)
      } catch {
        ag = {}
      }
    }
    if (typeof ag !== 'object' || Array.isArray(ag)) {
      ag = {}
    }

    const nextAg = { ...ag }
    const meta = {}

    if (nextAg.buyButtonText != null) {
      const t = String(nextAg.buyButtonText).trim()
      if (t) meta.buyButtonText = t.slice(0, 30)
      delete nextAg.buyButtonText
    }

    const slide = nextAg.slidingScale != null ? nextAg.slidingScale : nextAg.sliding_scale
    if (slide !== undefined && slide !== null) {
      meta.slidingScale = slide
      delete nextAg.slidingScale
      delete nextAg.sliding_scale
    }

    await knex('stripe_products')
      .where({ id: row.id })
      .update({
        metadata: meta,
        access_grants: nextAg
      })
  }
}

exports.down = async function (knex) {
  const rows = await knex('stripe_products').select('id', 'access_grants', 'metadata')

  for (const row of rows) {
    let ag = row.access_grants
    if (ag == null) {
      ag = {}
    } else if (typeof ag === 'string') {
      try {
        ag = JSON.parse(ag)
      } catch {
        ag = {}
      }
    }
    if (typeof ag !== 'object' || Array.isArray(ag)) {
      ag = {}
    }

    let meta = row.metadata
    if (meta == null) {
      meta = {}
    } else if (typeof meta === 'string') {
      try {
        meta = JSON.parse(meta)
      } catch {
        meta = {}
      }
    }
    if (typeof meta !== 'object' || Array.isArray(meta)) {
      meta = {}
    }

    const merged = { ...ag }
    if (meta.buyButtonText != null && String(meta.buyButtonText).trim() !== '') {
      merged.buyButtonText = String(meta.buyButtonText).trim()
    }
    if (meta.slidingScale != null) {
      merged.slidingScale = meta.slidingScale
    }

    await knex('stripe_products')
      .where({ id: row.id })
      .update({ access_grants: merged })
  }

  await knex.schema.table('stripe_products', function (table) {
    table.dropColumn('metadata')
  })
}
