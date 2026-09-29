import { ANSWER_OPEN_REQUEST_NUDGE } from 'store/constants'

/**
 * Records the author's answer to the nudge about a request or offer nobody has
 * replied to (D58): 'still_needed' or 'met'.
 */
export default function answerOpenRequestNudge (postId, answer) {
  return {
    type: ANSWER_OPEN_REQUEST_NUDGE,
    graphql: {
      query: `mutation AnswerOpenRequestNudge ($postId: ID!, $answer: String!) {
        answerOpenRequestNudge (postId: $postId, answer: $answer) {
          success
        }
      }`,
      variables: { postId, answer }
    },
    meta: { postId, answer }
  }
}
