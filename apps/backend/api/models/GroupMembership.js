import HasSettings from './mixins/HasSettings'
import { isEmpty } from 'lodash'
import {
  whereId
} from './group/queryUtils'

module.exports = bookshelf.Model.extend(Object.assign({
  tableName: 'group_memberships',
  requireFetch: false,
  hasTimestamps: true,

  agreements () {
    return this.belongsToMany(Agreement, 'users_groups_agreements', 'group_id', 'agreement_id', 'group_id')
      .through(UserGroupAgreement, 'group_id', 'agreement_id')
      .where({ user_id: this.get('user_id') })
      .withPivot(['accepted'])
  },

  commonRoles () {
    return this.belongsToMany(CommonRole, 'group_memberships_common_roles', 'group_id', 'common_role_id', 'group_id')
      .through(MemberCommonRole, 'group_id', 'common_role_id')
      .where({ user_id: this.get('user_id'), group_id: this.get('group_id') })
      .withPivot(['group_id'])
  },

  membershipCommonRoles () {
    return this.hasMany(MemberCommonRole, 'group_id', 'group_id')
      .where({ user_id: this.get('user_id') })
  },

  membershipGroupRoles () {
    return this.hasMany(MemberGroupRole, 'group_id', 'group_id')
      .where({ user_id: this.get('user_id') })
  },

  group () {
    return this.belongsTo(Group)
  },

  joinQuestionAnswers () {
    return this.hasMany(GroupJoinQuestionAnswer, 'group_id').where({ user_id: this.get('user_id') })
  },

  tagFollows: function () {
    return this.hasMany(TagFollow, 'group_id', 'group_id').where({ user_id: this.get('user_id') })
  },

  user () {
    return this.belongsTo(User)
  },

  // TODO RESP: update/fix/remove this yeah once mobile app has switched to new roles/responsibilities
  async hasRole (role) {
    if (role === GroupMembership.Role.MODERATOR) {
      const result = await bookshelf.knex.raw(`SELECT 1 FROM group_memberships_common_roles WHERE user_id = ${this.get('user_id')} AND group_id = ${this.get('group_id')} AND common_role_id = 1 LIMIT 1`)
      return result.rows.length > 0
    }
    return false
  },

  async acceptAgreements (transacting) {
    this.addSetting({ agreementsAcceptedAt: (new Date()).toISOString() })
    const groupId = this.get('group_id')
    const groupAgreements = await GroupAgreement.where({ group_id: groupId }).fetchAll({ transacting })
    for (const ga of groupAgreements) {
      const attrs = { group_id: groupId, user_id: this.get('user_id'), agreement_id: ga.get('agreement_id') }
      await UserGroupAgreement
        .where(attrs)
        .fetch({ transacting })
        .then(async (uga) => {
          if (uga && !uga.get('accepted')) {
            await uga.save({ accepted: true }, { transacting })
          } else {
            await UserGroupAgreement.forge(attrs).save({}, { transacting })
          }
        })
    }
  },

  async updateAndSave (attrs, { transacting } = {}) {
    for (const key in attrs) {
      if (key === 'settings') {
        this.addSetting(attrs[key])
      } else {
        this.set(key, attrs[key])
      }
    }
    if (attrs.role === 0 || attrs.role === 1) {
      await MemberCommonRole.updateCoordinatorRole({ userId: this.get('user_id'), groupId: this.get('group_id'), role: attrs.role, transacting })
    }

    if (!isEmpty(this.changed)) return this.save(null, { transacting })
    return this
  }

}, HasSettings), {
  Role: {
    DEFAULT: 0,
    MODERATOR: 1
  },

  forPair (userOrId, groupOrId, opts = {}) {
    const userId = userOrId instanceof User ? userOrId.id : userOrId
    const groupId = groupOrId instanceof Group ? groupOrId.id : groupOrId

    if (!userId) {
      throw new Error("Can't call forPair without a user or user id")
    }
    if (!groupId) {
      throw new Error("Can't call forPair without a group or group id")
    }

    return this.forIds(userId, groupId, opts)
  },

  // `usersOrIds` can be a single user or id, a list of either, or null
  forIds (usersOrIds, groupId, opts = {}) {
    const queryRoot = opts.multiple ? this.collection() : this
    return queryRoot.query(q => {
      if (groupId) {
        q.join('groups', 'groups.id', 'group_memberships.group_id')
        whereId(q, groupId, 'groups.id')
      }

      if (usersOrIds) {
        whereId(q, usersOrIds, 'group_memberships.user_id')
      }

      if (!opts.includeInactive) q.where('group_memberships.active', true)
      if (opts.query) opts.query(q)
    })
  },

  async hasActiveMembership (userOrId, groupOrId) {
    const gm = await this.forPair(userOrId, groupOrId).fetch()
    return !!gm && gm.get('active')
  },

  async hasResponsibility (userOrId, groupOrId, responsibility, opts = {}) {
    const userId = userOrId instanceof User ? userOrId.id : userOrId
    const groupId = groupOrId instanceof Group ? groupOrId.id : groupOrId
    if (!userId) {
      throw new Error("Can't call forPair without a user or user id")
    }
    if (!groupId) {
      throw new Error("Can't call forPair without a group or group id")
    }
    if (responsibility.length === 0) {
      throw new Error("Can't determine what responsibility is being checked")
    }

    const gm = await this.forPair(userOrId, groupId).fetch(opts)

    // TODO: simplify by fetching by responsibility id, for the common ones?
    const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, groupId)

    if (gm && !responsibilities.includes(responsibility)) {
      return false
    }
    return !!gm
  },

  async setModeratorRole (userId, group) {
    return group.addMembers([userId], { role: this.Role.MODERATOR })
  },

  async removeModeratorRole (userId, group) {
    return group.addMembers([userId], { role: this.Role.DEFAULT })
  },

  forMember (userOrId) {
    return this.forIds(userOrId, null, { multiple: true })
  },

  async updateLastViewedAt (userOrId, groupOrId) {
    const membership = await GroupMembership.forPair(userOrId, groupOrId).fetch()
    if (membership) {
      membership.addSetting({ lastReadAt: new Date() })
      await membership.save({ new_post_count: 0 })
      return membership
    }
    return false
  },

  /**
   * Ensures a user is a member of a group
   * Creates membership if it doesn't exist, or reactivates if inactive
   *
   * @param {User|Number} userOrId - User instance or user ID
   * @param {Group|Number} groupOrId - Group instance or group ID
   * @param {Object} [options] - Options
   * @param {Number} [options.role] - Role to assign (defaults to DEFAULT)
   * @param {Object} [options.transacting] - Database transaction
   * @returns {Promise<GroupMembership>} The membership record
   */
  async ensureMembership (userOrId, groupOrId, { role = GroupMembership.Role.DEFAULT, transacting } = {}) {
    const userId = userOrId instanceof User ? userOrId.id : userOrId
    const groupId = groupOrId instanceof Group ? groupOrId.id : groupOrId

    if (!userId) {
      throw new Error("Can't call ensureMembership without a user or user id")
    }
    if (!groupId) {
      throw new Error("Can't call ensureMembership without a group or group id")
    }

    // Check for existing membership (including inactive)
    const existingMembership = await GroupMembership.forPair(userId, groupId, { includeInactive: true }).fetch({ transacting })

    if (existingMembership) {
      // Membership exists
      if (!existingMembership.get('active')) {
        // Reactivate inactive membership
        await existingMembership.save({ active: true }, { patch: true, transacting })
      }
      return existingMembership
    }

    // No membership exists, create it
    const user = userOrId instanceof User ? userOrId : await User.find(userId, { transacting })
    if (!user) {
      throw new Error(`User not found: ${userId}`)
    }

    const group = groupOrId instanceof Group ? groupOrId : await Group.find(groupId, { transacting })
    if (!group) {
      throw new Error(`Group not found: ${groupId}`)
    }

    // Create membership via user.joinGroup
    const membership = await user.joinGroup(group, {
      role,
      fromInvitation: true, // This will ensure join questions are still shown
      transacting
    })

    return membership
  },

  /**
   * Pin a group to the user's global navigation menu
   * Adds it to the bottom of the pinned list
   *
   * @param {User|Number} userOrId - User instance or user ID
   * @param {Group|Number} groupOrId - Group instance or group ID
   * @param {Object} [options] - Options
   * @param {Object} [options.transacting] - Database transaction
   * @returns {Promise<GroupMembership>} The updated membership record
   */
  async pinGroupToNav (userOrId, groupOrId, { transacting } = {}) {
    const userId = userOrId instanceof User ? userOrId.id : userOrId
    const groupId = groupOrId instanceof Group ? groupOrId.id : groupOrId

    if (!userId) {
      throw new Error("Can't call pinGroupToNav without a user or user id")
    }
    if (!groupId) {
      throw new Error("Can't call pinGroupToNav without a group or group id")
    }

    const membership = await GroupMembership.forPair(userId, groupId).fetch({ transacting })
    if (!membership) {
      throw new Error(`Membership not found for user ${userId} and group ${groupId}`)
    }

    // Check if already pinned
    if (membership.get('nav_order') !== null) {
      // Already pinned, no need to do anything
      return membership
    }

    // Find the max nav_order for this user's pinned groups
    const result = await bookshelf.knex('group_memberships')
      .where({ user_id: userId })
      .whereNotNull('nav_order')
      .max('nav_order as max_order')
      .transacting(transacting)
      .first()

    // Set this group's nav_order to max + 1 (or 0 if no pinned groups)
    const maxOrder = result?.max_order
    const newNavOrder = maxOrder !== null && maxOrder !== undefined ? maxOrder + 1 : 0

    await membership.save({ nav_order: newNavOrder }, { patch: true, transacting })

    return membership
  }
})
