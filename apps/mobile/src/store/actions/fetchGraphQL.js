import { FETCH_GRAPHQL } from 'store/constants'

export default function fetchGraphQL ({ query, variables = {}, meta = {} }) {
  return {
    type: FETCH_GRAPHQL,
    graphql: {
      query,
      variables
    },
    meta
  }
}
