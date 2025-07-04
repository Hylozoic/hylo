import { ORM } from 'redux-orm'
import './Model.extension'
import Activity from './Activity'
import Agreement from './Agreement'
import Attachment from './Attachment'
import Collection, { CollectionPost } from './Collection'
import Comment from './Comment'
import CommonRole from './CommonRole'
import CustomView from './CustomView'
import EventInvitation from './EventInvitation'
import Group, { ChatRoom, GroupRelationship, GroupSteward, GroupJoinQuestion, GroupPrerequisite, GroupToGroupJoinQuestion } from './Group'
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
import Person, { MembershipCommonRole, PersonSkillsToLearn, Reaction } from './Person'
import PersonConnection from './PersonConnection'
import PlatformAgreement from './PlatformAgreement'
import Post, { PostFollower, PostCommenter, ProjectMember, ProposalOption, PostUser } from './Post'
import PostMembership from './PostMembership'
import SearchResult from './SearchResult'
import Skill from './Skill'
import Topic from './Topic'
import TopicFollow from './TopicFollow'
import Track, { Role } from './Track'
import Widget from './Widget'

export const orm = new ORM({ stateSelector: state => state.orm })

orm.register(
  Activity,
  Agreement,
  Attachment,
  ChatRoom,
  Collection,
  CollectionPost,
  Comment,
  CommonRole,
  CustomView,
  EventInvitation,
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
  Invitation,
  JoinRequest,
  LinkPreview,
  Location,
  Me,
  Membership,
  MembershipAgreement,
  MembershipCommonRole,
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
)

export default orm
