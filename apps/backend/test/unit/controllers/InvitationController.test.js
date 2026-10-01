/* eslint-disable no-unused-expressions */
const root = require('root-path')
require(root('test/setup'))
const factories = require(root('test/setup/factories'))
const InvitationController = require(root('api/controllers/InvitationController'))

describe('InvitationController', () => {
  let req, res, invitation, inviter, group

  const optOutRows = email => bookshelf.knex('invitation_opt_outs').where({ email })

  before(async () => {
    inviter = await factories.user({ name: 'Visible Inviter Name' }).save()
    group = await factories.group({ name: 'Visible Group Name' }).save()
    invitation = await Invitation.create({ userId: inviter.id, groupId: group.id, email: 'Opt.Out@Controller.com' })
  })

  beforeEach(() => {
    req = factories.mock.request()
    res = factories.mock.response()
  })

  describe('showOptOut', () => {
    it('asks to confirm and records nothing, showing only the address', async () => {
      req.params = { token: invitation.get('token') }
      await InvitationController.showOptOut(req, res)

      expect(res.statusCode).to.equal(200)
      expect(res.headers['Content-Type']).to.match(/text\/html/)
      expect(res.body).to.include('Stop invitations to opt.out@controller.com?')
      expect(res.body).to.include('<form method="post">')
      expect(res.body).to.not.include('Visible Inviter Name')
      expect(res.body).to.not.include('Visible Group Name')
      expect(await optOutRows('opt.out@controller.com')).to.have.lengthOf(0)
    })

    it('answers the same way for a link that matches no invitation', async () => {
      req.params = { token: 'not-a-token' }
      await InvitationController.showOptOut(req, res)

      expect(res.statusCode).to.equal(404)
      expect(res.body).to.include("This link doesn't work anymore.")
      expect(res.body).to.not.include('<form')
    })

    it('uses the language of the email the link came from', async () => {
      req.params = { token: invitation.get('token') }
      req.query = { locale: 'de-DE' }
      await InvitationController.showOptOut(req, res)

      expect(res.body).to.include('Einladungen an opt.out@controller.com stoppen?')
    })
  })

  describe('optOut', () => {
    it('records the address once, however often the button is pressed', async () => {
      req.params = { token: invitation.get('token') }
      await InvitationController.optOut(req, res)
      expect(res.statusCode).to.equal(200)
      expect(res.body).to.include("Done. opt.out@controller.com won't get any more invitations from Hylo.")

      const again = factories.mock.response()
      await InvitationController.optOut(req, again)
      expect(again.statusCode).to.equal(200)

      const rows = await optOutRows('opt.out@controller.com')
      expect(rows).to.have.lengthOf(1)
      expect(rows[0].invitation_id).to.equal(invitation.id)

      const shown = factories.mock.response()
      await InvitationController.showOptOut(req, shown)
      expect(shown.body).to.include("Done. opt.out@controller.com won't get any more invitations from Hylo.")
      expect(shown.body).to.not.include('<form')
    })

    it('records nothing for a link that matches no invitation', async () => {
      req.params = { token: 'not-a-token' }
      await InvitationController.optOut(req, res)
      expect(res.statusCode).to.equal(404)
      expect(await bookshelf.knex('invitation_opt_outs').count('* as count').first()).to.deep.equal({ count: '1' })
    })
  })
})
