import React from 'react'
import Div100vh from 'react-div-100vh'
import { Helmet } from 'react-helmet'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'
import RoundImage from 'components/RoundImage'
import { DEFAULT_AVATAR } from 'store/models/Group'
import PublicPageHeader from './PublicPageHeader'

const withReturnTo = (path, returnToUrl) => `${path}?returnToUrl=${encodeURIComponent(returnToUrl)}`

/**
 * What a signed-out visitor sees on a post they can't view.
 * - No group: a generic "This post is in a private group" page that doesn't name
 *   the group, with Sign up and Log in, both returning to the post.
 * - A group whose About page is already public: its name and avatar, and
 *   "Sign up to request access", which returns to the group's page, where
 *   they can ask to join. Log in still returns to the post.
 */
export default function PrivatePostTeaser ({ group, returnToUrl }) {
  const { t } = useTranslation()
  const loginUrl = withReturnTo('/login', returnToUrl)
  const signupUrl = group
    ? withReturnTo('/signup', `/groups/${group.slug}`)
    : withReturnTo('/signup', returnToUrl)

  return (
    <Div100vh className='bg-background flex flex-col'>
      <Helmet>
        <meta name='robots' content='noindex' />
      </Helmet>
      <PublicPageHeader />
      <div className='flex-1 w-full overflow-y-auto bg-midground flex items-start sm:items-center justify-center px-4 py-10'>
        <div
          className='w-full max-w-[480px] rounded-xl bg-card/60 border-2 border-foreground/10 shadow-xl p-6 sm:p-8 flex flex-col items-center text-center gap-4'
          data-testid={group ? 'private-post-teaser-group' : 'private-post-teaser'}
        >
          {group
            ? <RoundImage url={group.avatarUrl || DEFAULT_AVATAR} large />
            : (
              <span className='flex items-center justify-center w-14 h-14 rounded-full bg-foreground/10 text-foreground/70' aria-hidden='true'>
                <Lock className='w-6 h-6' />
              </span>
              )}
          <h1 className='text-xl font-bold text-foreground m-0'>
            {group
              ? t('This post is in {{groupName}}', { groupName: group.name })
              : t('This post is in a private group')}
          </h1>
          <p className='text-foreground/70 text-sm m-0'>
            {group ? t('privatePostTeaserGroupBody') : t('privatePostTeaserBody')}
          </p>
          <div className='flex flex-col sm:flex-row gap-3 w-full sm:w-auto pt-2'>
            <Link
              to={signupUrl}
              className='bg-accent text-white px-4 py-2 rounded-md hover:bg-selected/90 transition-colors text-center font-medium'
            >
              {group ? t('Sign up to request access') : t('Sign up')}
            </Link>
            <Link
              to={loginUrl}
              className='border-2 border-foreground/20 text-foreground px-4 py-2 rounded-md hover:border-foreground/50 transition-colors text-center font-medium'
            >
              {t('Log in')}
            </Link>
          </div>
        </div>
      </div>
    </Div100vh>
  )
}
