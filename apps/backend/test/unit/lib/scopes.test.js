import { expect } from 'chai'
import {
  SCOPE_TYPES,
  createScope,
  parseScope,
  isValidScope,
  createGroupScope,
  createTrackScope,
  createGroupRoleScope,
  isScopeOfType,
  getEntityIdFromScope,
  createScopesFromContentAccess
} from '../../../lib/scopes'

describe('Scope Helper Functions', () => {
  describe('createScope', () => {
    it('creates a valid scope string', () => {
      expect(createScope('group', 123)).to.equal('group:123')
      expect(createScope('track', '456')).to.equal('track:456')
      expect(createScope('group_role', 789)).to.equal('group_role:789')
    })

    it('throws error for invalid type', () => {
      expect(() => createScope('invalid', 123)).to.throw('Invalid scope type')
    })

    it('throws error for missing entityId', () => {
      expect(() => createScope('group')).to.throw('Entity ID is required')
      expect(() => createScope('group', null)).to.throw('Entity ID is required')
    })
  })

  describe('parseScope', () => {
    it('parses valid scope strings', () => {
      expect(parseScope('group:123')).to.deep.equal({ type: 'group', entityId: '123' })
      expect(parseScope('track:456')).to.deep.equal({ type: 'track', entityId: '456' })
      expect(parseScope('group_role:789')).to.deep.equal({ type: 'group_role', entityId: '789' })
    })

    it('returns null for invalid scope strings', () => {
      expect(parseScope('invalid:123')).to.be.null
      expect(parseScope('group')).to.be.null
      expect(parseScope('group:')).to.be.null
      expect(parseScope('group:123:extra')).to.be.null
      expect(parseScope('')).to.be.null
      expect(parseScope(null)).to.be.null
      expect(parseScope(123)).to.be.null
    })
  })

  describe('isValidScope', () => {
    it('validates scope strings', () => {
      expect(isValidScope('group:123')).to.be.true
      expect(isValidScope('track:456')).to.be.true
      expect(isValidScope('group_role:789')).to.be.true
      expect(isValidScope('invalid:123')).to.be.false
      expect(isValidScope('group')).to.be.false
      expect(isValidScope('')).to.be.false
    })
  })

  describe('createGroupScope', () => {
    it('creates a group scope', () => {
      expect(createGroupScope(123)).to.equal('group:123')
      expect(createGroupScope('456')).to.equal('group:456')
    })
  })

  describe('createTrackScope', () => {
    it('creates a track scope', () => {
      expect(createTrackScope(123)).to.equal('track:123')
      expect(createTrackScope('456')).to.equal('track:456')
    })
  })

  describe('createGroupRoleScope', () => {
    it('creates a group role scope', () => {
      expect(createGroupRoleScope(123)).to.equal('group_role:123')
      expect(createGroupRoleScope('456')).to.equal('group_role:456')
    })
  })

  describe('isScopeOfType', () => {
    it('checks if scope is of specific type', () => {
      expect(isScopeOfType('group:123', 'group')).to.be.true
      expect(isScopeOfType('track:456', 'track')).to.be.true
      expect(isScopeOfType('group_role:789', 'group_role')).to.be.true
      expect(isScopeOfType('group:123', 'track')).to.be.false
      expect(isScopeOfType('invalid:123', 'group')).to.be.false
    })
  })

  describe('getEntityIdFromScope', () => {
    it('extracts entity ID from scope', () => {
      expect(getEntityIdFromScope('group:123')).to.equal('123')
      expect(getEntityIdFromScope('track:456')).to.equal('456')
      expect(getEntityIdFromScope('group_role:789')).to.equal('789')
      expect(getEntityIdFromScope('invalid:123')).to.be.null
      expect(getEntityIdFromScope('group')).to.be.null
    })
  })

  describe('createScopesFromContentAccess', () => {
    it('creates scopes from content access object', () => {
      const contentAccess = {
        trackIds: [1, 2],
        groupIds: [3],
        roleIds: [4, 5, 6]
      }

      const scopes = createScopesFromContentAccess(contentAccess)

      expect(scopes).to.have.lengthOf(6)
      expect(scopes).to.include('track:1')
      expect(scopes).to.include('track:2')
      expect(scopes).to.include('group:3')
      expect(scopes).to.include('group_role:4')
      expect(scopes).to.include('group_role:5')
      expect(scopes).to.include('group_role:6')
    })

    it('handles empty content access', () => {
      expect(createScopesFromContentAccess({})).to.deep.equal([])
      expect(createScopesFromContentAccess(null)).to.deep.equal([])
      expect(createScopesFromContentAccess(undefined)).to.deep.equal([])
    })

    it('handles partial content access', () => {
      const contentAccess = {
        trackIds: [1]
      }

      const scopes = createScopesFromContentAccess(contentAccess)

      expect(scopes).to.have.lengthOf(1)
      expect(scopes).to.include('track:1')
    })

    it('ignores non-array values', () => {
      const contentAccess = {
        trackIds: 'not-an-array',
        groupIds: [1],
        roleIds: null
      }

      const scopes = createScopesFromContentAccess(contentAccess)

      expect(scopes).to.have.lengthOf(1)
      expect(scopes).to.include('group:1')
    })
  })
})

