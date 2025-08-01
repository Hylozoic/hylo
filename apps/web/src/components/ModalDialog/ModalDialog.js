import React, { Component, createRef } from 'react'
import { withTranslation } from 'react-i18next'
import { bool, func, node, string } from 'prop-types'
import Button from 'components/ui/button'
import Icon from 'components/Icon'
import { bgImageStyle, cn } from 'util/index'

import classes from './ModalDialog.module.scss'

class ModalDialog extends Component {
  static propTypes = {
    // Any image in assets (filename or path relative to /assets).
    // Will be shown at bottom left of dialog.
    backgroundImage: string,

    // Cancel always closes the dialog, but will invoke this first if present
    cancelButtonAction: func,

    // Default: true. Set to false if you need to show a notification afterward
    closeOnSubmit: bool,

    // Content to render in the body of the dialog
    children: node,

    // Only visible when `useNotificationFormat` is false
    modalTitle: string,

    // Only shown if `useNotificationFormat` is true
    notificationIconName: string,

    // Default: true
    showCancelButton: bool,

    // Default: true
    showSubmitButton: bool,

    // Submit will invoke this if present
    submitButtonAction: func,

    // Function should return truthy if Submit should show greyed out.
    submitButtonIsDisabled: func,

    submitButtonText: string,

    submitButtonClassName: string,

    // Uses alternate format with green bolded text, +/- an icon
    useNotificationFormat: bool,

    // Default: true
    showModalTitle: bool
  }

  static defaultProps = {
    closeOnSubmit: true,
    style: { },
    modalTitle: 'Notice',
    showModalTitle: true,
    showCancelButton: true,
    showSubmitButton: true,
    submitButtonIsDisabled: () => false,
    useNotificationFormat: false
  }

  modalRef = createRef()

  handleKeydown = event => {
    if (event.code === 'Escape') this.cancel()
    if (event.code === 'Enter') this.submit()
  }

  handleMousedown = event => {
    if (!this.modalRef.current.contains(event.target)) this.cancel()
  }

  componentDidMount () {
    if (this.modalRef.current) { // for testing via shallow render
      // XXX: what is this doing? Ask Kevin
      const element = this.modalRef.current.querySelector("[tabindex='-1']")
      if (element) {
        element.focus()
      }
      this.modalRef.current.addEventListener('keydown', this.handleKeydown)
    }
    document.addEventListener('mousedown', this.handleMousedown)
    // disable main window scrolling
    this.previousOverflowStyle = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }

  componentWillUnmount () {
    this.modalRef.current.removeEventListener('keydown', this.handleKeydown)
    document.removeEventListener('mousedown', this.handleMousedown)
    // re-enable main window scrolling
    document.body.style.overflow = this.previousOverflowStyle
  }

  cancel = () => {
    if (this.props.cancelButtonAction) this.props.cancelButtonAction()
    this.props.closeModal()
  }

  submit = () => {
    if (this.props.submitButtonAction) this.props.submitButtonAction()
    if (this.props.closeOnSubmit) this.props.closeModal()
  }

  render () {
    const {
      backgroundImage,
      children,
      modalTitle,
      notificationIconName,
      showCancelButton,
      showSubmitButton,
      submitButtonIsDisabled,
      submitButtonText = this.props.t('Ok'),
      showModalTitle,
      useNotificationFormat,
      style
    } = this.props

    const backgroundStyle = backgroundImage && useNotificationFormat
      ? {
          ...bgImageStyle(`/assets/${backgroundImage}`),
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'bottom left',
          backgroundSize: '180px'
        }
      : {}
    const innerStyle = { ...backgroundStyle, ...style }
    const showControls = showCancelButton || showSubmitButton

    return (
      <div className='ModalDialog w-full h-full fixed top-0 left-0 flex items-center justify-center z-[1100] bg-black/50' tabIndex='-1'>
        <div className='w-full max-w-[750px] bg-midground rounded-xl p-4' style={innerStyle} ref={this.modalRef} data-testid='popup-inner'>
          <span onClick={this.cancel} className={classes.closeBtn}>
            <Icon name='Ex' className={classes.icon} />
          </span>

          <div className={classes.titleBlock}>
            {useNotificationFormat &&
              <Icon green name={notificationIconName} className={classes.notificationIcon} dataTestId={'icon-' + notificationIconName} />}
            {showModalTitle && (
              <h1 className={cn('text-lg font-bold flex flex-row gap-2 items-center justify-center', { [classes.notificationTitle]: useNotificationFormat })}>
                {modalTitle}
              </h1>
            )}
          </div>

          <div className='flex flex-col gap-4'>
            {children}
          </div>

          {showControls &&
            <div className={classes.controls}>
              {showCancelButton &&
                <Button
                  variant='primary'
                  className={classes.cancelBtn}
                  onClick={this.cancel}
                >
                  {this.props.t('Cancel')}
                </Button>}
              {showSubmitButton &&
                <Button
                  variant='secondary'
                  className={cn(classes.submitBtn, this.props.submitButtonClassName)}
                  onClick={this.submit}
                  disabled={submitButtonIsDisabled()}
                >
                  {submitButtonText}
                </Button>}
            </div>}
        </div>
      </div>
    )
  }
}
export default withTranslation()(ModalDialog)
