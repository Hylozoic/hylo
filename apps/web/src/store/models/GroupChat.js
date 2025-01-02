import { attr, many, Model, fk } from 'redux-orm'

class GroupChat extends Model {
  toString () {
    return `GroupChat: ${this.name}`
  }
}

export default GroupChat

GroupChat.modelName = 'GroupChat'

GroupChat.fields = {
  accessibility: attr(),
  commonRoles: many('CommonRole'),
  id: attr(),
  members: many('Person'),
  memberCount: attr(),
  name: attr(),
  posts: many('Post'),
  postCount: attr(),
  settings: attr(),
  slug: attr(),
  type: attr(),
  visibility: attr()
}
