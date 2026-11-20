/* eslint-disable no-unused-expressions */
import setup from '../../test/setup'
import factories from '../../test/setup/factories'
import { FREE_UPLOAD_LIMIT_BYTES, PRO_PLUS_UPLOAD_LIMIT_BYTES, PRO_UPLOAD_LIMIT_BYTES } from '@hylo/shared'
import { groupIdsForUpload, parseGroupIds, uploadLimitForRequest } from './limits'

/* global HyloProSubscription */

describe('uploader limits', () => {
  describe('parseGroupIds', () => {
    it('accepts an array, a comma-separated string or one id, and drops blanks and "new"', () => {
      expect(parseGroupIds(['1', 2, '1'])).to.deep.equal(['1', '2'])
      expect(parseGroupIds('3, 4,,new')).to.deep.equal(['3', '4'])
      expect(parseGroupIds(5)).to.deep.equal(['5'])
      expect(parseGroupIds(undefined)).to.deep.equal([])
    })
  })

  describe('uploadLimitForRequest', () => {
    let member, outsider, proGroup, plusGroup, freeGroup, proPost

    before(async () => {
      await setup.clearDb()
      member = await factories.user().save()
      outsider = await factories.user().save()
      proGroup = await factories.group().save()
      plusGroup = await factories.group().save()
      freeGroup = await factories.group().save()
      await member.joinGroup(proGroup)
      await member.joinGroup(plusGroup)
      await member.joinGroup(freeGroup)
      await HyloProSubscription.forge({ group_id: proGroup.id, source: 'manual', status: 'active', tier: 'pro' }).save()
      await HyloProSubscription.forge({ group_id: plusGroup.id, source: 'manual', status: 'active', tier: 'pro_plus' }).save()
      proPost = await factories.post({ user_id: member.id }).save()
      await proPost.groups().attach(proGroup.id)
    })

    after(() => setup.clearDb())

    it('gives the free limit to uploads that are not for a group', async () => {
      expect(await uploadLimitForRequest({ userId: member.id, type: 'userAvatar', id: member.id })).to.equal(FREE_UPLOAD_LIMIT_BYTES)
      expect(await uploadLimitForRequest({ userId: member.id, type: 'post', id: 'new' })).to.equal(FREE_UPLOAD_LIMIT_BYTES)
      expect(await uploadLimitForRequest({ userId: member.id, type: 'comment', id: 'new', groupIds: [] })).to.equal(FREE_UPLOAD_LIMIT_BYTES)
    })

    it('gives the Pro limit to a new post or comment in a group with largerUploads', async () => {
      expect(await uploadLimitForRequest({ userId: member.id, type: 'post', id: 'new', groupIds: [proGroup.id] })).to.equal(PRO_UPLOAD_LIMIT_BYTES)
      expect(await uploadLimitForRequest({ userId: member.id, type: 'comment', id: 'new', groupIds: String(proGroup.id) })).to.equal(PRO_UPLOAD_LIMIT_BYTES)
    })

    it('gives the Pro Plus limit to a group with higherUploadLimits', async () => {
      expect(await uploadLimitForRequest({ userId: member.id, type: 'post', id: 'new', groupIds: [plusGroup.id] })).to.equal(PRO_PLUS_UPLOAD_LIMIT_BYTES)
      expect(await uploadLimitForRequest({ userId: member.id, type: 'groupBanner', id: plusGroup.id })).to.equal(PRO_PLUS_UPLOAD_LIMIT_BYTES)
    })

    it('gives the free limit to a group without Pro, and the highest limit to a mix of groups', async () => {
      expect(await uploadLimitForRequest({ userId: member.id, type: 'post', id: 'new', groupIds: [freeGroup.id] })).to.equal(FREE_UPLOAD_LIMIT_BYTES)
      expect(await uploadLimitForRequest({ userId: member.id, type: 'post', id: 'new', groupIds: [freeGroup.id, proGroup.id] })).to.equal(PRO_UPLOAD_LIMIT_BYTES)
      expect(await uploadLimitForRequest({ userId: member.id, type: 'post', id: 'new', groupIds: [freeGroup.id, proGroup.id, plusGroup.id] })).to.equal(PRO_PLUS_UPLOAD_LIMIT_BYTES)
      expect(await uploadLimitForRequest({ userId: member.id, type: 'comment', id: 'new', groupIds: [plusGroup.id, freeGroup.id] })).to.equal(PRO_PLUS_UPLOAD_LIMIT_BYTES)
    })

    it('ignores groups the user is not a member of, and groups that do not exist', async () => {
      expect(await uploadLimitForRequest({ userId: outsider.id, type: 'post', id: 'new', groupIds: [proGroup.id] })).to.equal(FREE_UPLOAD_LIMIT_BYTES)
      expect(await uploadLimitForRequest({ userId: member.id, type: 'post', id: 'new', groupIds: ['999999999'] })).to.equal(FREE_UPLOAD_LIMIT_BYTES)
      expect(await groupIdsForUpload({ userId: outsider.id, type: 'post', id: 'new', groupIds: [proGroup.id] })).to.deep.equal([])
      // a member of a free group can't borrow a Pro Plus group's limit by naming it alongside
      const freeOnly = await factories.user().save()
      await freeOnly.joinGroup(freeGroup)
      expect(await uploadLimitForRequest({ userId: freeOnly.id, type: 'post', id: 'new', groupIds: [freeGroup.id, plusGroup.id] })).to.equal(FREE_UPLOAD_LIMIT_BYTES)
      expect(await uploadLimitForRequest({ userId: member.id, type: 'post', id: 'new', groupIds: [proGroup.id, '999999999'] })).to.equal(PRO_UPLOAD_LIMIT_BYTES)
    })

    it('uses the groups of an existing post, whatever the client sends', async () => {
      expect(await groupIdsForUpload({ userId: member.id, type: 'post', id: proPost.id, groupIds: [freeGroup.id] })).to.deep.equal([String(proGroup.id)])
      expect(await uploadLimitForRequest({ userId: member.id, type: 'post', id: proPost.id, groupIds: [freeGroup.id] })).to.equal(PRO_UPLOAD_LIMIT_BYTES)
      expect(await uploadLimitForRequest({ userId: member.id, type: 'postCompletion', id: proPost.id })).to.equal(PRO_UPLOAD_LIMIT_BYTES)
    })

    it('uses the group itself for group avatars, banners and welcome pages', async () => {
      expect(await uploadLimitForRequest({ userId: member.id, type: 'groupBanner', id: proGroup.id })).to.equal(PRO_UPLOAD_LIMIT_BYTES)
      expect(await uploadLimitForRequest({ userId: member.id, type: 'welcomePage', id: freeGroup.id })).to.equal(FREE_UPLOAD_LIMIT_BYTES)
      expect(await uploadLimitForRequest({ userId: member.id, type: 'groupAvatar', id: 'new' })).to.equal(FREE_UPLOAD_LIMIT_BYTES)
    })

    it('follows the feature, not the tier: a Pro grant with largerUploads switched off keeps the free limit', async () => {
      const group = await factories.group().save()
      await member.joinGroup(group)
      await HyloProSubscription.forge({ group_id: group.id, source: 'manual', status: 'active', tier: 'pro', features: { largerUploads: false } }).save()
      expect(await uploadLimitForRequest({ userId: member.id, type: 'post', id: 'new', groupIds: [group.id] })).to.equal(FREE_UPLOAD_LIMIT_BYTES)
    })

    it('gives a Pro group with higherUploadLimits granted outside its tier the Pro Plus limit', async () => {
      const group = await factories.group().save()
      await member.joinGroup(group)
      await HyloProSubscription.forge({ group_id: group.id, source: 'manual', status: 'active', tier: 'pro', features: { higherUploadLimits: true } }).save()
      expect(await uploadLimitForRequest({ userId: member.id, type: 'post', id: 'new', groupIds: [group.id] })).to.equal(PRO_PLUS_UPLOAD_LIMIT_BYTES)
    })
  })
})
