import React, { useState, useEffect, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { get } from 'lodash/fp'
import { bgImageStyle, cn } from 'util/index'
import Button from 'components/Button'
import Dropdown from 'components/Dropdown'
import Icon from 'components/Icon'
import RoundImage from 'components/RoundImage'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import useRouteParams from 'hooks/useRouteParams'
import { DEFAULT_AVATAR } from 'store/models/Group'
import { GROUP_RELATIONSHIP_TYPE } from 'store/models/GroupRelationshipInvite'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import { groupUrl } from 'util/navigation'
import {
  acceptGroupRelationshipInvite,
  cancelGroupRelationshipInvite,
  deleteGroupRelationship,
  inviteGroupToJoinParent,
  rejectGroupRelationshipInvite,
  requestToAddGroupToParent
} from 'store/actions/groupRelationshipActions'
import {
  getChildGroups,
  getGroupInvitesToJoinThem,
  getGroupInvitesToJoinUs,
  getParentGroups,
  getGroupRequestsToJoinThem,
  getGroupRequestsToJoinUs
} from 'store/selectors/getGroupRelationships'
import presentGroupRelationshipInvite from 'store/presenters/presentGroupRelationshipInvite'
import {
  getPossibleRelatedGroups,
  fetchGroupToGroupJoinQuestions
} from './RelatedGroupsTab.store'

import classes from './RelatedGroupsTab.module.scss'

function RelatedGroupsTab () {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const routeParams = useRouteParams()
  const group = useSelector(state => getGroupForSlug(state, routeParams.groupSlug))

  const childGroups = useSelector(state => getChildGroups(state, group))
  const parentGroups = useSelector(state => getParentGroups(state, group))
  const possibleRelatedGroups = useSelector(state => getPossibleRelatedGroups(state, group))
  const groupInvitesToJoinUs = useSelector(state => getGroupInvitesToJoinUs(state, group))
  const _groupRequestsToJoinUs = useSelector(state => getGroupRequestsToJoinUs(state, group))
  const groupRequestsToJoinUs = useMemo(() => _groupRequestsToJoinUs.map(i => presentGroupRelationshipInvite(i)), [_groupRequestsToJoinUs])
  const groupInvitesToJoinThem = useSelector(state => getGroupInvitesToJoinThem(state, group))
  const groupRequestsToJoinThem = useSelector(state => getGroupRequestsToJoinThem(state, group))

  const [showInviteAsChildPicker, setShowInviteAsChildPicker] = useState(false)
  const [showRequestToJoinModalForGroup, setShowRequestToJoinModalForGroup] = useState(false)
  const [showRequestToJoinPicker, setShowRequestToJoinPicker] = useState(false)

  useEffect(() => {
    dispatch(fetchGroupToGroupJoinQuestions())
  }, [dispatch])

  const toggleInviteAsChildPicker = () => {
    setShowInviteAsChildPicker(!showInviteAsChildPicker)
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

  const relationshipDropdownItems = (fromGroup, toGroup, type) => {
    return [
      {
        icon: 'Trash',
        label: type === GROUP_RELATIONSHIP_TYPE.ParentToChild ? t('Remove Child') : t('Leave Parent'),
        onClick: () => {
          if (window.confirm(GROUP_RELATIONSHIP_TYPE.ParentToChild
            ? t('Are you sure you want to remove {{groupName}}', { groupName: group.name })
            : t('Are you sure you want to leave {{groupName}}', { groupName: group.name }))) {
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
      title: `${t('Group Settings')} > ${t('Related Groups')}`,
      icon: 'Settings',
      info: ''
    })
  }, [])

  return (
    <div className={classes.container}>
      <div className={classes.title}>{t('Parent Groups')}</div>
      {parentGroups.length > 0
        ? (
          <div>
            <div className={classes.subtitle}>{parentGroups.length === 1 ? t('This is the one group') : t('These are the {{length}} groups that {{group.name}} is a member of', { group, length: parentGroups.length })}</div>
            <div className={classes.groupList}>
              {parentGroups.map(p => (
                <GroupCard
                  group={p}
                  key={p.id}
                  actionMenu={<Dropdown toggleChildren={<Icon name='More' />} items={relationshipDropdownItems(p, group, GROUP_RELATIONSHIP_TYPE.ChildToParent)} className={classes.relatedGroupDropdown} />}
                />
              ))}
            </div>
          </div>
          )
        : <div className={classes.subtitle}>{t('{{group.name}} is not a member of any groups yet', { group })}</div>}

      {groupInvitesToJoinThem.length > 0 && (
        <div>
          <div className={classes.subtitle}>{t('Open Invitations to Join Other Groups')}</div>
          <div className={classes.groupList}>
            {groupInvitesToJoinThem.map(invite => {
              return (
                <GroupCard
                  group={invite.fromGroup}
                  key={invite.id}
                  actionMenu={(
                    <div>
                      <span className={classes.rejectButton} onClick={() => dispatch(rejectGroupRelationshipInvite(invite.id))}><Icon name='Ex' className={classes.rejectIcon} /></span>
                      <span className={classes.acceptButton} onClick={() => dispatch(acceptGroupRelationshipInvite(invite.id))}><Icon name='Heart' className={classes.acceptIcon} /> <span>{t('Join')}</span></span>
                    </div>
                  )}
                />
              )
            })}
          </div>
        </div>
      )}

      {groupRequestsToJoinThem.length > 0 && (
        <div>
          <div className={classes.subtitle}>{t('Pending requests to join other groups')}</div>
          <div className={classes.groupList}>
            {groupRequestsToJoinThem.map(invite => {
              return (
                <GroupCard
                  group={invite.toGroup}
                  key={invite.id}
                  actionMenu={(
                    <div>
                      <span className={classes.cancelButton} onClick={() => dispatch(cancelGroupRelationshipInvite(invite.id))}>{t('Cancel Request')}</span>
                    </div>
                  )}
                />
              )
            })}
          </div>
        </div>
      )}

      <div className={classes.groupPickerContainer}>
        <Button className={classes.connectButton} onClick={toggleRequestToJoinPicker}>
          <div>
            <Icon name='Handshake' className={classes.connectIcon} />
            {t('Join {{group.name}} to another group', { group })}
          </div>
          <span className={classes.connectLabel}>{t('REQUEST')}</span>
        </Button>
        {showRequestToJoinPicker && (
          <div className={classes.groupPicker}>
            <div className={classes.groupPickerList}>
              {possibleRelatedGroups.map(membership => (
                <div key={membership.id}>
                  <span className={classes.inviteButton} onClick={handleRequestToAddGroupToParent(membership.group, group)}>
                    <b>{membership.hasAdministrationAbility ? t('Join') : t('Request')}</b>
                    {membership.group.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={classes.title}>{t('Child Groups')}</div>
      {childGroups.length > 0
        ? (
          <div>
            <div className={classes.subtitle}>{childGroups.length === 1 ? t('This group is a member') : t('These {{childGroups.length}} groups are members of {{group.name}}', { childGroups, group })}</div>
            <div className={classes.groupList}>
              {childGroups.map(c => (
                <GroupCard
                  group={c}
                  key={c.id}
                  actionMenu={<Dropdown toggleChildren={<Icon name='More' />} items={relationshipDropdownItems(group, c, GROUP_RELATIONSHIP_TYPE.ParentToChild)} className={classes.relatedGroupDropdown} />}
                />
              ))}
            </div>
          </div>
          )
        : <div className={classes.subtitle}>{t('No groups are members of {{group.name}} yet', { group })}</div>}

      {groupRequestsToJoinUs.length > 0 && (
        <div>
          <div className={classes.subtitle}>{t('Requests to join {{group.name}}', { group })}</div>
          <div className={classes.groupList}>
            {groupRequestsToJoinUs.map(invite => {
              return (
                <GroupCard
                  group={invite.fromGroup}
                  thisGroup={group}
                  questionAnswers={invite.questionAnswers}
                  key={invite.id}
                  actionMenu={(
                    <div>
                      <span className={classes.rejectButton} onClick={() => dispatch(rejectGroupRelationshipInvite(invite.id))}><Icon name='Ex' className={classes.rejectIcon} /></span>
                      <span className={classes.acceptButton} onClick={() => dispatch(acceptGroupRelationshipInvite(invite.id))}><Icon name='Heart' className={classes.acceptIcon} /> <span>{t('Approve')}</span></span>
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
        <div>
          <div className={classes.subtitle}>{t('Pending invites to join {{group.name}}', { group })}</div>
          <div className={classes.groupList}>
            {groupInvitesToJoinUs.map(invite => {
              return (
                <GroupCard
                  group={invite.toGroup}
                  key={invite.id}
                  actionMenu={(
                    <div>
                      <span className={classes.cancelButton} onClick={() => dispatch(cancelGroupRelationshipInvite(invite.id))}>{t('Cancel Invite')}</span>
                    </div>
                  )}
                />
              )
            })}
          </div>
        </div>
      )}

      <div className={classes.groupPickerContainer}>
        <Button className={classes.connectButton} onClick={toggleInviteAsChildPicker}>
          <div>
            <Icon name='Handshake' className={classes.connectIcon} />
            {t('Invite a group to join')}{' '}<strong>{group.name}</strong>
          </div>
          <span className={classes.connectLabel}>{t('INVITE')}</span>
        </Button>
        {showInviteAsChildPicker && (
          <div className={classes.groupPicker}>
            <div className={classes.groupPickerList}>
              {possibleRelatedGroups.map(membership => (
                <div key={membership.id}>
                  <span className={classes.inviteButton} onClick={handleInviteGroupToJoinParent(group.id, membership.group.id)}>
                    <b>{membership.hasAdministrationAbility ? t('Add') : t('Invite')}</b>
                    {membership.group.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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

// export function SearchBar ({ search, setSearch }) {
//   var selected = find(o => o.id === sortBy, sortOptions)

//   if (!selected) selected = sortOptions[0]

//   return <div className={classes.searchBar}>
//     <TextInput className={classes.searchInput}
//       value={search}
//       placeholder={this.props.t('Search groups by name')}
//       onChange={event => setSearch(event.target.value)} />
//   </div>
// }

export function GroupCard ({ actionMenu, thisGroup, group, questionAnswers, type }) {
  // Answers to questions no longer being asked by the group
  const otherAnswers = questionAnswers ? questionAnswers.filter(qa => !thisGroup.groupToGroupJoinQuestions.find(jq => jq.questionId === qa.question.id)) : []
  const { t } = useTranslation()

  return (
    <div className={classes.groupCardWrapper}>
      <div className={classes.groupCard}>
        <div className={classes.groupDetails}>
          <RoundImage url={group.avatarUrl || DEFAULT_AVATAR} className={cn(classes.groupImage, classes.square)} size='30px' />
          <Link to={groupUrl(group.slug)}><span className={classes.groupName}>{group.name}</span></Link>
        </div>
        {actionMenu}
      </div>
      {type === GROUP_RELATIONSHIP_TYPE.ChildToParent &&
      thisGroup.settings.askGroupToGroupJoinQuestions &&
      thisGroup.groupToGroupJoinQuestions &&
      thisGroup.groupToGroupJoinQuestions && (
        <div className={classes.answerWrapper}>
          {type === GROUP_RELATIONSHIP_TYPE.ChildToParent &&
          thisGroup.settings.askGroupToGroupJoinQuestions &&
          thisGroup.groupToGroupJoinQuestions &&
          thisGroup.groupToGroupJoinQuestions.toModelArray().map(q =>
            <div className={classes.answer} key={q.id}>
              <div className={classes.subtitle}>{q.text}</div>
              <p>{get('answer', questionAnswers && questionAnswers.find(qa => qa.question.id === q.questionId)) || <i>{t('Not answered')}</i>}</p>
            </div>
          )}
          {otherAnswers.map(qa =>
            <div className={classes.answer} key={qa.id}>
              <div className={classes.subtitle}>{qa.question.text}</div>
              <p>{qa.answer}</p>
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
    <>
      <div className={classes.requestModalBg}>
        <div className={classes.requestModal}>
          <div className={classes.requestTop}>
            <span className={cn(classes.modalCloseButton)} onClick={hideRequestToJoinModal}><Icon name='Ex' /></span>
            <span className={classes.requestMessage}>{t('You are requesting that')}{' '}<strong>{group.name}</strong>{' '}{t('become a member of')}{' '}<strong>{parentGroup.name}</strong></span>
            <div className={classes.joinExample}>
              <div className={cn(classes.requestingGroup)} style={bgImageStyle(group.bannerUrl)}>
                <RoundImage url={group.avatarUrl || DEFAULT_AVATAR} className={cn(classes.groupImage)} size='30px' square />
                <h4>{group.name}</h4>
              </div>
              <div className={classes.requestingIcon}>
                <Icon name='Handshake' />
              </div>
              <div className={cn(classes.requestedParentGroup)} style={bgImageStyle(parentGroup.bannerUrl)}>
                <RoundImage url={parentGroup.avatarUrl || DEFAULT_AVATAR} className={cn(classes.groupImage)} size='30px' square />
                <h4>{parentGroup.name}</h4>
              </div>
            </div>
          </div>
          {questionAnswers && (
            <div className={classes.joinQuestions}>
              <div className={classes.requestMessageTitle}>{t('{{parentGroup.name}} requires groups to answer the following questions before joining', { parentGroup })}</div>
              {questionAnswers.map((q, index) => (
                <div className={classes.joinQuestion} key={index}>
                  <div className={classes.subtitle}>{q.text}</div>
                  <textarea name={`question_${q.questionId}`} onChange={setAnswer(index)} value={q.answer} placeholder={t('Type your answer here...')} />
                </div>
              ))}
            </div>
          )}
          <div className={classes.requestBottom}>
            <Button onClick={() => { requestToAddGroupToParent(parentGroup.id, group.id, questionAnswers); hideRequestToJoinModal() }}>{t('Request to Join')}</Button>
          </div>
        </div>
      </div>
    </>
  )
}

export default RelatedGroupsTab
