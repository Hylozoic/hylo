import { PLACEHOLDER_COPY } from '../constants'
import { htmlCopy, sid } from '../helpers'

/**
 * Comments keyed by post id. Edit text fields directly — each uses PLACEHOLDER_COPY.
 */
export function buildCommentsByPostId (peopleById, meId) {
  const me = peopleById[meId]
  const p2 = peopleById['sandbox-person-002']
  const p3 = peopleById['sandbox-person-003']
  const p4 = peopleById['sandbox-person-004']
  const p5 = peopleById['sandbox-person-005']

  return {
    [sid('post', '002')]: [
      comment(sid('comment', '002', '001'), p2, -7200, { childComments: [
        comment(sid('comment', '002', '001', '001'), me, -7000)
      ] }),
      comment(sid('comment', '002', '002'), p3, -6800),
      comment(sid('comment', '002', '003'), p4, -6400),
      comment(sid('comment', '002', '004'), me, -6000),
      comment(sid('comment', '002', '005'), p5, -5600)
    ],
    [sid('post', '001')]: [
      comment(sid('comment', '001', '001'), p2, -50000)
    ],
    [sid('post', '005')]: [
      comment(sid('comment', '005', '001'), p3, -90000, {
        text: htmlCopy(PLACEHOLDER_COPY.slice(0, 120))
      })
    ],
    [sid('post', '006')]: [
      comment(sid('comment', '006', '001'), p4, -40000)
    ],
    [sid('post', '003')]: [
      comment(sid('comment', '003', '001'), p5, -30000)
    ]
  }
}

function comment (id, creator, createdAt_offset, extras = {}) {
  return {
    id,
    text: extras.text || htmlCopy(),
    createdAt_offset,
    creator,
    childComments: extras.childComments || [],
    commentReactions: extras.commentReactions || [],
    commentsTotal: (extras.childComments || []).length
  }
}

/**
 * Reactions keyed by post id.
 */
export function buildReactionsByPostId (peopleById, meId) {
  const pick = id => peopleById[id]
  return {
    [sid('post', '001')]: [
      reaction(sid('reaction', '001', '001'), pick(meId), '👍', -80000),
      reaction(sid('reaction', '001', '002'), pick('sandbox-person-006'), '❤️', -79000),
      reaction(sid('reaction', '001', '003'), pick('sandbox-person-007'), '🎉', -78000)
    ],
    [sid('post', '002')]: [
      reaction(sid('reaction', '002', '001'), pick('sandbox-person-008'), '👍', -75000),
      reaction(sid('reaction', '002', '002'), pick(meId), '💡', -74000)
    ],
    [sid('post', '005')]: [
      reaction(sid('reaction', '005', '001'), pick('sandbox-person-010'), '👍', -85000)
    ],
    [sid('post', '003')]: [
      reaction(sid('reaction', '003', '001'), pick('sandbox-person-011'), '✅', -70000)
    ]
  }
}

function reaction (id, user, emojiFull, createdAt_offset) {
  return {
    id,
    userId: user.id,
    user,
    emojiFull,
    emojiBase: emojiFull,
    emojiLabel: emojiFull,
    entityType: 'post',
    createdAt_offset
  }
}

/**
 * Proposal options and votes for proposal posts.
 */
export function buildProposalData () {
  const postId = sid('post', '005')
  const options = [
    { id: sid('proposal-option', '001'), postId, text: PLACEHOLDER_COPY.slice(0, 80), emoji: '🅰️', color: '#4A90D9' },
    { id: sid('proposal-option', '002'), postId, text: PLACEHOLDER_COPY.slice(0, 80), emoji: '🅱️', color: '#7B68EE' },
    { id: sid('proposal-option', '003'), postId, text: PLACEHOLDER_COPY.slice(0, 80), emoji: '🅲', color: '#50C878' }
  ]
  const votes = [
    vote(sid('vote', '001'), 'sandbox-person-002', options[0].id, postId, -86000),
    vote(sid('vote', '002'), 'sandbox-person-003', options[0].id, postId, -85000),
    vote(sid('vote', '003'), 'sandbox-person-004', options[1].id, postId, -84000),
    vote(sid('vote', '004'), 'sandbox-person-005', options[2].id, postId, -83000),
    vote(sid('vote', '005'), 'sandbox-me', options[0].id, postId, -82000)
  ]
  return {
    [postId]: { options, votes, proposalStatus: 'voting', votingMethod: 'single' },
    [sid('post', '010')]: {
      options: [
        { id: sid('proposal-option', '010', '001'), postId: sid('post', '010'), text: PLACEHOLDER_COPY.slice(0, 80), emoji: '1️⃣' },
        { id: sid('proposal-option', '010', '002'), postId: sid('post', '010'), text: PLACEHOLDER_COPY.slice(0, 80), emoji: '2️⃣' }
      ],
      votes: [],
      proposalStatus: 'discussion',
      votingMethod: 'single'
    }
  }
}

function vote (id, userId, optionId, postId, createdAt_offset) {
  return { id, userId, optionId, postId, createdAt_offset }
}
