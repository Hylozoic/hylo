import { isEmpty, includes } from 'lodash/fp'
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import {
  addGroupRole,
  addRoleToMember,
  fetchGroupRoleDetails,
  fetchMembersForGroupRole,
  ROLE_MEMBERS_PAGE_SIZE,
  removeRoleFromMember,
  updateGroupRole
} from '../../../store/actions/roles'
import ScrollListener from 'components/ScrollListener'
import {
  removeResponsibilityFromRole,
  addResponsibilityToRole,
  fetchResponsibilitiesForGroup
} from 'store/actions/responsibilities'
import {
  fetchStewardSuggestions,
  clearStewardSuggestions,
  getStewardSuggestions
} from './RolesSettingsTab.store'
import { fetchGroupSettings } from '../GroupSettings.store'
import SettingsSection from '../SettingsSection'
import EmojiPicker from 'components/EmojiPicker'
import SettingsControl from 'components/SettingsControl'
import Icon from 'components/Icon'
import RemovableListItem from 'components/RemovableListItem'
import KeyControlledItemList from 'components/KeyControlledList/KeyControlledItemList'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { keyMap } from 'util/textInput'
import { cn } from 'util/index'
import { personUrl } from '@hylo/navigation'
import { sortCustomGroupRoles, sortSystemGroupRoles, isSystemGroupRole } from '@hylo/hooks/groupRoleHelpers'

import styles from './RolesSettingsTab.module.scss'

const emptyRole = {
  color: '',
  description: '',
  emoji: '',
  name: '',
  active: ''
}

const validateRole = ({ name, emoji }) => {
  if (name.length < 3) return false
  if (emoji === '') return false
  return true
}

function RolesSettingsTab ({ group, slug }) {
  const dispatch = useDispatch()
  const suggestions = useSelector(getStewardSuggestions)
  const { t } = useTranslation()

  const systemRoles = useMemo(
    () => sortSystemGroupRoles(group?.groupRoles?.items || []),
    [group?.groupRoles?.items]
  )
  const customRolesFromGroup = useMemo(
    () => sortCustomGroupRoles((group?.groupRoles?.items || []).filter(role => !isSystemGroupRole(role))),
    [group?.groupRoles?.items]
  )
  const [rolesOverride, setRolesOverride] = useState(null)
  const roles = rolesOverride ?? customRolesFromGroup
  const [availableResponsibilities, setAvailableResponsibilities] = useState([])
  const { setHeaderDetails } = useViewHeader()

  useEffect(() => {
    if (!group?.id) return
    let isMounted = true
    dispatch(fetchResponsibilitiesForGroup({ groupId: group.id }))
      .then((response) => {
        if (isMounted) setAvailableResponsibilities(response?.payload?.data?.responsibilities || [])
      })
      .catch((e) => { console.error('Error fetching responsibilities for group', e) })
    return () => { isMounted = false }
  }, [group?.id, dispatch])

  useEffect(() => {
    setHeaderDetails({
      title: `${t('Group Settings')} > ${t('Roles & Badges')}`,
      icon: 'Settings',
      info: ''
    })

    return () => {
      dispatch(clearStewardSuggestions())
    }
  }, [])

  const handleAddRole = () => {
    setRolesOverride([...roles, { ...emptyRole }])
  }

  const deleteUnsavedRole = (i) => () => {
    if (window.confirm(t('Are you sure you want to delete this unsaved role/badge?'))) {
      const newRoles = [...roles]
      newRoles.splice(i, 1)
      setRolesOverride(newRoles)
    }
  }

  const toggleRoleActivation = (i) => () => {
    const role = roles[i]
    if (window.confirm(`${t('Are you sure you want to ')}${role.active ? t('deactivate') : t('reactivate')} ${t('this role/badge?')}`)) {
      dispatch(updateGroupRole({ active: !role.active, groupId: group?.id, groupRoleId: role.id })).then((response) => {
        const saved = response.payload.data.updateGroupRole
        setRolesOverride(prev => (prev ?? customRolesFromGroup).map((r, idx) => idx === i ? { ...saved } : r))
        if (slug || group?.slug) dispatch(fetchGroupSettings(slug || group.slug))
      })
    }
  }

  const updateLocalRole = (i) => (key) => (v) => {
    const value = typeof (v.target) !== 'undefined' ? v.target.value : v
    const role = { ...roles[i] }
    if (role.changed !== true) role.originalState = { ...role }
    role[key] = value
    role.changed = true
    const updatedRoles = [...roles]
    updatedRoles[i] = role
    setRolesOverride(updatedRoles)
  }

  const saveRole = (i) => () => {
    const role = { ...roles[i] }
    if (validateRole(role)) {
      dispatch(addGroupRole({ ...role, groupId: group?.id })).then((response) => {
        const saved = response.payload.data.addGroupRole
        setRolesOverride(prev => (prev ?? customRolesFromGroup).map((r, idx) => idx === i ? { ...saved } : r))
        if (slug || group?.slug) dispatch(fetchGroupSettings(slug || group.slug))
      })
    } else {
      window.alert(t('A role must have a valid emoji and name to be saved'))
    }
  }

  const resetRole = (i) => () => {
    const role = { ...roles[i] }
    const updatedRoles = [...roles]
    updatedRoles[i] = { ...role.originalState }
    setRolesOverride(updatedRoles)
  }

  const updateRole = (i) => () => {
    const role = { ...roles[i] }
    if (validateRole(role)) {
      dispatch(updateGroupRole({ ...role, groupId: group?.id, groupRoleId: role.id })).then((response) => {
        const saved = response.payload.data.updateGroupRole
        setRolesOverride(prev => (prev ?? customRolesFromGroup).map((r, idx) => idx === i ? { ...saved } : r))
        if (slug || group?.slug) dispatch(fetchGroupSettings(slug || group.slug))
      })
    } else {
      window.alert(t('A role must have a valid emoji and name to be updated'))
    }
  }

  const unsavedRolePresent = roles.length > 0 ? roles[roles.length - 1]?.active === '' : false

  return (
    <>
      <SettingsSection>
        <h2 className='text-foreground'>{t('Common Roles')}</h2>
        <div className='text-foreground/70 text-xs'>{t('adminRolesHelpText')}</div>
        {systemRoles.map((role, i) => (
          <RoleRow
            group={group}
            suggestions={suggestions}
            availableResponsibilities={availableResponsibilities}
            key={role.id || i}
            index={i}
            {...role}
            isSystemRole
          />
        ))}
      </SettingsSection>
      <SettingsSection>
        <h3>{t('Custom Roles & Badges')}</h3>
        <div className='text-foreground/70 text-xs mb-2'>{t('Create additional roles or badges for your group')}</div>
        {roles.map((role, i) => (
          <RoleRow
            group={group}
            suggestions={suggestions}
            availableResponsibilities={availableResponsibilities}
            key={i}
            index={i}
            {...role}
            onChange={updateLocalRole(i)}
            onSave={saveRole(i)}
            onUpdate={updateRole(i)}
            onToggleActivation={toggleRoleActivation(i)}
            onDelete={deleteUnsavedRole(i)}
            onReset={resetRole(i)}
          />
        ))}
        {!unsavedRolePresent && (
          <div className='border-2 border-foreground/30 rounded-lg p-2 text-foreground cursor-pointer m-2' onClick={handleAddRole}>
            <h4>{t('Create new role/badge')}</h4>
            <Icon name='Circle-Plus' className={styles.newRole} />
          </div>
        )}
      </SettingsSection>
      <br />
    </>
  )
}

RolesSettingsTab.propTypes = {
  addGroupRole: PropTypes.func,
  addRoleToMember: PropTypes.func,
  group: PropTypes.object,
  removeRoleFromMember: PropTypes.func,
  slug: PropTypes.string,
  updateGroupRole: PropTypes.func
}

function RoleRow ({
  active,
  addRoleToMember,
  availableResponsibilities,
  changed,
  isSystemRole,
  description,
  emoji,
  group,
  id,
  name,
  onChange = () => {},
  onDelete,
  onToggleActivation,
  onReset,
  onSave,
  onUpdate,
  suggestions = [],
  removeRoleFromMember
}) {
  const { t } = useTranslation()
  const isDraftRole = active === ''
  const inactiveStyle = (!active && !isDraftRole && !isSystemRole) ? styles.inactive : ''
  return (
    <div className={cn('relative bg-foreground/5 rounded-lg my-4 pb-2', inactiveStyle)}>
      {!isSystemRole &&
        <div className={styles.actionContainer}>
          {isDraftRole && (
            <span onClick={onDelete} className={styles.action}><Icon name='Trash' /> {t('Delete')}</span>
          )}
          {!isDraftRole && changed && (
            <>
              <span className={styles.action} onClick={onUpdate}><Icon name='Unlock' /> {t('Save')}</span>
              <span className={styles.action} onClick={onReset}><Icon name='Back' /> {t('Revert')}</span>
            </>
          )}
          {!isDraftRole && !changed && (
            <span className={styles.action} onClick={onToggleActivation}><Icon name={active ? 'CircleEx' : 'CircleArrow'} /> {active ? t('Deactivate') : t('Reactivate')}</span>
          )}
        </div>}
      <div className='flex flex-col relative w-full p-2'>
        <EmojiPicker forReactions={false} emoji={emoji} handleReaction={onChange('emoji')} className='absolute top-[2.7rem] left-[1rem] w-[40px] h-[40px] bg-foreground/5 rounded flex items-center justify-center cursor-pointer hover:bg-foreground/10 hover:shadow-xl border-2 border-foreground/50 hover:border-foreground/50 transition-all' />
        <SettingsControl label='Name & Badge' onChange={onChange('name')} value={name} inputStyle={{ paddingLeft: '3.5rem' }} />
      </div>
      <div className='p-2'>
        <SettingsControl label='Description' onChange={onChange('description')} value={description} type='textarea' />
      </div>
      {
        isDraftRole
          ? (
            <div className={cn(styles.roleRow, styles.reverseFlex)}>
              <div className={styles.createButton} onClick={onSave}>{t('Create Role')}</div>
            </div>
            )
          : (active || isSystemRole) && (
            <RoleList
              {...{ addRoleToMember, suggestions, clearStewardSuggestions, fetchStewardSuggestions, removeRoleFromMember, active }}
              key='grList'
              group={group}
              isSystemRole={isSystemRole}
              roleId={id}
              availableResponsibilities={availableResponsibilities}
              slug={group.slug}
            />)
      }
    </div>
  )
}

function AddMemberToRole ({
  groupId,
  roleId,
  memberSuggestions,
  updateLocalMembersForRole,
  isSystemRole = false
}) {
  const [adding, setAdding] = useState(false)
  const listRef = useRef()
  const inputRef = useRef()
  const dispatch = useDispatch()
  const { t } = useTranslation()

  const toggle = () => {
    dispatch(clearStewardSuggestions())
    setAdding(!adding)
  }

  const onInputChange = e => {
    if (e.target.value.length === 0) return dispatch(clearStewardSuggestions())
    return dispatch(fetchStewardSuggestions(groupId, e.target.value))
  }

  const onChoose = choice => {
    dispatch(addRoleToMember({ personId: choice.id, roleId, groupId })).then(() => {
      updateLocalMembersForRole(choice)
    })
    toggle()
  }

  const chooseCurrentItem = () => {
    if (!listRef.current) return
    return listRef.current.handleKeys({
      keyCode: keyMap.ENTER,
      preventDefault: () => {}
    })
  }

  const handleKeys = e => {
    if (e.key === 'Escape') {
      toggle()
      return
    }
    if (!listRef.current) return
    return listRef.current.handleKeys(e)
  }

  const listWidth = { width: (inputRef?.current?.clientWidth || 0) + 4 }

  if (adding) {
    return (
      <div className='p-2'>
        <div className='flex gap-2'>
          <input
            className='rounded-lg p-2 w-full text-foreground bg-input focus:outline-none focus:border-focus border-2 border-transparent transition-all placeholder:text-foreground/50'
            placeholder={t('Search here for a member to add to this role')}
            type='text'
            onChange={onInputChange}
            onKeyDown={handleKeys}
            ref={inputRef}
            data-testid='add-member-input'
          />
          <span className='border-2 border-foreground/30 rounded-lg p-2 text-foreground cursor-pointer' onClick={toggle}>{t('Cancel')}</span>
          <span className='border-2 border-selected/30 rounded-lg p-2 text-foreground cursor-pointer' onClick={chooseCurrentItem}>{t('Add')}</span>
        </div>
        {!isEmpty(memberSuggestions) && (
          <div style={listWidth}>
            <KeyControlledItemList
              ref={listRef}
              items={memberSuggestions}
              onChange={onChoose}
              theme={styles}
            />
          </div>
        )}
      </div>
    )
  } else {
    return (
      <div className='border-2 border-foreground/30 rounded-lg p-2 text-foreground cursor-pointer m-2' onClick={toggle} data-testid='add-new'>
        + {t('Add Member to Role')}
      </div>
    )
  }
}

function AddResponsibilityToRoleSection ({
  handleAddResponsibilityToRole,
  roleId,
  responsibilitySuggestions,
  group
}) {
  const [adding, setAdding] = useState(false)
  const listRef = useRef()
  const { t } = useTranslation()

  const toggle = () => {
    setAdding(!adding)
  }

  const onChoose = choice => {
    handleAddResponsibilityToRole({ responsibilityId: choice.id, roleId, groupId: group.id, responsibility: choice }).then(() => {
      toggle()
    })
  }

  const chooseCurrentItem = () => {
    if (!listRef.current) return
    return listRef.current.handleKeys({
      keyCode: keyMap.ENTER,
      preventDefault: () => {}
    })
  }

  const handleKeys = e => {
    if (e.key === 'Escape') {
      toggle()
      return
    }
    if (!listRef.current) return
    return listRef.current.handleKeys(e)
  }

  if (adding) {
    return (
      <div className={styles.adding}>
        <div className={styles.helpText}>{t('Search here for responsibilities to add to this role')}</div>
        <div className={styles.inputRow}>
          <input
            className={styles.input}
            placeholder='Type...'
            type='text'
            onKeyDown={handleKeys}
            ref={listRef}
          />
          <span className={styles.cancelButton} onClick={toggle}>{t('Cancel')}</span>
          <span className={styles.addButton} onClick={chooseCurrentItem}>{t('Add')}</span>
        </div>
        {!isEmpty(responsibilitySuggestions) && (
          <div>
            <KeyControlledItemList
              ref={listRef}
              items={responsibilitySuggestions}
              onChange={onChoose}
              theme={styles}
            />
          </div>
        )}
      </div>
    )
  } else {
    return (
      <div className='border-2 border-foreground/30 rounded-lg p-2 text-foreground cursor-pointer m-2' onClick={toggle}>
        + {t('Add Responsibility to Role')}
      </div>
    )
  }
}

function RoleList ({
  slug,
  suggestions,
  roleId,
  group,
  isSystemRole,
  availableResponsibilities = []
}) {
  const { t } = useTranslation()
  const [membersForRole, setMembersForRole] = useState([])
  const [hasMoreMembers, setHasMoreMembers] = useState(false)
  const [responsibilitiesForRole, setResponsibilitiesForRole] = useState([])
  const loadingMoreMembers = useRef(false)
  const dispatch = useDispatch()
  const membersListId = `role-members-${roleId}`

  useEffect(() => {
    let isMounted = true
    dispatch(fetchGroupRoleDetails({ id: group.id, roleId, first: ROLE_MEMBERS_PAGE_SIZE, offset: 0 }))
      .then((response) => {
        if (!isMounted) return
        const members = response?.payload?.data?.group?.members
        setMembersForRole(members?.items || [])
        setHasMoreMembers(!!members?.hasMore)
        setResponsibilitiesForRole(response?.payload?.data?.responsibilities || [])
      })
      .catch((e) => { console.error('Error fetching group role details', e) })
    return () => { isMounted = false }
  }, [group.id, roleId, dispatch])

  const fetchMoreMembers = () => {
    if (loadingMoreMembers.current || !hasMoreMembers) return
    loadingMoreMembers.current = true
    dispatch(fetchMembersForGroupRole({
      id: group.id,
      roleId,
      first: ROLE_MEMBERS_PAGE_SIZE,
      offset: membersForRole.length
    }))
      .then((response) => {
        const members = response?.payload?.data?.group?.members
        const newMembers = members?.items || []
        setMembersForRole(prev => {
          const existingIds = new Set(prev.map(member => member.id))
          return [...prev, ...newMembers.filter(member => !existingIds.has(member.id))]
        })
        setHasMoreMembers(!!members?.hasMore)
      })
      .catch((e) => { console.error('Error fetching more members for role', e) })
      .finally(() => { loadingMoreMembers.current = false })
  }

  const memberRoleIds = membersForRole.map(mr => mr.id)

  const memberSuggestions = suggestions.filter(person => !includes(person.id, memberRoleIds))
  const groupRoleResponsibilityTitles = responsibilitiesForRole.map(rfr => rfr.title)
  const responsibilitySuggestions = availableResponsibilities.filter(responsibility => !includes(responsibility.title, groupRoleResponsibilityTitles))

  const updateLocalMembersForRole = (choice) => {
    setMembersForRole([...membersForRole, choice])
  }

  const handleRemoveRoleFromMember = (id) => {
    dispatch(removeRoleFromMember({ personId: id, groupId: group.id, roleId })).then(() => {
      setMembersForRole(membersForRole.filter(member => member.id !== id))
    })
  }

  const handleRemoveResponsibilityFromRole = (id) => {
    dispatch(removeResponsibilityFromRole({ roleResponsibilityId: id, groupId: group.id })).then(() => {
      setResponsibilitiesForRole(responsibilitiesForRole.filter(responsibility => responsibility.id !== id))
    })
  }

  const handleAddResponsibilityToRole = ({ responsibilityId, roleId, groupId, responsibility }) => {
    return dispatch(addResponsibilityToRole({ responsibilityId, roleId, groupId })).then((response) => {
      setResponsibilitiesForRole([...responsibilitiesForRole, { ...responsibility, id: response.payload.data.addResponsibilityToRole.id, responsibilityId: responsibility.id }])
    })
  }

  return (
    <div>
      <div className='p-2'>
        <h4 className='mb-0'>Responsibilities</h4>
        {isSystemRole && (
          <div className='text-foreground/70 text-xs mb-2'>{t('Common roles cannot have their responsibilities edited')}</div>
        )}
        <div className='flex flex-col gap-2'>
          {responsibilitiesForRole.map(r =>
            <RemovableListItem
              item={r}
              removeItem={isSystemRole ? null : handleRemoveResponsibilityFromRole}
              key={r.id}
            />)}
        </div>
      </div>
      {!isSystemRole && (
        <AddResponsibilityToRoleSection
          handleAddResponsibilityToRole={handleAddResponsibilityToRole}
          responsibilitySuggestions={responsibilitySuggestions}
          roleId={roleId}
          group={group}
        />)}
      <div className='p-2'>
        <h4>{t('Members')}</h4>
        <div className='flex flex-col gap-2 max-h-[560px] overflow-y-auto' id={membersListId}>
          {membersForRole.map(m =>
            <RemovableListItem
              item={m}
              url={personUrl(m.id, slug)}
              removeItem={handleRemoveRoleFromMember}
              key={m.id}
            />)}
          <ScrollListener onBottom={fetchMoreMembers} elementId={membersListId} />
        </div>
      </div>
      <AddMemberToRole
        fetchSuggestions={fetchStewardSuggestions}
        addRoleToMember={addRoleToMember}
        memberSuggestions={memberSuggestions}
        clearSuggestions={clearStewardSuggestions}
        updateLocalMembersForRole={updateLocalMembersForRole}
        roleId={roleId}
        groupId={group.id}
        isSystemRole={isSystemRole}
      />
    </div>
  )
}

export default RolesSettingsTab
export { RoleList, AddMemberToRole }
