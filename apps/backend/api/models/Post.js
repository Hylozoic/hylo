/* globals _ */

import data from '@emoji-mart/data'
import { init, getEmojiDataFromNative } from 'emoji-mart'
import { difference, filter, get, omitBy, uniqBy, isEmpty, intersection, isUndefined, pick } from 'lodash/fp'
import { DateTime } from 'luxon'
import format from 'pg-format'
import { flatten, sortBy } from 'lodash'
import { TextHelpers, DateTimeHelpers } from '@hylo/shared'
import ical, { ICalEventStatus, ICalCalendarMethod } from 'ical-generator'
import fetch from 'node-fetch'
import { postRoom, pushToSockets } from '../services/Websockets'
import { fulfill, unfulfill } from './post/fulfillPost'
import EnsureLoad from './mixins/EnsureLoad'
import { countTotal } from '../../lib/util/knex'
import { refineMany, refineOne } from './util/relations'
import ProjectMixin from './project/mixin'
import EventMixin from './event/mixin'
import * as RichText from '../services/RichText'
import { defaultTimezone } from '../../lib/group/digest2/util'
import { publishPostUpdate } from '../../lib/postSubscriptionPublisher'

init({ data })

export const POSTS_USERS_ATTR_UPDATE_WHITELIST = [
  'project_role_id',
  'following',
  'active',
  'clickthrough'
]

const commentersQuery = (limit, post, currentUserId) => q => {
  q.select('users.*', 'comments.user_id')
  q.join('comments', 'comments.user_id', 'users.id')

  q.where({
    'comments.post_id': post.id,
    'comments.active': true
  })

  if (currentUserId) {
    q.whereNotIn('users.id', BlockedUser.blockedFor(currentUserId))
    q.orderBy(bookshelf.knex.raw(`case when user_id = ${currentUserId} then -1 else user_id end`))
  }

  q.groupBy('users.id', 'comments.user_id')
  if (limit) q.limit(limit)
}

module.exports = bookshelf.Model.extend(Object.assign({
  tableName: 'posts',
  requireFetch: false,
  hasTimestamps: true,

  _localId: null, // Used to store the localId of the post coming from the client and passed back to the client, for optimistic updates

  // Instance Methods

  initialize: function () {
    this._cachedPostUsers = {}
  },

  // Simple attribute getters

  getLocalId: function () {
    return this._localId
  },

  setLocalId: function (value) {
    this._localId = value
    return this
  },

  // This should be always used when accessing this attribute
  details: function (forUserId) {
    return RichText.processHTML(this.get('description'), { forUserId })
  },

  description: function (forUserId) {
    console.warn('Deprecation warning: Post#description called but has been replaced by Post#details')
    return this.details(forUserId)
  },

  title: function () {
    return this.get('name')
  },

  // To handle posts without a name/title
  summary: function () {
    return this.get('name') || TextHelpers.presentHTMLToText(this.details(), { truncate: 80 })
  },

  isPublic: function () {
    return this.get('is_public')
  },

  isChat: function () {
    return this.get('type') === Post.Type.CHAT
  },

  isProposal: function () {
    return this.get('type') === Post.Type.PROPOSAL
  },

  isThread: function () {
    return this.get('type') === Post.Type.THREAD
  },

  isWelcome: function () {
    return this.get('type') === Post.Type.WELCOME
  },

  flaggedGroups: function () {
    return this.get('flagged_groups') || []
  },

  commentsTotal: function () {
    return this.get('num_comments')
  },

  commentersTotal: function () {
    return this.get('num_commenters')
  },

  peopleReactedTotal: function () {
    return this.get('num_people_reacts')
  },

  // Relations

  activities: function () {
    return this.hasMany(Activity)
  },

  collections: function () {
    return this.belongsToMany(Collection).through(CollectionsPost)
  },

  collectionsPosts: function () {
    return this.hasMany(CollectionsPost, 'post_id')
  },

  completionResponses: function () {
    return this.hasMany(PostUser, 'post_id').query(q => {
      q.where({ active: true })
      q.whereNotNull('completed_at')
    })
  },

  contributions: function () {
    return this.hasMany(Contribution, 'post_id')
  },

  followers: function () {
    return this.belongsToMany(User).through(PostUser)
      // .withPivot(['last_read_at', 'clickthrough']) // TODO COMOD: does not seem to work
      .withPivot(['last_read_at'])
      .where({ following: true, 'posts_users.active': true, 'users.active': true })
  },

  groups: function () {
    return this.belongsToMany(Group).through(PostMembership)
      .query({ where: { 'groups.active': true } })
  },

  async isFollowed (userId) {
    const pu = await PostUser.find(this.id, userId)
    return !!(pu && pu.get('following'))
  },

  comments: function () {
    return this.hasMany(Comment, 'post_id').query({
      where: {
        'comments.active': true,
        'comments.comment_id': null
      }
    })
  },

  linkPreview: function () {
    return this.belongsTo(LinkPreview)
  },

  locationObject: function () {
    return this.isChat() ? false : this.belongsTo(Location, 'location_id')
  },

  media: function (type) {
    const relation = this.hasMany(Media)
    return type ? relation.query({ where: { type } }) : relation
  },

  moderationActions: function () {
    return this.hasMany(ModerationAction)
  },

  postMemberships: function () {
    return this.hasMany(PostMembership, 'post_id')
  },

  postUsers: function () {
    return this.hasMany(PostUser, 'post_id')
  },

  loadPostInfoForUser: async function (userId, opts = {}) {
    if (userId && this._cachedPostUsers[userId]) {
      return this._cachedPostUsers[userId]
    }
    const pu = await this.postUsers().query(q => q.where('user_id', userId)).fetchOne(opts)
    this._cachedPostUsers[userId] = pu
    return pu
  },

  projectContributions: function () {
    return this.hasMany(ProjectContribution)
  },

  proposalOptions: function () {
    return this.get('type') === Post.Type.PROPOSAL ? this.hasMany(ProposalOption) : null
  },

  proposalVotes: function () {
    return this.get('type') === Post.Type.PROPOSAL ? this.hasMany(ProposalVote) : null
  },

  reactions: function () {
    return this.hasMany(Reaction, 'entity_id').where({ 'reactions.entity_type': 'post' })
  },

  responders: function () {
    return this.belongsToMany(User).through(EventResponse)
  },

  relatedUsers: function () {
    return this.belongsToMany(User, 'posts_about_users')
  },

  // should only be one of these per post
  selectedTags: function () {
    return this.belongsToMany(Tag).through(PostTag).withPivot('selected')
      .query({ where: { selected: true } })
  },

  tags: function () {
    return this.belongsToMany(Tag).through(PostTag).withPivot('selected')
  },

  tracks: function () {
    return this.belongsToMany(Track, 'tracks_posts')
  },

  user: function () {
    return this.belongsTo(User)
  },

  reactionsForUser: function (userId, emojiFull) {
    const q = this.reactions()
    if (userId) {
      q.query({ where: { 'reactions.user_id': userId } })
    }

    if (emojiFull) {
      q.query({ where: { 'reactions.emoji_full': emojiFull } })
    }

    return q
  },

  // TODO: this is confusing and we are not using, remove for now?
  children: function () {
    return this.hasMany(Post, 'parent_post_id')
      .query({ where: { active: true } })
  },

  parent: function () {
    return this.belongsTo(Post, 'parent_post_id')
  },

  getTagsInComments: function (opts) {
    // this is part of the 'taggable' interface, shared with Comment
    return this.load('comments.tags', opts)
      .then(() => uniqBy('id', flatten(this.relations.comments.map(c => c.relations.tags.models))))
  },

  getCommenters: function (first, currentUserId) {
    return User.query(commentersQuery(first, this, currentUserId)).fetchAll()
  },

  getCommentersTotal: function (currentUserId) {
    return countTotal(User.query(commentersQuery(null, this, currentUserId)).query(), 'users')
      .then(result => {
        if (isEmpty(result)) {
          return 0
        } else {
          return result[0].total
        }
      })
  },

  // Emulate the graphql request for a post in the feed so the feed can be
  // updated via socket. Some fields omitted.
  // TODO: if we were in a position to avoid duplicating the graphql layer
  // here, that'd be grand.
  getNewPostSocketPayload: function () {
    const { media, groups, linkPreview, tags, user, proposalOptions } = this.relations

    const creator = refineOne(user, ['id', 'name', 'avatar_url'])
    const topics = refineMany(tags, ['id', 'name'])

    // TODO: Sanitization -- sanitize details here if not passing through `text` getter
    return Object.assign({},
      refineOne(
        this,
        [
          'announcement',
          'created_at',
          'description',
          'end_time',
          'id',
          'is_public',
          'location',
          'name',
          'num_people_reacts',
          'num_votes',
          'proposalStatus',
          'proposalOutcome',
          'start_time',
          'timezone',
          'type',
          'updated_at',
          'votingMethod'
        ],
        { name: 'title', num_people_reacts: 'peopleReactedTotal', num_votes: 'votesTotal' }
      ),
      {
        attachments: refineMany(media, ['id', 'type', 'url']),
        // Shouldn't have commenters immediately after creation
        commenters: [],
        commentsTotal: 0,
        creator,
        details: this.details(),
        groups: refineMany(groups, ['id', 'name', 'slug']),
        linkPreview: refineOne(linkPreview, ['id', 'image_url', 'title', 'description', 'url']),
        proposalOptions,
        proposalVotes: [],
        topics
      }
    )
  },

  iCalUid: function() {
    return `event-${this.id}-hylo.com`
  },

  // for event objects, for use in icalendar
  // must eager load the user relation
  getCalEventData: async function (eventInvitation, forUserId) {
    const organizer = await this.user().fetch()

    return {
      summary: this.title(),
      description: TextHelpers.presentHTMLToText(this.details(forUserId)),
      location: this.get('location'),
      start: this.get('start_time'),
      end: this.get('end_time'),
      timezone: this.get('timezone'),
      status: eventInvitation.notGoing() ? ICalEventStatus.CANCELLED : ICalEventStatus.CONFIRMED,
      method: eventInvitation.notGoing() ? ICalCalendarMethod.CANCEL : ICalCalendarMethod.REQUEST,
      sequence: eventInvitation.getIcalSequence(),
      uid: this.iCalUid(),
      organizer: {
        name: organizer.get('name'),
        email: organizer.get('email')
      }
    }
  },

  // for event objects, for use in icalendar
  // must eager load the user relation
  getCalEventCancelData: async function (eventInvitation) {
    return {
      summary: this.title(),
      status: ICalEventStatus.CANCELLED,
      method: ICalCalendarMethod.CANCEL,
      sequence: eventInvitation.getIcalSequence(),
      uid: this.iCalUid()
    }
  },

  async sendEventRsvpEmail (eventInvitation, eventChanges = {}) {
    const cal = ical()
    const user = await eventInvitation.user().fetch()
    const calEvent = this.getCalEventData(eventInvitation, user.id)
    cal.method(calEvent.method)
    cal.createEvent(calEvent).uid(calEvent.uid)
    await this.load('groups')
    const groupNames = this.relations.groups.map(g => g.get('name')).join(', ')

    const clickthroughParams = '?' + new URLSearchParams({
      ctt: 'event_rsvp',
      cti: user.id
    }).toString()

    const emailTemplate = eventChanges.start_time || eventChanges.end_time || eventChanges.location ? 'sendEventUpdateEmail' : 'sendEventRsvpEmail'

    Queue.classMethod('Email', emailTemplate, {
      email: user.get('email'),
      version: 'default',
      data: {
        date: DateTimeHelpers.formatDatePair({start: this.get('start_time'), end: this.get('end_time'), timezone: this.get('timezone')}),
        user_name: user.get('name'),
        event_name: this.title(),
        event_description: this.details(),
        event_location: this.get('location'),
        event_url: Frontend.Route.post(this, this.relations.groups.first(), clickthroughParams),
        response: eventInvitation.getHumanResponse(),
        group_names: groupNames,
        newDate: DateTimeHelpers.formatDatePair({start: eventChanges.start_time, end: eventChanges.end_time, timezone: this.get('timezone')}),
        newLocation: eventChanges.location
      },
      files: [
        {
          id: 'invite.ics',
          data: Buffer.from(cal.toString(), 'utf8').toString('base64')
        }
      ]
    }).then(() => {
      // update the ical sequence number, no need to await
      eventInvitation.incrementIcalSequence()
    })
  },

  async sendEventCancelEmail (eventInvitation) {
    const cal = ical()
    const user = await eventInvitation.user().fetch()
    const calEvent = this.getCalEventCancelData(eventInvitation)
    cal.method(calEvent.method)
    cal.createEvent(calEvent).uid(calEvent.uid)
    const groupNames = this.relations.groups?.map(g => g.get('name')).join(', ')

    Queue.classMethod('Email', 'sendEventCancelEmail', {
      email: user.get('email'),
      version: 'default',
      data: {
        user_name: user.get('name'),
        event_name: this.title(),
        event_description: this.details(),
        event_location: this.get('location'),
        group_names: groupNames
      },
      files: [
        {
          id: 'invite.ics',
          data: Buffer.from(cal.toString(), 'utf8').toString('base64')
        }
      ]
    })
  },

  async clickthroughForUser (userId) {
    if (!userId) return null
    const pu = await this.loadPostInfoForUser(userId)
    return (pu && pu.get('clickthrough')) || null
  },

  async lastReadAtForUser (userId) {
    if (!userId) return new Date(0)
    const pu = await this.loadPostInfoForUser(userId)
    return new Date((pu && pu.get('last_read_at')) || 0)
  },

  async completedAtForUser (userId) {
    if (!userId || this.get('type') !== Post.Type.ACTION) return null
    const pu = await this.loadPostInfoForUser(userId)
    return (pu && pu.get('completed_at')) || null
  },

  async completionResponseForUser (userId) {
    if (!userId || this.get('type') !== Post.Type.ACTION) return null
    const pu = await this.loadPostInfoForUser(userId)
    return (pu && pu.get('completion_response')) || null
  },

  presentForEmail: function ({ clickthroughParams = '', context, group, type = 'full', locale }) {
    const { media, tags, linkPreview, user } = this.relations
    const slug = group?.get('slug')

    return {
      id: parseInt(this.id),
      announcement: this.get('announcement'),
      comments: [],
      day: type !== 'oneline' && this.get('start_time') && DateTimeHelpers.getDayFromDate(this.get('start_time'), this.get('timezone')),
      details: type !== 'oneline' && RichText.qualifyLinks(this.details(), slug),
      end_time: type === 'oneline' && this.get('end_time') && DateTimeHelpers.formatDatePair(this.get('end_time'), null, false, this.get('timezone'), locale),
      link_preview: type !== 'oneline' && linkPreview && linkPreview.id &&
        linkPreview.pick('title', 'description', 'url', 'image_url'),
      location: type !== 'oneline' && this.get('location'),
      image_url: type !== 'oneline' && media?.filter(m => m.get('type') === 'image')?.[0]?.get(type === 'full' ? 'url' : 'thumbnail_url'), // Thumbail for digest
      month: type !== 'oneline' && this.get('start_time') && DateTimeHelpers.getMonthFromDate(this.get('start_time'), this.get('timezone')),
      topic_name: type !== 'oneline' && this.get('type') === 'chat' ? tags?.first()?.get('name') : '',
      type: this.get('type'),
      start_time: type === 'oneline' && this.get('start_time') && DateTimeHelpers.formatDatePair(this.get('start_time'), null, false, this.get('timezone'), locale),
      title: this.summary(),
      unfollow_url: Frontend.Route.unfollow(this, group) + clickthroughParams,
      user: {
        id: user.id,
        name: user.get('name'),
        avatar_url: user.get('avatar_url'),
        profile_url: Frontend.Route.profile(user) + clickthroughParams
      },
      url: context ? Frontend.Route.mapPost(this, context, slug) + clickthroughParams : Frontend.Route.post(this, group) + clickthroughParams,
      when: this.get('start_time') && DateTimeHelpers.formatDatePair({ start: this.get('start_time'), end: this.get('end_time'), timezone: this.get('timezone') })
    }
  },

  totalContributions: async function () {
    await this.load('projectContributions')
    return this.relations.projectContributions.models.reduce((total, contribution) => total + contribution.get('amount'), 0)
  },

  unreadCountForUser: function (userId) {
    return this.lastReadAtForUser(userId)
      .then(date => {
        if (date > this.get('updated_at')) return 0
        return Aggregate.count(this.comments().query(q =>
          q.where('created_at', '>', date)))
      })
  },

  // ****** Setters ******//

  async addFollowers (usersOrIds, attrs = {}, { transacting } = {}) {
    const updatedAttribs = Object.assign(
      { active: true, following: true },
      pick(POSTS_USERS_ATTR_UPDATE_WHITELIST, omitBy(isUndefined, attrs))
    )

    const userIds = usersOrIds.map(x => x instanceof User ? x.id : x)
    const existingFollowers = await this.postUsers()
      .query(q => q.whereIn('user_id', userIds)).fetch({ transacting })
    const existingUserIds = existingFollowers.pluck('user_id')
    const newUserIds = difference(userIds, existingUserIds)
    const updatedFollowers = await this.updateFollowers(existingUserIds, updatedAttribs, { transacting })
    const newFollowers = []
    for (const id of newUserIds) {
      const follower = await this.postUsers().create(
        Object.assign({}, updatedAttribs, {
          user_id: id,
          created_at: new Date()
        }), { transacting })
      newFollowers.push(follower)
    }
    return updatedFollowers.concat(newFollowers)
  },

  async addProposalVote ({ userId, optionId }) {
    const result = await ProposalVote.forge({ post_id: this.id, user_id: userId, option_id: optionId, created_at: new Date() }).save()
    Post.afterRelatedMutation(this.id, { changeContext: 'vote' })
    return result
  },

  async removeFollowers (usersOrIds, { transacting } = {}) {
    return this.updateFollowers(usersOrIds, { active: false }, { transacting })
  },

  async removeProposalVote ({ userId, optionId }) {
    const vote = await ProposalVote.query({ where: { user_id: userId, option_id: optionId } }).fetch()
    const result = await vote.destroy()
    Post.afterRelatedMutation(this.id, { changeContext: 'vote' })
    return result
  },

  async setProposalOptions ({ options = [], userId, opts = {} }) {
    opts.transacting ||= { transacting: false }
    const deleteQuery = format('DELETE FROM proposal_options WHERE post_id = %L', this.id)

    const insertValues = options.map(option => {
      return [
        this.id,
        option.text,
        option.color || '',
        option.emoji || ''
      ]
    })

    const insertQuery = format('INSERT INTO proposal_options (post_id, text, color, emoji) VALUES %L RETURNING id', insertValues)

    const fullQuery = `
    BEGIN;
    ${deleteQuery};
    ${insertQuery};
    COMMIT;
`
    const result = await bookshelf.knex.raw(fullQuery).transacting(opts.transacting)
    Post.afterRelatedMutation(this.id, { changeContext: 'vote' })
    return result
  },

  async swapProposalVote ({ userId, removeOptionId, addOptionId }) {
    await this.removeProposalVote({ userId, optionId: removeOptionId })
    return this.addProposalVote({ userId, optionId: addOptionId })
  },

  async updateFollowers (usersOrIds, attrs, { transacting } = {}) {
    if (usersOrIds.length === 0) return []
    const userIds = usersOrIds.map(x => x instanceof User ? x.id : x)
    const existingFollowers = await this.postUsers()
      .query(q => q.whereIn('user_id', userIds)).fetch({ transacting })
    const updatedAttribs = pick(POSTS_USERS_ATTR_UPDATE_WHITELIST, omitBy(isUndefined, attrs))
    return Promise.map(existingFollowers.models, postUser => postUser.updateAndSave(updatedAttribs, { transacting }))
  },

  async updateProposalOptions ({ options = [], userId, opts = {} }) {
    opts.transacting ||= { transacting: false }
    const existingOptions = await this.proposalOptions().fetch({ transacting: opts.transacting, require: false })
    const existingOptionIds = existingOptions.pluck('id')

    // Add activities for vote reset
    if (options.length > 0 && existingOptionIds.length > 0) {
      await this.createVoteResetActivities(opts.transacting)
    }

    // Delete ALL votes any time options are updated
    if (options.length > 0 && existingOptionIds.length > 0) {
      const deleteVotesQuery = `
        DELETE FROM proposal_votes
        WHERE option_id IN (${existingOptionIds.join(', ')});
      `
      await bookshelf.knex.raw(deleteVotesQuery).transacting(opts.transacting)
    }
    // Delete all options and start fresh
    if (options.length > 0 && existingOptionIds.length > 0) {
      const deleteQuery = `
        DELETE FROM proposal_options
        WHERE id IN (${existingOptionIds.join(', ')});
      `
      await bookshelf.knex.raw(deleteQuery).transacting(opts.transacting)
    }

    // Execute the insert query for options passed in
    if (options.length > 0) {
      await bookshelf.knex('proposal_options').insert(options.map(option => {
        return { ...option, post_id: this.id }
      })).transacting(opts.transacting)
    }

    // Trigger post pub/sub update after proposal options change
    Post.afterRelatedMutation(this.id, { changeContext: 'vote' })

    // Return a resolved promise
    return Promise.resolve()
  },

  complete (userId, completionResponse, trx) {
    const runInTransaction = async (transaction) => {
      let pu = await this.loadPostInfoForUser(userId, { transacting: transaction })
      let completedBefore = false
      if (pu) {
        if (pu.get('completed_at')) {
          completedBefore = true
        }
        await pu.save({ completed_at: new Date(), completion_response: completionResponse }, { transacting: transaction })
      } else {
        pu = await this.postUsers().create({ user_id: userId, created_at: new Date(), completed_at: new Date(), completion_response: completionResponse }, { transacting: transaction })
      }

      if (!completedBefore) {
        await this.save({ num_people_completed: this.get('num_people_completed') + 1 }, { transacting: transaction })
        Queue.classMethod('Post', 'checkCompletedTracks', { userId, postId: this.id })
      }

      return pu
    }

    return trx ? runInTransaction(trx) : bookshelf.transaction(runInTransaction)
  },

  async markAsRead (userId) {
    const pu = await this.loadPostInfoForUser(userId)
    // XXX: don't know why we need to save the completion_response here but it errors without
    return pu.save({ last_read_at: new Date(), completion_response: JSON.stringify(pu.get('completion_response')) })
  },

  pushTypingToSockets: function (userId, userName, isTyping, socketToExclude) {
    pushToSockets(postRoom(this.id), 'userTyping', { userId, userName, isTyping }, socketToExclude)
  },

  copy: function (attrs) {
    const that = this.clone()
    _.merge(that.attributes, Post.newPostAttrs(), attrs)
    delete that.id
    delete that.attributes.id
    that._previousAttributes = {}
    that.changed = {}
    return that
  },

  createActivities: async function (trx) {
    await this.load(['groups', 'tags'], { transacting: trx })
    const { tags, groups } = this.relations
    let activitiesToCreate = []

    const mentions = RichText.getUserMentions(this.details())
    const mentioned = mentions.map(userId => ({
      reader_id: userId,
      post_id: this.id,
      actor_id: this.get('user_id'),
      reason: 'mention'
    }))
    activitiesToCreate = activitiesToCreate.concat(mentioned)

    // Activities get created for every chat or post, and then we decide whether to send notifications for them in Activity.generateNotificationMedia
    if (this.get('type') === Post.Type.CHAT) {
      const tagFollows = await TagFollow.query(qb => {
        qb.join('group_memberships', 'group_memberships.group_id', 'tag_follows.group_id')
        qb.where('group_memberships.active', true)
        qb.whereRaw('group_memberships.user_id = tag_follows.user_id')
        qb.whereIn('tag_id', tags.map('id'))
        qb.whereIn('tag_follows.group_id', groups.map('id'))
      })
        .fetchAll({ withRelated: ['tag'], transacting: trx })

      const tagFollowers = tagFollows.map(tagFollow => ({
        reader_id: tagFollow.get('user_id'),
        post_id: this.id,
        actor_id: this.get('user_id'),
        group_id: tagFollow.get('group_id'),
        reason: `chat: ${tagFollow.relations.tag.get('name')}`
      }))

      activitiesToCreate = activitiesToCreate.concat(tagFollowers)
    } else if (this.get('type') !== Post.Type.ACTION) {
      // Non-chat posts are sent to all members of the groups the post is in
      // XXX: no notifications sent for Actions right now
      const members = await Promise.all(groups.map(async group => {
        const userIds = await group.members().fetch().then(u => u.pluck('id'))
        const newPosts = userIds.map(userId => ({
          reader_id: userId,
          post_id: this.id,
          actor_id: this.get('user_id'),
          group_id: group.id,
          reason: `newPost: ${group.id}`
        }))

        // TODO: RESP. moderators can also make announcements?
        const hasAdministration = await GroupMembership.hasResponsibility(this.get('user_id'), group, Responsibility.constants.RESP_ADMINISTRATION)
        if (this.get('announcement') && hasAdministration) {
          const announcees = userIds.map(userId => ({
            reader_id: userId,
            post_id: this.id,
            actor_id: this.get('user_id'),
            group_id: group.id,
            reason: `announcement: ${group.id}`
          }))
          return newPosts.concat(announcees)
        }

        return newPosts
      }))

      activitiesToCreate = activitiesToCreate.concat(flatten(members))
    }

    const eventInvitations = await EventInvitation.query(qb => {
      qb.where('event_id', this.id)
    })
      .fetchAll({ transacting: trx })

    const invitees = eventInvitations.map(eventInvitation => ({
      reader_id: eventInvitation.get('user_id'),
      post_id: this.id,
      actor_id: eventInvitation.get('inviter_id'),
      reason: 'eventInvitation'
    }))
    activitiesToCreate = activitiesToCreate.concat(invitees)

    activitiesToCreate = filter(r => r.reader_id !== this.get('user_id'), activitiesToCreate)

    return Activity.saveForReasons(activitiesToCreate, trx)
  },

  createVoteResetActivities: async function (trx) {
    const voterIds = await ProposalVote.getVoterIdsForPost(this.id).fetchAll({ transacting: trx })
    if (!voterIds || voterIds.length === 0) return Promise.resolve()

    const voters = voterIds.map(voterId => ({
      reader_id: voterId.get('user_id'),
      post_id: this.id,
      actor_id: this.get('user_id'),
      reason: 'voteReset'
    }))

    return Activity.saveForReasons(voters, trx)
  },

  fulfill,

  unfulfill,

  // TODO: Remove this once mobile has been updated
  vote: function (userId, isUpvote) {
    return isUpvote ? this.addReaction(userId, '\uD83D\uDC4D') : this.deleteReaction(userId, '\uD83D\uDC4D')
  },

  addReaction: function (userId, emojiFull) {
    return bookshelf.transaction(async trx => {
      const userReactions = await this.reactionsForUser(userId).fetch()
      const deltaPeople = userReactions?.models?.length > 0 ? 0 : 1
      const userReaction = userReactions.filter(reaction => reaction.attributes?.emoji_full === emojiFull)[0]

      // If user has alread reacted with this emoji on this post then ignore this
      if (userReaction) {
        return false
      }

      const reactionsSummary = this.get('reactions_summary') || {}
      const reactionCount = reactionsSummary[emojiFull] || 0

      const emojiObject = await getEmojiDataFromNative(emojiFull)

      await new Reaction({
        date_reacted: new Date(),
        entity_id: this.id,
        user_id: userId,
        emoji_base: emojiFull,
        emoji_full: emojiFull,
        entity_type: 'post',
        emoji_label: emojiObject.shortcodes
      }).save({}, { transacting: trx })

      await this.addFollowers([userId])

      await this.save({
        num_people_reacts: this.get('num_people_reacts') + deltaPeople,
        reactions_summary: { ...reactionsSummary, [emojiFull]: reactionCount + 1 }
      }, { transacting: trx })

      if (this.get('type') === 'action' && this.get('completion_action') === 'reaction' && !this.get('completed_at')) {
        await this.complete(userId, JSON.stringify([emojiFull]), trx)
      }

      // Trigger post update after reaction added
      Post.afterRelatedMutation(this.id, { changeContext: 'reaction' })

      return this
    })
  },

  deleteReaction: function (userId, emojiFull) {
    return bookshelf.transaction(async trx => {
      const userReactionsModels = await this.reactionsForUser(userId).fetch({ transacting: trx })
      const userReactions = userReactionsModels.models
      const userReaction = userReactions.filter(reaction => reaction.attributes?.emoji_full === emojiFull)[0]
      if (!userReaction) {
        return false
      }

      // is this the last reaction on this post from this user?
      const isLastReaction = userReactions.length === 1

      await userReaction.destroy({ transacting: trx })

      const reactionsSummary = this.get('reactions_summary')
      const reactionCount = reactionsSummary[emojiFull] || 0

      if (isLastReaction) {
        await this.save({
          num_people_reacts: this.get('num_people_reacts') - 1,
          reactions_summary: { ...reactionsSummary, [emojiFull]: reactionCount - 1 }
        }, { transacting: trx })
      } else {
        const reactionsSummary = this.get('reactions_summary')
        await this.save({ reactions_summary: { ...reactionsSummary, [emojiFull]: reactionCount - 1 } }, { transacting: trx })
      }

      // Trigger post update after reaction removed
      Post.afterRelatedMutation(this.id, { changeContext: 'reaction' })

      return this
    })
  },

  updateProposalOutcome: function (proposalOutcome) {
    const result = Post.where({ id: this.id }).query().update({ proposal_outcome: proposalOutcome })
    Post.afterRelatedMutation(this.id, { changeContext: 'vote' })
    return result
  },

  removeFromGroup: function (idOrSlug) {
    return PostMembership.find(this.id, idOrSlug)
      .then(membership => membership.destroy())
  }
}, EnsureLoad, ProjectMixin, EventMixin), {
  // Class Methods

  Type: {
    ACTION: 'action',
    CHAT: 'chat',
    DISCUSSION: 'discussion',
    EVENT: 'event',
    OFFER: 'offer',
    PROJECT: 'project',
    PROPOSAL: 'proposal',
    REQUEST: 'request',
    RESOURCE: 'resource',
    THREAD: 'thread',
    WELCOME: 'welcome'
  },

  Proposal_Status: {
    DISCUSSION: 'discussion',
    COMPLETED: 'completed',
    VOTING: 'voting',
    CASUAL: 'casual'
  },

  Proposal_Outcome: {
    CANCELLED: 'cancelled',
    QUORUM_NOT_MET: 'quorum-not-met',
    INCOMPLETE: 'incomplete',
    IN_PROGRESS: 'in-progress',
    SUCCESSFUL: 'successful',
    TIE: 'tie'
  },

  voting_method: {
    SINGLE: 'single',
    MULTI_UNRESTRICTED: 'multi-unrestricted'
    // unused for now
    // MAJORITY: 'majority', // one option must have more than 50% of votes for the proposal to 'pass',
    // CONSENSUS: 'consensus' // Will not pass if there are any block votes
  },

  // TODO Consider using Visibility property for more granular privacy
  // as our work on Public Posts evolves
  Visibility: {
    DEFAULT: 0,
    PUBLIC_READABLE: 1
  },

  countForUser: function (user, type) {
    const attrs = { user_id: user.id, 'posts.active': true }
    if (type) attrs.type = type
    return this.query().count().where(attrs).then(rows => rows[0].count)
  },

  groupedCountForUser: function (user) {
    return this.query(q => {
      q.join('posts_tags', 'posts.id', 'posts_tags.post_id')
      q.join('tags', 'tags.id', 'posts_tags.tag_id')
      q.whereIn('tags.name', ['request', 'offer', 'resource'])
      q.groupBy('tags.name')
      q.where({ 'posts.user_id': user.id, 'posts.active': true })
      q.select('tags.name')
    }).query().count()
      .then(rows => rows.reduce((m, n) => {
        m[n.name] = n.count
        return m
      }, {}))
  },

  havingExactFollowers (userIds) {
    userIds = sortBy(userIds, Number)
    return this.query(q => {
      q.join('posts_users', 'posts.id', 'posts_users.post_id')
      q.where('posts_users.active', true)
      q.groupBy('posts.id')
      q.having(bookshelf.knex.raw('array_agg(posts_users.user_id order by posts_users.user_id) = ?', [userIds]))
    })
  },

  isVisibleToUser: async function (postId, userId) {
    if (!postId || !userId) return Promise.resolve(false)
    const post = await Post.find(postId)
    if (post.isPublic()) return true

    const postGroupIds = await PostMembership.query()
      .where({ post_id: postId }).pluck('group_id')
    const userGroupIds = await Group.pluckIdsForMember(userId)

    if (intersection(postGroupIds, userGroupIds).length > 0) return true
    if (await post.isFollowed(userId)) return true

    return false
  },

  addToFlaggedGroups: async function ({ groupId, postId }) {
    return bookshelf.knex.raw(`
      UPDATE posts
      SET flagged_groups = array_append(flagged_groups, ?)
      WHERE id = ?
    `, [groupId, postId])
  },

  removeFromFlaggedGroups: async function ({ groupId, postId }) {
    // The regular postgres array_remove function removes *ALL* matches to whatever is passed in.
    // There might be several flags for different violations and we want to be able to remove them one by one if needed
    return bookshelf.knex.raw(`
      UPDATE posts
      SET flagged_groups = (
        SELECT array_agg(elem)
        FROM unnest(flagged_groups) WITH ORDINALITY AS t(elem, ord)
        WHERE elem != ? OR ord != (SELECT min(ord) FROM unnest(flagged_groups) WITH ORDINALITY AS t(elem, ord) WHERE elem = ?)
      )
      WHERE id = ?
    `, [groupId, groupId, postId])
  },

  find: function (id, options) {
    return Post.where({ id, 'posts.active': true }).fetch(options)
  },

  findDeactivated: function (id, options) {
    return Post.where({ id, 'posts.active': false }).fetch(options)
  },

  createdInTimeRange: function (collection, startTime, endTime) {
    if (endTime === undefined) {
      endTime = startTime
      startTime = collection
      collection = Post
    }
    return collection.query(function (qb) {
      qb.whereRaw('posts.created_at between ? and ?', [startTime, endTime])
      qb.where('posts.active', true)
    })
  },

  upcomingPostReminders: async function (group, digestType) {
    const startTime = DateTime.now().setZone(defaultTimezone).toISO()
    // If daily digest show posts that have reminders in the next 2 days
    // If weekly digest show posts that have reminders in the next 7 days
    const endTime = digestType === 'daily'
      ? DateTime.now().setZone(defaultTimezone).plus({ days: 2 }).endOf('day').toISO()
      : DateTime.now().setZone(defaultTimezone).plus({ days: 7 }).endOf('day').toISO()

    const startingSoon = await group.posts().query(function (qb) {
      qb.whereRaw('(posts.start_time between ? and ?)', [startTime, endTime])
      qb.whereIn('posts.type', ['event', 'offer', 'project', 'proposal', 'resource', 'request'])
      qb.where('posts.fulfilled_at', null)
      qb.where('posts.active', true)
      qb.orderBy('posts.start_time', 'asc')
    })
      .fetch({ withRelated: ['user'] })
      .then(get('models'))

    const endingSoon = await group.posts().query(function (qb) {
      qb.whereRaw('(posts.end_time between ? and ?)', [startTime, endTime])
      qb.whereRaw('(posts.start_time < ?)', startTime) // Explicitly cast to timestamp with time zone
      qb.whereIn('posts.type', ['event', 'offer', 'project', 'proposal', 'resource', 'request'])
      qb.where('posts.fulfilled_at', null)
      qb.where('posts.active', true)
      qb.orderBy('posts.end_time', 'asc')
    })
      .fetch({ withRelated: ['user'] })
      .then(get('models'))

    return {
      startingSoon,
      endingSoon
    }
  },

  newPostAttrs: () => ({
    created_at: new Date(),
    updated_at: new Date(),
    active: true,
    num_comments: 0,
    num_commenters: 0,
    num_people_reacts: 0
  }),

  create: function (attrs, opts) {
    return Post.forge(_.merge(Post.newPostAttrs(), attrs))
      .save(null, _.pick(opts, 'transacting'))
  },

  async updateFromNewComment ({ postId, commentId }) {
    const where = { post_id: postId, 'comments.active': true }
    const now = new Date()

    await Comment.query().where(where).orderBy('created_at', 'desc').limit(2)
      .pluck('id').then(ids => Promise.all([
        Comment.query().whereIn('id', ids).update('recent', true),
        Comment.query().whereNotIn('id', ids)
          .where({ recent: true, post_id: postId })
          .update('recent', false)
      ]))

    // update num_comments and updated_at
    const numComments = await Aggregate.count(Comment.where(where))
    const post = await Post.find(postId)
    await post.save({
      num_comments: numComments,
      num_commenters: await post.getCommentersTotal(),
      updated_at: now
    })

    // when creating a comment, mark post as read for the commenter
    if (commentId) {
      const comment = await Comment.find(commentId)
      const userId = comment.get('user_id')
      if (userId) {
        await post.markAsRead(userId)
        // If the post is an action and the completion action is to comment,
        // set the completed_at date to now
        if (post.get('type') === 'action' && post.get('completion_action') === 'comment' && !post.get('completed_at')) {
          await post.complete(userId, JSON.stringify([comment.get('text')]))
        }
      }
    }

    // Publish post update after comment changes
    Post.afterRelatedMutation(postId, { changeContext: 'comment' })
  },

  deactivate: postId =>
    bookshelf.transaction(trx =>
      Promise.join(
        Activity.removeForPost(postId, trx),
        Track.removePost(postId, trx),
        Post.where('id', postId).query().update({ active: false, deactivated_at: new Date() }).transacting(trx)
      )),

  createActivities: (opts) =>
    Post.find(opts.postId).then(post => post &&
      bookshelf.transaction(trx => post.createActivities(trx))),

  // Check if completing this post completed any tracks for the user
  checkCompletedTracks: async function ({ userId, postId }) {
    return bookshelf.transaction(async trx => {
      const post = await Post.find(postId, { transacting: trx })
      if (!post || post.get('type') !== 'action') return

      const trackPosts = await TrackPost.where({ post_id: postId }).fetchAll({ transacting: trx })
      const trackIds = trackPosts.pluck('track_id')
      const tracks = await Track.query(q => q.whereIn('id', trackIds)).fetchAll({ transacting: trx })
      for (const track of tracks) {
        const trackActions = await track.posts().fetch({ transacting: trx })
        const completedActionsCount = await PostUser.query(q => {
          q.where('user_id', userId)
          q.whereIn('post_id', trackActions.pluck('post_id'))
          q.whereNotNull('completed_at')
        }).count({ transacting: trx })

        // If completed the track
        if (parseInt(completedActionsCount) === trackActions.length) {
          const trackUser = await TrackUser.where({ track_id: track.id, user_id: userId }).fetch({ transacting: trx })
          if (trackUser.get('completed_at')) {
            // Don't complete the track again if it's already completed
            continue
          }
          await trackUser.save({ completed_at: new Date() }, { transacting: trx })
          await track.save({ num_people_completed: track.get('num_people_completed') + 1 }, { transacting: trx })
          const group = await track.groups().fetchOne({ transacting: trx })
          // See if there is a role/badge for completing the track
          if (track.get('completion_role_id')) {
            if (track.get('completion_role_type') === 'common') {
              await MemberCommonRole.forge({ common_role_id: track.get('completion_role_id'), user_id: userId, group_id: group.id }).save(null, { transacting: trx })
            } else if (track.get('completion_role_type') === 'group') {
              await MemberGroupRole.forge({ group_role_id: track.get('completion_role_id'), user_id: userId, active: true, group_id: group.id }).save(null, { transacting: trx })
            }
          }

          // Create notification activities for the track's group's track managers
          const manageTracksResponsibility = await Responsibility.where({ title: Responsibility.constants.RESP_MANAGE_TRACKS }).fetch({ transacting: trx })
          const stewards = await group.membersWithResponsibilities([manageTracksResponsibility.id]).fetch({ transacting: trx })
          const stewardsIds = stewards.pluck('id')
          const activities = stewardsIds.map(stewardId => ({
            reason: 'trackCompleted',
            actor_id: userId,
            group_id: group.id,
            reader_id: stewardId,
            track_id: track.id
          }))
          await Activity.saveForReasons(activities, { transacting: trx })
        }
      }
    })
  },

  // TODO: remove, unused (??)
  fixTypedPosts: () =>
    bookshelf.transaction(transacting =>
      Tag.whereIn('name', ['request', 'offer', 'resource', 'intention'])
        .fetchAll({ transacting })
        .then(tags => Post.query(q => {
          q.whereIn('type', ['request', 'offer', 'resource', 'intention'])
        }).fetchAll({ withRelated: ['selectedTags', 'tags'], transacting })
          .then(posts => Promise.each(posts.models, post => {
            const untype = () => post.save({ type: null }, { patch: true, transacting })
            if (post.relations.selectedTags.first()) return untype()

            const matches = t => t.get('name') === post.get('type')
            const existingTag = post.relations.tags.find(matches)
            if (existingTag) {
              return PostTag.query()
                .where({ post_id: post.id, tag_id: existingTag.id })
                .update({ selected: true }).transacting(transacting)
                .then(untype)
            }

            return post.selectedTags().attach(tags.find(matches).id, { transacting })
              .then(untype)
          }))
          .then(promises => promises.length))),

  // TODO: does this work?
  notifySlack: ({ postId }) =>
    Post.find(postId, { withRelated: ['groups', 'user', 'relatedUsers'] })
      .then(post => {
        if (!post) return
        const slackCommunities = post.relations.groups.filter(g => g.get('slack_hook_url'))
        return Promise.map(slackCommunities, g => Group.notifySlack(g.id, post))
      }),

  updateProposalStatuses: async () => {
    return bookshelf.knex.raw(
      `UPDATE posts
      SET proposal_status =
          CASE
              WHEN proposal_status NOT IN ('casual', 'completed')
                   AND type = 'proposal'
                   AND CURRENT_TIMESTAMP BETWEEN start_time AND end_time
                   THEN 'voting'
              WHEN proposal_status NOT IN ('casual', 'completed')
                   AND type = 'proposal'
                   AND CURRENT_TIMESTAMP > end_time
                   THEN 'completed'
              ELSE proposal_status
          END
      WHERE type = 'proposal'
        AND proposal_status NOT IN ('casual', 'completed')
        AND start_time IS NOT NULL
        AND end_time IS NOT NULL;`
    )
  },

  // Background task to fire zapier triggers on new_post
  zapierTriggers: async ({ postId }) => {
    const post = await Post.find(postId, { withRelated: ['groups', 'tags', 'user'] })
    if (!post) return

    const groupIds = post.relations.groups.map(g => g.id)
    const zapierTriggers = await ZapierTrigger.forTypeAndGroups('new_post', groupIds).fetchAll()
    if (zapierTriggers && zapierTriggers.length > 0) {
      for (const trigger of zapierTriggers) {
        // Check if this trigger is only for certain post types and if so whether it matches this post type
        if (trigger.get('params')?.types?.length > 0 && !trigger.get('params').types.includes(post.get('type'))) {
          continue
        }

        const entityUrl = Frontend.Route.post(post, post.relations.groups[0])

        const creator = post.relations.user
        const response = await fetch(trigger.get('target_url'), {
          method: 'post',
          body: JSON.stringify({
            id: post.id,
            announcement: post.get('announcement'),
            createdAt: post.get('created_at'),
            creator: { name: creator.get('name'), url: Frontend.Route.profile(creator) },
            details: post.details(),
            endTime: post.get('end_time'),
            isPublic: post.get('is_public'),
            location: post.get('location'),
            startTime: post.get('start_time'),
            timezone: post.get('timezone'),
            title: post.summary(),
            type: post.get('type'),
            url: entityUrl,
            groups: post.relations.groups.map(g => ({ id: g.id, name: g.get('name'), url: Frontend.Route.group(g), postUrl: Frontend.Route.post(post, g) })),
            topics: post.relations.tags.map(t => ({ name: t.get('name') }))
          }),
          headers: { 'Content-Type': 'application/json' }
        })
        // TODO: what to do with the response? check if succeeded or not?
      }
    }
  },

  // Background task to publish post updates to subscriptions
  publishPostUpdates: async ({ postId, options = {} }) => {
    const post = await Post.find(postId, { withRelated: ['groups'] })
    if (!post) return

    if (process.env.NODE_ENV === 'development') {
      console.log(`📡 Background job: Publishing post update for post ${post.id}`)
    }

    try {
      await publishPostUpdate(null, post, options)
    } catch (error) {
      console.error('❌ Error publishing post update in background job:', error)
    }
  },

  // Non-blocking method to trigger post subscription updates
  afterRelatedMutation: function (postId, options = {}) {
    if (!postId) return

    // Use Queue system for non-blocking post subscription publishing
    Queue.classMethod('Post', 'publishPostUpdates', { postId, options }, 0)
  },

  sendEventUpdateRsvps: async function ({ postId, eventChanges }) {
    const post = await Post.find(postId)
    const eventInvitations = await post.eventInvitations().fetch()

    eventInvitations.forEach(eventInvitation => {
      if (!eventInvitation.notGoing()) {
        post.sendEventRsvpEmail(eventInvitation, eventChanges)
      }
    })
  },

  sendEventCancelRsvps: async function ({ postId, eventInvitationFindData }) {
    const post = await Post.findDeactivated(postId)
    for (const eventInvitationData of eventInvitationFindData) {
      const eventInvitation = await EventInvitation.find(eventInvitationData)
      if (eventInvitation && !eventInvitation.notGoing()) {
        post.sendEventCancelEmail(eventInvitation)
      }
    }
  }

})
