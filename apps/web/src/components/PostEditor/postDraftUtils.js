const serializeTopics = (topics = []) =>
  (topics || [])
    .filter(Boolean)
    .map(topic => ({ id: topic.id, name: topic.name, slug: topic.slug }))

const serializeGroupIds = (groups = []) =>
  (groups || [])
    .filter(Boolean)
    .map(group => group.id)

const normalizeDate = value => {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export const buildPostDraftPayload = (post = {}) => ({
  title: post.title || '',
  details: post.details || '',
  type: post.type || '',
  topics: serializeTopics(post.topics),
  groups: serializeGroupIds(post.groups),
  isPublic: !!post.isPublic,
  location: post.location || '',
  locationId: post.locationId || null,
  meetingLink: post.meetingLink || '',
  linkPreview: post.linkPreview || null,
  linkPreviewFeatured: !!post.linkPreviewFeatured,
  skipLinkPreview: !!post.skipLinkPreview,
  acceptContributions: !!post.acceptContributions,
  completionAction: post.completionAction || null,
  completionActionSettings: post.completionActionSettings || null,
  proposalOptions: (post.proposalOptions || []).map(option => ({ ...option })),
  startTime: normalizeDate(post.startTime),
  endTime: normalizeDate(post.endTime),
  timezone: post.timezone || '',
  donationsLink: post.donationsLink || '',
  projectManagementLink: post.projectManagementLink || '',
  quorum: post.quorum || 0,
  votingMethod: post.votingMethod || null,
  sendAnnouncement: !!post.sendAnnouncement,
  trackId: post.trackId || null
})

export const mergeDraftIntoPost = (base, draft, groupOptions = []) => {
  if (!draft) return base
  const sameGroupId = (a, b) => a != null && b != null && String(a) === String(b)
  const resolveGroup = (id) => groupOptions.find(group => sameGroupId(group.id, id)) || base.groups?.find(group => sameGroupId(group.id, id)) || { id }
  const draftGroups = Array.isArray(draft.groups) && draft.groups.length > 0
    ? draft.groups.map(resolveGroup)
    : base.groups
  return {
    ...base,
    ...draft,
    topics: draft.topics?.length ? draft.topics.map(topic => ({ ...topic })) : base.topics,
    groups: draftGroups,
    proposalOptions: draft.proposalOptions?.length ? draft.proposalOptions.map(option => ({ ...option })) : base.proposalOptions,
    startTime: draft.startTime ? new Date(draft.startTime) : base.startTime,
    endTime: draft.endTime ? new Date(draft.endTime) : base.endTime
  }
}
