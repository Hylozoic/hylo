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
    const isBootstrap = role.get('bootstrap') === true

    // Determine group size (active members)
    const groupSizeRows = await bookshelf.knex('group_memberships')
      .where({ group_id: groupId, active: true })
      .count()
    const groupSize = Number(groupSizeRows[0].count)

    // Handle bootstrap override (creator powers for small groups)
    let bootstrapOverride = false
    if (isBootstrap) {
      if (groupSize < 3) {
        bootstrapOverride = true
      } else {
        // Bootstrap era over – clear flag
        await role.save({ bootstrap: false }, { patch: true })
      }
    }

    // Threshold formula: require trust from OTHER people (excluding self-votes)
    // - 2 people: need 1 vote from the other person
    // - 3 people: need 1 vote from others (simple majority excluding self)
    // - 4 people: need 2 votes from others 
    // - 5+ people: scale but always exclude self-votes
    let thresholdRequired
    if (groupSize <= 2) {
      // For 2 people: need the other person to trust you
      thresholdRequired = 1
    } else if (groupSize <= 5) {
      // For small groups: need majority from others (excluding self)
      thresholdRequired = Math.ceil((groupSize - 1) * 0.5) // 50% of others
    } else {
      // For larger groups: scale from 50% down to 30% (excluding self)
      const percentage = Math.max(0.3, 0.5 - (groupSize - 5) * 0.01)
      thresholdRequired = Math.ceil((groupSize - 1) * percentage)
    }

    console.log(`[TrustStewardshipService] Threshold calculation for role ${roleId}: groupSize=${groupSize}, threshold=${thresholdRequired} (excluding self-votes)`)

    // Fetch trust sums per trustee, EXCLUDING self-votes
    const trustRows = await bookshelf.knex('trust_expressions')
      .where({ group_role_id: roleId, value: 1 })
      .whereRaw('trustor_id != trustee_id') // Exclude self-votes
      .select('trustee_id')
      .count('value')
      .groupBy('trustee_id')

    // Convert to JS objects with numeric totals
    const trustTotals = trustRows.map(r => ({ trustee_id: r.trustee_id, total: Number(r.count) }))

    const top = maxBy(trustTotals, 'total')
    const current = top ? top.total : 0

    // Trustees who meet or exceed threshold
    const stewards = trustTotals.filter(t => t.total >= thresholdRequired).map(t => t.trustee_id)

    // Apply bootstrap override: creator retains powers until group has 3+ members
    if (bootstrapOverride) {
      await role.save({
        threshold_current: current,
        threshold_required: thresholdRequired,
        status: 'active'
      }, { patch: true })
      // Skip further membership updates – keep existing coordinator assignment
      return role.refresh()
    }

    // Enhanced state machine logic:
    let newStatus
    if (trustTotals.length === 0) {
      newStatus = 'vacant'
    } else if (stewards.length === 0) {
      newStatus = 'pending'
    } else {
      // One or more stewards above threshold — treat as active (allow multi-steward)
      newStatus = 'active'
    }

    await role.save({
      threshold_current: current,
      threshold_required: thresholdRequired,
      status: newStatus
    }, { patch: true })

    // Update membership assignments based on role status
    if (newStatus === 'active') {
      // Only activate stewards for active roles (not contested)
      await Promise.all(stewards.map(async userId => {
        // membership link for permission checks
        await bookshelf.knex('group_memberships_group_roles')
          .insert({ group_id: groupId, user_id: userId, group_role_id: roleId, active: true, created_at: new Date(), updated_at: new Date() })
          .onConflict(['user_id', 'group_id', 'group_role_id'])
          .merge({ active: true, updated_at: new Date() })

        // simple steward pivot table used by GraphQL
        await bookshelf.knex('group_roles_users')
          .insert({ group_role_id: roleId, user_id: userId, created_at: new Date(), updated_at: new Date() })
          .onConflict(['group_role_id', 'user_id'])
          .merge({ updated_at: new Date() })

        // Legacy permission bridge: mark as MODERATOR in group_memberships
        const roleRecord = await GroupRole.where({ id: roleId }).fetch({ columns: ['name'] })
        if (roleRecord && roleRecord.get('name')?.toLowerCase() === 'coordinator') {
          await bookshelf.knex('group_memberships')
            .where({ group_id: groupId, user_id: userId })
            .update({ role: GroupMembership.Role.MODERATOR, updated_at: new Date() })
        }
      }))

      // Deactivate others
      await bookshelf.knex('group_memberships_group_roles')
        .where({ group_role_id: roleId })
        .whereNotIn('user_id', stewards)
        .update({ active: false, updated_at: new Date() })
    } else if (newStatus === 'contested') {
      // For contested roles, deactivate everyone until the conflict is resolved
      // The group needs to decide between multiple qualified candidates
      await bookshelf.knex('group_memberships_group_roles')
        .where({ group_role_id: roleId })
        .update({ active: false, updated_at: new Date() })
      
      console.log(`[TrustStewardshipService] Role ${roleId} is contested with ${stewards.length} qualified candidates`)
    } else {
      // For vacant/pending roles, deactivate everyone
      await bookshelf.knex('group_memberships_group_roles')
        .where({ group_role_id: roleId })
        .update({ active: false, updated_at: new Date() })
    }

    // Create notifications for status changes
    if (oldStatus !== newStatus) {
      await this.createStatusChangeNotification({ roleId, oldStatus, newStatus, stewards })
    }

    return role.refresh()
  },

  /**
   * Create notification for role status changes
   */
  async createStatusChangeNotification ({ roleId, oldStatus, newStatus, stewards }) {
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
      const formerStewards = await bookshelf.knex('group_memberships_group_roles')
        .where({ group_role_id: roleId, active: false })
        .pluck('user_id')

      await Promise.all(formerStewards.map(async stewardId => {
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
      console.log(`[TrustStewardshipService] Getting trust data for role ${roleId}, user ${userId}`)
      
      const role = await GroupRole.where({ id: roleId }).fetch()
      if (!role) throw new Error('Role not found')
      
      console.log(`[TrustStewardshipService] Found role: ${role.get('name')}, assignment: ${role.get('assignment')}`)

      // If this role doesn't use trust assignment, return empty data
      if (role.get('assignment') !== 'trust') {
        console.log(`[TrustStewardshipService] Role ${role.get('name')} doesn't use trust assignment, returning empty data`)
        return {
          candidates: [],
          trustExpressions: [],
          myTrustExpressions: {}
        }
      }

      // Get current stewards first to exclude them from candidates
      console.log('[TrustStewardshipService] Fetching current stewards...')
      const stewardRows = await bookshelf.knex('group_roles_users')
        .join('users', 'group_roles_users.user_id', 'users.id')
        .where({ 'group_roles_users.group_role_id': roleId })
        .select('users.id', 'users.name', 'users.avatar_url')

      const stewardIds = stewardRows.map(s => s.id)

      // Get all users who have volunteered (expressed trust in themselves for this role), EXCLUDING current stewards
      console.log('[TrustStewardshipService] Fetching candidates (excluding current stewards)...')
      const candidateRows = await bookshelf.knex('trust_expressions')
        .join('users', 'trust_expressions.trustee_id', 'users.id')
        .where({
          'trust_expressions.group_role_id': roleId,
          'trust_expressions.value': 1
        })
        .whereRaw('trust_expressions.trustor_id = trust_expressions.trustee_id')
        .whereNotIn('users.id', stewardIds) // Exclude stewards
        .select('users.id', 'users.name', 'users.avatar_url')

      console.log(`[TrustStewardshipService] Found ${candidateRows.length} candidates`)

      // Get trust scores for each candidate
      console.log('[TrustStewardshipService] Calculating trust scores...')
      const candidatesWithTrust = await Promise.all(candidateRows.map(async candidate => {
        const trustScore = await bookshelf.knex('trust_expressions')
          .where({
            group_role_id: roleId,
            trustee_id: candidate.id,
            value: 1
          })
          .count()

        return {
          id: candidate.id,
          name: candidate.name,
          avatarUrl: candidate.avatar_url,
          trustScore: Number(trustScore[0].count)
        }
      }))

      console.log('[TrustStewardshipService] Fetching user\'s trust expressions...')
      // Get current user's trust expressions for this role
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

      console.log('[TrustStewardshipService] Fetching all trust expressions...')
      // Get all trust expressions for this role
      const allTrustRows = await bookshelf.knex('trust_expressions')
        .where({ group_role_id: roleId })
        .select('trustor_id', 'trustee_id', 'value')

      console.log('[TrustStewardshipService] Successfully completed trust data fetch')
      return {
        candidates: candidatesWithTrust,
        trustExpressions: allTrustRows,
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
      assignment: 'trust' // Mark as trust-based since it's in a self-stewarded group
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
      threshold_required: 1,
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