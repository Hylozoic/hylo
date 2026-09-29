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
      // A neutral notice to the person who asked (D14): it names neither the steward
      // nor a reason
      await JoinRequest.notifyRequester(this, Activity.Reason.DeclinedJoinRequest)
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

    // Tell the person their request arrived and what happens next (D14)
    await JoinRequest.notifyRequester(request, Activity.Reason.AcknowledgedJoinRequest)
  },

  /**
   * An in-app and email notice to the person who asked to join (reason is one of
   * acknowledgedJoinRequest, declinedJoinRequest and unansweredJoinRequest). The
   * person is also the actor, so a notice never names the steward who acted.
   */
  notifyRequester: async function (request, reason) {
    const userId = request.get('user_id')
    const groupId = request.get('group_id')
    if (!userId || !groupId) return
    const group = request.relations.group || await Group.find(groupId)
    const parentId = group?.get('parent_id')
    return Activity.saveForReasons([{
      actor_id: userId,
      reader_id: userId,
      group_id: groupId,
      ...(parentId ? { other_group_id: parentId } : {}),
      reason
    }])
  },

  UNANSWERED_DAYS: 14,
  // Requests older than this are left alone, so the first run doesn't write to people
  // about requests they made long ago
  UNANSWERED_LOOKBACK_DAYS: 30,

  /**
   * Tells each person whose request to join has had no answer for UNANSWERED_DAYS,
   * once per request (D14); the email suggests open groups to try. Skips requests made
   * more than UNANSWERED_LOOKBACK_DAYS ago, closed accounts, inactive groups and people
   * who are already members. Each request is marked before its notice goes out, so
   * overlapping runs can't send twice. Runs from the daily steward job
   * (lib/group/stewardDigest.js). Returns how many people were told.
   */
  notifyUnanswered: async function ({ now = new Date(), limit = 500 } = {}) {
    const day = 24 * 60 * 60 * 1000
    const answeredBy = new Date(now.getTime() - JoinRequest.UNANSWERED_DAYS * day)
    const madeAfter = new Date(now.getTime() - JoinRequest.UNANSWERED_LOOKBACK_DAYS * day)
    const { rows } = await bookshelf.knex.raw(`
      UPDATE join_requests SET unanswered_notified_at = ?
      WHERE id IN (
        SELECT r.id FROM join_requests r
        JOIN groups g ON g.id = r.group_id AND g.active = true
        JOIN users u ON u.id = r.user_id AND u.active = true
        WHERE r.status = ? AND r.unanswered_notified_at IS NULL
          AND r.created_at <= ? AND r.created_at > ?
          AND NOT EXISTS (
            SELECT 1 FROM group_memberships gm
            WHERE gm.group_id = r.group_id AND gm.user_id = r.user_id AND gm.active = true
          )
        ORDER BY r.id
        LIMIT ?
        FOR UPDATE OF r SKIP LOCKED
      )
      RETURNING id
    `, [now, JoinRequest.STATUS.Pending, answeredBy, madeAfter, limit])

    for (const { id } of rows) {
      const request = await JoinRequest.where({ id }).fetch({ withRelated: 'group' })
      if (request) await JoinRequest.notifyRequester(request, Activity.Reason.UnansweredJoinRequest)
    }
    return rows.length
  },

  find: async function (id) {
    if (!id) return Promise.resolve(null)
    return JoinRequest.where({ id }).fetch()
  }
})
