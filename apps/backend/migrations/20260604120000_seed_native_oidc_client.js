// Seeds a first-party public OIDC client for the Hylo mobile app.
//
// The native app obtains its initial token pair via POST /noo/login/native (and the
// social endpoints), which mint tokens directly. It then refreshes via the standard
// /noo/oauth/token endpoint (grant_type=refresh_token) and revokes via
// /noo/oauth/token/revocation -- both of which require this client to exist and to allow
// the refresh_token grant. It is a public client (no secret) and uses no browser
// redirect, so redirect_uris/response_types are empty.

const CLIENT_ID = 'hylo-mobile'

const clientPayload = {
  client_id: CLIENT_ID,
  client_name: 'Hylo Mobile',
  application_type: 'native',
  grant_types: ['refresh_token'],
  response_types: [],
  redirect_uris: [],
  token_endpoint_auth_method: 'none',
  scope: 'openid offline_access email profile api:read api:write'
}

exports.up = async function (knex) {
  const existing = await knex('oidc_payloads')
    .where({ id: CLIENT_ID, type: 'Client' })
    .first()

  if (existing) {
    await knex('oidc_payloads')
      .where({ id: CLIENT_ID, type: 'Client' })
      .update({ payload: clientPayload })
  } else {
    await knex('oidc_payloads').insert({
      id: CLIENT_ID,
      type: 'Client',
      payload: clientPayload
    })
  }
}

exports.down = function (knex) {
  return knex('oidc_payloads')
    .where({ id: CLIENT_ID, type: 'Client' })
    .delete()
}
