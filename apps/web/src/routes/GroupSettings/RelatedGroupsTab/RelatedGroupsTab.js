import React, { useState, useEffect, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { get } from 'lodash/fp'
import { bgImageStyle } from 'util/index'
import Button from 'components/ui/button'
import Dropdown from 'components/Dropdown'
import Icon from 'components/Icon'
import RoundImage from 'components/RoundImage'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import useRouteParams from 'hooks/useRouteParams'
import { DEFAULT_AVATAR } from 'store/models/Group'
import { GROUP_RELATIONSHIP_TYPE } from 'store/models/GroupRelationshipInvite'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import { groupUrl } from '@hylo/navigation'
import {
  acceptGroupRelationshipInvite,
  cancelGroupRelationshipInvite,
  deleteGroupRelationship,
  inviteGroupToJoinParent,
  invitePeerRelationship,
  rejectGroupRelationshipInvite,
  requestToAddGroupToParent
} from 'store/actions/groupRelationshipActions'
import {
  getChildGroups,
  getGroupInvitesToJoinThem,
  getGroupInvitesToJoinUs,
  getParentGroups,
  getPeerGroups,
  getPeerGroupInvitesToUs,
  getPeerGroupInvitesFromUs,
  getGroupRequestsToJoinThem,
  getGroupRequestsToJoinUs
} from 'store/selectors/getGroupRelationships'
import presentGroupRelationshipInvite from 'store/presenters/presentGroupRelationshipInvite'
import {
  getPossibleRelatedGroups,
  fetchGroupToGroupJoinQuestions
} from './RelatedGroupsTab.store'

function RelatedGroupsTab () {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const routeParams = useRouteParams()
  const group = useSelector(state => getGroupForSlug(state, routeParams.groupSlug))

  const childGroups = useSelector(state => getChildGroups(state, group))
  const parentGroups = useSelector(state => getParentGroups(state, group))
  const peerGroups = useSelector(state => getPeerGroups(state, group))
  const possibleRelatedGroups = useSelector(state => getPossibleRelatedGroups(state, group))
  const groupInvitesToJoinUs = useSelector(state => getGroupInvitesToJoinUs(state, group))
  const _groupRequestsToJoinUs = useSelector(state => getGroupRequestsToJoinUs(state, group))
  const groupRequestsToJoinUs = useMemo(() => _groupRequestsToJoinUs.map(i => presentGroupRelationshipInvite(i)), [_groupRequestsToJoinUs])
  const groupInvitesToJoinThem = useSelector(state => getGroupInvitesToJoinThem(state, group))
  const groupRequestsToJoinThem = useSelector(state => getGroupRequestsToJoinThem(state, group))
  const peerGroupInvitesToUs = useSelector(state => getPeerGroupInvitesToUs(state, group))
  const peerGroupInvitesFromUs = useSelector(state => getPeerGroupInvitesFromUs(state, group))

  const [showInviteAsChildPicker, setShowInviteAsChildPicker] = useState(false)
  const [showInviteAsPeerPicker, setShowInviteAsPeerPicker] = useState(false)
  const [selectedPeerGroup, setSelectedPeerGroup] = useState(null)
  const [peerDescription, setPeerDescription] = useState('')
  const [showRequestToJoinModalForGroup, setShowRequestToJoinModalForGroup] = useState(false)
  const [showRequestToJoinPicker, setShowRequestToJoinPicker] = useState(false)

  useEffect(() => {
    dispatch(fetchGroupToGroupJoinQuestions())
  }, [dispatch])

  const toggleInviteAsChildPicker = () => {
    setShowInviteAsChildPicker(!showInviteAsChildPicker)
    setShowInviteAsPeerPicker(false) // Close peer picker when opening child picker
  }

  const toggleInviteAsPeerPicker = () => {
    setShowInviteAsPeerPicker(!showInviteAsPeerPicker)
    setShowInviteAsChildPicker(false) // Close child picker when opening peer picker
    // Reset peer selection state when closing
    if (showInviteAsPeerPicker) {
      setSelectedPeerGroup(null)
      setPeerDescription('')
    }
  }

  const hideRequestToJoinModal = () => {
    setShowRequestToJoinModalForGroup(false)
  }

  const toggleRequestToJoinPicker = () => {
    setShowRequestToJoinPicker(!showRequestToJoinPicker)
  }

  const handleRequestToAddGroupToParent = (parentGroup, childGroup) => (e) => {
    if (parentGroup.settings.askGroupToGroupJoinQuestions &&
          parentGroup.groupToGroupJoinQuestions &&
          parentGroup.groupToGroupJoinQuestions.toModelArray().length > 0) {
      setShowRequestToJoinModalForGroup(parentGroup)
    } else {
      dispatch(requestToAddGroupToParent(parentGroup.id, childGroup.id))
    }
    toggleRequestToJoinPicker()
  }

  const handleInviteGroupToJoinParent = (parentId, childId) => (e) => {
    dispatch(inviteGroupToJoinParent(parentId, childId))
    toggleInviteAsChildPicker()
  }

  const handleSelectPeerGroup = (membership) => (e) => {
    setSelectedPeerGroup(membership)
  }

  const handleInvitePeerRelationship = (fromGroupId, toGroupId, description) => (e) => {
    e?.preventDefault()
    dispatch(invitePeerRelationship(fromGroupId, toGroupId, description))
    // Reset state and close picker
    setSelectedPeerGroup(null)
    setPeerDescription('')
    toggleInviteAsPeerPicker()
  }

  const handlePeerDescriptionSubmit = (e) => {
    e.preventDefault()
    if (selectedPeerGroup) {
      handleInvitePeerRelationship(group.id, selectedPeerGroup.group.id, peerDescription.trim() || null)(e)
    }
  }

  const relationshipDropdownItems = (fromGroup, toGroup, type) => {
    if (type === GROUP_RELATIONSHIP_TYPE.PeerToPeer) {
      return [
        {
          icon: <Trash2 className='w-4 h-4 text-destructive' />,
          label: t('Remove Peer Relationship'),
          onClick: () => {
            if (window.confirm(t('Are you sure you want to remove the peer relationship with {{groupName}}?', { groupName: toGroup.name }))) {
              // TODO: This is a temporary solution - ideally we'd pass the relationship ID. Tibet: Why?
              dispatch(deleteGroupRelationship(fromGroup.id, toGroup.id))
            }
          },
          red: true
        }
      ]
    }

    return [
      {
        icon: <Trash2 className='w-4 h-4 text-destructive' />,
        label: type === GROUP_RELATIONSHIP_TYPE.ParentToChild ? t('Remove Child') : t('Leave Parent'),
        onClick: () => {
          if (window.confirm(type === GROUP_RELATIONSHIP_TYPE.ParentToChild
            ? t('Are you sure you want to remove {{groupName}}', { groupName: toGroup.name })
            : t('Are you sure you want to leave {{groupName}}', { groupName: toGroup.name }))) {
            dispatch(deleteGroupRelationship(fromGroup.id, toGroup.id))
          }
        },
        red: true
      }
    ]
  }

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: {
        mobile: `${t('Group Settings')} > ${t('Related Groups')}`,
        desktop: `${t('Related Groups')}`
      },
      icon: 'Settings',
      info: ''
    })
  }, [])

  return (
    <div className='pb-[200px]'>
      <div className='text-2xl font-bold text-foreground mb-4'>{t('Add Group Relationships')}</div>
      <div className='mb-12'>
        {/* Parent Groups Section */}
        <div className='relative mb-4'>
          <Button onClick={toggleRequestToJoinPicker} variant='outline' className='w-full justify-center h-12'>
            <div className='flex items-center'>
              <Icon name='HierarchyUpward' className='mr-2 text-xl relative top-[1px]' />
              <span className='truncate'>{t('Join Parent Groups')}</span>
            </div>
          </Button>
          {showRequestToJoinPicker && (
            <div className='absolute w-full bg-background rounded-b-lg z-10 overflow-hidden top-12 shadow-lg'>
              <div className='h-[150px] sm:h-[300px] overflow-y-auto'>
                {possibleRelatedGroups.map(membership => (
                  <div key={membership.id}>
                    <button onClick={handleRequestToAddGroupToParent(membership.group, group)} className='w-full px-4 py-2 border-b border-foreground/10 text-foreground hover:bg-foreground/5 transition-colors flex items-center justify-between'>
                      <span className='truncate'>{membership.group.name}</span>
                      <span className='border border-selected text-selected rounded-full px-2 py-0.5 text-sm mr-2'>{membership.hasAdministrationAbility ? t('Join') : t('Request')}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Child Groups Section */}
        <div className='relative mb-4'>
          <Button onClick={toggleInviteAsChildPicker} variant='outline' className='w-full justify-center h-12'>
            <div className='flex items-center'>
              <Icon name='HierarchyDownward' className='mr-2 text-xl relative top-[1px]' />
              <span className='truncate'>{t('Add Child Groups')}</span>
            </div>
          </Button>
          {showInviteAsChildPicker && (
            <div className='absolute w-full bg-background rounded-b-lg z-10 overflow-hidden top-12 shadow-lg'>
              <div className='h-[150px] sm:h-[300px] overflow-y-auto'>
                {possibleRelatedGroups.map(membership => (
                  <div key={membership.id}>
                    <button onClick={handleInviteGroupToJoinParent(group.id, membership.group.id)} className='w-full px-4 py-2 border-b border-foreground/10 text-foreground hover:bg-foreground/5 transition-colors flex items-center justify-between'>
                      <span>{membership.group.name}</span>
                      <span className='border border-selected text-selected rounded-full px-2 py-0.5 text-sm mr-2'>{membership.hasAdministrationAbility ? t('Add as Child') : t('Invite as Child')}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Peer Groups Section */}
        <div className='relative'>
          <Button onClick={toggleInviteAsPeerPicker} variant='outline' className='w-full justify-center h-12'>
            <div className='flex items-center'>
              <Icon name='Handshake' className='mr-2 text-xl relative top-[1px]' />
              <span className='truncate'>{t('Add Peer Groups')}</span>
            </div>
          </Button>
          {showInviteAsPeerPicker && (
            <div className='absolute w-full bg-background rounded-b-lg z-10 overflow-hidden top-12 shadow-lg'>
              <div className='h-[150px] sm:h-[300px] overflow-y-auto'>
                {possibleRelatedGroups.map(membership => (
                  <div key={membership.id} className='border-b border-foreground/10'>
                    <button
                      onClick={handleSelectPeerGroup(membership)}
                      className='w-full px-4 py-2 text-foreground hover:bg-foreground/5 transition-colors flex items-center justify-between'
                    >
                      <span>{membership.group.name}</span>
                      <span className='border border-accent text-accent rounded-full px-2 py-0.5 text-sm mr-2'>
                        {membership.hasAdministrationAbility ? t('Add as Peer') : t('Invite as Peer')}
                      </span>
                    </button>
                    {selectedPeerGroup?.id === membership.id && (
                      <div className='px-4 pb-4 bg-foreground/5'>
                        <form onSubmit={handlePeerDescriptionSubmit} className='space-y-3'>
                          <div>
                            <label className='block text-sm text-foreground/70 mb-1'>
                              {t('Description: optional')}
                            </label>
                            <textarea
                              value={peerDescription}
                              onChange={(e) => setPeerDescription(e.target.value)}
                              placeholder={t('Describe the purpose of this peer relationship...')}
                              className='w-full px-3 py-2 text-sm border border-foreground/20 rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent resize-none'
                              rows={2}
                            />
                          </div>
                          <div className='flex justify-end gap-2'>
                            <button
                              type='button'
                              onClick={() => {
                                setSelectedPeerGroup(null)
                                setPeerDescription('')
                              }}
                              className='px-3 py-1 text-sm text-foreground/70 hover:text-foreground transition-colors'
                            >
                              {t('Cancel')}
                            </button>
                            <button
                              type='submit'
                              className='px-4 py-1 text-sm bg-accent text-white rounded-md hover:bg-accent/90 transition-colors'
                            >
                              {membership.hasAdministrationAbility ? t('Add Peer Group') : t('Send Invite')}
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className='text-2xl font-bold text-foreground mb-4 mt-12'>{t('Parent Groups')}</div>
      {parentGroups.length > 0
        ? (
          <div>
            <div className='text-foreground/70 text-sm mb-4'>{parentGroups.length === 1 ? t('{{group.name}} is a member of {{length}} group', { group, length: parentGroups.length }) : t('{{group.name}} is a member of {{length}} groups', { group, length: parentGroups.length })}</div>
            <div className='flex flex-col gap-4'>
              {parentGroups.map(p => (
                <GroupCard
                  group={p}
                  key={p.id}
                  actionMenu={<Dropdown id='related-groups-parent-dropdown' alignRight toggleChildren={<Icon name='More' />} items={relationshipDropdownItems(p, group, GROUP_RELATIONSHIP_TYPE.ChildToParent)} className='right-0 left-auto' />}
                />
              ))}
            </div>
          </div>
          )
        : <div className='text-foreground/70 text-sm'>{t('{{group.name}} is not a member of any groups yet', { group })}</div>}

      {groupInvitesToJoinThem.length > 0 && (
        <div>
          <div className='text-foreground/70 text-sm mb-4'>{t('Open Invitations to Join Other Groups')}</div>
          <div className='flex flex-col gap-4'>
            {groupInvitesToJoinThem.map(invite => {
              return (
                <GroupCard
                  group={invite.fromGroup}
                  key={invite.id}
                  actionMenu={(
                    <div className='flex items-center gap-2'>
                      <button onClick={() => dispatch(rejectGroupRelationshipInvite(invite.id))} className='text-red-500 hover:text-red-600'><Icon name='Ex' /></button>
                      <button onClick={() => dispatch(acceptGroupRelationshipInvite(invite.id))} className='flex items-center gap-1 text-green-500 hover:text-green-600'><Icon name='Heart' /> <span>{t('Join')}</span></button>
                    </div>
                  )}
                />
              )
            })}
          </div>
        </div>
      )}

      {groupRequestsToJoinThem.length > 0 && (
        <div className='mt-8'>
          <div className='text-foreground/70 text-sm mb-4'>{t('Pending requests to join other groups')}</div>
          <div className='flex flex-col gap-4'>
            {groupRequestsToJoinThem.map(invite => {
              return (
                <GroupCard
                  group={invite.toGroup}
                  key={invite.id}
                  actionMenu={(
                    <Button variant='outline' onClick={() => dispatch(cancelGroupRelationshipInvite(invite.id))} className='text-accent border-accent/20 hover:border-accent/100'>{t('Cancel Request')}</Button>
                  )}
                />
              )
            })}
          </div>
        </div>
      )}

      <div className='text-2xl font-bold text-foreground mb-4 mt-12'>{t('Child Groups')}</div>
      {childGroups.length > 0
        ? (
          <div>
            <div className='text-foreground/70 text-sm mb-4'>{childGroups.length === 1 ? t('This group is a member') : t('These {{childGroups.length}} groups are members of {{group.name}}', { childGroups, group })}</div>
            <div className='flex flex-col gap-4'>
              {childGroups.map(c => (
                <GroupCard
                  group={c}
                  key={c.id}
                  actionMenu={<Dropdown id='related-groups-child-dropdown' alignRight toggleChildren={<Icon name='More' />} items={relationshipDropdownItems(group, c, GROUP_RELATIONSHIP_TYPE.ParentToChild)} className='right-0 left-auto' />}
                />
              ))}
            </div>
          </div>
          )
        : <div className='text-foreground/70 text-sm'>{t('No groups are members of {{group.name}} yet', { group })}</div>}

      {groupRequestsToJoinUs.length > 0 && (
        <div>
          <div className='text-foreground/70 text-sm mb-4'>{t('Requests to join {{group.name}}', { group })}</div>
          <div className='flex flex-col gap-4'>
            {groupRequestsToJoinUs.map(invite => {
              return (
                <GroupCard
                  group={invite.fromGroup}
                  thisGroup={group}
                  questionAnswers={invite.questionAnswers}
                  key={invite.id}
                  actionMenu={(
                    <div className='flex items-center gap-2'>
                      <button onClick={() => dispatch(rejectGroupRelationshipInvite(invite.id))} className='text-red-500 hover:text-red-600'><Icon name='Ex' /></button>
                      <button onClick={() => dispatch(acceptGroupRelationshipInvite(invite.id))} className='flex items-center gap-1 text-green-500 hover:text-green-600'><Icon name='Heart' /> <span>{t('Approve')}</span></button>
                    </div>
                  )}
                  type={GROUP_RELATIONSHIP_TYPE.ChildToParent}
                />
              )
            })}
          </div>
        </div>
      )}

      {groupInvitesToJoinUs.length > 0 && (
        <div className='mt-8'>
          <div className='text-foreground/70 text-sm mb-4'>{t('Pending invites to join {{group.name}}', { group })}</div>
          <div className='flex flex-col gap-4'>
            {groupInvitesToJoinUs.map(invite => {
              return (
                <GroupCard
                  group={invite.toGroup}
                  key={invite.id}
                  actionMenu={(
                    <Button variant='outline' onClick={() => dispatch(cancelGroupRelationshipInvite(invite.id))} className='text-accent border-accent/20 hover:border-accent/100'>{t('Cancel Invite')}</Button>
                  )}
                />
              )
            })}
          </div>
        </div>
      )}

      <div className='text-2xl font-bold text-foreground mb-4 mt-8'>{t('Peer Groups')}</div>
      {peerGroups.length > 0
        ? (
          <div>
            <div className='text-foreground/70 text-sm mb-4'>{peerGroups.length === 1 ? t('{{group.name}} has {{length}} peer group', { group, length: peerGroups.length }) : t('{{group.name}} has {{length}} peer groups', { group, length: peerGroups.length })}</div>
            <div className='flex flex-col gap-4'>
              {peerGroups.map(p => (
                <GroupCard
                  group={p}
                  key={p.id}
                  actionMenu={<Dropdown id='related-groups-peer-dropdown' alignRight toggleChildren={<Icon name='More' />} items={relationshipDropdownItems(group, p, GROUP_RELATIONSHIP_TYPE.PeerToPeer)} className='right-0 left-auto' />}
                />
              ))}
            </div>
          </div>
          )
        : <div className='text-foreground/70 text-sm'>{t('{{group.name}} has no peer groups yet. Peer group relationships allow groups to define their relationships outside of a hierarchical structure.', { group })}</div>}

      {peerGroupInvitesToUs.length > 0 && (
        <div className='mt-8'>
          <div className='text-2xl font-bold text-foreground mb-4'>{t('Peer Group Invitations')}</div>
          <div className='text-foreground/70 text-sm mb-4'>{t('Groups that want to form a peer relationship with {{group.name}}', { group })}</div>
          <div className='flex flex-col gap-4'>
            {peerGroupInvitesToUs.map(invite => {
              return (
                <GroupCard
                  group={invite.fromGroup}
                  key={invite.id}
                  actionMenu={(
                    <div className='flex items-center gap-2'>
                      <button onClick={() => dispatch(rejectGroupRelationshipInvite(invite.id))} className='text-red-500 hover:text-red-600'><Icon name='Ex' /></button>
                      <button onClick={() => dispatch(acceptGroupRelationshipInvite(invite.id))} className='flex items-center gap-1 text-green-500 hover:text-green-600'><Icon name='Heart' /> <span>{t('Accept')}</span></button>
                    </div>
                  )}
                  type={GROUP_RELATIONSHIP_TYPE.PeerToPeer}
                />
              )
            })}
          </div>
        </div>
      )}

      {peerGroupInvitesFromUs.length > 0 && (
        <div className='mt-8'>
          <div className='text-2xl font-bold text-foreground mb-4'>{t('Pending Peer Group Invitations')}</div>
          <div className='text-foreground/70 text-sm mb-4'>{t('Peer relationship invitations sent by {{group.name}}', { group })}</div>
          <div className='flex flex-col gap-4'>
            {peerGroupInvitesFromUs.map(invite => {
              return (
                <GroupCard
                  group={invite.toGroup}
                  key={invite.id}
                  actionMenu={(
                    <Button variant='outline' onClick={() => dispatch(cancelGroupRelationshipInvite(invite.id))} className='text-accent border-accent/20 hover:border-accent/100'>{t('Cancel Invite')}</Button>
                  )}
                />
              )
            })}
          </div>
        </div>
      )}

      {showRequestToJoinModalForGroup && (
        <RequestToJoinModal
          group={group}
          parentGroup={showRequestToJoinModalForGroup}
          requestToAddGroupToParent={requestToAddGroupToParent}
          hideRequestToJoinModal={hideRequestToJoinModal}
        />
      )}
    </div>
  )
}

export function GroupCard ({ actionMenu, thisGroup, group, questionAnswers, type }) {
  const otherAnswers = questionAnswers ? questionAnswers.filter(qa => !thisGroup?.groupToGroupJoinQuestions?.find(jq => jq.questionId === qa.question.id)) : []
  const { t } = useTranslation()

  return (
    <div className='flex flex-col'>
      <div className='flex items-center justify-between p-4 bg-foreground/5 rounded-lg hover:bg-foreground/10 transition-colors'>
        <div className='flex items-center gap-2'>
          <RoundImage url={group.avatarUrl || DEFAULT_AVATAR} className='w-[30px] h-[30px] rounded-lg' size='30px' square />
          <Link to={groupUrl(group.slug)} className='text-foreground hover:text-selected'>{group.name}</Link>
        </div>
        {actionMenu}
      </div>
      {type === GROUP_RELATIONSHIP_TYPE.ChildToParent &&
      thisGroup?.settings?.askGroupToGroupJoinQuestions &&
      thisGroup?.groupToGroupJoinQuestions && (
        <div className='p-4 bg-foreground/5 rounded-lg mt-2'>
          {thisGroup.groupToGroupJoinQuestions.toModelArray().map(q =>
            <div className='mb-4' key={q.id}>
              <div className='text-foreground/70 text-sm'>{q.text}</div>
              <p className='text-foreground'>{get('answer', questionAnswers && questionAnswers.find(qa => qa.question.id === q.questionId)) || <i>{t('Not answered')}</i>}</p>
            </div>
          )}
          {otherAnswers.map(qa =>
            <div className='mb-4' key={qa.id}>
              <div className='text-foreground/70 text-sm'>{qa.question.text}</div>
              <p className='text-foreground'>{qa.answer}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RequestToJoinModal ({ group, hideRequestToJoinModal, parentGroup, requestToAddGroupToParent }) {
  const [questionAnswers, setQuestionAnswers] = useState(parentGroup.groupToGroupJoinQuestions.toModelArray().map(q => { return { questionId: q.questionId, text: q.text, answer: '' } }))
  const { t } = useTranslation()

  const setAnswer = (index) => (event) => {
    const answerValue = event.target.value
    setQuestionAnswers(prevAnswers => {
      const newAnswers = [...prevAnswers]
      newAnswers[index].answer = answerValue
      return newAnswers
    })
  }

  return (
    <div className='fixed inset-0 bg-darkening/70 z-[100000] flex items-center justify-center overflow-y-auto py-[70px]'>
      <div className='bg-background rounded-xl w-full max-w-[480px] border border-foreground/20 relative'>
        <div className='bg-foreground/5 p-6 rounded-t-xl'>
          <button onClick={hideRequestToJoinModal} className='absolute top-2 right-2 w-6 h-6 bg-background rounded-full shadow hover:shadow-md transition-shadow flex items-center justify-center'>
            <Icon name='Ex' />
          </button>
          <div className='text-center mb-4 text-foreground'>{t('You are requesting that')}{' '}<strong>{group.name}</strong>{' '}{t('become a member of')}{' '}<strong>{parentGroup.name}</strong></div>
          <div className='flex items-center justify-center gap-4'>
            <div className='w-[120px] h-[100px] flex flex-col items-center justify-center p-2 text-center bg-selected/10 rounded-lg' style={bgImageStyle(group.bannerUrl)}>
              <RoundImage url={group.avatarUrl || DEFAULT_AVATAR} className='w-[50px] h-[50px] mb-2' size='50px' square />
              <h4 className='text-sm font-bold m-0'>{group.name}</h4>
            </div>
            <div className='flex items-center justify-center'>
              <Icon name='Handshake' />
            </div>
            <div className='w-[120px] h-[100px] flex flex-col items-center justify-center p-2 text-center bg-selected/10 rounded-lg' style={bgImageStyle(parentGroup.bannerUrl)}>
              <RoundImage url={parentGroup.avatarUrl || DEFAULT_AVATAR} className='w-[50px] h-[50px] mb-2' size='50px' square />
              <h4 className='text-sm font-bold m-0'>{parentGroup.name}</h4>
            </div>
          </div>
        </div>
        {questionAnswers && (
          <div className='p-6'>
            <div className='text-foreground mb-4'>{t('{{parentGroup.name}} requires groups to answer the following questions before joining', { parentGroup })}</div>
            {questionAnswers.map((q, index) => (
              <div className='mb-4' key={index}>
                <div className='text-foreground/70 text-sm mb-2'>{q.text}</div>
                <textarea
                  name={`question_${q.questionId}`}
                  onChange={setAnswer(index)}
                  value={q.answer}
                  placeholder={t('Type your answer here...')}
                  className='w-full p-2 border-2 border-foreground/20 rounded-lg bg-background text-foreground placeholder:text-foreground/40 focus:border-selected outline-none'
                />
              </div>
            ))}
          </div>
        )}
        <div className='p-6 flex justify-end'>
          <Button onClick={() => { requestToAddGroupToParent(parentGroup.id, group.id, questionAnswers); hideRequestToJoinModal() }}>{t('Request to Join')}</Button>
        </div>
      </div>
    </div>
  )
}

export default RelatedGroupsTab
