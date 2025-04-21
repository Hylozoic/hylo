import { cn } from 'util/index'
import { isEmpty } from 'lodash'
import React, { useEffect, useRef, useState } from 'react'
import { string } from 'prop-types'
import { useTranslation } from 'react-i18next'
import { TextHelpers } from '@hylo/shared'
import ClickCatcher from 'components/ClickCatcher'
import HyloHTML from 'components/HyloHTML'
import classes from './GroupSidebar.module.scss'

// TODO REMOVE: This is no longer used. Can it be removed?
function AboutSection ({ description, purpose }) {
  const [showExpandButton, setShowExpandButton] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const containerRef = useRef(null)
  const { t } = useTranslation()

  useEffect(() => {
    const container = containerRef.current
    if (container) {
      setShowExpandButton(container.scrollHeight > container.clientHeight)
    }
  }, [containerRef.current, purpose, description])

  const onClick = () => setExpanded(!expanded)

  if (!purpose && !description) return null

  return (
    <div className={classes.aboutSection}>
      <div className={cn(classes.aboutContent, { [classes.expanded]: expanded })} ref={containerRef}>
        {showExpandButton && !expanded && <div className={classes.gradient} />}
        {!isEmpty(purpose) &&
          <ClickCatcher>
            <h2>{t('Our Purpose')}</h2>
            <HyloHTML element='span' html={TextHelpers.markdown(purpose)} />
          </ClickCatcher>}
        {!isEmpty(description) &&
          <ClickCatcher>
            <h2>{t('Group Description')}</h2>
            <HyloHTML element='span' html={TextHelpers.markdown(description)} />
          </ClickCatcher>}
      </div>
      {showExpandButton &&
        <span className={classes.expandButton} onClick={onClick}>
          {expanded ? t('Show Less') : t('Read More')}
        </span>}
    </div>
  )
}

AboutSection.propTypes = {
  description: string,
  purpose: string
}

export default AboutSection
