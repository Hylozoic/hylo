import gql from 'graphql-tag'

/**
 * Check if a group is viewable - either publicly accessible or accessible via invitation
 * @param groupSlug {string} the group slug
 * @param accessCode {string} optional access code from invitation link
 * @param invitationToken {string} optional invitation token from email invite
 */
export default function checkIsGroupViewable (groupSlug, { accessCode, invitationToken } = {}) {
  return {
    type: 'IS_GROUP_VIEWABLE',
    graphql: {
      query: gql`
        query CheckIsGroupViewable ($slug: String, $accessCode: String, $invitationToken: String) {
          group (slug: $slug, accessCode: $accessCode, invitationToken: $invitationToken) {
            visibility
          }
        }
      `,
      variables: { slug: groupSlug, accessCode, invitationToken }
    },
    meta: { extractModel: 'Group' }
  }
}
