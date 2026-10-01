// The saved unsubscribe choice (D35) and which "email is off" line it calls for
export const FETCH_EMAIL_UNSUBSCRIBE_SCOPE = 'EmailOffNotice/FETCH_EMAIL_UNSUBSCRIBE_SCOPE'
export const NOTIFICATION_SETTINGS_PATH = '/my/notifications'

// Choices on the emailed settings page (D35) that keep a group's email off
const SCOPES_WITH_GROUP_EMAIL_OFF = ['no_group_emails', 'everything']
const SCOPES_WITH_ONLY_DIRECT = ['all_but_direct']

// Read on its own, not into the store: the saved choice is only shown here
export function fetchEmailUnsubscribeScope () {
  return {
    type: FETCH_EMAIL_UNSUBSCRIBE_SCOPE,
    graphql: {
      query: `
        query EmailUnsubscribeScope {
          me {
            id
            settings {
              emailUnsubscribeScope
            }
          }
        }
      `,
      variables: {}
    }
  }
}

// Which line to show, if any: 'off' when this group sends no email, 'onlyDirect' when
// only mentions and replies still do
export function emailOffState (membershipSettings, unsubscribeScope) {
  if (membershipSettings?.sendEmail === false || SCOPES_WITH_GROUP_EMAIL_OFF.includes(unsubscribeScope)) return 'off'
  if (SCOPES_WITH_ONLY_DIRECT.includes(unsubscribeScope)) return 'onlyDirect'
  return null
}
