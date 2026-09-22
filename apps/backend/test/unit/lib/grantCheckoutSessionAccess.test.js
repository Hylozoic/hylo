/* eslint-env mocha */
const { expect } = require('chai')
const { groupIdsToJoinFromOffering } = require('../../../lib/grantCheckoutSessionAccess')

function mockOffering (attrs) {
  return { get: (k) => attrs[k] }
}

describe('groupIdsToJoinFromOffering', () => {
  it('includes the selling group and granted spaces', () => {
    const ids = groupIdsToJoinFromOffering(mockOffering({
      group_id: 10,
      access_grants: { groupIds: [10, 202] }
    }))
    expect([...ids].sort()).to.deep.equal([10, 202])
  })

  it('parses JSON string access_grants', () => {
    const ids = groupIdsToJoinFromOffering(mockOffering({
      group_id: 10,
      access_grants: JSON.stringify({ groupIds: ['202'] })
    }))
    expect([...ids].sort()).to.deep.equal([10, 202])
  })
})
