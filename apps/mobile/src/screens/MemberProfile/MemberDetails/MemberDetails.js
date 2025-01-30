import React, { useEffect, useRef, useState } from 'react'
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery } from 'urql'
import { useNavigation, useRoute } from '@react-navigation/native'
import FastImage from 'react-native-fast-image'
import EntypoIcon from 'react-native-vector-icons/Entypo'
import { debounce, get, isEmpty, pick } from 'lodash/fp'
import { Validators } from '@hylo/shared'
import useLogout from 'hooks/useLogout'
import updateUserSettingsMutation from 'graphql/mutations/updateUserSettingsMutation'
import personQuery from 'graphql/queries/personQuery'
import useCurrentUser from 'frontend-shared/hooks/useCurrentUser'
import useCurrentGroup from 'frontend-shared/hooks/useCurrentGroup'
import useRouteParams from 'hooks/useRouteParams'
import useChangeToGroup from 'hooks/useChangeToGroup'
import confirmDiscardChanges from 'util/confirmDiscardChanges'
import { openURL } from 'hooks/useOpenURL'
import ModalHeader from 'navigation/headers/ModalHeader'
import TabStackHeader from 'navigation/headers/TabStackHeader'
import Icon from 'components/Icon'
import Loading from 'components/Loading'
import MemberHeader from 'screens/MemberProfile/MemberHeader'
import Control from 'screens/MemberProfile/Control'
import styles from './MemberDetails.styles'

export default function MemberDetails () {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const route = useRoute()
  const logout = useLogout()
  const { id, editing: editingParam } = useRouteParams()
  const [{ currentGroup }] = useCurrentGroup()
  const [{ currentUser }] = useCurrentUser()
  const [{ data }] = useQuery({ query: personQuery, variables: { id }, pause: !id })
  const [, updateUserSettings] = useMutation(updateUserSettingsMutation)
  const [changed, setChanged] = useState(false)
  const [editing, setEditing] = useState(editingParam)
  const [errors, setError] = useState({})

  const selectedPerson = id ? data?.person : currentUser
  const isMe = Number(get('id', currentUser)) === Number(get('id', selectedPerson))
  const [person, setPerson] = useState(pick(['name', 'location', 'tagline', 'bio'], selectedPerson || {}))

  const goToSkills = () => openURL('/settings')

  const validate = debounce(500, () => {
    setError({
      name: Validators.validateUser.name(person.name)
    })
  })

  const updateSetting = (setting, value) => {
    setPerson(person => ({ ...person, [setting]: value }))
    setChanged(true)
  }

  const saveChanges = async () => {
    if (this.isValid()) {
      await updateUserSettings({ changes: person })
      setEditing(false)
      setChanged(false)
    }
  }

  const setHeader = () => {
    const title = editing
      ? t('Edit Your Profile')
      : currentGroup?.name
    if (editing) {
      navigation.setOptions({
        header: headerProps =>
          <ModalHeader
            {...headerProps}
            title={title}
            headerLeftOnPress={this.saveChanges}
            headerLeftConfirm={changed}
            headerRightButtonLabel={editing ? t('Save') : null}
            headerRightButtonOnPress={this.saveChanges}
            headerRightButtonDisabled={!changed || !this.isValid()}
          />
      })
    } else if (route.name === 'My Profile') {
      navigation.setOptions({
        header: headerProps =>
          <ModalHeader
            {...headerProps}
            title={t('My Profile')}
            headerLeftOnPress={() => navigation.navigate('Home Tab')}
            headerLeftConfirm={changed}
            headerRightButtonLabel={t('Logout')}
            headerRightButtonOnPress={() => confirmDiscardChanges({
              title: t('Logout'),
              confirmationMessage: t('Are you sure you want to logout?'),
              continueButtonText: t('Cancel'),
              disgardButtonText: t('Yes'),
              onDiscard: logout,
              t
            })}
          />
      })
    } else {
      navigation.setOptions({
        title,
        header: headerProps =>
          <TabStackHeader {...headerProps} />
      })
    }
  }

  useEffect(() => {
    setHeader()
  }, [person, currentGroup, currentUser, changed, editing])

  useEffect(() => {
    validate()
  }, [person])

  if (isEmpty(person)) return <Loading />

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <MemberHeader
        person={person}
        currentUser={currentUser}
        isMe={isMe}
        saveChanges={saveChanges}
        editable={editing}
        updateSetting={updateSetting}
        errors={errors}
      />
      <MemberBio
        person={person}
        editable={editing}
        updateSetting={updateSetting}
        isMe={isMe}
      />
      <MemberSkills
        skills={person?.skills?.items}
        editable={editing}
        goToSkills={goToSkills}
      />
      <MemberGroups
        memberships={person?.memberships}
        editing={editing}
      />
      <MemberAffiliations
        affiliations={person.affiliations?.items}
      />
    </ScrollView>
  )
}

export function MemberBio (props) {
  const { t } = useTranslation()
  const { person: { bio }, editable, updateSetting, isMe } = props
  const controlRef = useRef()
  const focus = () => controlRef.current?.focus()

  if (isEmpty(bio) && !editable) return null

  return (
    <View style={styles.bioContainer}>
      <View style={styles.labelWrapper}>
        <Text style={[styles.sectionLabel, { marginTop: 10 }]}>{t('ABOUT ME')}</Text>
        {editable && (
          <TouchableOpacity onPress={focus}>
            <EntypoIcon name='edit' style={styles.editIcon} />
          </TouchableOpacity>
        )}
      </View>
      <Control
        ref={controlRef}
        style={styles.bio}
        value={bio}
        placeholder={t('Description')}
        editable={editable}
        onChangeText={value => updateSetting('bio', value)}
        isMe={isMe}
        multiline
        hideEditIcon
      />
    </View>
  )
}

export function MemberSkills ({ skills, editable, goToSkills }) {
  const { t } = useTranslation()
  if (isEmpty(skills)) return null

  return (
    <View style={styles.skillsContainer}>
      <View style={styles.labelWrapper}>
        <Text style={styles.sectionLabel}>{t('MY SKILLS')}</Text>
        {editable && (
          <TouchableOpacity onPress={goToSkills}>
            <EntypoIcon name='edit' style={styles.editIcon} />
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity onPress={goToSkills} disabled={!editable}>
        <View style={styles.skills}>{skills.map(skill =>
          <Text style={styles.skill} key={skill.id}>{skill.name.toUpperCase()}</Text>)}
        </View>
      </TouchableOpacity>
    </View>
  )
}

export function MemberGroups ({ memberships, editing }) {
  const { t } = useTranslation()
  const changeToGroup = useChangeToGroup()
  if (isEmpty(memberships)) return null

  return (
    <View style={styles.groupsContainer}>
      <Text style={styles.sectionLabel}>{t('Hylo Communities')}</Text>
      {memberships.map(membership => (
        <GroupRow
          membership={membership} key={membership.id}
          goToGroup={changeToGroup} editing={editing}
        />
      ))}
    </View>
  )
}

export function MemberAffiliations ({ affiliations }) {
  const { t } = useTranslation()
  if (isEmpty(affiliations)) return null

  return (
    <View style={styles.groupsContainer}>
      <Text style={styles.sectionLabel}>{t('Other Affiliations')}</Text>
      {affiliations.map((affiliation, index) => (
        <View style={styles.groupRow} key={index}>
          <MemberAffiliation affiliation={affiliation} />
        </View>
      ))}
    </View>
  )
}

export function MemberAffiliation ({ affiliation }) {
  const { role, preposition, orgName, url } = affiliation

  return (
    <>
      <Text style={styles.affiliationRole}>{role} </Text>
      <Text style={styles.affiliationPreposition}>{preposition}</Text>
      {url && (
        <TouchableOpacity onPress={() => openURL(url)}>
          <Text style={[styles.affiliationOrgName, styles.affiliationOrgNameLink]}> {orgName}</Text>
        </TouchableOpacity>
      )}
      {!url && (
        <Text style={[styles.affiliationOrgName]}> {orgName}</Text>
      )}
    </>
  )
}

export function GroupRow ({ membership, editing }) {
  const changeToGroup = useChangeToGroup()
  const { group, hasModeratorRole } = membership
  const formatCount = count => {
    if (count < 1000) return `${count}`
    return `${Number(count / 1000).toFixed(1)}k`
  }
  const memberCount = formatCount(group.memberCount)

  return (
    <View style={styles.groupRow}>
      <FastImage source={{ uri: group.avatarUrl }} style={styles.groupAvatar} />
      <TouchableOpacity onPress={() => changeToGroup(group.slug)} disabled={editing}>
        <Text style={styles.groupName}>{group.name}</Text>
      </TouchableOpacity>
      {hasModeratorRole && <Icon name='Star' style={styles.starIcon} />}
      <Text style={styles.memberCount}>{memberCount}</Text>
      <Icon name='Members' style={styles.memberIcon} />
    </View>
  )
}
