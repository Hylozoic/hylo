import { attr, many, Model } from 'redux-orm'

// export class TrackUser extends Model { }
// TrackUser.modelName = 'TrackUser'
// TrackUser.fields = {
//   track: fk('Track', 'trackusers'),
//   user: fk('User', 'trackusers')
// }

class Track extends Model {
  currentAction () {
    return this.posts.toModelArray().find(post => !post.completedAt)
  }

  toString () {
    return `Track: ${this.name}`
  }
}

export default Track

Track.modelName = 'Track'

Track.fields = {
  actionsName: attr(),
  bannerUrl: attr(),
  completionBadgeEmoji: attr(),
  completionMessage: attr(),
  description: attr(),
  groups: many('Group'),
  name: attr(),
  numActions: attr(),
  numPeopleCompleted: attr(),
  numPeopleEnrolled: attr(),
  posts: many('Post'),
  publishedAt: attr(),
  welcomeMessage: attr(),
  users: many('Person')
}
