import bcrypt from 'bcrypt'
import crypto from 'crypto'
import { has, isEmpty, merge, omit, pick, intersectionBy } from 'lodash'
import fetch from 'node-fetch'
import { v4 as uuidv4 } from 'uuid'
import validator from 'validator'
import { GraphQLError } from 'graphql'
import { Validators } from '@hylo/shared'
import RedisClient from '../services/RedisClient'
import HasSettings from './mixins/HasSettings'
import { findThread } from './post/findOrCreateThread'
import { generateHyloJWT } from '../../lib/HyloJWT'
import MemberCommonRole from './MemberCommonRole'

module.exports = bookshelf.Model.extend(merge({
  tableName: 'users',
  requireFetch: false,
  hasTimestamps: true,

  activity: function () {
    return this.hasMany(Activity, 'reader_id')
  },

  affiliations: function () {
    return this.hasMany(Affiliation).where('is_active', true)
  },

  blockedUsers: function () {
    return this.belongsToMany(User, 'blocked_users', 'user_id', 'blocked_user_id')
  },

  /**
    * For OIDC
    * @param use - can either be "id_token" or "userinfo", depending on
    *   where the specific claims are intended to be put in.
    * @param scope - the intended scope, while oidc-provider will mask
    *   claims depending on the scope automatically you might want to skip
    *   loading some claims from external resources etc. based on this detail
    *   or not return them in id tokens but only userinfo and so on.
    * @param claims {object} - the part of the claims authorization parameter for either
    *   "id_token" or "userinfo" (depends on the "use" param)
    * @param rejected {Array[String]} - claim names that were rejected by the end-user, you might
    *   want to skip loading some claims from external resources or through db projection
    */
  async claims (use, scope, claims, rejected) { // eslint-disable-line no-unused-vars
    // TODO: allow people to ask for specific claims https://github.com/panva/node-oidc-provider/blob/main/docs/README.md#featuresclaimsparameter
    // TODO: need to handle the use parameter?
    // TODO: track specific claims that are rejected by the user, but allow others

    let returnData = {
      sub: this.accountId || this.id // it is essential to always return a sub claim
    }

    if (scope.includes('address')) {
      const loc = await this.locationObject().fetch()
      returnData.address = {
        country: loc.get('country'),
        formatted: this.get('location'),
        locality: loc.get('city'),
        postal_code: loc.get('postcode'),
        region: loc.get('region'),
        street_address: loc.get('address_number') + ' ' + loc.get('address_street')
      }
    }

    if (scope.includes('profile')) {
      returnData = Object.assign(returnData, {
        birthdate: null,
        family_name: null,
        gender: null,
        given_name: null,
        locale: null,
        middle_name: null,
        name: this.get('name'),
        nickname: null,
        picture: this.get('avatar_url'),
        preferred_username: null,
        profile: Frontend.Route.profile(this),
        updated_at: this.get('updated_at'),
        website: this.get('url'),
        zoneinfo: null
      })
    }

    if (scope.includes('email')) {
      returnData = Object.assign(returnData, {
        email: this.get('email'),
        email_verified: this.get('email_validated')
      })
    }

    if (scope.includes('phone')) {
      returnData = Object.assign(returnData, {
        phone_number: this.get('contact_phone'),
        phone_number_verified: false
      })
    }

    return returnData
  },

  comments: function () {
    return this.hasMany(Comment)
      .query(q => {
        // TODO: this breaks recent activity, but it is sketchy to take out here.
        // q.join('posts', 'posts.id', 'comments.post_id')
        q.whereNotIn('posts.user_id', BlockedUser.blockedFor(this.id))
        q.where(function () {
          this.where('posts.type', '!=', Post.Type.THREAD)
            .orWhere('posts.type', null)
        })
      })
  },

  cookieConsent: function () {
    return this.hasOne(CookieConsent, 'user_id')
  },

  commonRoles () {
    return this.belongsToMany(CommonRole)
      .through(MemberCommonRole, 'user_id', 'common_role_id')
  },

  contributions: function () {
    return this.hasMany(Contribution)
  },

  eventsAttending: function () {
    return this.belongsToMany(Post, 'event_invitations', 'user_id', 'event_id')
      .where('posts.end_time', '>', new Date())
      .where('event_invitations.response', 'yes')
  },

  eventsInvitedTo: function () {
    return this.belongsToMany(Post).through(EventInvitation)
  },

  followedPosts () {
    return this.belongsToMany(Post).through(PostUser).query(q => q.where({ 'posts_users.following': true, 'posts_users.active': true }))
  },

  followedTags: function () {
    return this.belongsToMany(Tag).through(TagFollow)
  },

  groups: function () {
    return this.belongsToMany(Group).through(GroupMembership)
      .where('groups.active', true)
      .where('group_memberships.active', true)
  },

  groupJoinQuestionAnswers: function () {
    return this.hasMany(GroupJoinQuestionAnswer)
  },

  groupInvitesPending: function () {
    return this.hasMany(Invitation, 'email', 'email')
      .query({ where: { used_by_id: null, expired_by_id: null } })
      .orderBy('created_at', 'desc')
  },

  groupRoles () {
    return this.belongsToMany(GroupRole)
      .through(MemberGroupRole, 'user_id', 'group_role_id')
      .where('groups_roles.active', true)
  },

  inAppNotifications: function () {
    return this.hasMany(Notification)
      .query({ where: { 'notifications.medium': Notification.MEDIUM.InApp } })
  },

  isTester: function () {
    return User.isTester(this.id)
  },

  joinRequests: function () {
    return this.hasMany(JoinRequest)
  },

  linkedAccounts: function () {
    return this.hasMany(LinkedAccount)
  },

  locationObject: function () {
    return this.belongsTo(Location, 'location_id')
  },

  memberships () {
    return this.hasMany(GroupMembership)
      .query(q => q.leftJoin('groups', 'groups.id', 'group_memberships.group_id')
        .where('group_memberships.active', true)
        .where('groups.active', true)
      )
  },

  membershipCommonRoles () {
    return this.hasMany(MemberCommonRole, 'user_id')
  },

  messageThreads: function () {
    return this.followedPosts().query(q => q.where('type', Post.Type.THREAD))
  },

  moderatedGroupMemberships: function () { // TODO RESP: need to edit this. A helper function has already been created on the Responsibility model, it gets you groupIds and responsibilities tho, need to use that to look up memberships to return
    return this.memberships()
      .where('group_memberships.role', GroupMembership.Role.MODERATOR)
  },

  posts: function () {
    return this.hasMany(Post).query(q => q.where('type', '!=', Post.Type.THREAD))
  },

  postUsers: function () {
    return this.hasMany(PostUser, 'user_id')
  },

  projects: function () {
    // TODO: fix
    return this.hasMany(Post).query(q => q.leftJoin('groups', 'groups.group_data_id', 'posts.id')
      .leftJoin('group_memberships', 'group_memberships.group_id', 'groups.id')
      .whereNotNull('group_memberships.project_role_id')
      .andWhere('group_memberships.user_id', this.id)
      .andWhere('group_memberships.active', true)
    )
  },

  pushNotifications: function () {
    return this.hasMany(PushNotification)
  },

  reactions: function () {
    return this.hasMany(Reaction)
  },

  sentInvitations: function () {
    return this.hasMany(Invitation, 'invited_by_id')
  },

  skills: function () {
    return this.belongsToMany(Skill, 'skills_users').query({ where: { type: Skill.Type.HAS } }).withPivot(['type'])
  },

  skillsToLearn: function () {
    return this.belongsToMany(Skill, 'skills_users').query({ where: { type: Skill.Type.LEARNING } }).withPivot(['type'])
  },

  stripeAccount: function () {
    return this.belongsTo(StripeAccount)
  },

  tagFollows: function () {
    return this.hasMany(TagFollow)
  },

  thanks: function () {
    return this.hasMany(Thank)
  },

  tracksEnrolledIn: function () {
    return this.belongsToMany(Track).through(TrackUser).query(q => {
      q.where('tracks_users.user_id', this.id)
      q.whereNotNull('tracks_users.enrolled_at')
    })
  },

  intercomHash: function () {
    return crypto.createHmac('sha256', process.env.INTERCOM_KEY)
      .update(this.id)
      .digest('hex')
  },

  reactivate: function () {
    return this.save({ active: true })
  },

  deactivate: async function (sessionId) {
    Queue.classMethod('User', 'clearSessionsFor', { userId: this.get('user_id'), sessionId })
    return this.save({ active: false })
  },

  deleteUserMedia: async function () {
    const userId = this.get('id')
    const userUrls = [this.get('banner_url'), this.get('avatar_url')]

    const mediaUrls = await Media.findMediaUrlsForUser(userId)
    const urls = mediaUrls.concat(userUrls)
    Queue.classMethod('Media', 'deleteMediaByUrl', { urls })
  },

  sanelyDeleteUser: async function ({ sessionId, transacting = {} }) {
    /*
      ### List of things to be done on account deletion ###

      - Look up urls for all their possible uploads
      - drop urls from external sources
      - iterate through urls to delete each upload

      - zero out content of their posts and comments
      - remove other references to their user_id
      - wipe their user record!
    */

    await this.deleteUserMedia()
    Queue.classMethod('User', 'clearSessionsFor', { userId: this.get('user_id'), sessionId })
    // TODO RESP: will need to add responsibilies, roles, etc to here, where they are missing (some roles are already handled)
    const query = `
    BEGIN;
    UPDATE posts SET name = 'Post by deleted user', description = '', location = NULL, location_id = NULL WHERE user_id = ${this.id};
    DELETE FROM user_connections WHERE (user_id = ${this.id}) OR (other_user_id = ${this.id});

    UPDATE comments SET text = 'Comment by deleted user' WHERE user_id = ${this.id};

    DELETE FROM thanks WHERE comment_id in (select id from comments WHERE user_id = ${this.id});
    DELETE FROM thanks WHERE thanked_by_id = ${this.id};
    DELETE FROM group_memberships_group_roles WHERE user_id = ${this.id};
    DELETE FROM notifications WHERE activity_id in (select id from activities WHERE reader_id = ${this.id});
    DELETE FROM notifications WHERE activity_id in (select id from activities WHERE actor_id = ${this.id});
    DELETE FROM push_notifications WHERE user_id = ${this.id};
    DELETE FROM activities WHERE actor_id = ${this.id};
    DELETE FROM activities WHERE reader_id = ${this.id};

    DELETE FROM contributions WHERE user_id = ${this.id};
    DELETE FROM devices WHERE user_id = ${this.id};
    DELETE FROM group_invites WHERE used_by_id = ${this.id};
    DELETE FROM group_memberships WHERE user_id = ${this.id};
    DELETE FROM communities_users WHERE user_id = ${this.id};
    DELETE FROM linked_account WHERE user_id = ${this.id};
    DELETE FROM group_join_questions_answers WHERE user_id = ${this.id};
    DELETE FROM join_requests WHERE user_id = ${this.id};
    DELETE FROM skills_users WHERE user_id = ${this.id};
    DELETE FROM posts_about_users WHERE user_id = ${this.id};

    DELETE FROM tag_follows WHERE user_id = ${this.id};
    DELETE FROM user_external_data WHERE user_id = ${this.id};
    DELETE FROM user_post_relevance WHERE user_id = ${this.id};
    DELETE FROM posts_tags WHERE post_id in (select id from posts WHERE user_id = ${this.id});
    DELETE FROM reactions WHERE user_id = ${this.id};

    UPDATE users SET
    active = false,
    settings = NULL,
    name = 'Deleted User',
    avatar_url = NULL,
    bio = NULL,
    banner_url = NULL,
    location = NULL,
    url = NULL,
    tagline = NULL,
    stripe_account_id = NULL,
    location_id = NULL,
    contact_email = NULL,
    contact_phone = NULL,
    email = '${uuidv4()}@hylo.com',
    first_name = NULL,
    last_name = NULL,
    twitter_name = NULL,
    linkedin_url = NULL,
    facebook_url = NULL,
    work = NULL,
    intention = NULL,
    extra_info = NULL
    WHERE id = ${this.id};

    COMMIT;
    `
    return bookshelf.knex.raw(query)
  },

  getLocale: function () {
    return this.getSetting('locale') || 'en'
  },

  joinGroup: async function (group, { role = GroupMembership.Role.DEFAULT, fromInvitation = false, questionAnswers = [], transacting = null } = {}) {
    const memberships = await group.addMembers([this.id],
      {
        role,
        settings: {
          // XXX: A user choosing to join a group has aleady seen/filled out the join questions (enforced on the front-end)
          joinQuestionsAnsweredAt: fromInvitation ? null : new Date(),
          postNotifications: 'all',
          digestFrequency: 'daily',
          sendEmail: true,
          sendPushNotifications: true,
          showJoinForm: true
        }
      },
      { transacting })

    await this.markInvitationsUsed(group.id, transacting)

    // Add join question answers
    for (const qa of questionAnswers) {
      await GroupJoinQuestionAnswer.forge({ group_id: group.id, question_id: qa.questionId, answer: qa.answer, user_id: this.id }).save()
    }

    return memberships[0]
  },

  leaveGroup: async function (group, removedByModerator = false) {
    await group.removeMembers([this.id])

    Queue.classMethod('User', 'afterLeaveGroup', {
      groupId: group.id,
      userId: this.id,
      removedByModerator
    })
  },

  // sanitize certain values before storing them
  setSanely: function (attrs) {
    const saneAttrs = omit(attrs, 'settings')

    if (!isEmpty(saneAttrs.twitter_name)) {
      if (saneAttrs.twitter_name.match(/^\s*$/)) {
        saneAttrs.twitter_name = null
      } else if (saneAttrs.twitter_name.match(/^@/)) {
        saneAttrs.twitter_name = saneAttrs.twitter_name.substring(1)
      }
    }
    const urlAttrs = ['url', 'facebook_url', 'linkedin_url']

    urlAttrs.forEach(key => {
      const normalized = addProtocol(saneAttrs[key])
      if (!isEmpty(normalized)) {
        saneAttrs[key] = normalized
      }
    })

    if (attrs.settings) this.addSetting(attrs.settings)

    return this.set(saneAttrs)
  },

  encryptedEmail: function () {
    return User.encryptEmail(this.get('email'))
  },

  generateTokenContents: function () {
    return `crumbly:${this.id}:${this.get('email')}:${this.get('created_at')}`
  },

  generateJWT: function (data = {}) {
    return generateHyloJWT(this.id, data)
  },

  generateToken: function () {
    const hash = Promise.promisify(bcrypt.hash, bcrypt)
    return hash(this.generateTokenContents(), 10)
  },

  generateTokenSync: function () {
    return bcrypt.hashSync(this.generateTokenContents(), 10)
  },

  checkToken: function (token) {
    const compare = Promise.promisify(bcrypt.compare, bcrypt)
    return compare(this.generateTokenContents(), token)
  },

  sendPushNotification: async function (alert, path) {
    // With the new OneSignal data model (2025), we can send directly to a user by their readerId
    // instead of needing to iterate through individual devices

    const count = await User.unseenThreadCount(this.id)
    const push = await PushNotification.forge({
      alert: alert.substring(0, 255),
      path,
      badge_no: this.get('new_notification_count') + count,
      queued_at: new Date().toISOString(),
      user_id: this.id
    }).save()

    return push.send()
  },

  followDefaultTags: function (groupId, trx) {
    return this.constructor.followDefaultTags(this.id, groupId, trx)
  },

  hasNoAvatar: function () {
    return this.get('avatar_url') === User.gravatar(this.get('email'))
  },

  markInvitationsUsed: function (groupId, trx) {
    const q = Invitation.query()
    if (trx) {
      q.transacting(trx)
    }
    return q.where('group_id', groupId)
      .whereRaw('lower(email) = lower(?)', this.get('email'))
      .update({ used_by_id: this.id, used_at: new Date() })
  },

  setPassword: function (password, sessionId, { transacting } = {}) {
    return LinkedAccount.where({ user_id: this.id, provider_key: 'password' })
      .fetch({ transacting }).then(account => account
        ? account.updatePassword(password, sessionId, { transacting })
        : LinkedAccount.create(this.id, { type: 'password', password, transacting }))
  },

  hasRegistered: async function () {
    await this.load('linkedAccounts')
    return this.relations.linkedAccounts.length > 0
  },

  validateAndSave: function (sessionId, changes) {
    // TODO maybe throw an error if a non-whitelisted field is supplied (besides
    // tags and password, which are used later)
    const whitelist = pick(changes, [
      'avatar_url', 'banner_url', 'bio', 'email', 'contact_email', 'contact_phone',
      'extra_info', 'facebook_url', 'intention', 'linkedin_url', 'location', 'location_id',
      'name', 'password', 'settings', 'tagline', 'twitter_name', 'url', 'work',
      'new_notification_count'
    ])

    return bookshelf.transaction(async (transacting) => {
      await validateUserAttributes(whitelist, { existingUser: this, transacting })

      // we refresh the user's data inside the transaction to avoid a race
      // condition between two updates on the same user that depend upon
      // existing data, e.g. when updating settings
      await this.refresh({ transacting })

      this.setSanely(omit(whitelist, 'password'))

      if (changes.password) {
        await this.setPassword(changes.password, sessionId, { transacting })
      }

      if (!isEmpty(this.changed)) {
        // Save the updated fields to send a Zapier trigger for, before we save and lose the changes
        const changedForTrigger = pick(this.changed, [
          'avatar_url', 'bio', 'contact_email', 'contact_phone',
          'facebook_url', 'linkedin_url', 'location', 'location_id',
          'name', 'tagline', 'twitter_name', 'url'
        ])

        await this.save(Object.assign({ updated_at: new Date() }, this.changed), { patch: true, transacting })

        if (!isEmpty(changedForTrigger)) {
          Queue.classMethod('User', 'afterUpdate', { userId: this.id, changes: changedForTrigger })
        }

        if (changes.settings && changes.settings.signup_in_progress === false) {
          // Send welcome email 2 minutes after signup, to make sure that group membership has been setup if they signup after getting invitation from the group
          Queue.classMethod('User', 'sendWelcomeEmail', { userId: this.id }, 2 * 60 * 1000)
        }
      }
      return this
    })
  },

  enabledNotification (type, medium) {
    let setting

    switch (type) {
      case Notification.TYPE.Message:
        setting = this.getSetting('dm_notifications')
        break
      case Notification.TYPE.Comment:
        setting = this.getSetting('comment_notifications')
        break
      default:
        throw new Error(`unknown notification type: ${type}`)
    }

    return (medium === Notification.MEDIUM.Email &&
             (setting === 'both' || setting === 'email') &&
             (process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true' || User.isTester(this.id))) ||
           (medium === Notification.MEDIUM.Push &&
            (setting === 'both' || setting === 'push') &&
            (process.env.PUSH_NOTIFICATIONS_ENABLED === 'true' || User.isTester(this.id)))
  },

  disableAllNotifications () {
    // TODO: turn off notifictions for all groups? or do we have a user level setting too?
    return this.addSetting({
      digest_frequency: 'never',
      comment_notifications: 'none',
      dm_notifications: 'none',
      post_notifications: 'none'
    }, true)
  },

  unlinkAccount (provider) {
    const fieldName = {
      facebook: 'facebook_url',
      linkedin: 'linkedin_url',
      twitter: 'twitter_name'
    }[provider]

    if (!fieldName) throw new Error(`${provider} not a supported provider`)

    return Promise.join(
      LinkedAccount.query().where({ user_id: this.id, provider_key: provider }).del(),
      this.save({ [fieldName]: null })
    )
  },

  getMessageThreadWith (userId) {
    return findThread([this.id, userId])
  },

  unseenThreadCount () {
    return User.unseenThreadCount(this.id)
  },

  async groupsSharedWithPost (post) {
    const myGroups = await this.groups().fetch()
    await post.load('groups')
    return intersectionBy(post.relations.groups.models, myGroups.models, 'id')
  },

  async groupsSharedWithUser (user) {
    const myGroups = await this.groups().fetch()
    const theirGroups = await user.groups().fetch()
    return intersectionBy(myGroups.models, theirGroups.models, 'id')
  },

  async updateStripeAccount (accountId, refreshToken = '') {
    await this.load('stripeAccount')
    const existingAccount = this.relations.stripeAccount
    const newAccount = await StripeAccount.forge({
      stripe_account_external_id: accountId,
      refresh_token: refreshToken
    }).save()
    return this.save({
      stripe_account_id: newAccount.id
    })
      .then(() => {
        if (existingAccount) {
          return existingAccount.destroy()
        }
      })
  },

  hasStripeAccount () {
    return !!this.get('stripe_account_id')
  }

}, HasSettings), {
  AXOLOTL_ID: '13986',

  authenticate: Promise.method(function (email, password) {
    const compare = Promise.promisify(bcrypt.compare, bcrypt)

    if (!email) throw new GraphQLError('no email provided')
    if (!password) throw new GraphQLError('no password provided')

    return User.query('whereRaw', 'lower(email) = lower(?)', email)
      .fetch({ withRelated: ['linkedAccounts'] })
      .then(function (user) {
        if (!user) throw new GraphQLError('email not found')

        const account = user.relations.linkedAccounts.find(a => a.get('provider_key') === 'password')

        if (!account) {
          const keys = user.relations.linkedAccounts.pluck('provider_key')
          throw new GraphQLError(`password account not found. available: [${keys.join(',')}]`)
        }

        return compare(password, account.get('provider_user_id')).then(function (match) {
          if (!match) throw new GraphQLError('password does not match')

          return user
        })
      })
  }),

  clearSessionsFor: async function ({ userId, sessionId }) {
    const redisClient = RedisClient.create()
    let cursor = 0
    do {
      const [nextCursor, keys] = await redisClient.scan(
        cursor,
        'MATCH',
        `sess:${userId}:*`,
        'COUNT',
        '100'
      )
      cursor = parseInt(nextCursor)

      for (const key of keys) {
        if (key !== 'sess:' + sessionId) {
          await redisClient.del(key)
        }
      }
    } while (cursor !== 0)
  },

  create: function (attributes) {
    const { account, group, role } = attributes

    attributes = merge({
      avatar_url: User.gravatar(attributes.email),
      created_at: new Date(),
      updated_at: new Date(),
      settings: {
        signup_in_progress: true,
        dm_notifications: 'both',
        comment_notifications: 'both'
      },
      active: true
    }, omit(attributes, 'account', 'group', 'role'))

    if (account) {
      merge(
        attributes,
        LinkedAccount.socialMediaAttributes(account.type, account.profile)
      )
    }

    return bookshelf.transaction(transacting =>
      validateUserAttributes(attributes, { transacting })
        .then(() => new User(attributes).save({}, { transacting }))
        .then(async (user) => {
          await Promise.join(
            account && LinkedAccount.create(user.id, account, { transacting }),
            group && group.addMembers([user.id], { role: role || GroupMembership.Role.DEFAULT }, { transacting }),
            group && user.markInvitationsUsed(group.id, transacting)
          )
          return user
        })
    )
  },

  find: function (idEmailOrName, options, activeFilter = true) {
    if (!idEmailOrName) return Promise.resolve(null)

    let q

    if (isNaN(Number(idEmailOrName))) {
      q = User.query(q => {
        q.where(function () {
          this.whereRaw('lower(email) = lower(?)', idEmailOrName)
            .orWhere({ name: idEmailOrName })
        })
      })
    } else {
      q = User.where({ id: idEmailOrName })
    }

    if (activeFilter) return q.where('users.active', true).fetch(options)

    return q.fetch(options)
  },

  named: function (name) {
    return User.where({ name }).fetch()
  },

  createdInTimeRange: function (collection, startTime, endTime) {
    if (endTime === undefined) {
      endTime = startTime
      startTime = collection
      collection = User
    }
    return collection.query(function (qb) {
      qb.whereRaw('users.created_at between ? and ?', [startTime, endTime])
      qb.where('users.active', true)
    })
  },

  isEmailUnique: function (email, excludeEmail, { transacting } = {}) {
    let query = bookshelf.knex('users')
      .whereRaw('lower(email) = lower(?)', email).count('*')
      .transacting(transacting)
    if (excludeEmail) query = query.andWhere('email', '!=', excludeEmail)
    return query.then(rows => Number(rows[0].count) === 0)
  },

  incNewNotificationCount: function (id) {
    return User.query().where({ id }).increment('new_notification_count', 1)
  },

  isTester: function (id) {
    const testerIds = process.env.HYLO_TESTER_IDS ? process.env.HYLO_TESTER_IDS.split(',') : []
    return testerIds.includes(id)
  },

  resetNewNotificationCount: function (id) {
    return User.query().where({ id }).update({ new_notification_count: 0 })
  },

  gravatar: function (email) {
    if (!email) email = ''
    const emailHash = crypto.createHash('md5').update(email).digest('hex')
    return `https://www.gravatar.com/avatar/${emailHash}?d=mm&s=140`
  },

  encryptEmail: function (email) {
    const plaintext = process.env.INBOUND_EMAIL_SALT + email
    return `u=${PlayCrypto.encrypt(plaintext)}@${process.env.INBOUND_EMAIL_DOMAIN}`
  },

  decryptEmail: function (email) {
    const pattern = new RegExp(`u=(\\w+)@${process.env.INBOUND_EMAIL_DOMAIN}`)
    const match = email.match(pattern)
    const hash = match[1]
    const decrypted = PlayCrypto.decrypt(hash)
    const unsalted = decrypted.replace(new RegExp('^' + process.env.INBOUND_EMAIL_SALT), '')
    return unsalted
  },

  sendPushNotification: function (userId, alert, url) {
    return User.find(userId).fetch().sendPushNotification(alert, url)
  },

  followTags: function (userId, groupId, tagIds, trx) {
    return Promise.each(tagIds, id =>
      TagFollow.findOrCreate({
        userId,
        groupId,
        tagId: id,
        isSubscribing: true
      }, { transacting: trx })
        .catch(err => {
          if (!err.message.match(/duplicate key value/)) throw err
        })
    )
  },

  followDefaultTags: function (userId, groupId, trx) {
    return GroupTag.defaults(groupId, trx)
      .then(defaultTags => defaultTags.models.map(t => t.get('tag_id')))
      .then(ids => User.followTags(userId, groupId, ids, trx))
  },

  resetTooltips: function (userId) {
    return User.find(userId)
      .then(user => user.removeSetting('viewedTooltips', true))
  },

  unseenThreadCount: async function (userId) {
    const lastViewed = await User.where('id', userId).query()
      .select(bookshelf.knex.raw("settings->'last_viewed_messages_at' as time"))
      .then(rows => new Date(rows[0].time))

    return PostUser.whereUnread(userId, { afterTime: lastViewed })
      .query(q => {
        q.where('posts.type', Post.Type.THREAD)
        q.where('num_comments', '>', 0)
      })
      .count().then(c => Number(c))
  },

  // Background jobs

  async afterLeaveGroup ({ removedByModerator, groupId, userId }) {
    const zapierTriggers = await ZapierTrigger.forTypeAndGroups('member_leaves', groupId).fetchAll()
    if (zapierTriggers && zapierTriggers.length > 0) {
      const user = await User.find(userId)
      const group = await Group.find(groupId)
      if (user && group) {
        for (const trigger of zapierTriggers) {
          const response = await fetch(trigger.get('target_url'), {
            method: 'post',
            body: JSON.stringify({
              id: user.id,
              name: user.get('name'),
              // Which group were they removed from, since the trigger can be for multiple groups
              group: { id: group.id, name: group.get('name'), url: Frontend.Route.group(group) },
              removedByModerator
            }),
            headers: { 'Content-Type': 'application/json' }
          })
          // TODO: what to do with the response? check if succeeded or not?
        }
      }
    }
  },

  async afterUpdate ({ userId, changes }) {
    const user = await User.find(userId)
    if (user) {
      const memberships = await user.memberships().fetch({ withRelated: 'group' })
      memberships.models.forEach(async (membership) => {
        const zapierTriggers = await ZapierTrigger.forTypeAndGroups('member_updated', membership.get('group_id')).fetchAll()
        for (const trigger of zapierTriggers) {
          const response = await fetch(trigger.get('target_url'), {
            method: 'post',
            body: JSON.stringify(Object.assign({ id: user.id, profileUrl: Frontend.Route.profile(user, membership.relations.group) }, changes)),
            headers: { 'Content-Type': 'application/json' }
          })
          // TODO: what to do with the response? check if succeeded or not?
        }
      })
    }
  },

  async sendWelcomeEmail ({ userId }) {
    const user = await User.find(userId)
    if (user) {
      const memberships = await user.memberships().fetch({ withRelated: 'group' })
      const initialGroup = memberships?.models[0]?.relations?.group
      Email.sendWelcomeEmail({
        email: user.get('email'),
        data: {
          member_name: user.get('name'),
          group_name: initialGroup?.get('name'),
          group_url: initialGroup ? Frontend.Route.group(initialGroup) : null
        }
      })
    }
  }

})

function validateUserAttributes (attrs, { existingUser, transacting } = {}) {
  if (has(attrs, 'password')) {
    const invalidReason = Validators.validateUser.password(attrs.password)
    if (invalidReason) return Promise.reject(new GraphQLError(invalidReason))
  }

  if (has(attrs, 'name')) {
    const invalidReason = Validators.validateUser.name(attrs.name)
    if (invalidReason) return Promise.reject(new GraphQLError(invalidReason))
  }

  // for an existing user, the email field can be omitted.
  if (existingUser && !has(attrs, 'email')) return Promise.resolve()
  const oldEmail = existingUser ? existingUser.get('email') : null

  if (!validator.isEmail(attrs.email)) {
    return Promise.reject(new GraphQLError('invalid-email'))
  }

  return User.isEmailUnique(attrs.email, oldEmail, { transacting })
    .then(unique => unique || Promise.reject(new GraphQLError('duplicate-email')))
}

export function addProtocol (url) {
  if (isEmpty(url)) return url
  const regex = /^(http:\/\/|https:\/\/)/
  if (regex.test(url)) {
    return url
  } else {
    return 'https://' + url
  }
}
