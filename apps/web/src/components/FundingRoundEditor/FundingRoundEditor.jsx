import { trim } from 'lodash'
import { isEqual } from 'lodash/fp'
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { push } from 'redux-first-history'
import { Plus, EyeOff, Eye } from 'lucide-react'
import TextInput from 'components/TextInput'
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
import Checkbox from 'components/Checkbox'
import Button from 'components/ui/button'
import { Label } from 'components/ui/label'
import { RadioGroup, RadioGroupItem } from 'components/ui/radio-group'
import HyloEditor from 'components/HyloEditor'
import { createFundingRound } from 'store/actions/fundingRoundActions'
import { RESP_MANAGE_ROUNDS } from 'store/constants'
import getCommonRoles from 'store/selectors/getCommonRoles'
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

function FundingRoundEditor () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const routeParams = useParams()
  const currentGroup = useSelector(state => getGroupForSlug(state, routeParams.groupSlug))
  const canManage = useSelector(state => currentGroup && hasResponsibilityForGroup(state, { groupId: currentGroup.id, responsibility: RESP_MANAGE_ROUNDS }))

  const [fundingRoundState, setFundingRoundState] = useState({
    criteria: '',
    description: '',
    maxTokenAllocation: '',
    minTokenAllocation: '',
    publishedAt: null,
    requireBudget: false,
    submissionsOpenAt: null,
    submissionsCloseAt: null,
    title: '',
    tokenType: 'Votes',
    totalTokens: '',
    votingOpensAt: null,
    votingClosesAt: null,
    votingMethod: 'token_allocation_constant'
  })

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
  const roles = useMemo(() => [...commonRoles.map(role => ({ ...role, type: 'common' })), ...groupRoles.map(role => ({ ...role, type: 'group' }))], [commonRoles, groupRoles])

  useEffect(() => {
    if (!canManage && currentGroup) {
      dispatch(push(groupUrl(currentGroup.slug)))
    }
  }, [canManage, currentGroup?.id])

  const isValid = useMemo(() => trim(fundingRoundState.title)?.length > 0, [fundingRoundState.title])

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

  const updateFundingRoundState = useCallback((key, value) => {
    setFundingRoundState(prev => ({ ...prev, [key]: value }))
    setEdited(prev => prev || !isEqual(prev[key], value))
  }, [])

  const handleSelectToken = (value) => {
    updateFundingRoundState('tokenType', value)
    setCustomTokenMode(false)
    setTokenPopoverOpen(false)
  }

  const handleSave = async () => {
    const e = {}
    if (!trim(title)) e.title = t('Title is required')
    if (Object.keys(e).length) {
      setErrors(e)
      return
    }

    if (saving || !isValid) return
    setSaving(true)

    const descriptionHTML = descriptionEditorRef.current?.getHTML?.() || description
    const criteriaHTML = criteriaEditorRef.current?.getHTML?.() || criteria

    const result = await dispatch(createFundingRound({
      groupId: currentGroup.id,
      title: trim(title),
      description: descriptionHTML,
      criteria: criteriaHTML,
      requireBudget,
      tokenType: tokenType || null,
      totalTokens: totalTokens ? Number(totalTokens) : null,
      minTokenAllocation: minTokenAllocation ? Number(minTokenAllocation) : null,
      maxTokenAllocation: maxTokenAllocation ? Number(maxTokenAllocation) : null
    }))

    const created = result?.payload?.data?.createFundingRound
    setSaving(false)
    if (created?.id) {
      setEdited(false)
      dispatch(push(groupUrl(currentGroup.slug, `funding-rounds/${created.id}`)))
    } else if (result?.error) {
      setErrors({ ...errors, general: t('There was an error, please try again.') })
    }
  }

  const { title, description, criteria, requireBudget, tokenType, totalTokens, minTokenAllocation, maxTokenAllocation, publishedAt, votingMethod } = fundingRoundState

  return (
    <div className='flex flex-col rounded-lg bg-background p-3 shadow-2xl relative gap-2'>
      <div className='p-0'>
        <h1 className='w-full text-sm block text-foreground m-0 p-0 mb-2'>{t('Create Funding Round')}</h1>
      </div>

      <div className='mt-0 flex relative border-2 items-center border-transparent shadow-md transition-all duration-200 focus-within:border-2 group focus-within:border-focus bg-input mb-4 rounded-md mb-8'>
        <div className='text-xs text-foreground/50 px-2 py-1 w-[90px]'>{t('Title')}*</div>
        <input
          autoFocus
          className='border-none outline-none bg-transparent placeholder:text-foreground/50 p-2 w-full'
          maxLength='120'
          name='name'
          onChange={e => { updateFundingRoundState('title', e.target.value); setTitleCharacterCount(e.target.value.length) }}
          value={title}
          placeholder={t('Your funding round\'s name')}
          type='text'
        />
        <span className='absolute right-3 text-sm text-gray-500'>{titleCharacterCount} / 120</span>
      </div>

      <div className='flex flex-col relative border-2 border-transparent shadow-md transition-all duration-200 focus-within:border-2 group focus-within:border-focus bg-input mb-4 rounded-tr-md rounded-br-md rounded-bl-md'>
        <h3 className='px-2 py-1 text-xs text-foreground/60 absolute -top-[36px] -translate-x-[2px] bg-input rounded-t-md border-t-2 border-x-2 border-transparent border-b-0 group-focus-within:text-foreground/80 group-focus-within:border-t-focus group-focus-within:border-x-focus transition-colors duration-200'>Description</h3>
        <HyloEditor
          key={currentGroup.id}
          contentHTML={description}
          containerClassName='mt-2'
          className='h-full p-2 border-border border-2 border-dashed min-h-20 mt-1'
          extendedMenu
          groupIds={[currentGroup.id]}
          onUpdate={html => {
            updateFundingRoundState('description', html)
          }}
          placeholder={t('Describe this funding round')}
          showMenu
          type='fundingRoundDescription'
          ref={descriptionEditorRef}
        />
      </div>

      <div className='flex flex-col relative border-2 border-transparent shadow-md transition-all duration-200 focus-within:border-2 group focus-within:border-focus bg-input mt-4 mb-4 rounded-tr-md rounded-br-md rounded-bl-md'>
        <h3 className='px-2 py-1 text-xs text-foreground/60 absolute -top-[36px] -translate-x-[2px] bg-input rounded-t-md border-t-2 border-x-2 border-transparent border-b-0 group-focus-within:text-foreground/80 group-focus-within:border-t-focus group-focus-within:border-x-focus transition-colors duration-200'>
          {t('Criteria')}
        </h3>
        <HyloEditor
          key={currentGroup.id}
          contentHTML={criteria}
          className='h-full p-2 min-h-20 m-0'
          extendedMenu
          groupIds={[currentGroup.id]}
          onUpdate={html => {
            updateFundingRoundState('criteria', html)
          }}
          placeholder={t('Describe the evaluation criteria')}
          showMenu
          type='fundingRoundCriteria'
          ref={criteriaEditorRef}
        />
      </div>

      <div>
        <Checkbox
          label={t('Require Budget for Submissions')}
          checked={requireBudget}
          onChange={checked => { updateFundingRoundState('requireBudget', checked) }}
        />
      </div>

      <div className='mt-3 flex relative border-2 items-center border-transparent shadow-md transition-all duration-200 focus-within:border-2 group focus-within:border-focus bg-input rounded-md'>
        <div className='text-xs text-foreground/50 px-2 py-1 w-[90px]'>{t('Token Type')}</div>
        <Popover open={tokenPopoverOpen} onOpenChange={setTokenPopoverOpen}>
          <PopoverTrigger className='flex-1'>
            <button type='button' className='w-full text-left border-none outline-none bg-transparent placeholder:text-foreground/50 p-2'>
              {customTokenMode ? t('Other') : (tokenType || 'Votes')}
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
                      {t('Use')} "{tokenSearch}"
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
          onChange={e => { updateFundingRoundState('tokenType', e.target.value) }}
        />
      )}

      <RadioGroup onValueChange={(value) => updateFundingRoundState('votingMethod', value)} value={votingMethod || ''}>
        {tokenAllocationOptions.map((option) => (
          <div key={option.value} className='flex items-center gap-2 mb-2 cursor-pointer'>
            <RadioGroupItem value={option.value} id={`radio-${option.value}`} />
            <Label htmlFor={`radio-${option.value}`} className='cursor-pointer'>{option.label}</Label>
          </div>
        ))}
      </RadioGroup>

      <TextInput
        type='number'
        internalLabel={fundingRoundState.votingMethod === 'token_allocation_divide' ? t('Total {{tokenName}} to distribute', { tokenName: fundingRoundState.tokenType }) : t('Total {{tokenName}} per voter', { tokenName: fundingRoundState.tokenType })}
        value={totalTokens}
        onChange={e => { updateFundingRoundState('totalTokens', e.target.value) }}
      />

      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <TextInput
          type='number'
          internalLabel={t('Min {{tokenName}} allowed per submission', { tokenName: fundingRoundState.tokenType })}
          value={minTokenAllocation}
          onChange={e => { updateFundingRoundState('minTokenAllocation', e.target.value) }}
        />

        <TextInput
          type='number'
          internalLabel={t('Max {{tokenName}} allowed per submission', { tokenName: fundingRoundState.tokenType })}
          value={maxTokenAllocation}
          onChange={e => { updateFundingRoundState('maxTokenAllocation', e.target.value) }}
        />
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
            onClick={() => updateFundingRoundState('publishedAt', null)}
          >
            <EyeOff className='w-5 h-5' />
          </button>
          <button
            className={cn(
              'p-2 rounded-md transition-colors',
              publishedAt ? 'bg-accent text-white' : 'bg-foreground/10'
            )}
            onClick={() => updateFundingRoundState('publishedAt', new Date().toISOString())}
          >
            <Eye className='w-5 h-5' />
          </button>
          <span className='mr-2'>{publishedAt ? t('Publish Now') : t('Unpublished')}</span>
        </div>
      </div>

      <div className=''>
        <Button
          variant='secondary'
          disabled={!edited || !isValid || saving}
          onClick={handleSave}
        >
          <Plus className={cn('w-4 h-4 text-white', { 'bg-secondary': edited && isValid })} />{t('Create Funding Round')}
        </Button>
      </div>
    </div>
  )
}

export default FundingRoundEditor
