import { create } from 'zustand'
import { uniqBy, isEmpty } from 'lodash/fp'
import { TextHelpers } from '@hylo/shared'
import PostPresenter from '@hylo/presenters/PostPresenter'

// Get timezone using Intl API (works in React Native)
const getCurrentTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch (e) {
    return 'UTC' // fallback
  }
}

const initialState = {
  type: 'discussion',
  title: null,
  details: null,
  topics: [],
  members: { items: [] },
  startTime: null,
  endTime: null,
  timezone: getCurrentTimezone(),
  groups: [],
  location: null,
  locationObject: null,
  donationsLink: null,
  projectManagementLink: null,
  isPublic: false,
  announcement: false,
  attachments: [],
  images: [],
  files: [],
  postMemberships: [],
  fundingRoundId: null
}

export const usePostEditorStore = create((set, get) => {
  // Wrapped setter that ensures all updates pass through PostPresenter
  const updatePost = updates => {
    set((state) => ({
      post: PostPresenter({ ...state.post, ...updates })
    }))
  }

  return {
    post: PostPresenter(initialState),

    updatePost,

    resetPost: () => {
      set(() => ({
        post: PostPresenter(initialState)
      }))
    },

    isValid: () => {
      const { type, title, groups, startTime, endTime, donationsLink, projectManagementLink, getAttachments } = get().post
      const attachmentsLoading = getAttachments().some(attachment => !attachment?.url)

      return (
        title &&
        title.length >= 1 &&
        !attachmentsLoading &&
        !isEmpty(groups) &&
        (type !== 'event' || (startTime && endTime)) &&
        (!donationsLink || TextHelpers.sanitizeURL(donationsLink)) &&
        (!projectManagementLink || TextHelpers.sanitizeURL(projectManagementLink))
      )
    },

    preparePostData: ({ canHaveTimeframe, details }) => {
      const post = get().post
      return {
        id: post.id,
        type: post.type,
        details,
        groupIds: post.groups.map(c => c.id),
        memberIds: post.members.items.map(m => m.id),
        fileUrls: post.getFileUrls(),
        imageUrls: post.getImageUrls(),
        isPublic: post.isPublic,
        title: post.title,
        announcement: post.announcement,
        topicNames: post.topics.map(t => t.name),
        startTime: !canHaveTimeframe ? null : post.startTime && post.startTime.getTime().valueOf(),
        endTime: !canHaveTimeframe ? null : post.endTime && post.endTime.getTime().valueOf(),
        timezone: post.timezone,
        location: post.location,
        projectManagementLink: TextHelpers.sanitizeURL(post.projectManagementLink),
        donationsLink: TextHelpers.sanitizeURL(post.donationsLink),
        locationId: post?.locationObject?.id || null,
        linkPreviewId: post?.linkPreview?.id,
        linkPreviewFeatured: post?.linkPreviewFeatured,
        fundingRoundId: post.fundingRoundId
      }
    },

    togglePublicPost: () => updatePost({
      isPublic: !get().post.isPublic
    }),

    toggleAnnouncement: () => updatePost({
      announcement: !get().post.announcement
    }),

    addGroup: (group) => updatePost({
      groups: uniqBy(c => c.id, [...get().post.groups, group])
    }),

    removeGroup: (groupSlug) => updatePost({
      groups: get().post.groups.filter(group => group.slug !== groupSlug)
    }),

    updateLocation: (locationObject) => updatePost({
      location: locationObject.fullText,
      locationObject: locationObject?.id && locationObject
    }),

    addTopic: topic => updatePost({
      topics: uniqBy(t => t.name, [...get().post.topics, topic]).slice(0, 3)
    }),

    removeTopic: topic => updatePost({
      topics: get().post.topics.filter(t => t.id !== topic.id)
    }),

    addAttachment: (type, attachment) => updatePost({
      attachments: [
        ...get().post.attachments.filter(a => a.local !== attachment.local),
        { type, ...attachment }
      ]
    }),

    removeAttachment: (type, attachmentToRemove) => updatePost({
      attachments: get().post.attachments.filter(
        attachment => !(attachment.local === attachmentToRemove.local && attachment.type === type)
      )
    })
  }
})
