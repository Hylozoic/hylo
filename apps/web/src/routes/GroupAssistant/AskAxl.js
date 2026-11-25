import React, { useState } from 'react'
import { useDispatch } from 'react-redux'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import TextareaAutosize from 'react-textarea-autosize'
import { groupUrl } from '@hylo/navigation'
import { GROUP_ASSISTANT, hasFeature } from 'config/featureFlags'
import { askGroupQuestion } from 'store/actions/groupAssistant'
import AxlAvatar from './AxlAvatar'

/**
 * "Ask Axl" on a group's About page (the "Answer members' questions" ability): any member asks
 * a question about the group and Axl answers from what the stewards let it read, with links to
 * the posts it used. Nothing is kept: the answer is shown here only.
 */
export default function AskAxl ({ group }) {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [answer, setAnswer] = useState(null)
  const [error, setError] = useState(null)

  if (!hasFeature(GROUP_ASSISTANT)) return null

  const ask = async () => {
    const text = question.trim()
    if (!text || asking) return
    setAsking(true)
    setError(null)
    try {
      const response = await dispatch(askGroupQuestion(group.id, text))
      const result = response?.payload?.data?.askGroupQuestion
      if (response?.error || !result) throw response?.payload || new Error()
      setAnswer(result)
    } catch (err) {
      setError(err?.message || t('Something went wrong. Please try again.'))
    } finally {
      setAsking(false)
    }
  }

  return (
    <section className='bg-card border border-foreground/10 rounded-xl px-5 py-4' data-testid='ask-axl'>
      <div className='flex items-center gap-2 mb-2'>
        <AxlAvatar size={24} />
        <h2 className='m-0 text-base font-bold text-foreground'>{t('Ask Axl about this group')}</h2>
      </div>
      <p className='m-0 mb-2 text-xs text-foreground/60'>
        {t('Axl answers from this group’s posts, agreements and About page. Your question is sent to Claude, an AI made by Anthropic.')}
      </p>
      <div className='flex items-end gap-2'>
        <TextareaAutosize
          value={question}
          onChange={event => setQuestion(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); ask() } }}
          minRows={1}
          maxRows={6}
          maxLength={4000}
          aria-label={t('Ask Axl about this group')}
          placeholder={t('For example: when does the group meet?')}
          className='flex-1 min-w-0 rounded-lg border-2 border-foreground/20 bg-background text-sm text-foreground p-2 outline-none focus:border-focus resize-none'
          data-testid='ask-axl-input'
        />
        <button
          type='button'
          onClick={ask}
          disabled={asking || !question.trim()}
          className='h-9 px-3 rounded-md bg-selected text-white text-sm font-bold disabled:opacity-50'
          data-testid='ask-axl-send'
        >
          {asking ? t('Asking...') : t('Ask')}
        </button>
      </div>
      {error && <p className='m-0 mt-2 text-xs text-accent' role='alert'>{error}</p>}
      {answer && (
        <div className='mt-3 text-sm leading-relaxed text-foreground/85' data-testid='ask-axl-answer'>
          <p className='m-0'>{answer.text}</p>
          {answer.posts?.length > 0 && (
            <ul className='m-0 mt-2 pl-4 list-disc'>
              {answer.posts.map(post => (
                <li key={post.id}>
                  <Link to={groupUrl(group.slug, `post/${post.id}`)} className='font-semibold text-selected hover:underline'>{post.title || t('A post')}</Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
