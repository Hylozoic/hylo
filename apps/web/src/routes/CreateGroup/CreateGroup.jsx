import { get, trim } from 'lodash/fp'
import { ArrowRight, Image, ImagePlus, SquarePen } from 'lucide-react'
import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { push } from 'redux-first-history'
import { useLocation, useParams } from 'react-router-dom'
import { Button } from 'components/ui/button'
import GroupsSelector from 'components/GroupsSelector'
import Icon from 'components/Icon'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from 'components/ui/select'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { RESP_ADMINISTRATION } from 'store/constants'
import {
  accessibilityDescription,
  accessibilityIcon,
  accessibilityString,
  DEFAULT_AVATAR,
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
    avatarUrl = avatarUrl || DEFAULT_AVATAR

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
    setHeaderDetails({ title: t('Create a new group'), icon: '', info: '', backButton: true, search: false })
  }, [])

  return (
    <div className='CreateGroupContainer w-full h-full flex justify-center mt-10'>
      <div className='CreateGroupInnerContainer flex flex-col mx-auto w-full max-w-screen-sm items-center'>
        
        <UploadAttachmentButton
              type='groupBanner'
              onInitialUpload={({ url }) => updateField('bannerUrl')(url)}
              className='w-full group'
        >
          <div
            className={cn('CreateGroupBannerContainer relative w-full h-[20vh] flex flex-col items-center justify-center border-2 border-dashed border-foreground/50 rounded-lg shadow-md bg-cover bg-center bg-black/0 hover:bg-black/20 scale-1 hover:scale-105 transition-all cursor-pointer', { 'border-none': !!bannerUrl })}
            style={{ backgroundImage: `url(${bannerUrl})` }}
          >
              <div className='flex flex-col items-center justify-center gap-1'>
                <ImagePlus className='inline-block' />
                <span className='ml-2 text-xs opacity-40 group-hover:opacity-100 transition-all'>{t('Set group banner')}</span>
              </div>
          </div>
        </UploadAttachmentButton>

        <UploadAttachmentButton
          type='groupAvatar'
          onInitialUpload={({ url }) => updateField('avatarUrl')(url)}
          className='relative -top-10 bg-background -mb-6 group'
        >
          <div
            style={bgImageStyle(avatarUrl)}
            className={cn('relative w-20 h-20 rounded-lg border-dashed border-2 border-foreground/50 shadow-md flex items-center justify-center bg-cover bg-center bg-black/0 hover:bg-black/20 scale-1 hover:scale-105 transition-all cursor-pointer', { 'border-none': !!avatarUrl })}
          >
            {!avatarUrl && <div className='flex flex-col items-center justify-center gap-1'>
              <ImagePlus className='inline-block' />
              <span className='text-xs opacity-40 group-hover:opacity-100 transition-all'>Add icon</span>
            </div>}
            
          </div>
        </UploadAttachmentButton>

        <div className='w-full bg-foreground/5 p-4 rounded-lg flex flex-col gap-2'>
          <div className='flex items-center gap-2'>
            <input
              autoFocus
              type='text'
              name='name'
              onChange={updateField('name')}
              value={name}
              className='text-2xl border-none bg-transparent focus:outline-none flex-1 text-foreground placeholder-foreground/30'
              placeholder={t('Name your group')}
              maxLength='60'
              onKeyDown={onEnter(onSubmit)}
              id='groupName'
            />
            <label htmlFor='groupName' className=''>
              <SquarePen className='text-foreground inline w-4 h-4' />
            </label>
            <span className='text-xs'>{nameCharacterCount} / 60</span>
          </div>
          {errors.name && <span className=''>{errors.name}</span>}

          <div>
            <div className='flex items-center'>
              <label htmlFor='groupSlug' className=''>
                https://hylo.com/groups/
              </label>
              <input
                type='text'
                name='slug'
                onChange={updateField('slug')}
                value={slug}
                onClick={focusSlug}
                className='text-xs border-none bg-transparent focus:outline-none flex-1'
                onKeyDown={onEnter(onSubmit)}
                maxLength='40'
                ref={slugRef}
                id='groupSlug'
              />
            </div>
            {errors.slug && <div className='text-error text-sm'>{errors.slug}</div>}
          </div>
        </div>

        <div className='w-full bg-foreground/5 p-4 rounded-lg mt-4 flex justify-between gap-4'>
          <Select
            value={visibility}
            onValueChange={(value) => updateField('visibility')(GROUP_VISIBILITY[value])}
          >
            <SelectTrigger className='inline-flex'>
              <SelectValue>
                <Icon name={visibilityIcon(visibility)} className='mr-2' />
                <span>{t(visibilityString(visibility))}</span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.keys(GROUP_VISIBILITY).map(label => (
                <SelectItem key={label} value={label} className='pl-2'>
                  <div className=''>
                    <Icon name={visibilityIcon(GROUP_VISIBILITY[label])} />
                    <b className='ml-2'>{t(label)}:</b>
                    <span className=''> {t(visibilityDescription(GROUP_VISIBILITY[label]))}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={accessibility}
            onValueChange={(value) => updateField('accessibility')(GROUP_ACCESSIBILITY[value])}
          >
            <SelectTrigger className='inline-flex'>
              <SelectValue>
                <Icon name={accessibilityIcon(accessibility)} className='mr-2' />
                <span>{t(accessibilityString(accessibility))}</span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.keys(GROUP_ACCESSIBILITY).map(label => (
                <SelectItem key={label} value={label} className='pl-2'>
                  <div className=''>
                    <Icon name={accessibilityIcon(GROUP_ACCESSIBILITY[label])} />
                    <b className='ml-2'>{t(label)}:</b>
                    <span className=''> {t(accessibilityDescription(GROUP_ACCESSIBILITY[label]))}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* {parentGroupOptions && parentGroupOptions.length > 0 && (
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
        )}  */}

        <div className='mt-10'>
          <Button
            disabled={!edited || !isValid()}
            onClick={onSubmit}
            variant='outline'
            className='border-2 border-foreground/50 hover:border-foreground/100 hover:scale-105 transition-all'
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
