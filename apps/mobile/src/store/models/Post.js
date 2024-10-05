import { attr, fk, many, Model } from 'redux-orm'
import { get } from 'lodash/fp'
import PropTypes from 'prop-types'
import { butterflyBush, caribbeanGreen, fakeAlpha, flushOrange, gold, pictonBlue, sunsetOrange } from 'style/colors'

// proposal status
export const PROPOSAL_STATUS_DISCUSSION = 'discussion'
export const PROPOSAL_STATUS_VOTING = 'voting'
export const PROPOSAL_STATUS_CASUAL = 'casual'
export const PROPOSAL_STATUS_COMPLETED = 'completed'

// Voting methods
export const VOTING_METHOD_SINGLE = 'single'
export const VOTING_METHOD_MULTI_UNRESTRICTED = 'multi-unrestricted'

export class PostFollower extends Model {}
PostFollower.modelName = 'PostFollower'
PostFollower.fields = {
  post: fk('Post', 'postfollowers'),
  follower: fk('Person', 'postfollowers')
}

export class PostCommenter extends Model {}
PostCommenter.modelName = 'PostCommenter'
PostCommenter.fields = {
  post: fk('Post', 'postcommenters'),
  commenter: fk('Person', 'postcommenters')
}

export class ProjectMember extends Model {}
ProjectMember.modelName = 'ProjectMember'
ProjectMember.fields = {
  post: fk('Post', 'projectmembers'),
  member: fk('Person', 'projectmembers')
}

class Post extends Model {
  toString () {
    return `Post: ${this.name}`
  }

  images () {
    return this.attachments.filter(x => x.type === 'image')
  }

  getImageUrls () {
    return this.images().orderBy(get('position')).toRefArray().map(x => x.url)
  }

  files () {
    return this.attachments.filter(x => x.type === 'file')
  }

  getFileUrls () {
    return this.files().orderBy(get('position')).toRefArray().map(get('url'))
  }
}

export default Post

Post.modelName = 'Post'
Post.fields = {
  id: attr(),
  title: attr(),
  type: attr(),
  location: attr(),
  locationId: fk({
    to: 'Location',
    as: 'locationObject'
  }),
  details: attr(),
  linkPreview: fk('LinkPreview', 'posts'),
  creator: fk('Person', 'posts'),
  followers: many({
    to: 'Person',
    relatedName: 'postsFollowing',
    through: 'PostFollower',
    throughFields: [ 'post', 'follower' ]
  }),
  groups: many('Group'),
  groupsTotal: attr(),
  postMemberships: many('PostMembership'),
  commenters: many({
    to: 'Person',
    relatedName: 'postsCommented',
    through: 'PostCommenter',
    throughFields: [ 'post', 'commenter' ]
  }),
  members: many({
    to: 'Person',
    relatedName: 'projectsJoined',
    through: 'ProjectMember',
    throughFields: [ 'post', 'member' ]
  }),
  commentersTotal: attr(),
  createdAt: attr(),
  startsAt: attr(),
  endsAt: attr(),
  fulfilledAt: attr(),
  donationsLink: attr(),
  projectManagementLink: attr(),
  peopleReactedTotal: attr(),
  // do I have to fix this for reacts?
  topics: many('Topic'),
  isPublic: attr()
}

export const POST_TYPES = {
  discussion: {
    primaryColor: pictonBlue,
    backgroundColor: fakeAlpha(pictonBlue, 0.2),
    map: false
  },
  event: {
    primaryColor: sunsetOrange,
    backgroundColor: fakeAlpha(sunsetOrange, 0.2),
    map: true
  },
  offer: {
    primaryColor: caribbeanGreen,
    backgroundColor: fakeAlpha(caribbeanGreen, 0.2),
    map: true
  },
  resource: {
    primaryColor: gold,
    backgroundColor: fakeAlpha(gold, 0.2),
    map: true
  },
  project: {
    primaryColor: flushOrange,
    backgroundColor: fakeAlpha(flushOrange, 0.2),
    map: false
  },
  request: {
    primaryColor: caribbeanGreen,
    backgroundColor: fakeAlpha(caribbeanGreen, 0.2),
    map: true
  },
  proposal: {
    primaryColor: butterflyBush,
    backgroundColor: fakeAlpha(butterflyBush, 0.2),
    map: true
  }
}

export const POST_PROP_TYPES = {
  id: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number
  ]),
  type: PropTypes.string,
  title: PropTypes.string,
  details: PropTypes.string,
  location: PropTypes.string,
  locationObject: PropTypes.object,
  name: PropTypes.string,
  upVotes: PropTypes.string,
  updatedAt: PropTypes.string,
  imageUrl: PropTypes.string,
  linkPreview: PropTypes.object,
  groups: PropTypes.array,
  isPublic: PropTypes.bool
}
