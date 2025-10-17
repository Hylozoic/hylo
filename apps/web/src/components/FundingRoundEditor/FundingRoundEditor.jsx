import { isEqual, trim } from 'lodash'
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { push } from 'redux-first-history'
import { ImagePlus, X, EyeOff, Eye } from 'lucide-react'
import TextInput from 'components/TextInput'
import TagInput from 'components/TagInput'
import UploadAttachmentButton from 'components/UploadAttachmentButton'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from 'components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from 'components/ui/command'
import { getHourCycle } from 'components/Calendar/calendar-util'
import Checkbox from 'components/Checkbox'
import Button from 'components/ui/button'
import { DateTimePicker } from 'components/ui/datetimepicker'
import { Label } from 'components/ui/label'
import { RadioGroup, RadioGroupItem } from 'components/ui/radio-group'
import HyloEditor from 'components/HyloEditor'
import { createFundingRound, updateFundingRound } from 'routes/FundingRounds/FundingRounds.store'
import { RESP_MANAGE_ROUNDS } from 'store/constants'
import getCommonRoles from 'store/selectors/getCommonRoles'
import getFundingRound from 'store/selectors/getFundingRound'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getMe from 'store/selectors/getMe'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import { groupUrl } from '@hylo/navigation'
import { cn } from 'util/index'

// Minimal country -> currency map to prioritize local currency
const countryToCurrency = {
  'United States': 'USD',
  'United Kingdom': 'GBP',
  Canada: 'CAD',
  Australia: 'AUD',
  'New Zealand': 'NZD',
  Japan: 'JPY',
  China: 'CNY',
  India: 'INR',
  Brazil: 'BRL',
  Mexico: 'MXN',
  Russia: 'RUB',
  Turkey: 'TRY',
  'South Africa': 'ZAR',
  Switzerland: 'CHF',
  Sweden: 'SEK',
  Norway: 'NOK',
  'Korea, Republic of': 'KRW',
  'South Korea': 'KRW',
  'Hong Kong': 'HKD',
  Singapore: 'SGD',
  Germany: 'EUR',
  France: 'EUR',
  Spain: 'EUR',
  Italy: 'EUR',
  Netherlands: 'EUR',
  Belgium: 'EUR',
  Portugal: 'EUR',
  Austria: 'EUR',
  Ireland: 'EUR',
  Greece: 'EUR',
  Finland: 'EUR'
}

// Resolve all ISO currencies via Intl when available; fallback to a common subset
const fallbackCurrencyCodes = [
  'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR', 'BRL', 'CAD', 'AUD', 'CHF', 'SEK', 'NOK', 'KRW', 'MXN', 'RUB', 'TRY', 'ZAR', 'HKD', 'SGD', 'NZD'
]

const legalCurrencyCodes = (typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function')
  ? Intl.supportedValuesOf('currency')
  : fallbackCurrencyCodes

const cryptoCurrencies = [
  { code: 'ETH', name: 'Ethereum' },
  { code: 'BTC', name: 'Bitcoin' }
]

function FundingRoundEditor (props) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const routeParams = useParams()
  const currentGroup = useSelector(state => getGroupForSlug(state, routeParams.groupSlug))
  const editingRound = useSelector(state => props.editingRound ? getFundingRound(state, routeParams.fundingRoundId) : null)
  const canManage = useSelector(state => currentGroup && hasResponsibilityForGroup(state, { groupId: currentGroup.id, responsibility: RESP_MANAGE_ROUNDS }))

  const [fundingRoundState, setFundingRoundState] = useState({
    bannerUrl: null,
    criteria: '',
    description: '',
    maxTokenAllocation: 1,
    minTokenAllocation: 1,
    publishedAt: null,
    requireBudget: false,
    submissionDescriptor: 'Submission',
    submissionDescriptorPlural: 'Submissions',
    title: '',
    tokenType: 'Votes',
    totalTokens: '',
    votingMethod: 'token_allocation_constant',
    ...editingRound,
    submitterRoles: editingRound?.submitterRoles || [],
    voterRoles: editingRound?.voterRoles || [],
    submissionsOpenAt: typeof editingRound?.submissionsOpenAt === 'string' ? new Date(editingRound?.submissionsOpenAt) : editingRound?.submissionsOpenAt,
    submissionsCloseAt: typeof editingRound?.submissionsCloseAt === 'string' ? new Date(editingRound?.submissionsCloseAt) : editingRound?.submissionsCloseAt,
    votingOpensAt: typeof editingRound?.votingOpensAt === 'string' ? new Date(editingRound?.votingOpensAt) : editingRound?.votingOpensAt,
    votingClosesAt: typeof editingRound?.votingClosesAt === 'string' ? new Date(editingRound?.votingClosesAt) : editingRound?.votingClosesAt
  })

  const {
    bannerUrl,
    criteria,
    description,
    maxTokenAllocation,
    minTokenAllocation,
    publishedAt,
    requireBudget,
    submissionDescriptor,
    submissionDescriptorPlural,
    submitterRoles,
    submissionsCloseAt,
    submissionsOpenAt,
    title,
    tokenType,
    totalTokens,
    voterRoles,
    votingMethod,
    votingClosesAt,
    votingOpensAt
  } = fundingRoundState

  const [errors, setErrors] = useState({})
  const [edited, setEdited] = useState(false)
  const [saving, setSaving] = useState(false)

  const descriptionEditorRef = useRef(null)
  const criteriaEditorRef = useRef(null)
  const [titleCharacterCount, setTitleCharacterCount] = useState(0)
  const [tokenPopoverOpen, setTokenPopoverOpen] = useState(false)
  const [tokenSearch, setTokenSearch] = useState('')
  const [customTokenMode, setCustomTokenMode] = useState(false)

  const tokenAllocationOptions = [
    { label: t('Same number of {{tokenName}} per voter', { tokenName: fundingRoundState.tokenType }), value: 'token_allocation_constant' },
    { label: t('Divide total {{tokenName}} evenly among all voters', { tokenName: fundingRoundState.tokenType }), value: 'token_allocation_divide' }
  ]

  const commonRoles = useSelector(getCommonRoles)
  const groupRoles = useMemo(() => currentGroup?.groupRoles?.items || [], [currentGroup?.groupRoles?.items])
  const roles = useMemo(() => [...commonRoles.map(role => ({ ...role, type: 'common', label: `${role.emoji} ${role.name}` })), ...groupRoles.map(role => ({ ...role, type: 'group', label: `${role.emoji} ${role.name}` }))], [commonRoles, groupRoles])

  const [submitterRoleSearchTerm, setSubmitterRoleSearchTerm] = useState(null)
  const [voterRoleSearchTerm, setVoterRoleSearchTerm] = useState(null)
  const [submitterRoleInputFocused, setSubmitterRoleInputFocused] = useState(false)
  const [voterRoleInputFocused, setVoterRoleInputFocused] = useState(false)

  const submitterRoleSuggestions = useMemo(() => {
    if (submitterRoleSearchTerm === null) return []

    const unselectedRoles = roles.filter(role =>
      !submitterRoles.some(selected => selected.id === role.id)
    )

    if (!submitterRoleSearchTerm) {
      return unselectedRoles.slice(0, 5)
    }

    const searchLower = submitterRoleSearchTerm.toLowerCase()
    return unselectedRoles.filter(role =>
      role.name.toLowerCase().includes(searchLower)
    )
  }, [submitterRoleSearchTerm, roles, submitterRoles, submitterRoleInputFocused])

  const voterRoleSuggestions = useMemo(() => {
    // Don't show suggestions if input is not focused
    if (voterRoleSearchTerm === null) return []

    const unselectedRoles = roles.filter(role =>
      !voterRoles.some(selected => selected.id === role.id)
    )

    if (!voterRoleSearchTerm) {
      return unselectedRoles.slice(0, 5)
    }

    const searchLower = voterRoleSearchTerm.toLowerCase()
    return unselectedRoles.filter(role =>
      role.name.toLowerCase().includes(searchLower)
    )
  }, [voterRoleSearchTerm, roles, voterRoles, voterRoleInputFocused])

  const renderRoleSuggestion = useCallback(({ item, handleChoice }) => {
    return (
      <li key={item.id}>
        <a onClick={event => handleChoice(item, event)} className='flex items-center gap-2 rounded-md text-foreground hover:text-foreground'>
          <span className=''>{item.emoji}</span>
          <span className=''>{item.name}</span>
        </a>
      </li>
    )
  }, [])

  useEffect(() => {
    if (!canManage && currentGroup) {
      dispatch(push(groupUrl(currentGroup.slug)))
    }
  }, [canManage, currentGroup?.id])

  const isValid = useMemo(() => {
    return title?.length > 0 && submissionDescriptor?.length > 0 && submissionDescriptorPlural?.length > 0 && Object.values(errors).filter(v => !!v).length === 0
  }, [errors, title, submissionDescriptor, submissionDescriptorPlural])

  // Current user for country -> currency prioritization
  const currentUser = useSelector(getMe)
  const userCountry = currentUser?.locationObject?.country

  const currencyDisplay = useMemo(() => (typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function')
    ? new Intl.DisplayNames([currentUser?.settings?.locale || 'en'], { type: 'currency' })
    : null,
  [currentUser?.settings?.locale])

  const legalCurrencies = useMemo(() => legalCurrencyCodes
    .map(code => ({ code, name: currencyDisplay?.of(code) || code }))
    .sort((a, b) => a.name.localeCompare(b.name)),
  [currencyDisplay])

  const userCurrencyCode = useMemo(() => userCountry && countryToCurrency[userCountry], [userCountry])
  const suggestedCurrency = useMemo(() => userCurrencyCode && legalCurrencies.find(c => c.code === userCurrencyCode), [userCurrencyCode, legalCurrencies])

  const updateFundingRoundState = useCallback((key) => (v) => {
    // const value = typeof v?.target !== 'undefined' ? trim(v.target.value) : trim(v)
    const value = typeof v?.target !== 'undefined' ? v.target.value : v
    const trimmedValue = trim(value)

    setErrors(prev => ({
      ...prev,
      submissionsCloseAt: (key === 'submissionsCloseAt' && submissionsOpenAt && value <= submissionsOpenAt) || (key === 'submissionsOpenAt' && submissionsCloseAt && value > submissionsCloseAt) ? t('Submissions must close after they open') : null,
      submissionDescriptor: (key === 'submissionDescriptor' && trimmedValue.length === 0) || (key === 'submissionDescriptorPlural' && trimmedValue.length === 0) ? t('Submissions term missing') : null,
      title: key === 'title' && trimmedValue.length === 0 ? t('Title is required') : null,
      votingClosesAt: (key === 'votingClosesAt' && votingOpensAt && value <= votingOpensAt) || (key === 'votingOpensAt' && votingClosesAt && value > votingClosesAt) ? t('Voting must close after it opens') : null
    }))

    setFundingRoundState(prev => ({ ...prev, [key]: value }))
    setEdited(prev => prev || !isEqual(prev[key], value))
  }, [submissionsOpenAt, submissionsCloseAt, votingOpensAt, votingClosesAt])

  const handleSelectToken = useCallback((value) => {
    updateFundingRoundState('tokenType')(value)
    setCustomTokenMode(false)
    setTokenPopoverOpen(false)
  })

  const handleSave = useCallback(async () => {
    if (saving || !isValid) return
    setSaving(true)

    const descriptionHTML = descriptionEditorRef.current?.getHTML?.() || description
    const criteriaHTML = criteriaEditorRef.current?.getHTML?.() || criteria

    const save = editingRound ? updateFundingRound : createFundingRound

    const result = await dispatch(save({
      id: editingRound?.id,
      bannerUrl,
      criteria: criteriaHTML,
      description: descriptionHTML,
      groupId: currentGroup.id,
      maxTokenAllocation: maxTokenAllocation ? Number(maxTokenAllocation) : null,
      minTokenAllocation: minTokenAllocation ? Number(minTokenAllocation) : null,
      publishedAt,
      requireBudget,
      submissionDescriptor,
      submissionDescriptorPlural,
      submitterRoles,
      submissionsCloseAt: submissionsCloseAt instanceof Date ? submissionsCloseAt.toISOString() : submissionsCloseAt || null,
      submissionsOpenAt: submissionsOpenAt instanceof Date ? submissionsOpenAt.toISOString() : submissionsOpenAt || null,
      title: trim(title),
      tokenType,
      totalTokens: totalTokens ? Number(totalTokens) : null,
      voterRoles,
      votingMethod,
      votingClosesAt: votingClosesAt instanceof Date ? votingClosesAt.toISOString() : votingClosesAt || null,
      votingOpensAt: votingOpensAt instanceof Date ? votingOpensAt.toISOString() : votingOpensAt || null
    }))

    const savedRound = result?.payload?.data?.createFundingRound || result?.payload?.data?.updateFundingRound
    setSaving(false)
    if (savedRound?.id) {
      setEdited(false)
      dispatch(push(groupUrl(currentGroup.slug, `funding-rounds/${savedRound.id}/manage`)))
    } else if (result?.error) {
      setErrors({ ...errors, general: t('There was an error, please try again.') })
    }
  }, [fundingRoundState, isValid, editingRound])

  const handlePublish = useCallback(async () => {
    if (saving || !isValid) return
    setSaving(true)

    const descriptionHTML = descriptionEditorRef.current?.getHTML?.() || description
    const criteriaHTML = criteriaEditorRef.current?.getHTML?.() || criteria

    const save = editingRound ? updateFundingRound : createFundingRound

    const result = await dispatch(save({
      id: editingRound?.id,
      bannerUrl,
      criteria: criteriaHTML,
      description: descriptionHTML,
      groupId: currentGroup.id,
      maxTokenAllocation: maxTokenAllocation ? Number(maxTokenAllocation) : null,
      minTokenAllocation: minTokenAllocation ? Number(minTokenAllocation) : null,
      publishedAt: new Date().toISOString(),
      requireBudget,
      submissionDescriptor,
      submissionDescriptorPlural,
      submitterRoles,
      submissionsCloseAt: submissionsCloseAt instanceof Date ? submissionsCloseAt.toISOString() : submissionsCloseAt || null,
      submissionsOpenAt: submissionsOpenAt instanceof Date ? submissionsOpenAt.toISOString() : submissionsOpenAt || null,
      title: trim(title),
      tokenType,
      totalTokens: totalTokens ? Number(totalTokens) : null,
      voterRoles,
      votingMethod,
      votingClosesAt: votingClosesAt instanceof Date ? votingClosesAt.toISOString() : votingClosesAt || null,
      votingOpensAt: votingOpensAt instanceof Date ? votingOpensAt.toISOString() : votingOpensAt || null
    }))

    const savedRound = result?.payload?.data?.createFundingRound || result?.payload?.data?.updateFundingRound
    setSaving(false)
    if (savedRound?.id) {
      setEdited(false)
      dispatch(push(groupUrl(currentGroup.slug, `funding-rounds/${savedRound.id}/manage`)))
    } else if (result?.error) {
      setErrors({ ...errors, general: t('There was an error, please try again.') })
    }
  }, [fundingRoundState, isValid, editingRound])

  const handleUnpublish = useCallback(async () => {
    if (saving) return
    setSaving(true)

    const descriptionHTML = descriptionEditorRef.current?.getHTML?.() || description
    const criteriaHTML = criteriaEditorRef.current?.getHTML?.() || criteria

    const save = editingRound ? updateFundingRound : createFundingRound

    const result = await dispatch(save({
      id: editingRound?.id,
      bannerUrl,
      criteria: criteriaHTML,
      description: descriptionHTML,
      groupId: currentGroup.id,
      maxTokenAllocation: maxTokenAllocation ? Number(maxTokenAllocation) : null,
      minTokenAllocation: minTokenAllocation ? Number(minTokenAllocation) : null,
      publishedAt: null,
      requireBudget,
      submissionDescriptor,
      submissionDescriptorPlural,
      submitterRoles,
      submissionsCloseAt: submissionsCloseAt instanceof Date ? submissionsCloseAt.toISOString() : submissionsCloseAt || null,
      submissionsOpenAt: submissionsOpenAt instanceof Date ? submissionsOpenAt.toISOString() : submissionsOpenAt || null,
      title: trim(title),
      tokenType,
      totalTokens: totalTokens ? Number(totalTokens) : null,
      voterRoles,
      votingMethod,
      votingClosesAt: votingClosesAt instanceof Date ? votingClosesAt.toISOString() : votingClosesAt || null,
      votingOpensAt: votingOpensAt instanceof Date ? votingOpensAt.toISOString() : votingOpensAt || null
    }))

    const savedRound = result?.payload?.data?.createFundingRound || result?.payload?.data?.updateFundingRound
    setSaving(false)
    if (savedRound?.id) {
      setEdited(false)
      dispatch(push(groupUrl(currentGroup.slug, `funding-rounds/${savedRound.id}/manage`)))
    } else if (result?.error) {
      setErrors({ ...errors, general: t('There was an error, please try again.') })
    }
  }, [fundingRoundState, editingRound])

  return (
    <div className='flex flex-col rounded-lg bg-background p-3 shadow-2xl relative gap-2'>
      <div className='p-0'>
        <h1 className='w-full text-sm block text-foreground m-0 p-0 mb-2'>{props.editingRound ? t('Edit Funding Round') : t('Create Funding Round')}</h1>
      </div>

      <UploadAttachmentButton
        type='trackBanner'
        onInitialUpload={({ url }) => updateFundingRoundState('bannerUrl')(url)}
        className='w-full group'
      >
        <div
          className={cn('TrackEditorBannerContainer relative w-full h-[20vh] flex flex-col items-center justify-center border-2 border-dashed border-foreground/50 rounded-lg shadow-md bg-cover bg-center bg-black/0 hover:bg-black/20 scale-1 hover:scale-105 transition-all cursor-pointer', { 'border-none': !!bannerUrl })}
          style={{ backgroundImage: `url(${bannerUrl})` }}
        >
          <div className='flex flex-col items-center justify-center gap-1'>
            <ImagePlus className='inline-block' />
            <span className='ml-2 text-xs opacity-40 group-hover:opacity-100 transition-all'>{t('Set round banner')}</span>
          </div>
        </div>
      </UploadAttachmentButton>

      <div className='mt-4 flex relative border-2 items-center border-transparent shadow-md transition-all duration-200 focus-within:border-2 group focus-within:border-focus bg-input mb-4 rounded-md mb-8'>
        <div className='text-xs text-foreground/50 px-2 py-1'>{t('Title')}*</div>
        <input
          autoFocus
          className='border-none outline-none bg-transparent placeholder:text-foreground/50 p-2 pl-0 pr-20 w-full'
          maxLength='120'
          name='name'
          onChange={e => { updateFundingRoundState('title')(e.target.value); setTitleCharacterCount(e.target.value.length) }}
          value={title}
          placeholder={t('Your funding rounds name')}
          type='text'
        />
        <span className={cn('absolute right-3 text-sm', titleCharacterCount === 120 ? 'text-error' : 'text-foreground/50')}>{titleCharacterCount} / 120</span>
      </div>

      <div className='flex flex-col relative border-2 border-transparent shadow-md transition-all duration-200 focus-within:border-2 group focus-within:border-focus bg-input mb-4 rounded-tr-md rounded-br-md rounded-bl-md'>
        <h3 className='px-2 py-1 text-xs text-foreground/60 absolute -top-[36px] -translate-x-[2px] bg-input rounded-t-md border-t-2 border-x-2 border-transparent border-b-0 group-focus-within:text-foreground/80 group-focus-within:border-t-focus group-focus-within:border-x-focus transition-colors duration-200'>Description</h3>
        <HyloEditor
          key={currentGroup.id}
          contentHTML={description}
          containerClassName='mt-2'
          className='h-full p-2 min-h-20 mt-1 max-h-[300px] border-t-2 border-foreground/5 overflow-y-auto'
          extendedMenu
          groupIds={[currentGroup.id]}
          onUpdate={html => setEdited(prev => prev || !isEqual(html, description))}
          placeholder={t('Describe this funding round')}
          showMenu
          type='fundingRoundDescription'
          ref={descriptionEditorRef}
        />
      </div>

      <div className='border-t-2 border-foreground/10 p-2'>
        <h2>{submissionDescriptorPlural}</h2>
        <h3>{t('is the term used to describe submissions to the round. Alternatives include projects, initiatives, ideas, etc. Customize your terms, set your criteria, and choose who can add {{submissionDescriptorPlural}}.', { submissionDescriptorPlural })}</h3>
        <div className='flex items-center border-2 border-transparent transition-all bg-input rounded-md p-2 gap-2 transition-all focus-within:border-focus border-2 border-transparent mb-4'>
          <div className='text-xs text-foreground/50 py-1 w-[70px]'>{t('Unit term')}</div>
          <input
            className='p-2 pl-0 border-none bg-transparent w-full outline-none'
            maxLength='40'
            name='submissionDescriptor'
            onChange={updateFundingRoundState('submissionDescriptor')}
            value={submissionDescriptor}
            type='text'
          />
        </div>
        <div className='flex items-center border-2 border-transparent transition-all bg-input rounded-md p-2 gap-2 transition-all focus-within:border-focus border-2 border-transparent mb-10'>
          <div className='text-xs text-foreground/50 w-[70px]'>{t('Unit plural')}</div>
          <input
            className='p-2 pl-0 border-none bg-transparent w-full outline-none'
            maxLength='40'
            name='submissionDescriptorPlural'
            onChange={updateFundingRoundState('submissionDescriptorPlural')}
            value={submissionDescriptorPlural}
            type='text'
          />
        </div>

        <div className='flex flex-col relative border-2 border-transparent shadow-md transition-all duration-200 focus-within:border-2 group focus-within:border-focus bg-input mt-4 mb-4 rounded-tr-md rounded-br-md rounded-bl-md'>
          <h3 className='px-2 py-1 text-xs text-foreground/60 absolute -top-[36px] -translate-x-[2px] bg-input rounded-t-md border-t-2 border-x-2 border-transparent border-b-0 group-focus-within:text-foreground/80 group-focus-within:border-t-focus group-focus-within:border-x-focus transition-colors duration-200'>
            {t('{{submissionDescriptor}} Criteria', { submissionDescriptor })}
          </h3>
          <HyloEditor
            key={currentGroup.id}
            contentHTML={criteria}
            className='h-full p-2 border-t-2 border-foreground/5 min-h-20 mt-1 max-h-[300px] overflow-y-auto'
            extendedMenu
            groupIds={[currentGroup.id]}
            onUpdate={html => setEdited(prev => prev || !isEqual(html, criteria))}
            placeholder={t('Describe the evaluation criteria for {{submissionDescriptorPlural}}', { submissionDescriptorPlural })}
            showMenu
            type='fundingRoundCriteria'
            ref={criteriaEditorRef}
          />
        </div>

        <div>
          <h3>{t('Who can add a {{submissionDescriptor}} to the round? If not set anyone who joins the round can add.', { submissionDescriptor })}</h3>
          <div className='flex flex-row items-center relative border-2 border-transparent shadow-md transition-all duration-200 group focus-within:border-focus bg-input mb-4 rounded-md'>
            <TagInput
              tags={submitterRoles.map(role => ({ ...role, name: role.label || `${role.emoji} ${role.name}` }))}
              suggestions={submitterRoleSuggestions}
              handleInputChange={setSubmitterRoleSearchTerm}
              handleAddition={(role) => {
                updateFundingRoundState('submitterRoles')([...submitterRoles, role])
                setSubmitterRoleSearchTerm('')
                setEdited(true)
              }}
              handleDelete={(role) => {
                updateFundingRoundState('submitterRoles')(submitterRoles.filter(r => r.id !== role.id))
                setEdited(true)
              }}
              placeholder={t('Search roles/badges')}
              allowNewTags={false}
              renderSuggestion={renderRoleSuggestion}
              onFocus={() => setSubmitterRoleInputFocused(true)}
              onBlur={() => setSubmitterRoleInputFocused(false)}
            />
          </div>
        </div>

        <div>
          <Checkbox
            label={t('Require Budget for {{submissionDescriptorPlural}}', { submissionDescriptorPlural })}
            checked={requireBudget}
            onChange={updateFundingRoundState('requireBudget')}
          />
        </div>

      </div>

      <div className='flex flex-col gap-2 mt-1 border-t-2 border-foreground/10 p-2'>
        <h2 className='mb-0 pb-0'>Voting</h2>
        <div>
          <h3>{t('Who can vote in this round? If not set, anyone who joins the round can vote.')}</h3>
          <div className='flex flex-row items-center relative border-2 border-transparent shadow-md transition-all duration-200 group focus-within:border-focus bg-input mb-4 rounded-md'>
            <TagInput
              tags={voterRoles.map(role => ({ ...role, name: role.label || `${role.emoji} ${role.name}` }))}
              suggestions={voterRoleSuggestions}
              handleInputChange={setVoterRoleSearchTerm}
              handleAddition={(role) => {
                updateFundingRoundState('voterRoles')([...voterRoles, role])
                setVoterRoleSearchTerm('')
                setEdited(true)
              }}
              handleDelete={(role) => {
                updateFundingRoundState('voterRoles')(voterRoles.filter(r => r.id !== role.id))
                setEdited(true)
              }}
              placeholder={t('Search roles/badges')}
              allowNewTags={false}
              renderSuggestion={renderRoleSuggestion}
              onFocus={() => setVoterRoleInputFocused(true)}
              onBlur={() => setVoterRoleInputFocused(false)}
            />
          </div>
        </div>
        <div className='flex relative border-2 items-center border-transparent shadow-md transition-all duration-200 focus-within:border-2 group focus-within:border-focus bg-input rounded-md'>
          <div className='text-xs text-foreground/50 px-2 py-1 w-[90px]'>{t('Token Type')}</div>
          <Popover open={tokenPopoverOpen} onOpenChange={setTokenPopoverOpen}>
            <PopoverTrigger className='flex-1' asChild>
              <button type='button' className='w-full text-left border-none outline-none bg-transparent placeholder:text-foreground/50 p-2'>
                {customTokenMode ? t('Other') : (tokenType || 'Votes')}
                {/* TODO: add icon indicating its a select box */}
              </button>
            </PopoverTrigger>
            <PopoverContent className='w-[320px] p-0'>
              <Command>
                <CommandInput
                  value={tokenSearch}
                  onValueChange={setTokenSearch}
                  placeholder={t('Search currencies or type a custom name')}
                />
                <CommandList>
                  <CommandEmpty>
                    <div className='p-2 text-sm'>
                      <button
                        className='w-full text-left p-2 rounded hover:bg-accent hover:text-accent-foreground'
                        onClick={() => handleSelectToken(tokenSearch)}
                      >
                        {t('Use {{tokenType}}', { tokenType: tokenSearch })}
                      </button>
                    </div>
                  </CommandEmpty>

                  <CommandGroup heading={t('Default')}>
                    <CommandItem onSelect={() => handleSelectToken('Votes')}>Votes</CommandItem>
                  </CommandGroup>

                  {suggestedCurrency && (
                    <CommandGroup heading={t('Suggested')}>
                      <CommandItem onSelect={() => handleSelectToken(suggestedCurrency.code)}>
                        {suggestedCurrency.code} - {suggestedCurrency.name}
                      </CommandItem>
                    </CommandGroup>
                  )}

                  <CommandGroup heading={t('Currencies')}>
                    {legalCurrencies.filter(c => c.code !== suggestedCurrency?.code).map(c => (
                      <CommandItem key={c.code} onSelect={() => handleSelectToken(c.code)}>
                        {c.code} - {c.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>

                  <CommandGroup heading={t('Crypto')}>
                    {cryptoCurrencies.map(c => (
                      <CommandItem key={c.code} onSelect={() => handleSelectToken(c.code)}>
                        {c.code} - {c.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>

                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem onSelect={() => { setCustomTokenMode(true); setEdited(true); setTokenPopoverOpen(false) }}>
                      {t('Other...')}
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {customTokenMode && (
          <TextInput
            internalLabel={t('Custom token name')}
            value={tokenType}
            onChange={updateFundingRoundState('tokenType')}
          />
        )}

        <RadioGroup onValueChange={updateFundingRoundState('votingMethod')} value={votingMethod || ''}>
          {tokenAllocationOptions.map((option) => (
            <div key={option.value} className='flex items-center gap-2 mb-2 cursor-pointer'>
              <RadioGroupItem value={option.value} id={`radio-${option.value}`} />
              <Label htmlFor={`radio-${option.value}`} className='cursor-pointer'>{option.label}</Label>
            </div>
          ))}
        </RadioGroup>

        <TextInput
          type='number'
          internalLabel={fundingRoundState.votingMethod === 'token_allocation_divide' ? t('Total {{tokenName}} to distribute', { tokenName: tokenType }) : t('Total {{tokenName}} per voter', { tokenName: tokenType })}
          value={totalTokens}
          onChange={updateFundingRoundState('totalTokens')}
        />

        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
          <TextInput
            type='number'
            internalLabel={t('Min {{tokenName}} allowed per submission', { tokenName: tokenType })}
            value={minTokenAllocation}
            onChange={updateFundingRoundState('minTokenAllocation')}
          />

          <TextInput
            type='number'
            internalLabel={t('Max {{tokenName}} allowed per submission', { tokenName: tokenType })}
            value={maxTokenAllocation}
            onChange={updateFundingRoundState('maxTokenAllocation')}
          />
        </div>
      </div>

      <div className='border-t-2 border-foreground/10 p-2 gap-4 flex flex-col'>
        <h2 className='mb-0 pb-0'>Schedule</h2>
        <h3 className='mt-0 pt-0'>Set the start and end dates for the submissions and voting phases. If no dates are set in advance, phases will start and stop by manually managing the round.</h3>
        <div className='flex items-center gap-2'>
          <label>Submisions open: </label>
          <DateTimePicker
            key={submissionsOpenAt ? submissionsOpenAt.toString() : 'empty-submissionsOpenAt'}
            granularity='minute'
            hourCycle={getHourCycle()}
            onChange={updateFundingRoundState('submissionsOpenAt')}
            onMonthChange={() => {}}
            placeholder={t('Manually')}
            value={submissionsOpenAt}
          />
          {submissionsOpenAt && (
            <button
              type='button'
              onClick={() => updateFundingRoundState('submissionsOpenAt')(null)}
              className='p-1 rounded-md hover:bg-foreground/10 transition-colors'
              title={t('Clear date')}
            >
              <X className='w-4 h-4' />
            </button>
          )}
        </div>

        <div className='flex items-center gap-2'>
          <label>Submisions close: </label>
          <DateTimePicker
            key={submissionsCloseAt ? submissionsCloseAt.toString() : 'empty-submissionsCloseAt'}
            className={cn({ 'text-error border-error': errors.submissionsCloseAt })}
            granularity='minute'
            hourCycle={getHourCycle()}
            onChange={updateFundingRoundState('submissionsCloseAt')}
            onMonthChange={() => {}}
            placeholder={t('Manually')}
            value={submissionsCloseAt}
          />
          {submissionsCloseAt && (
            <button
              type='button'
              onClick={() => updateFundingRoundState('submissionsCloseAt')(null)}
              className='p-1 rounded-md hover:bg-foreground/10 transition-colors'
              title={t('Clear date')}
            >
              <X className='w-4 h-4' />
            </button>
          )}
        </div>

        <div className='flex items-center gap-2'>
          <label>{t('Voting opens:')}</label>
          <DateTimePicker
            key={votingOpensAt ? votingOpensAt.toString() : 'empty-votingOpensAt'}
            granularity='minute'
            hourCycle={getHourCycle()}
            onChange={updateFundingRoundState('votingOpensAt')}
            onMonthChange={() => {}}
            placeholder={t('Manually')}
            value={votingOpensAt}
          />
          {votingOpensAt && (
            <button
              type='button'
              onClick={() => updateFundingRoundState('votingOpensAt')(null)}
              className='p-1 rounded-md hover:bg-foreground/10 transition-colors'
              title={t('Clear date')}
            >
              <X className='w-4 h-4' />
            </button>
          )}
        </div>

        <div className='flex items-center gap-2'>
          <label>{t('Voting closes:')}</label>
          <DateTimePicker
            key={votingClosesAt ? votingClosesAt.toString() : 'empty-votingClosesAt'}
            className={cn({ 'text-error border-error': errors.votingClosesAt })}
            granularity='minute'
            hourCycle={getHourCycle()}
            onChange={updateFundingRoundState('votingClosesAt')}
            onMonthChange={() => {}}
            placeholder={t('Manually')}
            value={votingClosesAt}
          />
          {votingClosesAt && (
            <button
              type='button'
              onClick={() => updateFundingRoundState('votingClosesAt')(null)}
              className='p-1 rounded-md hover:bg-foreground/10 transition-colors'
              title={t('Clear date')}
            >
              <X className='w-4 h-4' />
            </button>
          )}
        </div>
      </div>
      <div className='flex items-center border-2 border-transparent transition-all bg-input rounded-md p-2 gap-2 transition-all focus-within:border-focus border-2 border-transparent mb-4'>
        {/* <span className='mr-2'>Publish At</span>
        <DateTimePicker
          hourCycle={getHourCycle()}
          granularity='minute'
          value={publishedAt}
          placeholder={t('When to Publish')}
          onChange={updateField('publishedAt')}
          onMonthChange={() => {}}
        /> */}
        <div className='flex items-center gap-2'>
          <button
            className={cn(
              'p-2 rounded-md transition-colors',
              publishedAt ? 'bg-foreground/10' : 'bg-accent text-white'
            )}
            onClick={() => updateFundingRoundState('publishedAt')(null)}
          >
            <EyeOff className='w-5 h-5' />
          </button>
          <button
            className={cn(
              'p-2 rounded-md transition-colors',
              publishedAt ? 'bg-accent text-white' : 'bg-foreground/10'
            )}
            onClick={() => updateFundingRoundState('publishedAt')(new Date().toISOString())}
          >
            <Eye className='w-5 h-5' />
          </button>
          <span className='mr-2'>{publishedAt ? t('Published. Round is visible. Click the Eye to unpublish.') : t('Unpublished. Click the Eye to publish.')}</span>
        </div>
      </div>

      <div className='flex gap-2 justify-start'>
        {!publishedAt && (
          <>
            <Button
              variant='outline'
              disabled={saving || !isValid}
              onClick={handleSave}
            >
              {t('Save Draft')}
            </Button>
            <Button
              variant='secondary'
              disabled={saving || !isValid}
              onClick={handlePublish}
            >
              {t('Publish')}
            </Button>
          </>
        )}
        {publishedAt && (
          <>
            <Button
              variant='outline'
              disabled={saving}
              onClick={handleUnpublish}
            >
              {t('Unpublish')}
            </Button>
            <Button
              variant='secondary'
              disabled={!edited || !isValid || saving}
              onClick={handleSave}
            >
              {t('Save Changes')}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export default FundingRoundEditor
