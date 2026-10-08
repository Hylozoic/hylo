/**
 * Rename the built-in system Coordinator role to Administrator.
 */

const OLD_NAME = 'Coordinator'
const NEW_NAME = 'Administrator'
const OLD_DESCRIPTIONS = [
  'Coordinators are empowered to do everything related to group administration.',
  'Administrators are empowered to do everything related to group administration.'
]
const NEW_DESCRIPTION = 'Administrators are empowered to do all group management and configuration.'

exports.up = async function (knex) {
  const now = new Date()

  await knex('groups_roles')
    .where({ name: OLD_NAME, type: 'system' })
    .update({ name: NEW_NAME, updated_at: now })

  await knex('groups_roles')
    .where({ name: NEW_NAME, type: 'system' })
    .whereIn('description', OLD_DESCRIPTIONS)
    .update({ description: NEW_DESCRIPTION, updated_at: now })
}

exports.down = async function (knex) {
  const now = new Date()

  await knex('groups_roles')
    .where({ name: NEW_NAME, type: 'system' })
    .whereIn('description', [...OLD_DESCRIPTIONS, NEW_DESCRIPTION])
    .update({
      description: 'Coordinators are empowered to do everything related to group administration.',
      updated_at: now
    })

  await knex('groups_roles')
    .where({ name: NEW_NAME, type: 'system' })
    .update({ name: OLD_NAME, updated_at: now })
}
