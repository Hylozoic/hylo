import { get, trim } from 'lodash/fp'
import { ArrowRight, Image, ImagePlus, SquarePen } from 'lucide-react'
import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { push } from 'redux-first-history'
import { useLocation, useParams } from 'react-router-dom'
import { Button } from 'components/ui/button'
import Dropdown from 'components/Dropdown'
import GroupsSelector from 'components/GroupsSelector'
import Icon from 'components/Icon'
import TextInput from 'components/TextInput'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import { useViewHeader } from 'contexts/ViewHeaderContext'
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
import { bgImageStyle, cn } from 'util/index'
import { groupUrl } from 'util/navigation'
import { onEnter } from 'util/textInput'
import { createGroup, fetchGroupExists } from './CreateGroup.store'

const slugValidatorRegex = /^[0-9a-z-]{2,40}$/

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
    avatarUrl: '',
    bannerUrl: '',
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
        const slugString = newValue.slice(0, 40).toLowerCase().replace(/(^\s+|[^a-zA-Z0-9 ]+|\s+$)/g, '').replace(/\s+/g, '-')
        updates.errors.slug = newValue.length > 1 && validateSlug(slugString)
        updates.slug = slugString
      }

      return { ...prev, ...updates }
    })
  }

  const onSubmit = () => {
    let { accessibility, avatarUrl, bannerUrl, name, parentGroups, purpose, slug, visibility } = state
    name = typeof name === 'string' ? trim(name) : name
    purpose = typeof purpose === 'string' ? trim(purpose) : purpose

    if (isValid()) {
      dispatch(createGroup({ accessibility, avatarUrl, bannerUrl, name, slug, parentIds: parentGroups.map(g => g.id), purpose, visibility }))
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

  const { accessibility, avatarUrl, bannerUrl, nameCharacterCount, edited, errors, name, parentGroups, slug, visibility } = state

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({ title: t('Create Group'), icon: 'Plus', backButton: true })
  }, [])

  return (
    <div className='CreateGroupContainer w-full h-full flex items-center justify-center'>
      <div className='CreateGroupInnerContainer flex flex-col items-center justify-center mx-auto w-full max-w-screen-sm h-full max-h-[500px]'>
        <div
          className={cn('CreateGroupBannerContainer relative w-full flex-1 flex flex-col items-center justify-center border border-dashed border-gray-300 rounded-lg shadow-md bg-cover bg-center', { 'border-none': !!bannerUrl })}
          style={{ backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.7)), url(${bannerUrl})` }}
        >
          <UploadAttachmentButton
            type='groupBanner'
            onInitialUpload={({ url }) => updateField('bannerUrl')(url)}
            className='absolute -top-3 -right-3'
          >
            <div className=''>
              <ImagePlus className='' />
            </div>
          </UploadAttachmentButton>

          <UploadAttachmentButton
            type='groupAvatar'
            onInitialUpload={({ url }) => updateField('avatarUrl')(url)}
          >
            <div
              style={bgImageStyle(avatarUrl)}
              className={cn('relative w-20 h-20 rounded-lg border border-dashed border-gray-300 shadow-md flex items-center justify-center bg-cover bg-center', { 'border-none': !!avatarUrl })}
            >
              {!avatarUrl && <Image className='w-10 h-10 text-gray-500' />}
              <ImagePlus className='absolute -top-3 -right-3' />
            </div>
          </UploadAttachmentButton>

          <div className='mt-10'>
            <div className=''>
              <input
                autoFocus
                type='text'
                name='name'
                onChange={updateField('name')}
                value={name}
                className='text-2xl border-none bg-transparent focus:outline-none'
                placeholder={t('Name your group')}
                maxLength='60'
                onKeyDown={onEnter(onSubmit)}
              />
              <span className=''>{nameCharacterCount} / 60</span>
            </div>
            {errors.name && <span className=''>{errors.name}</span>}

            <div>
              <span className=''>
                <button tabIndex='-1' className='' onClick={focusSlug}>
                  <SquarePen className='text-gray-500 inline w-4 h-4 mr-2' />
                  https://hylo.com/groups/
                </button>
                <input
                  type='text'
                  name='slug'
                  onChange={updateField('slug')}
                  value={slug}
                  onClick={focusSlug}
                  className='text-xs border-none bg-transparent focus:outline-none'
                  onKeyDown={onEnter(onSubmit)}
                  maxLength='40'
                  ref={slugRef}
                />
              </span>
              {errors.slug && <div className='text-error'>{errors.slug}</div>}
            </div>
          </div>
        </div>

        {/* <div className=''>
          <div className=''>
            <Dropdown
              className=''
              toggleChildren={(
                <span>
                  <div className=''>
                    <Icon name={visibilityIcon(visibility)} className='' />
                    <div>
                      <div className=''>{t('WHO CAN SEE THIS GROUP?')}</div>
                      <div className=''>
                        <b>{t(visibilityString(visibility))}</b>
                        <span>{t(visibilityDescription(visibility))}</span>
                      </div>
                    </div>
                  </div>
                  <Icon name='ArrowDown' className='' />
                </span>
              )}
              items={Object.keys(GROUP_VISIBILITY).map(label => ({
                key: label,
                label: (
                  <div className=''>
                    <Icon name={visibilityIcon(GROUP_VISIBILITY[label])} />
                    <div className=''>
                      <b>{t(label)}</b>
                      <span> {t(visibilityDescription(GROUP_VISIBILITY[label]))}</span>
                    </div>
                  </div>
                ),
                onClick: () => updateField('visibility')(GROUP_VISIBILITY[label])
              }))}
            />
          </div>
          <div className=''>
            <Dropdown
              className=''
              toggleChildren={(
                <span>
                  <div className=''>
                    <Icon name={accessibilityIcon(accessibility)} className='' />
                    <div>
                      <div className=''>{t('WHO CAN JOIN THIS GROUP?')}</div>
                      <div className=''>
                        <b>{t(accessibilityString(accessibility))}</b>
                        <span>{t(accessibilityDescription(accessibility))}</span>
                      </div>
                    </div>
                  </div>
                  <Icon name='ArrowDown' className='' />
                </span>
              )}
              items={Object.keys(GROUP_ACCESSIBILITY).map(label => ({
                key: label,
                label: (
                  <div className='' key={label}>
                    <Icon name={accessibilityIcon(GROUP_ACCESSIBILITY[label])} />
                    <div className=''>
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

        {parentGroupOptions && parentGroupOptions.length > 0 && (
          <div className=''>
            <div className=''>
              <span className=''>{t('IS THIS GROUP A MEMBER OF OTHER GROUPS?')}</span>
              <div className=''>
                ?
                <div>{t('groupParentGroupHelpText')}</div>
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
        )} */}

        <div className='mt-10'>
          <Button
            disabled={!edited || !isValid()}
            onClick={onSubmit}
            variant='outline'
            className=''
          >
            {t('Jump In ')}
            <ArrowRight className={cn('w-4 h-4 ml-2', edited && isValid() ? 'text-foreground' : 'text-foreground/50')} />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default CreateGroup
