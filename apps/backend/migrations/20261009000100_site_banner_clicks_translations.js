/**
 * Site banners:
 * - site_banners_users.clicked_at: set when someone used the banner's action
 *   button, so clicks are counted apart from plain dismissals. The row still
 *   hides the banner for them, as a dismissal does.
 * - site_banners.translations: per-language title, text and action_text,
 *   e.g. { "de": { "title": "...", "text": "...", "action_text": "..." } }.
 *   The banner's own columns stay the English text and the fallback.
 */

exports.up = async function (knex) {
  await knex.raw('ALTER TABLE site_banners_users ADD COLUMN IF NOT EXISTS clicked_at timestamp with time zone')
  await knex.raw("ALTER TABLE site_banners ADD COLUMN IF NOT EXISTS translations jsonb DEFAULT '{}'::jsonb NOT NULL")
}

exports.down = async function (knex) {
  await knex.raw('ALTER TABLE site_banners DROP COLUMN IF EXISTS translations')
  await knex.raw('ALTER TABLE site_banners_users DROP COLUMN IF EXISTS clicked_at')
}
