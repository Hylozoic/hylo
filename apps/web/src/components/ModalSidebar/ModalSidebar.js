import { cn } from 'util/index'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { bgImageStyle } from 'util/index'

import classes from './ModalSidebar.module.scss'

export default function ModalSidebar ({
  theme = {},
  header,
  body,
  onClick,
  secondParagraph,
  imageUrl,
  imageStyle,
  imageDialogOne,
  imageDialogTwo
}) {
  const { t } = useTranslation()

  return (
    <div className={classes.sidebar}>
      <p className={cn(classes.grayText, classes.closeButton)} onClick={onClick}>{t('CLOSE')}</p>
      <p className={cn(theme.sidebarHeader || classes.sidebarHeader)}>{header}</p>
      <p className={cn(theme.sidebarText || classes.grayText, classes.sidebarText)}>{body}</p>
      {secondParagraph && <p className={cn(theme.sidebarText || classes.grayText, classes.sidebarText)}>{secondParagraph}</p>}
      {imageDialogOne && <div className={classes.sidebarDialog}>{imageDialogOne}</div>}
      {imageDialogTwo && <div className={classes.sidebarDialogTwo}>{imageDialogTwo}</div>}
      {imageDialogOne && <div className={classes.dialogLine} />}
      {imageUrl && <div style={bgImageStyle(imageUrl)} className={classes.sidebarImage} data-testid='sidebar-image' />}
    </div>
  )
}
