import { attr, Model } from 'redux-orm'

class UserProfileLink extends Model {
  toString () {
    return `UserProfileLink: ${this.title || this.url}`
  }
}

export default UserProfileLink

UserProfileLink.modelName = 'UserProfileLink'

UserProfileLink.fields = {
  id: attr(),
  url: attr(),
  title: attr(),
  iconUrl: attr(),
  sortOrder: attr(),
  createdAt: attr(),
  updatedAt: attr()
}
