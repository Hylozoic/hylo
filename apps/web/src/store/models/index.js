import { ORM } from 'redux-orm'
import './Model.extension'
import Activity from './Activity'
import Agreement from './Agreement'
import Attachment from './Attachment'
import Comment from './Comment'
import ContentAccess from './ContentAccess'
import Draft from './Draft'
import EventInvitation from './EventInvitation'
import Group, { GroupRelationship, GroupSteward, GroupJoinQuestion, GroupPrerequisite, GroupToGroupJoinQuestion } from './Group'
import GroupView from './GroupView'
import GroupRelationshipInvite, { GroupToGroupJoinRequestQuestionAnswer } from './GroupRelationshipInvite'
import GroupTopic from './GroupTopic'
import Invitation from './Invitation'
import JoinRequest, { GroupJoinQuestionAnswer, Question } from './JoinRequest'
import LinkPreview from './LinkPreview'
import Location from './Location'
import Me, { MySkillsToLearn } from './Me'
import Membership, { MembershipAgreement } from './Membership'
import Message from './Message'
import MessageThread from './MessageThread'
import ModerationAction from './ModerationAction'
import Notification from './Notification'
import Person, { PersonSkillsToLearn, Reaction } from './Person'
import PersonConnection from './PersonConnection'
import PlatformAgreement from './PlatformAgreement'
import Post, { PostFollower, PostCommenter, ProjectMember, ProposalOption, PostUser } from './Post'
import PostMembership from './PostMembership'
import SearchResult from './SearchResult'
import Skill from './Skill'
import Topic from './Topic'
import TopicFollow from './TopicFollow'
import Track, { Role } from './Track'
import FundingRound from './FundingRound'
import Widget from './Widget'

const ORM_MODELS = [
  Activity,
  Agreement,
  Attachment,
  Comment,
  ContentAccess,
  Draft,
  EventInvitation,
  FundingRound,
  Group,
  GroupJoinQuestion,
  GroupJoinQuestionAnswer,
  GroupPrerequisite,
  GroupRelationship,
  GroupRelationshipInvite,
  GroupToGroupJoinQuestion,
  GroupToGroupJoinRequestQuestionAnswer,
  GroupTopic,
  GroupSteward,
  GroupView,
  Invitation,
  JoinRequest,
  LinkPreview,
  Location,
  Me,
  Membership,
  MembershipAgreement,
  Message,
  MessageThread,
  ModerationAction,
  MySkillsToLearn,
  Notification,
  Person,
  PersonConnection,
  PersonSkillsToLearn,
  PlatformAgreement,
  Post,
  PostCommenter,
  PostFollower,
  PostMembership,
  PostUser,
  ProjectMember,
  ProposalOption,
  Question,
  Reaction,
  Role,
  // Responsibility,
  SearchResult,
  Skill,
  Topic,
  TopicFollow,
  Track,
  Widget
]

/** Reuse one ORM instance in dev so Vite HMR does not re-register model descriptors. */
export const orm = typeof globalThis !== 'undefined' && globalThis.__hyloReduxOrm
  ? globalThis.__hyloReduxOrm
  : new ORM({ stateSelector: state => state.orm })

if (typeof globalThis !== 'undefined' && !globalThis.__hyloReduxOrmRegistered) {
  orm.register(...ORM_MODELS)
  globalThis.__hyloReduxOrm = orm
  globalThis.__hyloReduxOrmRegistered = true
}

export default orm
