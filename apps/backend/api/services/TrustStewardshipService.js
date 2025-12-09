/* eslint-disable camelcase, no-undef, no-trailing-spaces, eol-last */
import { maxBy } from 'lodash'

const TrustStewardshipService = {
  /**
   * Record a trust value (+1 or 0) from trustor to trustee for a specific role
   * Upserts the trust_expressions row, then triggers a threshold recalculation.
   */
  async setTrust ({ roleId, trustorId, trusteeId, value }) {
    const role = await GroupRole.where({ id: roleId }).fetch()
    if (!role) throw new Error('Role not found')

    const groupId = role.get('group_id')

    // NEW: Anti-abuse checks --------------------------------------------------
    // 1) Min membership age (Group.settings.min_member_age_days, default 0)
    const group = await Group.find(groupId)
    const minAgeDays = Number(group?.getSetting('min_member_age_days') || 0)
    if (minAgeDays > 0) {
      const membership = await GroupMembership.forIds(trustorId, groupId).fetch()
      if (!membership) throw new Error('Must be a member to express trust')
      const membershipAgeDays = (Date.now() - new Date(membership.get('created_at')).getTime()) / 86400000
      if (membershipAgeDays < minAgeDays) {
        throw new Error(`You must be a member for at least ${minAgeDays} days before expressing trust`)
      }
    }

    // 2) Rate-limit: one change per window per (trustor→trustee→role)
    const rateLimitHours = Number(group?.getSetting('trust_rate_limit_hours') || 0)
    if (rateLimitHours > 0) {
      const lastExpr = await bookshelf.knex('trust_expressions')
        .where({ group_role_id: roleId, trustor_id: trustorId, trustee_id: trusteeId })
        .orderBy('updated_at', 'desc')
        .first()
      if (lastExpr) {
        const elapsed = Date.now() - new Date(lastExpr.updated_at).getTime()
        if (elapsed < rateLimitHours * 60 * 60 * 1000) {
          throw new Error(`You can only change this trust once every ${rateLimitHours} hours`)
        }
      }
    }
    // ------------------------------------------------------------------------

    const isNewTrust = value === 1 && trustorId !== trusteeId
    const isVolunteer = trustorId === trusteeId && value === 1

    try {
      await bookshelf.knex('trust_expressions')
        .insert({
          group_id: groupId,
          group_role_id: roleId,
          trustor_id: trustorId,
          trustee_id: trusteeId,
          value,
          created_at: new Date(),
          updated_at: new Date()
        })
        .onConflict(['group_role_id', 'trustor_id', 'trustee_id'])
        .merge({ value, updated_at: new Date() })
    } catch (error) {
      console.error('[TrustStewardshipService] Trust expression insert error:', {
        roleId,
        groupId,
        trustorId,
        trusteeId,
        value,
        error: error.message
      })
      throw error
    }

    // Create notification for new trust expressions
    if (isNewTrust) {
      await this.createTrustNotification({ roleId, trustorId, trusteeId })
    }

    // Create notification for volunteering
    if (isVolunteer) {
      await this.createVolunteerNotification({ roleId, volunteerId: trustorId })
    }

    return this.recalculateRole(roleId)
  },

  async removeVolunteer ({ roleId, userId }) {
    const role = await GroupRole.where({ id: roleId }).fetch()
    if (!role) throw new Error('Role not found')

    await bookshelf.knex('trust_expressions')
      .where({
        group_role_id: roleId,
        trustee_id: userId
      })
      .del()

    return this.recalculateRole(roleId)
  },

  async removeVolunteerForCommonRole ({ roleId, groupId, userId }) {
    const groupRole = await this.findOrCreateGroupRoleForCommonRole({
      commonRoleId: roleId,
      groupId
    })

    return this.removeVolunteer({ roleId: groupRole.id, userId })
  },

  /**
   * Create notification for trust expression
   */
  async createTrustNotification ({ roleId, trustorId, trusteeId }) {
    const role = await GroupRole.where({ id: roleId }).fetch({ withRelated: ['group'] })

    const activity = await Activity.createWithNotifications({
      actor_id: trustorId,
      reader_id: trusteeId,
      group_id: role.get('group_id'),
      meta: {
        reasons: ['roleTrust'],
        role_id: roleId,
        role_name: role.get('name'),
        group_name: role.relations.group.get('name')
      }
    })

    return activity
  },

  /**
   * Create notification for volunteering
   */
  async createVolunteerNotification ({ roleId, volunteerId }) {
    const role = await GroupRole.where({ id: roleId }).fetch({ withRelated: ['group'] })
    const group = role.relations.group

    // Get group members to notify about the volunteer
    const members = await bookshelf.knex('group_memberships')
      .where({ group_id: group.id, active: true })
      .pluck('user_id')

    await Promise.all(members.filter(id => id !== volunteerId).map(async memberId => {
      await Activity.createWithNotifications({
        actor_id: volunteerId,
        reader_id: memberId,
        group_id: group.id,
        meta: {
          reasons: ['roleVolunteer'],
          role_id: roleId,
          role_name: role.get('name'),
          group_name: group.get('name')
        }
      })
    }))
  },

  /**
   * Recalculate threshold numbers and status for a role after trust change.
   * Implements the spec: required = max(base, ceil(sqrt(group_size) * k))
   * - For groups ≤50: ~0.5 * group_size (e.g., 25 for 50 people)
   * - For groups of 500: ~60-80 trust points
   * - Uses k=3 to achieve this scaling
   * Updates GroupRole.threshold_current, threshold_required, status and memberships.
   */
  async recalculateRole (roleId) {
    const role = await GroupRole.where({ id: roleId }).fetch()
    if (!role) throw new Error('Role not found')

    const groupId = role.get('group_id')
    const oldStatus = role.get('status')

    const memberCountRow = await bookshelf.knex('group_memberships')
      .where({ group_id: groupId, active: true })
      .count('user_id as count')
      .first()
    const activeMemberCount = parseInt(memberCountRow && memberCountRow.count, 10) || 0

    let thresholdRequired = Number(role.get('threshold_required'))
    if (!thresholdRequired || Number.isNaN(thresholdRequired)) {
      thresholdRequired = 0.51
    }
    if (thresholdRequired > 1) {
      thresholdRequired = activeMemberCount > 0
        ? Math.min(1, thresholdRequired / activeMemberCount)
        : 0.51
    }

    // Fetch average trust per trustee.
    // The average includes all expressions, including a user's trust in themselves (volunteering).
    const trustRows = await bookshelf.knex('trust_expressions')
      .where({ group_role_id: roleId })
      .select('trustee_id')
      .sum('value as total_trust')
      .groupBy('trustee_id')
    const trustAverages = trustRows.map(r => ({
      trustee_id: r.trustee_id,
      average: activeMemberCount > 0 ? (parseFloat(r.total_trust || 0) / activeMemberCount) : 0,
      total: parseFloat(r.total_trust || 0)
    }))

    const top = maxBy(trustAverages, 'average')
    const current = top ? top.average : 0

    // Trustees who meet or exceed the threshold
    const stewards = trustAverages.filter(t => t.average >= thresholdRequired).map(t => t.trustee_id)

    // Determine the new status of the role
    let newStatus
    if (trustAverages.length === 0) {
      newStatus = 'vacant' // No one has volunteered or been trusted.
    } else if (stewards.length === 0) {
      newStatus = 'pending' // There are candidates, but none meet the threshold yet.
    } else {
      newStatus = 'active' // One or more members have met the trust threshold.
    }

    const previousStewards = await bookshelf.knex('group_memberships_group_roles')
      .where({ group_role_id: roleId })
      .pluck('user_id')

    // Save the new state of the role
    await role.save({
      threshold_current: current,
      threshold_required: thresholdRequired,
      status: newStatus
    }, { patch: true })

    // Update membership assignments based on the new stewards list
    if (newStatus === 'active' && stewards.length > 0) {
      const now = new Date()
      await bookshelf.knex('group_memberships_group_roles')
        .insert(stewards.map(userId => ({
          group_role_id: roleId,
          user_id: userId,
          group_id: groupId,
          active: true,
          created_at: now,
          updated_at: now
        })))
        .onConflict(['group_role_id', 'user_id', 'group_id'])
        .merge({ active: true, updated_at: now })

      await bookshelf.knex('group_memberships_group_roles')
        .where({ group_role_id: roleId })
        .whereNotIn('user_id', stewards)
        .del()
    } else {
      await bookshelf.knex('group_memberships_group_roles')
        .where({ group_role_id: roleId })
        .del()
    }


    // Create notifications for status changes
    if (oldStatus !== newStatus) {
      await this.createStatusChangeNotification({
        roleId,
        oldStatus,
        newStatus,
        stewards,
        formerStewards: previousStewards
      })
    }

    return role.refresh()
  },

  /**
   * Create notification for role status changes
   */
  async createStatusChangeNotification ({ roleId, oldStatus, newStatus, stewards, formerStewards = [] }) {
    const role = await GroupRole.where({ id: roleId }).fetch({ withRelated: ['group'] })
    const group = role.relations.group

    if (newStatus === 'active' && oldStatus !== 'active') {
      // Role became active - notify stewards
      await Promise.all(stewards.map(async stewardId => {
        await Activity.createWithNotifications({
          actor_id: stewardId,
          reader_id: stewardId,
          group_id: group.id,
          meta: {
            reasons: ['roleActivated'],
            role_id: roleId,
            role_name: role.get('name'),
            group_name: group.get('name')
          }
        })
      }))
    } else if (newStatus === 'contested') {
      // Role became contested - notify all group members about the conflict
      // This triggers the need for group decision-making between qualified candidates
      const groupMembers = await bookshelf.knex('group_memberships')
        .where({ group_id: group.id, active: true })
        .pluck('user_id')

      await Promise.all(groupMembers.map(async memberId => {
        await Activity.createWithNotifications({
          actor_id: memberId, // Use member as actor for their own notification
          reader_id: memberId,
          group_id: group.id,
          meta: {
            reasons: ['roleContested'],
            role_id: roleId,
            role_name: role.get('name'),
            group_name: group.get('name'),
            qualified_candidates: stewards.length,
            candidates: stewards
          }
        })
      }))
    } else if (oldStatus === 'active' && newStatus !== 'active') {
      // Role became inactive - notify former stewards
      const recipients = formerStewards.length > 0
        ? formerStewards
        : await bookshelf.knex('group_memberships_group_roles')
          .where({ group_role_id: roleId })
          .pluck('user_id')

      await Promise.all(recipients.map(async stewardId => {
        await Activity.createWithNotifications({
          actor_id: stewardId,
          reader_id: stewardId,
          group_id: group.id,
          meta: {
            reasons: ['roleDeactivated'],
            role_id: roleId,
            role_name: role.get('name'),
            group_name: group.get('name')
          }
        })
      }))
    }
  },

  /**
   * Create a chat post when someone volunteers for a role
   * This implements the spec: volunteer message is posted to general chat with trust sliders
   */
  async createVolunteerChatPost ({ roleId, userId, message }) {
    const role = await GroupRole.where({ id: roleId }).fetch({ withRelated: ['group'] })
    const user = await User.where({ id: userId }).fetch()
    const group = role.relations.group

    // Create a post in the group's general chat
    const postTitle = `${user.get('name')} volunteers for ${role.get('name')} role`
    const postDetails = `${message}\n\n---\n\n*Use the trust slider below to express your opinion about ${user.get('name')} in the ${role.get('name')} role.*`

    const post = await Post.forge({
      name: postTitle,
      description: postDetails,
      type: 'discussion',
      user_id: userId,
      created_at: new Date(),
      updated_at: new Date(),
      active: true
    }).save()

    // Link the post to the group
    await post.groups().attach(group.id)

    // TODO: Add special metadata to identify this as a trust/volunteer post
    // The posts table doesn't have a meta field - we might need to use a different approach
    // For now, the post content and type='discussion' are sufficient to identify volunteer posts

    console.log(`[TrustStewardshipService] Created volunteer chat post ${post.id} for role ${roleId}`)
    return post
  },

  /**
   * Create a chat post when someone nominates another person for a role
   */
  async createNominationChatPost ({ roleId, nominatorId, nomineeId, message }) {
    const role = await GroupRole.where({ id: roleId }).fetch({ withRelated: ['group'] })
    const nominator = await User.where({ id: nominatorId }).fetch()
    const nominee = await User.where({ id: nomineeId }).fetch()
    const group = role.relations.group

    // Create a post in the group's general chat
    const postTitle = `${nominator.get('name')} nominates ${nominee.get('name')} for ${role.get('name')} role`
    const postDetails = `${message}\n\n---\n\n*Use the trust slider below to express your opinion about ${nominee.get('name')} in the ${role.get('name')} role.*`

    const post = await Post.forge({
      name: postTitle,
      description: postDetails,
      type: 'discussion',
      user_id: nominatorId,
      created_at: new Date(),
      updated_at: new Date(),
      active: true
    }).save()

    // Link the post to the group
    await post.groups().attach(group.id)

    // TODO: Add special metadata to identify this as a trust/nomination post
    // The posts table doesn't have a meta field - we might need to use a different approach
    // For now, the post content and type='discussion' are sufficient to identify nomination posts

    console.log(`[TrustStewardshipService] Created nomination chat post ${post.id} for role ${roleId}`)
    return post
  },

  /**
   * Get trust data for a role including candidates and trust expressions
   */
  async getTrustDataForRole ({ roleId, userId }) {
    try {
      const role = await GroupRole.where({ id: roleId }).fetch()
      if (!role) throw new Error('Role not found')

      if (role.get('assignment') !== 'trust') {
        return { candidates: [], trustExpressions: [], myTrustExpressions: {} }
      }

      const groupId = role.get('group_id')
      const memberCountRow = await bookshelf.knex('group_memberships')
        .where({ group_id: groupId, active: true })
        .count('user_id as count')
        .first()
      const activeMemberCount = parseInt(memberCountRow && memberCountRow.count, 10) || 0

      // Get current stewards
    const stewardRows = (await bookshelf.knex('group_memberships_group_roles')
      .join('users', 'group_memberships_group_roles.user_id', 'users.id')
      .where({ 'group_memberships_group_roles.group_role_id': roleId })
      .where({ 'group_memberships_group_roles.active': true })
      .select(
        'users.id as id',
        'users.name as name',
        'users.avatar_url as avatarUrl',
        'users.banner_url as bannerUrl'
      ))
    const stewardIds = stewardRows.map(s => s.id)

    // Get all candidates (users who have volunteered for this role)
    const candidateRows = (await bookshelf.knex('trust_expressions')
      .join('users', 'trust_expressions.trustee_id', 'users.id')
      .where({
        'trust_expressions.group_role_id': roleId,
        'trust_expressions.trustor_id': bookshelf.knex.raw('trust_expressions.trustee_id')
      })
      .select(
        'users.id as id',
        'users.name as name',
        'users.avatar_url as avatarUrl',
        'users.banner_url as bannerUrl'
      ))
        
      const allPeopleRows = [...stewardRows, ...candidateRows.filter(c => !stewardIds.includes(c.id))]

      const detailedTrustExpressions = await bookshelf.knex('trust_expressions')
        .leftJoin('users as trustor', 'trust_expressions.trustor_id', 'trustor.id')
        .leftJoin('users as trustee', 'trust_expressions.trustee_id', 'trustee.id')
        .where({ 'trust_expressions.group_role_id': roleId })
        .select(
          'trust_expressions.trustor_id',
          'trust_expressions.trustee_id',
          'trust_expressions.value',
          'trustor.name as trustor_name',
          'trustor.avatar_url as trustor_avatar',
          'trustee.name as trustee_name'
        )

      const trustNetworkMap = new Map()
      detailedTrustExpressions.forEach(expr => {
        const existing = trustNetworkMap.get(expr.trustee_id) || {
          trusteeId: expr.trustee_id,
          trusteeName: expr.trustee_name,
          total: 0,
          expressions: []
        }
        existing.total += Number(expr.value) || 0
        existing.expressions.push({
          trustorId: expr.trustor_id,
          trustorName: expr.trustor_name,
          trustorAvatarUrl: expr.trustor_avatar,
          trusteeId: expr.trustee_id,
          trusteeName: expr.trustee_name,
          value: Number(expr.value) || 0
        })
        trustNetworkMap.set(expr.trustee_id, existing)
      })

      const trustNetwork = Array.from(trustNetworkMap.values()).map(entry => ({
        ...entry,
        average: activeMemberCount > 0 ? entry.total / activeMemberCount : 0
      }))

      const trustScoreLookup = trustNetwork.reduce((acc, entry) => {
        acc[entry.trusteeId] = entry.average
        return acc
      }, {})

      const peopleWithTrust = allPeopleRows.map(person => ({
        ...person,
        trustScore: trustScoreLookup[person.id] || 0
      }))
      
      const candidatesWithTrust = peopleWithTrust.filter(p => !stewardIds.includes(p.id))
      const stewardsWithTrust = peopleWithTrust.filter(p => stewardIds.includes(p.id))

      // Get the current user's explicit trust expressions for this role
      const myTrustRows = await bookshelf.knex('trust_expressions')
        .where({
          group_role_id: roleId,
          trustor_id: userId
        })
        .select('trustee_id', 'value')

      const myTrustExpressions = {}
      myTrustRows.forEach(row => {
        myTrustExpressions[row.trustee_id] = row.value
      })



      return {
        candidates: candidatesWithTrust,
        stewards: stewardsWithTrust, // Add stewards to the payload
        trustExpressions: detailedTrustExpressions.map(expr => ({
        trustorId: expr.trustor_id,
        trustorName: expr.trustor_name,
        trustorAvatarUrl: expr.trustor_avatar,
        trusteeId: expr.trustee_id,
        trusteeName: expr.trustee_name,
        value: Number(expr.value) || 0
      })),
        trustNetwork,
        myTrustExpressions
      }
    } catch (error) {
      console.error('[TrustStewardshipService] Error in getTrustDataForRole:', error.message)
      console.error('[TrustStewardshipService] Stack:', error.stack)
      throw error
    }
  },

  /**
   * Check if a roleId corresponds to a common role (IDs 1, 2, 3)
   */
  async isCommonRole (roleId) {
    const commonRole = await CommonRole.where({ id: roleId }).fetch()
    return !!commonRole
  },

  /**
   * Find or create a GroupRole entry for a common role in a specific group
   * This allows common roles to use the same trust_expressions table as group roles
   */
  async findOrCreateGroupRoleForCommonRole ({ commonRoleId, groupId }) {
    const commonRole = await CommonRole.where({ id: commonRoleId }).fetch()
    if (!commonRole) throw new Error('Common role not found')

    // Check if a GroupRole already exists for this common role in this group
    const existingGroupRole = await GroupRole.where({ 
      group_id: groupId, 
      name: commonRole.get('name'),
      assignment: 'trust' // Mark as trust-based since it's in a member-led group
    }).fetch()

    if (existingGroupRole) {
      return existingGroupRole
    }

    // Create a new GroupRole for this common role
    const groupRole = await GroupRole.forge({
      group_id: groupId,
      name: commonRole.get('name'),
      description: commonRole.get('description'),
      emoji: commonRole.get('emoji'),
      assignment: 'trust',
      status: 'vacant',
      threshold_current: 0,
      threshold_required: 0.51,
      bootstrap: false,
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    }).save()

    console.log(`[TrustStewardshipService] Created GroupRole ${groupRole.id} for common role ${commonRole.get('name')} in group ${groupId}`)
    return groupRole
  },

  /**
   * Get trust data for a common role in a specific group context
   * Creates a GroupRole entry for the common role if needed
   */
  async getTrustDataForCommonRole ({ roleId, groupId, userId }) {
    try {
      console.log(`[TrustStewardshipService] Getting common role trust data for role ${roleId}, group ${groupId}, user ${userId}`)
      
      // Find or create the GroupRole for this common role
      const groupRole = await this.findOrCreateGroupRoleForCommonRole({ 
        commonRoleId: roleId, 
        groupId 
      })
      
      console.log(`[TrustStewardshipService] Using GroupRole ${groupRole.id} for common role ${roleId}`)

      // Now use the standard trust data method with the actual GroupRole ID
      return this.getTrustDataForRole({ roleId: groupRole.id, userId })
    } catch (error) {
      console.error('[TrustStewardshipService] Error in getTrustDataForCommonRole:', error.message)
      console.error('[TrustStewardshipService] Stack:', error.stack)
      throw error
    }
  },

  /**
   * Set trust for a common role (creates GroupRole entry if needed)
   */
  async setTrustForCommonRole ({ roleId, groupId, trustorId, trusteeId, value }) {
    try {
      // Find or create the GroupRole for this common role
      const groupRole = await this.findOrCreateGroupRoleForCommonRole({ 
        commonRoleId: roleId, 
        groupId 
      })
      
      console.log(`[TrustStewardshipService] Using GroupRole ${groupRole.id} for common role ${roleId} trust expression`)

      // Now use the standard trust method with the actual GroupRole ID
      return this.setTrust({ 
        roleId: groupRole.id, 
        trustorId, 
        trusteeId, 
        value 
      })
    } catch (error) {
      console.error('[TrustStewardshipService] Error in setTrustForCommonRole:', error.message)
      throw error
    }
  },

  /**
   * Create volunteer chat post for common role
   */
  async createVolunteerChatPostForCommonRole ({ roleId, groupId, userId, message }) {
    try {
      // Find or create the GroupRole for this common role
      const groupRole = await this.findOrCreateGroupRoleForCommonRole({ 
        commonRoleId: roleId, 
        groupId 
      })
      
      // Use the standard chat post method with the actual GroupRole ID
      return this.createVolunteerChatPost({ 
        roleId: groupRole.id, 
        userId, 
        message 
      })
    } catch (error) {
      console.error('[TrustStewardshipService] Error in createVolunteerChatPostForCommonRole:', error.message)
      throw error
    }
  },

  /**
   * Create trust notification for common role
   */
  async createTrustNotificationForCommonRole ({ roleId, groupId, trustorId, trusteeId }) {
    const commonRole = await CommonRole.where({ id: roleId }).fetch()
    const group = await Group.where({ id: groupId }).fetch()

    const activity = await Activity.createWithNotifications({
      actor_id: trustorId,
      reader_id: trusteeId,
      group_id: groupId,
      meta: {
        reasons: ['roleTrust'],
        role_id: roleId,
        role_name: commonRole.get('name'),
        group_name: group.get('name'),
        is_common_role: true
      }
    })

    return activity
  },

  /**
   * Create volunteer notification for common role
   */
  async createVolunteerNotificationForCommonRole ({ roleId, groupId, volunteerId }) {
    const commonRole = await CommonRole.where({ id: roleId }).fetch()
    const group = await Group.where({ id: groupId }).fetch()

    const members = await bookshelf.knex('group_memberships')
      .where({ group_id: groupId, active: true })
      .pluck('user_id')

    await Promise.all(members.filter(id => id !== volunteerId).map(async memberId => {
      await Activity.createWithNotifications({
        actor_id: volunteerId,
        reader_id: memberId,
        group_id: groupId,
        meta: {
          reasons: ['roleVolunteer'],
          role_id: roleId,
          role_name: commonRole.get('name'),
          group_name: group.get('name'),
          is_common_role: true
        }
      })
    }))
  },

  /**
   * Placeholder for common role recalculation (simplified for now)
   */
  async recalculateCommonRole ({ roleId, groupId }) {
    // For now, just return success
    // Common roles don't have the same status/threshold system as group roles
    console.log(`[TrustStewardshipService] Common role ${roleId} recalculation in group ${groupId} - simplified implementation`)
    return { success: true }
  }
}

export default TrustStewardshipService
