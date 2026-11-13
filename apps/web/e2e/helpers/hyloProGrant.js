import { execFileSync } from 'child_process'

/**
 * Gives or removes Hylo Pro for a seeded group by writing a manual grant row
 * straight to the isolated E2E database (the runner sets E2E_DATABASE_URL).
 * Grants are tagged with a note so a spec only ever removes its own.
 */

export const canSeedHyloPro = !!process.env.E2E_DATABASE_URL

function sql (query) {
  return execFileSync('psql', [process.env.E2E_DATABASE_URL, '-v', 'ON_ERROR_STOP=1', '-tAc', query], { encoding: 'utf8' }).trim()
}

const quote = value => `'${String(value).replace(/'/g, "''")}'`

export function revokeHyloPro (note) {
  sql(`DELETE FROM hylo_pro_subscriptions WHERE note = ${quote(note)}`)
}

export function grantHyloPro (groupSlug, note) {
  revokeHyloPro(note)
  sql(`INSERT INTO hylo_pro_subscriptions (group_id, source, status, note, created_at, updated_at)
    SELECT id, 'manual', 'active', ${quote(note)}, now(), now() FROM groups WHERE slug = ${quote(groupSlug)}`)
}
