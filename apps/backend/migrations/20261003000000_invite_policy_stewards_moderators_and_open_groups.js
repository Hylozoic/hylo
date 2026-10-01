/**
 * Give existing top-level groups the "Who can add new members?" policy decided
 * for them: Open groups get Everyone, and Restricted and Closed groups get
 * Stewards, which now includes Moderators. The work itself is in
 * scripts/convertInvitePolicies.js.
 *
 * It only happens where member invitations are already switched on when this
 * runs. Where they are off (production today), this only creates the tracking
 * table, and the conversion runs when member invitations are switched on:
 *
 *   NODE_ENV=production node migrations/scripts/convertInvitePolicies.js
 *
 * That keeps Invite Members off every role until it does something. down()
 * removes only the links the conversion added, whichever way it ran.
 */

const {
  memberInvitesOn,
  ensureTrackingTable,
  convertInvitePolicies,
  revertInvitePolicyConversion
} = require('./scripts/convertInvitePolicies')

exports.config = { transaction: false }

exports.up = async function (knex) {
  await ensureTrackingTable(knex)
  if (memberInvitesOn()) await convertInvitePolicies(knex)
}

exports.down = async function (knex) {
  await revertInvitePolicyConversion(knex)
}
