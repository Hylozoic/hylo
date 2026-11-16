/* eslint-disable no-unused-expressions */
import setup from '../../setup'
import factories from '../../setup/factories'
import { mockify, unspyify } from '../../setup/helpers'

describe('User lifecycle email', () => {
  before(() => setup.clearDb())
  after(() => setup.clearDb())

  describe('the welcome email', () => {
    let sent

    beforeEach(() => {
      sent = []
      mockify(Email, 'sendWelcomeEmail', opts => { sent.push(opts); return Promise.resolve(true) })
    })

    afterEach(() => unspyify(Email, 'sendWelcomeEmail'))

    it("goes out in the recipient's language", async () => {
      const user = await factories.user({ settings: { locale: 'es' } }).save()
      await User.sendWelcomeEmail({ userId: user.id })
      expect(sent).to.have.length(1)
      expect(sent[0].locale).to.equal('es-ES')
      expect(sent[0].email).to.equal(user.get('email'))
    })

    it('falls back to English', async () => {
      const user = await factories.user({ settings: {} }).save()
      await User.sendWelcomeEmail({ userId: user.id })
      expect(sent[0].locale).to.equal('en-US')
    })
  })
})
