/* eslint-disable no-unused-expressions */
import setup from '../../setup'
import factories from '../../setup/factories'
const CommentController = require('../../../api/controllers/CommentController')
const PostController = require('../../../api/controllers/PostController')

const redirectQuery = url => Object.fromEntries(new URL(url, 'http://localhost').searchParams)

// Inbound email arrives as multipart/form-data
function attachMultipartEmailFields (req, fields) {
  const boundary = '----archivedboundary' + Math.random().toString(36).slice(2, 14)
  let body = ''
  for (const [name, value] of Object.entries(fields)) {
    body += `--${boundary}\r\n`
    body += `Content-Disposition: form-data; name="${name}"\r\n\r\n`
    body += `${value}\r\n`
  }
  body += `--${boundary}--\r\n`
  req.headers['content-type'] = `multipart/form-data; boundary=${boundary}`
  req.body = Buffer.from(body, 'utf8')
  req.is = mime => mime === 'multipart/form-data'
}

describe('email replies and email posts in an archived group', () => {
  let member, archived, space, post, spacePost, req, res

  before(async () => {
    await setup.clearDb()
    member = await factories.user().save()
    archived = await factories.group().save()
    space = await factories.group({ type: 'space', parent_id: archived.id }).save()
    await archived.addMembers([member.id])
    await archived.save({ status: 'archived' }, { patch: true })
    post = await factories.post({ user_id: member.id, created_at: new Date('2020-12-12 00:00:00') }).save()
    await post.groups().attach(archived.id)
    spacePost = await factories.post({ user_id: member.id, created_at: new Date('2020-12-12 00:00:00') }).save()
    await spacePost.groups().attach(space.id)
    await Tag.findOrCreate('request')
  })

  after(() => setup.clearDb())

  beforeEach(() => {
    req = factories.mock.request()
    res = factories.mock.response()
  })

  const commentCount = async p => Number(await Comment.where({ post_id: p.id }).count())

  it('adds no comment from a reply by email, and answers without an error', async () => {
    for (const target of [post, spacePost]) {
      req = factories.mock.request()
      res = factories.mock.response()
      attachMultipartEmailFields(req, {
        'stripped-text': 'a reply',
        to: Email.postReplyAddress(target.id, member.id)
      })
      await CommentController.createFromEmail(req, res)
      expect(res.statusCode).to.equal(200)
      expect(res.ok).not.to.have.been.called()
      expect(await commentCount(target)).to.equal(0)
    }
  })

  it('adds no comment from the email reply form', async () => {
    res.locals.tokenData = { groupId: archived.id, userId: member.id }
    req.params[`post-${post.id}`] = 'a form reply'

    await CommentController.createBatchFromEmailForm(req, res)
    expect(await commentCount(post)).to.equal(0)
    expect(redirectQuery(res.redirected).error).to.equal('true')
  })

  it('creates no post from the email post form', async () => {
    Object.assign(req.params, { type: 'request', name: 'a seed swap', description: 'bring seeds' })
    res.locals.tokenData = { groupId: archived.id, userId: member.id }

    await PostController.createFromEmailForm(req, res)
    expect(redirectQuery(res.redirected)).to.deep.equal({
      notification: 'Your post was not created. That group is archived.',
      error: '1'
    })
    expect(await Post.where({ user_id: member.id, name: "I'm looking for a seed swap" }).fetch()).to.not.exist
  })
})
