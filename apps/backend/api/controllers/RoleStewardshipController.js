/* eslint-disable camelcase, no-undef, no-trailing-spaces, eol-last */
import TrustStewardshipService from '../services/TrustStewardshipService'

module.exports = {
  async volunteer (req, res) {
    try {
      const roleId = req.param('roleId')
      const userId = req.session.userId
      const { message, groupId } = req.body || {}
      
      const isCommonRole = await TrustStewardshipService.isCommonRole(roleId)
      
      if (isCommonRole) {
        if (!groupId) return res.badRequest('groupId required for common role volunteer')
        await TrustStewardshipService.setTrustForCommonRole({ roleId, groupId, trustorId: userId, trusteeId: userId, value: 1 })
      } else {
        await TrustStewardshipService.setTrust({ roleId, trustorId: userId, trusteeId: userId, value: 1 })
      }
      
      // If there's a message, post it to the general chat
      if (message && message.trim()) {
        if (isCommonRole) {
          await TrustStewardshipService.createVolunteerChatPostForCommonRole({ roleId, groupId, userId, message })
        } else {
          await TrustStewardshipService.createVolunteerChatPost({ roleId, userId, message })
        }
      }
      
      Analytics.track({
        userId,
        event: 'Role Stewardship: Volunteer',
        properties: { roleId, isCommonRole, hasMessage: !!message }
      })
      
      res.ok({ success: true })
    } catch (err) {
      res.serverError(err)
    }
  },

  async nominate (req, res) {
    try {
      const roleId = req.param('roleId')
      const userId = req.session.userId
      const { trustee_id, message } = req.body || {}
      if (!trustee_id) return res.badRequest('trustee_id required')
      
      await TrustStewardshipService.setTrust({ roleId, trustorId: userId, trusteeId: trustee_id, value: 1 })
      
      // If there's a message, post it to the general chat
      if (message && message.trim()) {
        await TrustStewardshipService.createNominationChatPost({ roleId, nominatorId: userId, nomineeId: trustee_id, message })
      }
      
      Analytics.track({
        userId,
        event: 'Role Stewardship: Nominate',
        properties: { roleId, trusteeId: trustee_id, hasMessage: !!message }
      })
      
      res.ok({ success: true })
    } catch (err) {
      res.serverError(err)
    }
  },

  async trust (req, res) {
    try {
      const roleId = req.param('roleId')
      const userId = req.session.userId
      const { trustee_id, value } = req.body || {}
      if (typeof trustee_id === 'undefined') return res.badRequest('trustee_id required')
      if (typeof value === 'undefined') return res.badRequest('value required')
      await TrustStewardshipService.setTrust({ roleId, trustorId: userId, trusteeId: trustee_id, value })
      
      Analytics.track({
        userId,
        event: 'Role Stewardship: Express Trust',
        properties: { roleId, trusteeId: trustee_id, value }
      })
      
      res.ok({ success: true })
    } catch (err) {
      res.serverError(err)
    }
  },

  async trustData (req, res) {
    try {
      const roleId = req.param('roleId')
      const userId = req.session.userId
      
      console.log(`[TrustData] Starting request for roleId: ${roleId}, userId: ${userId}`)
      
      // Detect if this is a common role (IDs 1, 2, 3) or group role
      const isCommonRole = await TrustStewardshipService.isCommonRole(roleId)
      
      if (isCommonRole) {
        // For common roles, we need a group context
        const groupId = req.param('groupId') || req.query.groupId
        if (!groupId) {
          return res.badRequest('groupId required for common role trust data')
        }
        const trustData = await TrustStewardshipService.getTrustDataForCommonRole({ roleId, groupId, userId })
        console.log(`[TrustData] Successfully fetched common role data for role ${roleId} in group ${groupId}`)
        res.ok(trustData)
      } else {
        const trustData = await TrustStewardshipService.getTrustDataForRole({ roleId, userId })
        console.log(`[TrustData] Successfully fetched group role data for role ${roleId}`)
        res.ok(trustData)
      }
    } catch (err) {
      console.error(`[TrustData] Error for roleId ${req.param('roleId')}:`, err.message)
      console.error('[TrustData] Stack trace:', err.stack)
      res.serverError(err)
    }
  },

  async recalculate (req, res) {
    try {
      const roleId = req.param('roleId')
      const role = await TrustStewardshipService.recalculateRole(roleId)
      
      Analytics.track({
        userId: req.session.userId,
        event: 'Role Stewardship: Manual Recalculate',
        properties: { roleId, status: role.get('status') }
      })
      
      res.ok({ success: true, role })
    } catch (err) {
      res.serverError(err)
    }
  },

  async recalculateRoles (req, res) {
    try {
      const groupId = req.param('groupId')
      const userId = req.session.userId
      
      console.log(`[RecalculateRoles] Starting recalculation for groupId: ${groupId}, userId: ${userId}`)
      
      // Get all group roles for this group
      const roles = await GroupRole.where({ group_id: groupId }).fetchAll()
      
      // Recalculate each role with the new threshold algorithm
      const results = await Promise.all(roles.map(async role => {
        const result = await TrustStewardshipService.recalculateRole(role.id)
        return {
          roleId: role.id,
          roleName: role.get('name'),
          newThreshold: result.get('threshold_required'),
          currentTrust: result.get('threshold_current'),
          status: result.get('status')
        }
      }))
      
      console.log(`[RecalculateRoles] Successfully recalculated ${results.length} roles`)
      res.ok({ 
        message: 'Roles recalculated successfully',
        results 
      })
    } catch (err) {
      console.error(`[RecalculateRoles] Error:`, err.message)
      res.serverError(err)
    }
  }
} 