import { merge, pick } from 'lodash'
import { getOr } from 'lodash/fp'

export default async function setupPostAttrs (userId, params, create = false) {
  if (params.isPublic) {
    // Don't allow creating a public post unless at least one of the post's groups has allow_in_public set to true
    const groups = await Group.query(q => q.whereIn('id', params.group_ids)).fetchAll()
    const allowedToMakePublic = groups.find(g => g.get('allow_in_public'))
    if (!allowedToMakePublic) params.isPublic = false
  }
  const attrs = merge({
    accept_contributions: params.acceptContributions,
    anonymous_voting: params.isAnonymousVote,
    announcement: params.announcement,
    completion_action: params.completionAction,
    completion_action_settings: params.completionActionSettings,
    donations_link: params.donationsLink,
    end_time: params.endTime ? new Date(Number(params.endTime)) : null,
    is_public: params.isPublic,
    link_preview_id: params.link_preview_id || getOr(null, 'id', params.linkPreview),
    parent_post_id: params.parent_post_id,
    project_management_link: params.projectManagementLink,
    voting_method: params.votingMethod,
    start_time: params.startTime ? new Date(Number(params.startTime)) : null,
    updated_at: new Date(),
    user_id: userId
  }, pick(params,
    'budget',
    'created_from',
    'description',
    'link_preview_featured',
    'location_id',
    'location',
    'name',
    'quorum',
    'timezone',
    'type'
  ))

  let proposalStatus = params.startTime && new Date(Number(params.startTime)) < new Date() ? Post.Proposal_Status.VOTING : Post.Proposal_Status.DISCUSSION
  if (params.endTime && new Date(Number(params.endTime)) < new Date()) proposalStatus = Post.Proposal_Status.COMPLETED
  const proposalAttrs = {
    proposal_status: params.startTime ? proposalStatus : Post.Proposal_Status.CASUAL
  }
  return Promise.resolve({ ...attrs, ...proposalAttrs })
}
