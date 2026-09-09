import gql from 'graphql-tag'

/**
 * Probe whether a person has opted into a public profile (works for anonymous GraphQL).
 */
export default function checkIsPersonPublic (personId) {
  return {
    type: 'IS_PERSON_PUBLIC',
    graphql: {
      query: gql`
        query CheckIsPersonPublic ($id: ID) {
          person (id: $id) {
            id
            isProfilePublic
          }
        }
      `,
      variables: { id: personId }
    },
    meta: { extractModel: 'Person' }
  }
}
