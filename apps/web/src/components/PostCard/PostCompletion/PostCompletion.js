import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'
import Button from 'components/ui/button'
import Checkbox from 'components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from 'components/ui/dialog'
import { Switch } from 'components/ui/switch'
import getMe from 'store/selectors/getMe'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import { cn } from 'util/index'
import { addRequestHelpers, fetchHelperCandidates } from './PostCompletion.store'

/**
 * 'Who helped?' (D27): after a request is marked met, its author can pick helpers
 * from the people who commented. Optional; nothing about it is shown publicly.
 */
export function WhoHelpedDialog ({ open, candidates, selectedIds, onToggle, onSkip, onSave, saving, error }) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={isOpen => { if (!isOpen) onSkip() }}>
      <DialogContent data-testid='who-helped-dialog' className='max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('Who helped?')}</DialogTitle>
          <DialogDescription>
            {t("Your request is marked as met. Pick the people who helped and we'll let them know. This is optional.")}
          </DialogDescription>
        </DialogHeader>
        <ul className='list-none p-0 m-0 flex flex-col gap-2 max-h-64 overflow-y-auto'>
          {candidates.map(person => {
            const checkboxId = `who-helped-${person.id}`
            return (
              <li key={person.id} className='flex items-center gap-3'>
                <Checkbox
                  id={checkboxId}
                  checked={selectedIds.includes(person.id)}
                  onCheckedChange={() => onToggle(person.id)}
                />
                <label htmlFor={checkboxId} className='flex items-center gap-2 min-w-0 cursor-pointer text-sm text-foreground'>
                  {person.avatarUrl
                    ? <img src={person.avatarUrl} alt='' className='w-6 h-6 rounded-full shrink-0' />
                    : <span className='w-6 h-6 rounded-full bg-foreground/20 shrink-0' />}
                  <span className='truncate'>{person.name}</span>
                </label>
              </li>
            )
          })}
        </ul>
        {error && <p className='text-sm text-destructive m-0'>{error}</p>}
        <DialogFooter className='gap-2'>
          <Button variant='outline' onClick={onSkip} disabled={saving} data-testid='who-helped-skip'>
            {t('Skip')}
          </Button>
          <Button onClick={onSave} disabled={saving || selectedIds.length === 0} data-testid='who-helped-save'>
            {t('Thank them')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function PostCompletion ({ postId, type, isFulfilled, fulfillPost, unfulfillPost, isModerator = false }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const location = useLocation()
  const navigate = useNavigate()
  const me = useSelector(getMe)
  const [candidates, setCandidates] = useState([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Only the author of a request is asked; moderators just mark it met
  const asksWhoHelped = type === 'request' && !isModerator && !!postId

  const promptCompleteOptions = {
    request: t('Is this request still needed?'),
    offer: t('Is this offer still available?'),
    resource: t('Is this resource still available?'),
    project: t('Is this project still active?'),
    proposal: t('Is this proposal still open?')
  }

  const prompt = promptCompleteOptions[type]

  // Opens the picker when someone other than the author has commented
  const openPicker = useCallback(() => {
    Promise.resolve(dispatch(fetchHelperCandidates(postId)))
      .then(result => {
        const commenters = result?.payload?.data?.post?.commenters || []
        const people = commenters.filter(person => String(person.id) !== String(me?.id))
        if (people.length === 0) return
        setCandidates(people)
        setSelectedIds([])
        setError(null)
        setPickerOpen(true)
      })
      .catch(() => {})
  }, [dispatch, postId, me?.id])

  const markMet = useCallback(() => {
    fulfillPost()
    if (asksWhoHelped) openPicker()
  }, [fulfillPost, asksWhoHelped, openPicker])

  const handleCheckedChange = (checked) => {
    checked ? unfulfillPost() : markMet()
  }

  // The author's open-request nudge links here with ?action=met (D58): mark the request
  // met once, drop the param, then ask who helped
  const metRequested = getQuerystringParam('action', location) === 'met'
  const metHandled = useRef(false)
  useEffect(() => {
    if (!metRequested || metHandled.current || isModerator) return
    metHandled.current = true
    const params = new URLSearchParams(location.search)
    params.delete('action')
    const search = params.toString()
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true, state: location.state })
    if (!isFulfilled) fulfillPost()
    if (asksWhoHelped) openPicker()
  }, [metRequested])

  const toggleHelper = useCallback(id => {
    setSelectedIds(ids => ids.includes(id) ? ids.filter(other => other !== id) : [...ids, id])
  }, [])

  const closePicker = useCallback(() => {
    setPickerOpen(false)
    setError(null)
  }, [])

  const saveHelpers = useCallback(() => {
    if (selectedIds.length === 0) return
    setSaving(true)
    setError(null)
    Promise.resolve(dispatch(addRequestHelpers(postId, selectedIds)))
      .then(result => {
        if (result?.error || !result?.payload?.data?.fulfillPost?.success) throw new Error('failed')
        setPickerOpen(false)
      })
      .catch(() => setError(t('There was an error, please try again.')))
      .finally(() => setSaving(false))
  }, [dispatch, postId, selectedIds, t])

  return (
    <div
      className={cn(
        'PostCompletion border-2 font-md flex flex-col justify-center items-center m-2 p-1 rounded-md',
        isModerator ? 'bg-accent/15 border-accent/60' : 'bg-secondary/30 border-secondary'
      )}
    >
      {isModerator && (
        <div className='text-xs font-semibold text-accent uppercase tracking-wide mb-1'>
          {t('Moderator')}
        </div>
      )}
      <div className='flex justify-center items-center'>
        <div className='mr-2'>{prompt}</div>
        <Switch
          yesNo
          checked={!isFulfilled}
          onCheckedChange={handleCheckedChange}
        />
      </div>
      {asksWhoHelped && (
        <WhoHelpedDialog
          open={pickerOpen}
          candidates={candidates}
          selectedIds={selectedIds}
          onToggle={toggleHelper}
          onSkip={closePicker}
          onSave={saveHelpers}
          saving={saving}
          error={error}
        />
      )}
    </div>
  )
}
