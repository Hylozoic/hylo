import { get, trim } from 'lodash/fp'
import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { goBack, push } from 'redux-first-history'
import { useLocation, useParams } from 'react-router-dom'
import Button from 'components/Button'
import Dropdown from 'components/Dropdown'
import GroupsSelector from 'components/GroupsSelector'
import Icon from 'components/Icon'
import TextInput from 'components/TextInput'
import { RESP_ADMINISTRATION } from 'store/constants'
import {
  accessibilityDescription,
  accessibilityIcon,
  accessibilityString,
  GROUP_ACCESSIBILITY,
  GROUP_VISIBILITY,
  visibilityString,
  visibilityDescription,
  visibilityIcon
} from 'store/models/Group'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getMe from 'store/selectors/getMe'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import { groupUrl } from '@hylo/navigation'
import { createGroup, fetchGroupExists } from './CreateGroup.store'

import styles from './CreateGroup.module.scss'

const slugValidatorRegex = /^[0-9a-z-]{2,40}$/

// IS THIS UI DEFUNCT?
function CreateGroup () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const location = useLocation()
  const routeParams = useParams()

  // Selectors
  const currentUser = useSelector(getMe)
  const currentGroup = useSelector(state => getGroupForSlug(state, routeParams.groupSlug))
  const groupSlugExists = useSelector(state => get('slugExists', state.CreateGroup))
  const initialGroupName = useSelector(state => getQuerystringParam('name', location))
  const initialGroupSlug = useSelector(state => getQuerystringParam('slug', location))

  // Parent group options
  const parentGroupOptions = useSelector(state => {
    return currentUser?.memberships.toModelArray()
      .filter(m => m.group.accessibility === GROUP_ACCESSIBILITY.Open ||
        hasResponsibilityForGroup(state, { groupId: m.group.id, responsibility: RESP_ADMINISTRATION }))
      .map(m => m.group)
      .sort((a, b) => a.name.localeCompare(b.name)) || []
  }, (prevGroups, nextGroups) => {
    if (prevGroups.length !== nextGroups.length) return false
    return prevGroups.every((item, index) => item.id === nextGroups[index].id)
  })

  // State
  const [state, setState] = useState({
    accessibility: 1,
    nameCharacterCount: 0,
    invitees: [],
    name: initialGroupName || '',
    parentGroups: currentGroup && parentGroupOptions.find(p => p.id === currentGroup.id) ? [currentGroup] : [],
    purposeCharacterCount: 0,
    slug: initialGroupSlug || '',
    slugCustomized: false,
    visibility: 1,
    edited: false,
    errors: {
      name: false,
      slug: false
    }
  })

  // Refs
  const groupsSelector = useRef()
  const slugRef = useRef()

  // Effects
  useEffect(() => {
    if (groupSlugExists) {
      setState(prev => ({
        ...prev,
        errors: {
          ...prev.errors,
          slug: groupSlugExists ? t('This URL already exists. Try another.') : false
        }
      }))
    }
  }, [groupSlugExists, t])

  // Functions
  const focusSlug = () => {
    slugRef.current.focus()
    slugRef.current.select()
  }

  const isValid = () => {
    return Object.values(state.errors).every(v => v === false) && state.name && state.slug
  }

  useEffect(() => {
    if (state.slug && slugValidatorRegex.test(state.slug)) {
      dispatch(fetchGroupExists(state.slug))
    }
  }, [state.slug])

  const validateSlug = (val) => {
    if (val === '') {
      return t('Please enter a URL slug')
    } else if (!slugValidatorRegex.test(val)) {
      return t('URLs must have between 2 and 40 characters, and can only have lower case letters, numbers, and dashes.')
    } else {
      return false
    }
  }

  const updateField = (field) => (value) => {
    const newValue = typeof value.target !== 'undefined' ? value.target.value : value

    setState(prev => {
      const updates = {
        [field]: newValue,
        errors: { ...prev.errors },
        edited: true
      }

      if (field === 'name') {
        updates.errors.name = newValue === '' ? t('Please enter a group name') : false
        updates.nameCharacterCount = newValue.length
      }

      if (field === 'purpose') {
        updates.purposeCharacterCount = newValue.length
      }

      if (field === 'slug') {
        updates.errors.slug = validateSlug(newValue)
        updates.slugCustomized = true
      }

      if (field === 'name' && !prev.slugCustomized) {
        if (newValue.length < 40) {
          const slugString = newValue.toLowerCase().replace(/(^\s+|[^a-zA-Z0-9 ]+|\s+$)/g, '').replace(/\s+/g, '-')
          updates.errors.slug = validateSlug(slugString)
          updates.slug = slugString
        }
      }

      return { ...prev, ...updates }
    })
  }

  const onSubmit = () => {
    let { accessibility, name, parentGroups, purpose, slug, visibility } = state
    name = typeof name === 'string' ? trim(name) : name
    purpose = typeof purpose === 'string' ? trim(purpose) : purpose

    if (isValid()) {
      dispatch(createGroup({ accessibility, name, slug, parentIds: parentGroups.map(g => g.id), purpose, visibility }))
        .then(({ error }) => {
          if (error) {
            setState(prev => ({
              ...prev,
              error: t('There was an error, please try again.')
            }))
          } else {
            dispatch(push(groupUrl(slug)))
          }
        })
    }
  }

  const { accessibility, nameCharacterCount, edited, errors, name, parentGroups, purposeCharacterCount, slug, visibility } = state

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <button onClick={() => dispatch(goBack())}><Icon name='Back' className={styles.backIcon} /></button>
        <span className={styles.headerHeadline}>{t('Create Group')}</span>
      </div>
      <div className={styles.nameAndSlug}>
        <TextInput
          autoFocus
          type='text'
          name='name'
          onChange={updateField('name')}
          value={name}
          theme={{ inputStyle: 'modalInput', wrapperStyle: 'center' }}
          placeholder={t('Your group\'s name')}
          noClearButton
          maxLength='60'
          onEnter={onSubmit}
          className={styles.groupNameInput}
        />
        <span className={styles.characterCounter}>{nameCharacterCount} / 60</span>
        {errors.name && <span className={styles.nameError}>{errors.name}</span>}
        <span className={styles.slug}>
          <button tabIndex='-1' className={styles.slugButton} onClick={focusSlug}>
            <Icon name='SmallEdit' />
            https://hylo.com/groups/
          </button>
          <TextInput
            type='text'
            name='slug'
            onChange={updateField('slug')}
            value={slug}
            onClick={focusSlug}
            theme={{ input: styles.slugInput, wrapper: styles.slugWrapper }}
            noClearButton
            onEnter={onSubmit}
            maxLength='40'
            inputRef={slugRef}
          />
        </span>
        {errors.slug && <span className={styles.slugError}>{errors.slug}</span>}
      </div>

      <div className={styles.privacy}>
        <div className={styles.dropdownContainer}>
          <Dropdown
            id='create-group-privacy-dropdown'
            className={styles.privacyDropdown}
            toggleChildren={(
              <span>
                <div className={styles.dropdownItemSelected}>
                  <Icon name={visibilityIcon(visibility)} className={styles.selectedIcon} />
                  <div>
                    <div className={styles.dropdownDescription}>{t('WHO CAN SEE THIS GROUP?')}</div>
                    <div className={styles.selectedString}>
                      <b>{t(visibilityString(visibility))}</b>
                      <span>{t(visibilityDescription(visibility))}</span>
                    </div>
                  </div>
                </div>
                <Icon name='ArrowDown' className={styles.openDropdown} />
              </span>
            )}
            items={Object.keys(GROUP_VISIBILITY).map(label => ({
              key: label,
              label: (
                <div className={styles.dropdownItem}>
                  <Icon name={visibilityIcon(GROUP_VISIBILITY[label])} />
                  <div className={styles.selectedString}>
                    <b>{t(label)}</b>
                    <span> {t(visibilityDescription(GROUP_VISIBILITY[label]))}</span>
                  </div>
                </div>
              ),
              onClick: () => updateField('visibility')(GROUP_VISIBILITY[label])
            }))}
          />
        </div>
        <div className={styles.dropdownContainer}>
          <Dropdown
            id='create-group-accessibility-dropdown'
            className={styles.privacyDropdown}
            toggleChildren={(
              <span>
                <div className={styles.dropdownItemSelected}>
                  <Icon name={accessibilityIcon(accessibility)} className={styles.selectedIcon} />
                  <div>
                    <div className={styles.dropdownDescription}>{t('WHO CAN JOIN THIS GROUP?')}</div>
                    <div className={styles.selectedString}>
                      <b>{t(accessibilityString(accessibility))}</b>
                      <span>{t(accessibilityDescription(accessibility))}</span>
                    </div>
                  </div>
                </div>
                <Icon name='ArrowDown' className={styles.openDropdown} />
              </span>
            )}
            items={Object.keys(GROUP_ACCESSIBILITY).map(label => ({
              key: label,
              label: (
                <div className={styles.dropdownItem} key={label}>
                  <Icon name={accessibilityIcon(GROUP_ACCESSIBILITY[label])} />
                  <div className={styles.selectedString}>
                    <b>{t(label)}</b>
                    <span> {t(accessibilityDescription(GROUP_ACCESSIBILITY[label]))}</span>
                  </div>
                </div>
              ),
              onClick: () => updateField('accessibility')(GROUP_ACCESSIBILITY[label])
            }))}
          />
        </div>
      </div>

      <div className={styles.purposeContainer}>
        <div className={styles.purposeField}>
          <span className={styles.title}>{t('GROUP PURPOSE')}</span>
          <span className={styles.characterCounter}>{purposeCharacterCount} / 500</span>
          <div className={styles.purposeHelp}>
            ?
            <div className={styles.purposeTooltip}>{t('purposeHelpText')}</div>
          </div>
          <textarea
            maxLength={500}
            onChange={updateField('purpose')}
            placeholder={t('What does this group hope to accomplish?')}
          />
        </div>
      </div>

      {parentGroupOptions && parentGroupOptions.length > 0 && (
        <div className={styles.parentGroups}>
          <div className={styles.parentSelector}>
            <span className={styles.title}>{t('IS THIS GROUP A MEMBER OF OTHER GROUPS?')}</span>
            <div className={styles.parentGroupInfo}>
              ?
              <div className={styles.parentGroupTooltip}>{t('groupParentGroupHelpText')}</div>
            </div>
            <GroupsSelector
              options={parentGroupOptions}
              selected={parentGroups}
              onChange={(newGroups) => { updateField('parentGroups')(newGroups) }}
              readOnly={false}
              ref={groupsSelector}
            />
          </div>
        </div>
      )}

      <div className={styles.createGroupBottom}>
        <Button
          color='green-white-green-border'
          key='create-button'
          narrow
          disabled={!edited || !isValid()}
          onClick={onSubmit}
          className={styles.submitButton}
        >
          <Icon name='Plus' green={edited && isValid()} className={styles.createGroupIcon} />{t('Create Group')}
        </Button>
      </div>
    </div>
  )
}

export default CreateGroup
