require(require('root-path')('test/setup'))
const factories = require(require('root-path')('test/setup/factories'))

describe('Admin', () => {
  let admin, hyloEmailUser, lookalikeUser, tester, oldAdmins, oldTesters

  before(async () => {
    oldAdmins = process.env.HYLO_ADMINS
    oldTesters = process.env.HYLO_TESTER_IDS
    admin = await factories.user({ email: 'admin-by-id@example.com' }).save()
    hyloEmailUser = await factories.user({ email: 'not-listed@hylo.com' }).save()
    lookalikeUser = await factories.user({ email: 'someone@hylo.com.attacker.net' }).save()
    tester = await factories.user().save()
    process.env.HYLO_ADMINS = ` ${admin.id}, ,abc`
    process.env.HYLO_TESTER_IDS = String(tester.id)
  })

  after(() => {
    process.env.HYLO_ADMINS = oldAdmins
    process.env.HYLO_TESTER_IDS = oldTesters
  })

  describe('isSignedIn', () => {
    it('is true only for users listed in HYLO_ADMINS', () => {
      expect(Admin.isSignedIn({ session: { userId: admin.id, userEmail: admin.get('email') } })).to.be.true
      expect(Admin.isSignedIn({ session: { userId: hyloEmailUser.id, userEmail: 'not-listed@hylo.com' } })).to.be.false
      expect(Admin.isSignedIn({ session: { userId: lookalikeUser.id, userEmail: 'someone@hylo.com.attacker.net' } })).to.be.false
      expect(Admin.isSignedIn({ session: {} })).to.be.false
    })
  })

  describe('isSuperAdmin', () => {
    it('ignores email domain and uses HYLO_ADMINS', async () => {
      expect(await Admin.isSuperAdmin(admin.id)).to.be.true
      expect(await Admin.isSuperAdmin(hyloEmailUser.id)).to.be.false
      expect(await Admin.isSuperAdmin(lookalikeUser.id)).to.be.false
      expect(await Admin.isSuperAdmin(null)).to.be.false
    })
  })

  describe('isTestAdmin', () => {
    it('allows HYLO_TESTER_IDS and HYLO_ADMINS only', async () => {
      expect(await Admin.isTestAdmin(tester.id)).to.be.true
      expect(await Admin.isTestAdmin(admin.id)).to.be.true
      expect(await Admin.isTestAdmin(hyloEmailUser.id)).to.be.false
    })
  })
})
