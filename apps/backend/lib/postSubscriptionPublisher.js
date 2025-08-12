/**
 * Utilities for publishing post subscription updates in a non-blocking way
 */

import RedisPubSub from '../api/services/RedisPubSub'

/**
 * Publishes post updates to users following the post.
 * @param {Object} context - GraphQL context with pubSub (optional)
 * @param {string|Object} post - Post ID or Post object
 * @param {Object} options - Update options
 * @param {string} options.changeContext - What changed: 'comment', 'reaction', 'vote', 'edit', 'completion', 'member'
 * @param {Object} options.customData - Custom data to override defaults (optional)
 */
export async function publishPostUpdate (context, post, options = {}) {
  const pubSub = context?.pubSub || RedisPubSub
  if (!pubSub) return

  const { changeContext = 'edit', customData } = options

  try {
    // Handle both post ID and post object
    const postObj = typeof post === 'string' ? await Post.find(post, { withRelated: ['followers'] }) : post
    if (!postObj) return

    // Ensure we have the followers loaded
    if (!postObj.relations.followers) {
      await postObj.load(['followers'])
    }

    // Get people who are following this post
    const followers = postObj.relations.followers
    const followerIds = new Set()

    if (followers) {
      for (const follower of followers.models) {
        followerIds.add(follower.id)
      }
    }

    // Always include the post creator (they should know about changes to their post)
    const creatorId = postObj.get('user_id')
    if (creatorId) {
      followerIds.add(creatorId)
    }

    // Build context-aware update data
    const postUpdateData = await buildPostUpdateData(postObj, changeContext, customData)

    if (process.env.NODE_ENV === 'development') {
      console.log(`📡 Publishing post update: ${postUpdateData.id} (${changeContext}) to ${followerIds.size} followers`)
      console.log(`   → Changed fields: ${Object.keys(postUpdateData).join(', ')}`)
    }

    // Publish to each follower's user channel
    for (const userId of followerIds) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`   → Publishing to user ${userId} on channel postUpdates:${userId}`)
      }
      pubSub.publish(`postUpdates:${userId}`, { post: postUpdateData })
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Successfully published ${followerIds.size} post updates to subscribers`)
    }
  } catch (error) {
    console.error('❌ Error in publishPostUpdate:', error)
  }
}

/**
 * Builds the appropriate update data based on post type and change context
 * @param {Object} postObj - The post object
 * @param {string} changeContext - What changed
 * @param {Object} customData - Custom data to override defaults
 * @returns {Object} - Minimal update data containing only relevant fields
 */
async function buildPostUpdateData (postObj, changeContext, customData = {}) {
  const postType = postObj.get('type')

  const updateData = {
    id: postObj.id,
    updatedAt: postObj.get('updated_at')
  }

  switch (changeContext) {
    case 'comment':
      updateData.commentsTotal = postObj.get('num_comments')

      await postObj.load(['comments.user'])
      if (postObj.relations.comments) {
        updateData.comments = {
          total: postObj.get('num_comments'),
          items: postObj.relations.comments.models.map(comment => {
            const creator = comment.relations.user
              ? {
                  id: comment.relations.user.id,
                  name: comment.relations.user.get('name'),
                  avatarUrl: comment.relations.user.get('avatar_url')
                }
              : null

            return {
              id: comment.id,
              text: comment.get('text'),
              createdAt: comment.get('created_at'),
              creator
            }
          })
        }
      } else {
        updateData.comments = null
      }
      break

    case 'reaction':
      updateData.peopleReactedTotal = postObj.get('num_people_reacts')
      updateData.reactionsSummary = postObj.get('reactions_summary')

      await postObj.load(['reactions.user'])
      updateData.postReactions = postObj.relations.reactions
        ? postObj.relations.reactions.models.map(reaction => ({
          id: reaction.id,
          emojiFull: reaction.get('emoji_full'),
          emojiBase: reaction.get('emoji_base'),
          user: reaction.relations.user
            ? {
                id: reaction.relations.user.id,
                name: reaction.relations.user.get('name')
              }
            : null
        }))
        : []
      break

    case 'vote':
      if (postType === 'proposal') {
        updateData.proposalStatus = postObj.get('proposal_status')
        updateData.proposalOutcome = postObj.get('proposal_outcome')

        await postObj.load(['proposalOptions', 'proposalVotes.user'])

        updateData.proposalOptions = postObj.relations.proposalOptions
          ? {
              total: postObj.relations.proposalOptions.length,
              items: postObj.relations.proposalOptions.models.map(option => ({
                id: option.id,
                text: option.get('text'),
                emoji: option.get('emoji'),
                color: option.get('color')
              }))
            }
          : null

        updateData.proposalVotes = postObj.relations.proposalVotes
          ? {
              total: postObj.relations.proposalVotes.length,
              items: postObj.relations.proposalVotes.models.map(vote => ({
                id: vote.id,
                optionId: vote.get('option_id'),
                user: vote.relations.user
                  ? {
                      id: vote.relations.user.id,
                      name: vote.relations.user.get('name')
                    }
                  : null
              }))
            }
          : null
      }
      break

    case 'completion':
      updateData.fulfilledAt = postObj.get('fulfilled_at')
      updateData.completedAt = postObj.get('completed_at')
      break

    case 'edit':
      // For post edits, include the main content fields
      updateData.title = postObj.get('name')
      updateData.details = postObj.get('description')
      updateData.type = postObj.get('type')
      updateData.location = postObj.get('location')
      updateData.startTime = postObj.get('start_time')
      updateData.endTime = postObj.get('end_time')
      break
  }

  // Override with any custom data provided
  return { ...updateData, ...customData }
}
