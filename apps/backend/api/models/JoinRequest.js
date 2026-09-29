import { GraphQLError } from 'graphql'

// The invitation a request came from, while it is neither used nor expired
function pendingInvitation (request) {
  return bookshelf.knex('group_invites')
    .where('id', request.get('invitation_id'))
    .whereNull('used_by_id')
    .whereNull('expired_by_id')
}

module.exports = bookshelf.Model.extend({
  tableName: 'join_requests',
  requireFetch: false,
  hasTimestamps: true,

  user: function () {
    return this.belongsTo(User)
  },

  group: function () {
    return this.belongsTo(Group)
  },

  questionAnswers: function () {
    return this.hasMany(GroupJoinQuestionAnswer)
  },

  // The member invitation this request came from, if any
  invitation: function () {
    return this.belongsTo(Invitation, 'invitation_id')
  },

  // The member's personal invite link this request came from, if any
  memberInviteLink: function () {
    return this.belongsTo(MemberInviteLink, 'member_invite_link_id')
  },

  // Who invited the person: the sender of the member invitation or the owner of the invite link it came from
  sponsorId: async function () {
    if (this.get('member_invite_link_id')) {
      const link = await bookshelf.knex('member_invite_links').where('id', this.get('member_invite_link_id')).first('user_id')
      if (link) return link.user_id
    }
    if (this.get('invitation_id')) {
      const invitation = await bookshelf.knex('group_invites').where('id', this.get('invitation_id')).first('invited_by_id')
      if (invitation) return invitation.invited_by_id
    }
    return null
  },

  accept: async function (moderatorId) {
    const user = await this.user().fetch()
    const group = await this.group().fetch()
    if (user && group) {
      const wasPending = this.get('status') === JoinRequest.STATUS.Pending
      const membership = await user.joinGroup(group, {
        joinSource: GroupMembership.JoinSource.JOIN_REQUEST,
        invitedById: await this.sponsorId()
      })
      // Requester already accepted agreements and answered questions when submitting.
      // Carry that through so the welcome modal does not re-ask after approval.
      if (membership) {
        await membership.completeJoinBarriers()
      }

      // joinGroup only marks invitations to the requester's own email address as used
      if (this.get('invitation_id')) {
        await pendingInvitation(this).update({ used_by_id: user.id, used_at: new Date() })
      }

      await this.save({ status: JoinRequest.STATUS.Accepted, processed_by_id: moderatorId || null }).then(async request => {
        const approvedMember = {
          actor_id: moderatorId,
          reader_id: user.id,
          group_id: group.id,
          reason: 'approvedJoinRequest'
        }

        Activity.saveForReasons([approvedMember])
      })
      if (wasPending) {
        await Group.adjustOpenJoinRequestCount(group.id, -1)
      }
      return this
    }
    throw new GraphQLError('Invalid join request')
  },

  /**
   * Mark a pending request as rejected, expire the member invitation it came
   * from, and decrement the group's cached count.
   */
  decline: async function (moderatorId) {
    const wasPending = this.get('status') === JoinRequest.STATUS.Pending
    await this.save({ status: JoinRequest.STATUS.Rejected, processed_by_id: moderatorId || null })
    if (this.get('invitation_id')) {
      await pendingInvitation(this).update({
        expired_by_id: moderatorId || bookshelf.knex.raw('invited_by_id'),
        expired_at: new Date()
      })
    }
    if (wasPending) {
      await Group.adjustOpenJoinRequestCount(this.get('group_id'), -1)
    }
    return this
  },

  /** Mark a pending request as canceled and decrement the group's cached count. */
  cancel: async function () {
    const wasPending = this.get('status') === JoinRequest.STATUS.Pending
    await this.save({ status: JoinRequest.STATUS.Canceled })
    if (wasPending) {
      await Group.adjustOpenJoinRequestCount(this.get('group_id'), -1)
    }
    return this
  }
}, {

  STATUS: {
    Pending: 0,
    Accepted: 1,
    Rejected: 2,
    Canceled: 3
  },

  create: function (opts) {
    return new JoinRequest({
      group_id: opts.groupId,
      user_id: opts.userId,
      invitation_id: opts.invitationId || null,
      member_invite_link_id: opts.memberInviteLinkId || null,
      created_at: new Date(),
      status: this.STATUS.Pending
    }).save()
      .then(async request => {
        await JoinRequest.afterCreate(request)
        return request
      })
  },

  afterCreate: async function (request) {
    await Group.adjustOpenJoinRequestCount(request.get('group_id'), 1)
    await request.load(['group', 'user'])
    const { group, user } = request.relations

    // Notify anyone with Add Members on this group, or on the parent for spaces
    // (space.moderators() only finds space members, so parent stewards were skipped).
    const rows = await Responsibility.fetchForGroup(group.id)
    const readerIds = [...new Set(
      rows
        .filter(r => r.responsibility_title === Responsibility.constants.RESP_ADD_MEMBERS)
        .map(r => r.user_id)
        .filter(id => String(id) !== String(user.id))
    )]

    const parentId = group.get('parent_id')
    const announcees = readerIds.map(readerId => ({
      actor_id: user.id,
      reader_id: readerId,
      group_id: group.id,
      ...(parentId ? { other_group_id: parentId } : {}),
      reason: 'joinRequest'
    }))

    await Activity.saveForReasons(announcees)
  },

  find: async function (id) {
    if (!id) return Promise.resolve(null)
    return JoinRequest.where({ id }).fetch()
  }
})
