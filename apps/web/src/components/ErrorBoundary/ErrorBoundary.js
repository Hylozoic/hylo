import React from 'react'
import { withTranslation } from 'react-i18next'
import classes from './ErrorBoundary.module.scss'
import errorReporter from 'client/errorReporter'
import { chunkReloadAttempted, reloadForStaleChunks, reloadPage } from 'client/chunkReload'

/** Returns true if the error is a stale chunk load failure after a new deploy */
const isChunkLoadError = (error) =>
  error?.name === 'ChunkLoadError' ||
  error?.message?.includes('Failed to fetch dynamically imported module') ||
  error?.message?.includes('Importing a module script failed')

class ErrorBoundary extends React.Component {
  constructor (props) {
    super(props)
    this.state = { hasError: false, reloading: false }
  }

  static getDerivedStateFromError (error) {
    return { hasError: true, reloading: isChunkLoadError(error) && !chunkReloadAttempted() }
  }

  componentDidCatch (error, info) {
    if (isChunkLoadError(error) && reloadForStaleChunks()) return
    // The boot loader covers the page until the app reports ready, so a crash
    // before that would otherwise leave an endless loading screen
    window.HyloBootLoader?.ready?.()
    if (!isChunkLoadError(error)) errorReporter.error(error, info)
  }

  render () {
    const { hasError, reloading } = this.state
    const { t } = this.props
    if (hasError && reloading) return null
    if (hasError) {
      const message = this.props.message || t('Oops! Something went wrong.  Try reloading the page.')
      return (
        <div className={classes.container} data-testid='error-boundary-container'>
          <div className={classes.speechBubble}>
            <div className={classes.arrow} />
            <span>{message}</span>
          </div>
          <div className={classes.axolotl} />
          <button
            type='button'
            onClick={reloadPage}
            className='rounded-lg bg-selected px-4 py-2 text-sm font-bold text-white hover:bg-selected/90'
            data-testid='error-boundary-reload'
          >
            {t('Reload')}
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
export default withTranslation()(ErrorBoundary)
