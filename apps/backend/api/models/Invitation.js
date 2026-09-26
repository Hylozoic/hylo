import { v4 as uuidv4 } from 'uuid'
import EnsureLoad from './mixins/EnsureLoad'

// Which invite access the sender used: 'full' (Add Members) or 'limited'
// (Invite Members, personal email invitations only)
const InviterAccess = {
  FULL: 'full',
  LIMITED: 'limited'
}

module.exports = bookshelf.Model.extend(Object.assign({
  tableName: 'group_invites',
  requireFetch: false,
  hasTimestamps: ['created_at', null],

  group: function () {
    return this.belongsTo(Group)
  },

  creator: function () {
    return this.belongsTo(User, 'invited_by_id')
  },

  tag: function () {
    return this.belongsTo(Tag)
  },

  user: function () {
    return this.belongsTo(User, 'used_by_id')
  },

  expiredBy: function () {
    return this.belongsTo(User, 'expired_by_id')
  },

  // The group-specific role to assign when this invitation is used
  groupRole: function () {
    return this.belongsTo(GroupRole, 'group_role_id')
  },

  isUsed: function () {
    return !!this.get('used_by_id')
  },

  isExpired: function () {
    return !!this.get('expired_by_id')
  },

  isLimited: function () {
    return this.get('inviter_access') === InviterAccess.LIMITED
  },

  tagName: function () {
    return this.get('tag_id')
      ? Tag.find({ id: this.get('tag_id') }).then(t => t.get('name'))
      : Promise.resolve()
  },

  // this should always return the membership, regardless of whether the
  // invitation is unused, whether the membership already exists, and whether
  // the tag follow already exists
  async use (userId, { transacting } = {}) {
    const user = await User.find(userId, { transacting })
    const group = await this.group().fetch({ transacting })
    const membership =
      await GroupMembership.forPair(user, group).fetch({ transacting }) ||
      await user.joinGroup(group, { fromInvitation: true, transacting })

    // Assign group role if specified on the invitation
    const groupRoleId = this.get('group_role_id')
    if (groupRoleId) {
      try {
        await MemberGroupRole.forge({
          user_id: userId,
          group_id: this.get('group_id'),
          group_role_id: groupRoleId,
          active: true
        }).save(null, { transacting })
      } catch (err) {
        // Ignore duplicate key errors - user may already have this role
        if (!err.message || !err.message.includes('duplicate key value')) {
          throw err
        }
      }
    }

    // TODO: we are not using this right now, but we could use to invite to a chat room
    if (!this.isUsed() && this.get('tag_id')) {
      try {
        await TagFollow.findOrCreate({
          tagId: this.get('tag_id'),
          userId,
          groupId: this.get('group_id')
        }, { transacting })
      } catch (err) {
        // do nothing if the tag follow already exists
        if (!err.message || !err.message.includes('duplicate key value')) {
          throw err
        }
      }
    }

    if (!this.isUsed()) {
      await this.save({ used_by_id: userId, used_at: new Date() }, { patch: true, transacting })
    }

    return membership
  },

  expire: function (userId, opts = {}) {
    const { transacting } = opts
    return this.save({ expired_by_id: userId, expired_at: new Date() },
      { patch: true, transacting })
  },

  send: function () {
    return this.ensureLoad(['creator', 'group', 'tag'])
      .then(() => {
        const { creator, group } = this.relations
        const email = this.get('email')

        const data = {
          subject: this.get('subject'),
          message: this.get('message'),
          inviter_avatar_url: creator.get('avatar_url'),
          inviter_name: creator.get('name'),
          inviter_email: creator.get('email'),
          locale: creator.getLocale(),
          group_name: group.get('name'),
          group_avatar_url: group.get('avatar_url'),
          group_url: Frontend.Route.group(group),
          invite_link: this.isLimited()
            ? Frontend.Route.invitation(this.get('token'))
            : Frontend.Route.useInvitation(this.get('token'), email),
          tracking_pixel_url: Analytics.pixelUrl('Invitation', {
            recipient: email,
            group: group.get('name')
          })
        }
        return this.save({
          sent_count: this.get('sent_count') + 1,
          last_sent_at: new Date()
        })
          .then(() => {
            if (this.get('tag_id')) {
              throw new Error('need to re-implement tag invitations')
            } else {
              return Email.sendInvitation(email, data)
            }
          })
      })
  }

}, EnsureLoad), {
  InviterAccess,

  find: (idOrToken, opts) => {
    if (!idOrToken) return Promise.resolve(null)
    const attr = isNaN(Number(idOrToken)) ? 'token' : 'id'
    return Invitation.where(attr, idOrToken).fetch(opts)
  },

  create: async function (opts, { transacting } = {}) {
    let groupRoleId = opts.groupRoleId || null
    if (opts.assignAdministrator && !groupRoleId) {
      await GroupRole.setupSystemRoles(opts.groupId)
      const administrator = await GroupRole.findSystemRole(opts.groupId, 'Administrator')
      groupRoleId = administrator ? administrator.id : null
    }

    return new Invitation({
      invited_by_id: opts.userId,
      group_id: opts.groupId,
      email: opts.email.toLowerCase(),
      tag_id: opts.tagId,
      group_role_id: groupRoleId,
      token: uuidv4(),
      created_at: new Date(),
      subject: opts.subject,
      message: opts.message,
      inviter_access: opts.inviterAccess || InviterAccess.FULL
    }).save(null, { transacting })
  },

  createAndSend: function ({ invitation }) {
    return Invitation.find(invitation.id)
      .then(invitation =>
        invitation.send()
      )
  },

  // Member invitations are left to the automatic reminders
  reinviteAll: function (opts) {
    const { groupId } = opts
    return Invitation.where({ group_id: groupId, used_by_id: null, expired_by_id: null, inviter_access: InviterAccess.FULL })
      .fetchAll({ withRelated: ['creator', 'group', 'tag'] })
      .then(invitations =>
        Promise.map(invitations.models, invitation => invitation.send()))
  },

  /**
   * Send the automatic reminders that are due. A member invitation gets no more
   * reminders once its group has become a space, a join request came from it,
   * or its sender can no longer invite people to the group.
   */
  async resendAllReady () {
    const invitations = await Invitation.query(q => {
      const whereClause = "((sent_count=1 and last_sent_at < now() - interval '4 day') or " +
        "(sent_count=2 and last_sent_at < now() - interval '9 day'))"
      q.whereRaw(whereClause)
      q.whereNull('used_by_id')
      q.whereNull('expired_by_id')
      q.where(function () {
        this.where('group_invites.inviter_access', InviterAccess.FULL)
          .orWhere(function () {
            this.whereExists(function () {
              this.select(bookshelf.knex.raw(1)).from('groups')
                .whereRaw('groups.id = group_invites.group_id')
                .whereNull('groups.parent_id')
                .whereRaw("groups.type IS DISTINCT FROM 'space'")
            })
              .whereNotExists(function () {
                this.select(bookshelf.knex.raw(1)).from('join_requests')
                  .whereRaw('join_requests.invitation_id = group_invites.id')
              })
          })
      })
    }).fetchAll({ withRelated: ['creator', 'group', 'tag'] })

    const senderAccess = new Map()
    const ready = await Promise.filter(invitations.models, invitation => {
      if (!invitation.isLimited()) return true
      const key = `${invitation.get('invited_by_id')}:${invitation.get('group_id')}`
      if (!senderAccess.has(key)) {
        senderAccess.set(key, GroupMembership.inviteAccess(invitation.get('invited_by_id'), invitation.get('group_id')))
      }
      return senderAccess.get(key).then(Boolean)
    }, { concurrency: 5 })
    await Promise.map(ready, invitation => invitation.send())
    return ready.map(invitation => invitation.id)
  },

  /**
   * Expire the pending member invitations in a group, optionally only those
   * sent by some people. expiredById defaults to each invitation's sender.
   */
  expirePendingLimited: async function ({ groupId, invitedByIds, expiredById }, { transacting } = {}) {
    let query = bookshelf.knex('group_invites')
      .where({ group_id: groupId, inviter_access: InviterAccess.LIMITED })
      .whereNull('used_by_id')
      .whereNull('expired_by_id')
    if (invitedByIds) query = query.whereIn('invited_by_id', invitedByIds)
    query = query.update({
      expired_by_id: expiredById || bookshelf.knex.raw('invited_by_id'),
      expired_at: new Date()
    })
    if (transacting) query = query.transacting(transacting)
    return query
  }

})
