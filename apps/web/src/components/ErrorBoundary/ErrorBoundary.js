import React from 'react'
import { withTranslation } from 'react-i18next'
import classes from './ErrorBoundary.module.scss'
import rollbar from 'client/rollbar'

/** Returns true if the error is a stale chunk load failure after a new deploy */
const isChunkLoadError = (error) =>
  error?.name === 'ChunkLoadError' ||
  error?.message?.includes('Failed to fetch dynamically imported module') ||
  error?.message?.includes('Importing a module script failed')

class ErrorBoundary extends React.Component {
  constructor (props) {
    super(props)
    this.state = { hasError: false, chunkError: false }
  }

  static getDerivedStateFromError (error) {
    if (isChunkLoadError(error)) return { hasError: true, chunkError: true }
    return { hasError: true, chunkError: false }
  }

  componentDidCatch (error, info) {
    if (isChunkLoadError(error)) {
      if (!window.sessionStorage.getItem('vite-reload-attempted')) {
        window.sessionStorage.setItem('vite-reload-attempted', '1')
        window.location.reload()
      }
      return
    }
    rollbar.error(error, info)
  }

  render () {
    const { hasError, chunkError } = this.state
    if (hasError && chunkError) return null
    if (hasError) {
      const message = this.props.message || this.props.t('Oops! Something went wrong.  Try reloading the page.')
      return (
        <div className={classes.container} data-testid='error-boundary-container'>
          <div className={classes.speechBubble}>
            <div className={classes.arrow} />
            <span>{message}</span>
          </div>
          <div className={classes.axolotl} />
        </div>
      )
    }
    return this.props.children
  }
}
export default withTranslation()(ErrorBoundary)
