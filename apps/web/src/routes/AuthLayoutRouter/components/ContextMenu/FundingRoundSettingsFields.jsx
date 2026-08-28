import React, { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import HyloEditor from 'components/HyloEditor'
import TagInput from 'components/TagInput'
import Checkbox from 'components/ui/checkbox'
import { DateTimePicker } from 'components/ui/datetimepicker'
import { Label } from 'components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'components/ui/select'
import { cn } from 'util/index'

/** Shared funding round settings fields for create and edit space flows. */
export default function FundingRoundSettingsFields ({
  submissionDescriptor,
  setSubmissionDescriptor,
  submissionDescriptorPlural,
  setSubmissionDescriptorPlural,
  submissionsOpenAt,
  setSubmissionsOpenAt,
  submissionsCloseAt,
  setSubmissionsCloseAt,
  votingOpensAt,
  setVotingOpensAt,
  votingClosesAt,
  setVotingClosesAt,
  votingMethod,
  setVotingMethod,
  totalTokens,
  setTotalTokens,
  tokenType,
  setTokenType,
  allowSelfVoting,
  setAllowSelfVoting,
  allowLateJoiners,
  setAllowLateJoiners,
  hideFinalResults,
  setHideFinalResults,
  submitterRoles,
  setSubmitterRoles,
  voterRoles,
  setVoterRoles,
  roles,
  criteriaEditorRef,
  groupIds = [],
  editorKey = 'new',
  initialCriteria = ''
}) {
  const { t } = useTranslation()
  const [submitterRoleSearch, setSubmitterRoleSearch] = useState(null)
  const [voterRoleSearch, setVoterRoleSearch] = useState(null)

  const submitterRoleSuggestions = useMemo(() => {
    if (submitterRoleSearch === null) return []
    const unselected = roles.filter(role => !submitterRoles.some(selected => selected.id === role.id))
    if (!submitterRoleSearch) return unselected
    const searchLower = submitterRoleSearch.toLowerCase()
    return unselected.filter(role => role.name.toLowerCase().includes(searchLower))
  }, [submitterRoleSearch, roles, submitterRoles])

  const voterRoleSuggestions = useMemo(() => {
    if (voterRoleSearch === null) return []
    const unselected = roles.filter(role => !voterRoles.some(selected => selected.id === role.id))
    if (!voterRoleSearch) return unselected
    const searchLower = voterRoleSearch.toLowerCase()
    return unselected.filter(role => role.name.toLowerCase().includes(searchLower))
  }, [voterRoleSearch, roles, voterRoles])

  const renderRoleSuggestion = useCallback(({ item, handleChoice }) => (
    <li key={item.id}>
      <a onClick={event => handleChoice(item, event)} className='flex items-center gap-2 rounded-md text-foreground hover:text-foreground'>
        <span>{item.emoji}</span>
        <span>{item.name}</span>
      </a>
    </li>
  ), [])

  return (
    <div className='flex flex-col gap-3 border-t-2 border-foreground/10 pt-3 mt-1'>
      <h3 className='text-base font-semibold'>{t('Funding Round Settings')}</h3>

      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <div className='flex items-center border-2 border-transparent transition-all bg-input rounded-md p-2 gap-2 focus-within:border-focus'>
          <div className='text-xs text-foreground/50 w-[90px]'>{t('Unit term')}</div>
          <input
            className='p-2 border-none bg-transparent w-full outline-none'
            maxLength='40'
            onChange={e => setSubmissionDescriptor(e.target.value)}
            value={submissionDescriptor}
            type='text'
          />
        </div>
        <div className='flex items-center border-2 border-transparent transition-all bg-input rounded-md p-2 gap-2 focus-within:border-focus'>
          <div className='text-xs text-foreground/50 w-[90px]'>{t('Unit term plural')}</div>
          <input
            className='p-2 border-none bg-transparent w-full outline-none'
            maxLength='40'
            onChange={e => setSubmissionDescriptorPlural(e.target.value)}
            value={submissionDescriptorPlural}
            type='text'
          />
        </div>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3' data-tour='round-schedule'>
        <div>
          <label className='text-sm text-foreground/70'>{t('Submissions open')}</label>
          <DateTimePicker value={submissionsOpenAt} onChange={setSubmissionsOpenAt} />
        </div>
        <div>
          <label className='text-sm text-foreground/70'>{t('Submissions close')}</label>
          <DateTimePicker value={submissionsCloseAt} onChange={setSubmissionsCloseAt} />
        </div>
        <div>
          <label className='text-sm text-foreground/70'>{t('Voting opens')}</label>
          <DateTimePicker value={votingOpensAt} onChange={setVotingOpensAt} />
        </div>
        <div>
          <label className='text-sm text-foreground/70'>{t('Voting closes')}</label>
          <DateTimePicker value={votingClosesAt} onChange={setVotingClosesAt} />
        </div>
      </div>

      <div data-tour='round-voting'>
        <label className='text-sm text-foreground/70'>{t('Voting method')}</label>
        <Select
          value={votingMethod}
          onValueChange={value => {
            setVotingMethod(value)
            if (value !== 'token_allocation_constant') setAllowLateJoiners(false)
          }}
        >
          <SelectTrigger className='w-full border-2 bg-input border-foreground/30 rounded-md p-2 text-base mt-1'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className='z-[1200]'>
            <SelectItem value='token_allocation_constant'>{t('Same number of tokens per voter')}</SelectItem>
            <SelectItem value='token_allocation_divide'>{t('Divide total tokens evenly among voters')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <div className='flex items-center border-2 border-transparent transition-all bg-input rounded-md p-2 gap-2 focus-within:border-focus'>
          <div className='text-xs text-foreground/50 w-[90px]'>{t('Total tokens')}</div>
          <input
            className='p-2 border-none bg-transparent w-full outline-none'
            onChange={e => setTotalTokens(e.target.value)}
            value={totalTokens}
            type='number'
            min='0'
          />
        </div>
        <div className='flex items-center border-2 border-transparent transition-all bg-input rounded-md p-2 gap-2 focus-within:border-focus'>
          <div className='text-xs text-foreground/50 w-[90px]'>{t('Token name')}</div>
          <input
            className='p-2 border-none bg-transparent w-full outline-none'
            onChange={e => setTokenType(e.target.value)}
            value={tokenType}
            type='text'
          />
        </div>
      </div>

      <div className='flex flex-col gap-2'>
        <div className='flex items-center gap-2'>
          <Checkbox
            id='fr-allow-self-voting'
            checked={allowSelfVoting}
            onCheckedChange={checked => setAllowSelfVoting(!!checked)}
          />
          <Label htmlFor='fr-allow-self-voting' className='cursor-pointer font-normal'>
            {t('Allow participants to vote on their own submissions')}
          </Label>
        </div>
        <div className='flex items-center gap-2'>
          <Checkbox
            id='fr-allow-late-joiners'
            checked={votingMethod === 'token_allocation_constant' && !!allowLateJoiners}
            disabled={votingMethod !== 'token_allocation_constant'}
            onCheckedChange={checked => setAllowLateJoiners(!!checked)}
          />
          <Label
            htmlFor='fr-allow-late-joiners'
            className={cn(
              'cursor-pointer font-normal',
              votingMethod !== 'token_allocation_constant' && 'opacity-50 cursor-not-allowed'
            )}
          >
            {t('Allow people who join during voting to receive tokens and vote')}
          </Label>
        </div>
        <div className='flex items-center gap-2'>
          <Checkbox
            id='fr-hide-final-results'
            checked={hideFinalResults}
            onCheckedChange={checked => setHideFinalResults(!!checked)}
          />
          <Label htmlFor='fr-hide-final-results' className='cursor-pointer font-normal'>
            {t('Hide final results from participants')}
          </Label>
        </div>
      </div>

      <div data-tour='round-roles'>
        <label className='text-sm text-foreground/70'>{t('Submitter roles')}</label>
        <div className='mt-1 flex flex-row items-center relative border-2 border-transparent shadow-md transition-all duration-200 group focus-within:border-focus bg-input rounded-md'>
          <TagInput
            tags={submitterRoles.map(role => ({ ...role, name: `${role.emoji} ${role.name}` }))}
            suggestions={submitterRoleSuggestions}
            handleInputChange={setSubmitterRoleSearch}
            handleAddition={(role) => {
              setSubmitterRoles(prev => [...prev, role])
              setSubmitterRoleSearch('')
            }}
            handleDelete={(role) => {
              setSubmitterRoles(prev => prev.filter(r => r.id !== role.id))
            }}
            placeholder={t('Anyone can submit')}
            allowNewTags={false}
            renderSuggestion={renderRoleSuggestion}
            onFocus={() => setSubmitterRoleSearch('')}
            onBlur={() => setSubmitterRoleSearch(null)}
          />
        </div>
      </div>

      <div>
        <label className='text-sm text-foreground/70'>{t('Voter roles')}</label>
        <div className='mt-1 flex flex-row items-center relative border-2 border-transparent shadow-md transition-all duration-200 group focus-within:border-focus bg-input rounded-md'>
          <TagInput
            tags={voterRoles.map(role => ({ ...role, name: `${role.emoji} ${role.name}` }))}
            suggestions={voterRoleSuggestions}
            handleInputChange={setVoterRoleSearch}
            handleAddition={(role) => {
              setVoterRoles(prev => [...prev, role])
              setVoterRoleSearch('')
            }}
            handleDelete={(role) => {
              setVoterRoles(prev => prev.filter(r => r.id !== role.id))
            }}
            placeholder={t('Anyone can vote')}
            allowNewTags={false}
            renderSuggestion={renderRoleSuggestion}
            onFocus={() => setVoterRoleSearch('')}
            onBlur={() => setVoterRoleSearch(null)}
          />
        </div>
      </div>

      <div className='flex flex-col relative border-2 border-transparent shadow-md transition-all duration-200 focus-within:border-2 group focus-within:border-focus bg-input rounded-tr-md rounded-br-md rounded-bl-md mb-2 mt-10'>
        <h3 className='px-2 py-1 text-xs text-foreground/60 absolute -top-[36px] -translate-x-[2px] bg-input rounded-t-md border-t-2 border-x-2 border-transparent border-b-0 group-focus-within:text-foreground/80 group-focus-within:border-t-focus group-focus-within:border-x-focus transition-colors duration-200'>
          {t('Criteria')}
        </h3>
        <HyloEditor
          key={`fr-crit-${editorKey}`}
          containerClassName='mt-2'
          contentHTML={initialCriteria}
          className='h-full p-2 border-border border-2 border-dashed min-h-20 mt-1'
          extendedMenu
          groupIds={groupIds}
          placeholder={t('Criteria for submissions')}
          ref={criteriaEditorRef}
          showMenu
          type='fundingRoundCriteria'
        />
      </div>
    </div>
  )
}
