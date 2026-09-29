/* eslint-disable no-unused-expressions */
import setup from '../../../setup'
import factories from '../../../setup/factories'
import {
  ARCHIVED_GROUP_ERROR,
  archivedGroupIds,
  assertPostWritable,
  assertWritable,
  isArchived
} from '../../../../api/models/group/archive'

describe('group/archive', () => {
  let archived, open, spaceInArchived, archivedSpace, post

  before(async () => {
    await setup.clearDb()
    archived = await factories.group({ status: 'archived' }).save()
    open = await factories.group().save()
    spaceInArchived = await factories.group({ type: 'space', parent_id: archived.id }).save()
    // A space can be archived on its own; that is the space's own status, not this one
    archivedSpace = await factories.group({ type: 'space', parent_id: open.id, status: 'archived' }).save()
    post = await factories.post().save()
    await post.groups().attach([open.id, archived.id])
  })

  after(() => setup.clearDb())

  it('treats an archived top-level group and the spaces inside it as archived', async () => {
    expect(await isArchived(archived.id)).to.be.true
    expect(await isArchived(archived)).to.be.true
    expect(await isArchived(spaceInArchived.id)).to.be.true
    expect(await isArchived(open.id)).to.be.false
    expect(await isArchived(archivedSpace.id)).to.be.false
    expect(await archivedGroupIds([open.id, archived.id, spaceInArchived.id, null, 'abc'])).to.have.members([String(archived.id), String(spaceInArchived.id)])
  })

  it('refuses writes to archived groups only', async () => {
    await expect(assertWritable([open.id, archived.id])).to.be.rejectedWith(ARCHIVED_GROUP_ERROR)
    await expect(assertWritable(spaceInArchived)).to.be.rejectedWith(ARCHIVED_GROUP_ERROR)
    await assertWritable([open.id, archivedSpace.id])
    await assertWritable([])
  })

  it('refuses posts to, and changes to posts in, an archived group', async () => {
    await expect(assertPostWritable({ groupIds: [archived.id] })).to.be.rejectedWith(ARCHIVED_GROUP_ERROR)
    await expect(assertPostWritable({ postId: post.id })).to.be.rejectedWith(ARCHIVED_GROUP_ERROR)
    await assertPostWritable({ groupIds: [open.id] })
    const elsewhere = await factories.post().save()
    await elsewhere.groups().attach(open.id)
    await assertPostWritable({ postId: elsewhere.id })
  })
})
