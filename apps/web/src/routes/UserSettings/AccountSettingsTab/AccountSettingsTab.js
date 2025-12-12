import { trim, pick, keys, omit, find, isEmpty } from 'lodash/fp'
import PropTypes from 'prop-types'
import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import Button from 'components/ui/button'
import Loading from 'components/Loading'
import SettingsControl from 'components/SettingsControl'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import { cn, validateEmail } from 'util/index'
import ModalDialog from 'components/ModalDialog'
import { useCookieConsent } from 'contexts/CookieConsentContext'
import { Switch } from 'components/ui/switch'
import SettingsSection from '../../GroupSettings/SettingsSection/SettingsSection'
import { exportUserAccount } from '../UserSettings.store'

function AccountSettingsTab ({
  currentUser,
  updateUserSettings,
  deleteMe,
  deactivateMe,
  logout,
  fetchPending,
  setConfirm
}) {
  const [state, setState] = useState({
    initialValues: {},
    edits: {},
    changed: {},
    showDeleteModal: false,
    showDeactivateModal: false,
    exportStatus: null
  })

  const { t } = useTranslation()
  const dispatch = useDispatch()

  const setEditState = () => {
    if (!currentUser) return

    const initialValues = {
      email: currentUser.email || '',
      password: '',
      confirm: ''
    }

    setState(prevState => ({
      ...prevState,
      initialValues,
      edits: initialValues
    }))
  }

  useEffect(() => {
    setEditState()
  }, [currentUser])

  useEffect(() => {
    if (fetchPending === false) {
      setEditState()
    }
  }, [fetchPending])

  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({
      title: t('Account Settings'),
      icon: '',
      info: '',
      search: false
    })
  }, [])

  const deactivateMeHandler = () => {
    deactivateMe(currentUser.id).then(logout)
  }

  const deleteMeHandler = () => {
    deleteMe(currentUser.id).then(logout)
  }

  const updateSetting = key => event => {
    const newValue = trim(event.target.value)
    const { changed, edits, initialValues } = state

    if (newValue === initialValues[key]) {
      return setState(prevState => ({
        ...prevState,
        changed: omit(key, changed),
        edits: {
          ...edits,
          [key]: newValue
        }
      }))
    }

    setConfirm(t('You have unsaved changes, are you sure you want to leave?'))
    setState(prevState => ({
      ...prevState,
      changed: {
        ...changed,
        [key]: true
      },
      edits: {
        ...edits,
        [key]: newValue
      }
    }))
  }

  const hasChanges = () => find(c => c, state.changed)

  const formErrors = () => {
    const { edits } = state
    const { email, password, confirm } = edits
    const hasChangesValue = hasChanges()
    const errors = []

    if (!hasChangesValue) return errors

    const passwordConfirmed = password === confirm

    if (!validateEmail(email)) errors.push(t('Email address is not in a valid format'))
    if (password.length > 0 && password.length < 9) errors.push(t('Passwords must be at least 9 characters long'))
    if (!passwordConfirmed) errors.push(t('Passwords don\'t match'))

    return errors
  }

  const canSave = () => hasChanges() && isEmpty(formErrors())

  const save = () => {
    const { changed, edits } = state

    setState(prevState => ({
      ...prevState,
      changed: {}
    }))
    setConfirm(false)
    updateUserSettings(pick(keys(omit('confirm', changed)), edits))
  }

  const { updateCookieConsent } = useCookieConsent()
  const [cookieSettings, setCookieSettings] = useState({
    analytics: true,
    support: true
  })

  useEffect(() => {
    if (currentUser?.cookieConsentPreferences?.settings) {
      setCookieSettings(currentUser.cookieConsentPreferences.settings)
    }
  }, [currentUser])

  const handleCookieSettingChange = async (setting, value) => {
    const newSettings = { ...cookieSettings, [setting]: value }
    setCookieSettings(newSettings)
    await updateCookieConsent(newSettings)
  }

  const handleExportProfile = async () => {
    try {
      setState(prev => ({ ...prev, exportStatus: 'exporting' }))

      const result = await dispatch(exportUserAccount())

      if (result.error) {
        setState(prev => ({ ...prev, exportStatus: 'error' }))
      } else {
        setState(prev => ({ ...prev, exportStatus: 'success' }))
        // Reset status after 3 seconds
        setTimeout(() => {
          setState(prev => ({ ...prev, exportStatus: null }))
        }, 3000)
      }
    } catch (error) {
      setState(prev => ({ ...prev, exportStatus: 'error' }))
    }
  }

  if (!currentUser) return <Loading />

  const { edits, showDeactivateModal, showDeleteModal } = state
  const { email, password, confirm } = edits
  const formErrorsList = formErrors()
  const canSaveValue = canSave()

  return (
    <div className='p-4 space-y-6'>
      <div className='text-xl font-semibold'>{t('Update Account')}</div>

      {formErrorsList.map((formErrorText, i) =>
        <div className='text-destructive text-sm' key={i}>{formErrorText}</div>
      )}

      <div className='space-y-4'>
        <SettingsControl label={t('Email')} onChange={updateSetting('email')} value={email} id='email' />
        <SettingsControl label={t('New Password')} onChange={updateSetting('password')} value={password} type='password' id='password' />
        <SettingsControl label={t('New Password (Confirm)')} onChange={updateSetting('confirm')} value={confirm} type='password' id='confirm' />
      </div>

      <div className='text-sm text-foreground/70'>
        {t('Passwords must be at least 9 characters long, and should be a mix of lower and upper case letters, numbers and symbols.')}
      </div>

      <div className='flex items-center justify-between pt-4 mt-6'>
        <span className={cn(
          'text-sm',
          canSaveValue ? 'text-accent' : 'text-foreground/50'
        )}
        >
          {canSaveValue ? 'Changes not saved' : 'Current settings up to date'}
        </span>
        <Button
          disabled={!canSaveValue}
          variant={canSaveValue ? 'secondary' : 'primary'}
          onClick={canSaveValue ? save : null}
        >
          {t('Save Changes')}
        </Button>
      </div>

      <div className='pt-4 flex flex-col sm:flex-row gap-4 items-center max-w-[280px] sm:max-w-none mx-auto sm:mx-0'>
        <Button
          onClick={handleExportProfile}
          disabled={state.exportStatus === 'exporting'}
          className='bg-accent hover:bg-accent/80 text-white px-6 py-2 rounded-lg transition-all disabled:opacity-50 text-center'
        >
          {state.exportStatus === 'exporting' ? t('Exporting...') : t('Export Profile Data')}
        </Button>
        <Button
          onClick={() => setState(prev => ({ ...prev, showDeactivateModal: true }))}
          className='border-2 border-accent/20 hover:border-accent/100 text-accent p-2 rounded-lg transition-all bg-transparent text-center'
        >
          {t('Deactivate Account')}
        </Button>
        <Button
          onClick={() => setState(prev => ({ ...prev, showDeleteModal: true }))}
          className='border-2 border-accent/20 hover:border-accent/100 text-accent p-2 rounded-lg transition-all bg-transparent text-center'
        >
          {t('Delete Account')}
        </Button>
      </div>

      {state.exportStatus === 'exporting' && (
        <div className='flex items-center justify-center pt-4'>
          <Loading />
        </div>
      )}

      {state.exportStatus === 'success' && (
        <div className='flex items-center justify-center pt-4 text-green-500 text-sm'>
          {t('Profile data exported successfully!')}
        </div>
      )}

      {state.exportStatus === 'error' && (
        <div className='flex items-center justify-center pt-4 text-red-500 text-sm'>
          {t('Failed to export profile data.')}
        </div>
      )}

      {showDeactivateModal && (
        <ModalDialog
          key='deactviate-user-dialog'
          closeModal={() => setState(prev => ({ ...prev, showDeactivateModal: false }))}
          showModalTitle={false}
          submitButtonAction={() => deactivateMeHandler()}
          submitButtonText='Deactivate my account'
          submitButtonClassName='bg-accent hover:bg-destructive transition-all'
        >
          <div className='p-4'>
            <h2 className='text-xl font-semibol mt-0'>
              {t('Deactivate')}
            </h2>
            <p className='text-foreground/70'>
              {t('This action is reversible, just log back in')}
            </p>
            <div className='bg-card rounded-lg p-4'>
              <h4 className='font-medium mb-2 mt-0'>
                {t('If you deactivate your account:')}
              </h4>
              <ul className='list-disc list-inside space-y-1 text-sm text-foreground/70'>
                <li>{t('You won\'t be able to use Hylo unless you log back in')}</li>
                <li>{t('You won\'t receive platform notifications')}</li>
                <li>{t('Your profile won\'t show up in any member searches or group memberships')}</li>
                <li>{t('Your comments and posts will REMAIN as they are')}</li>
              </ul>
            </div>
          </div>
        </ModalDialog>
      )}

      {showDeleteModal && (
        <ModalDialog
          key='delete-user-dialog'
          closeModal={() => setState(prev => ({ ...prev, showDeleteModal: false }))}
          showModalTitle={false}
          submitButtonAction={() => deleteMeHandler()}
          submitButtonText='Delete my account'
          submitButtonClassName='bg-accent hover:bg-destructive transition-all'
        >
          <div className='p-4'>
            <h2 className='text-xl font-semibold text-accent mt-0'>
              {t('DELETE: CAUTION')}
            </h2>
            <p className='text-foreground/70'>
              {t('This action is')}{' '}<strong className='text-accent font-medium'>{t('NOT')}</strong>{' '}{t('reversible')}
            </p>
            <div className='bg-card rounded-lg p-4'>
              <h4 className='font-medium mb-2 mt-0'>
                {t('If you delete your account:')}
              </h4>
              <ul className='list-disc list-inside space-y-1 text-sm text-foreground/70'>
                <li>{t('Your account and its details will be deleted')}</li>
                <li>{t('The content of your posts and comments will be removed')}</li>
                <li>{t('You won\'t be able to use Hylo unless you create a brand new account')}</li>
              </ul>
            </div>
          </div>
        </ModalDialog>
      )}

      {/* Visual divider before cookies section */}
      <div className='border-t border-foreground/10 my-8' />

      {/* Cookie Consent Section */}
      <SettingsSection>
        <h3 className='text-foreground font-bold mb-2'>{t('Cookie Preferences')}</h3>
        <p className='text-foreground/70 mb-4'>
          {t('We use cookies to help understand whether you are logged in and to understand your preferences and where you are in Hylo.')}
        </p>
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <div className='flex items-center gap-2'>
                <h4 className='text-foreground font-medium'>{t('Analytics (Mixpanel)')}</h4>
              </div>
              <p className='text-foreground/70 text-sm'>
                {t('We use a service called Mixpanel to understand how people like you use Hylo. Your identity is anonymized but your behavior is recorded so that we can make improvements to Hylo based on how people are using it.')}
              </p>
              <p className='text-xs text-muted-foreground mt-1'>
                {t('This helps us understand how people use Hylo so we can improve the platform. Your data is anonymized and aggregated.')}
              </p>
            </div>
            <Switch
              checked={cookieSettings.analytics}
              onCheckedChange={(checked) => handleCookieSettingChange('analytics', checked)}
            />
          </div>
          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <div className='flex items-center gap-2'>
                <h4 className='text-foreground font-medium'>{t('Support (Intercom)')}</h4>
              </div>
              <p className='text-foreground/70 text-sm'>
                {t('When people on Hylo need help or want to report a bug, they are interacting with a service called Intercom. Intercom stores cookies in your browser to keep track of conversations with us, the development team.')}
              </p>
              <p className='text-xs text-muted-foreground mt-1'>
                {t('This helps us provide better customer support and track bug reports. Your conversations are stored securely.')}
              </p>
            </div>
            <Switch
              checked={cookieSettings.support}
              onCheckedChange={(checked) => handleCookieSettingChange('support', checked)}
            />
          </div>
        </div>
      </SettingsSection>
      {/* ...end cookie consent section... */}
    </div>
  )
}

AccountSettingsTab.propTypes = {
  currentUser: PropTypes.object,
  updateUserSettings: PropTypes.func,
  deleteMe: PropTypes.func,
  deactivateMe: PropTypes.func,
  logout: PropTypes.func,
  fetchPending: PropTypes.bool,
  setConfirm: PropTypes.func
}

export default AccountSettingsTab
