import { attr, fk, Model } from 'redux-orm'

class ContentAccess extends Model {
  toString () {
    return `ContentAccess: ${this.id}`
  }
}

export default ContentAccess

ContentAccess.modelName = 'ContentAccess'

ContentAccess.fields = {
  id: attr(),
  createdAt: attr(),
  updatedAt: attr(),
  userId: attr(),
  user: fk('Person', 'contentAccess'),
  grantedByGroupId: attr(),
  grantedByGroup: fk('Group', 'grantedContentAccess'),
  groupId: attr(),
  group: fk('Group', 'contentAccess'),
  trackId: attr(),
  track: fk('Track', 'contentAccess'),
  groupRoleId: attr(),
  groupRole: attr(), // Stored as plain object, not ORM model
  commonRoleId: attr(),
  commonRole: attr(), // Stored as plain object, not ORM model
  accessType: attr(),
  stripeSessionId: attr(),
  stripeSubscriptionId: attr(),
  status: attr(),
  grantedById: attr(),
  grantedBy: fk('Person', 'grantedContentAccess'),
  expiresAt: attr(),
  metadata: attr(),
  offering: attr() // Note: StripeOffering is not a model in Redux, so we store the whole object
}
