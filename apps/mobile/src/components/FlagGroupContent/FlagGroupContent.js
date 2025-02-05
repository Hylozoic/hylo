import React, { useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, Linking, Modal, TextInput } from 'react-native'
import { useTranslation } from 'react-i18next'
import { gql, useMutation, useQuery } from 'urql'
import { isEmpty } from 'lodash'
import { groupUrl } from 'util/navigation'
import Icon from 'components/Icon'
import Button from 'components/Button'
import CheckBox from '@react-native-community/checkbox'
import MultiSelect from 'components/MultiSelect/MultiSelect'
import createModerationActionMutation from '@hylo/graphql/mutations/createModerationActionMutation'
import { agreementsURL } from 'store/constants'
import usePlatformAgreements from '@hylo/hooks/usePlatformAgreements'
import GroupPresenter from '@hylo/presenters/GroupPresenter'
import { mangoOrange } from 'style/colors'

const FlagGroupContent = ({ onClose, linkData, type = 'content' }) => {
  const { t } = useTranslation()
  const { id: postId, slug: groupSlug } = linkData || {}
  const [, createModerationAction] = useMutation(createModerationActionMutation)
  const [{ data: groupData }] = useQuery({
    query: gql`
      query GroupAgreementsQuery ($slug: String) {
        group(slug: $slug) {
          id
          name
          agreements {
            items {
              id
              description
              order
              title        
            }
          }
        }
      }
    `,
    variables: { slug: groupSlug }
  })
  const group = useMemo(() => GroupPresenter(groupData?.group), [groupData])
  const agreements = group?.agreements?.items || []
  const groupAgreementsUrl = group ? groupUrl(group.slug) + `/group/${group.slug}` : ''
  const [anonymous, setAnonymous] = useState(false)
  const [explanation, setExplanation] = useState('')
  const [subtitle] = useState(t('What was wrong?'))
  const [agreementsSelected, setAgreementsSelected] = useState([])
  const [platformAgreementsSelected, setPlatformAgreementsSelected] = useState([])
  const [platformAgreements, platformAgreementsFetching] = usePlatformAgreements()

  if (platformAgreementsFetching) return null

  const isValid = () => {
    if (isEmpty(agreementsSelected) && isEmpty(platformAgreementsSelected)) return false
    if (explanation.length < 5) return false
    return true
  }

  const closeModal = () => {
    if (onClose) {
      onClose()
    }
  }

  const handleAgreementsSelect = (selected) => {
    if (agreementsSelected.includes(selected)) {
      setAgreementsSelected(agreementsSelected.filter(ag => ag !== selected))
    } else {
      setAgreementsSelected([...agreementsSelected, selected])
    }
  }

  const handlePlatformAgreementsSelect = (selected) => {
    if (platformAgreementsSelected.includes(selected)) {
      setPlatformAgreementsSelected(platformAgreementsSelected.filter(ag => ag !== selected))
    } else {
      setPlatformAgreementsSelected([...platformAgreementsSelected, selected])
    }
  }

  const submit = async () => {
    await createModerationAction({
      data: {
        text: explanation,
        postId,
        groupId: group.id,
        agreements: agreementsSelected,
        platformAgreements: platformAgreementsSelected,
        anonymous
      }
    })
    closeModal()
    return true
  }

  return (
    <Modal
      transparent
      visible
      onRequestClose={closeModal}
      animationType='fade'
    >
      <View style={styles.popup}>
        <View style={styles.popupInner}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={styles.title}>{t('Explanation for Flagging')}</Text>
            <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
              <Icon name='Ex' style={styles.closeIcon} />
            </TouchableOpacity>

            <View style={styles.content}>
              <Text style={styles.explainer}>{t('flaggingExplainer')}</Text>
              <Text style={[styles.explainer, styles.reasonRequired]}>{t('flagsNeedACategory')}</Text>

              <TextInput
                style={styles.explanationTextbox}
                multiline
                numberOfLines={6}
                value={explanation}
                onChangeText={setExplanation}
                placeholder={subtitle}
              />

              {group && agreements.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>{t('Not permitted in {{groupName}}', { groupName: group?.name })}</Text>
                  <TouchableOpacity onPress={() => Linking.openURL(groupAgreementsUrl)}>
                    <Text style={styles.link}>{t('Link to group agreements')}</Text>
                  </TouchableOpacity>
                  <MultiSelect items={agreements} selected={agreementsSelected} handleSelect={handleAgreementsSelect} />
                </>
              )}

              <Text style={styles.sectionTitle}>{t('Violations of platform agreements')}</Text>
              <TouchableOpacity onPress={() => Linking.openURL(agreementsURL)}>
                <Text style={styles.link}>{t('Link to platform agreements')}</Text>
              </TouchableOpacity>

              <Text style={styles.subSectionTitle}>{t('Not permitted in Public Spaces')}</Text>
              <MultiSelect
                items={platformAgreements.filter((ag) => ag.type !== 'anywhere')}
                selected={platformAgreementsSelected}
                handleSelect={handlePlatformAgreementsSelect}
              />

              <Text style={styles.subSectionTitle}>{t('Not permitted anywhere on the platform')}</Text>
              <MultiSelect
                items={platformAgreements.filter((ag) => ag.type === 'anywhere')}
                selected={platformAgreementsSelected}
                handleSelect={handlePlatformAgreementsSelect}
              />

              <View style={styles.submission}>
                <View style={styles.submissionAnon}>
                  <CheckBox
                    boxType='square'
                    checked={anonymous}
                    onChange={value => setAnonymous(value)}
                    labelStyle={styles.anonLabel}
                  />
                  <Text>{t('Anonymous')}</Text>
                </View>
                <Text> {t('(Moderators will see your name)')}</Text>
                <Button
                  style={styles.submitButton}
                  onPress={submit}
                  disabled={!isValid()}
                  text={t('Submit')}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = {
  popup: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  popupInner: {
    width: '90%',
    maxWidth: 500,
    height: '87%',
    backgroundColor: 'white',
    borderRadius: 10,
    overflow: 'hidden'
  },
  scrollContent: {
    padding: 20
  },
  title: {
    fontSize: 24,
    color: '#2C405A',
    fontWeight: 'normal',
    fontFamily: 'Circular Medium',
    textAlign: 'center',
    marginTop: 28,
    marginBottom: 16
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    padding: 10
  },
  closeIcon: {
    fontSize: 26
  },
  content: {
    flex: 1
  },
  explainer: {
    color: '#666',
    fontSize: 14,
    marginBottom: 5
  },
  reasonRequired: {
    color: 'red'
  },
  explanationTextbox: {
    borderWidth: 1,
    borderColor: '#CCD1D7',
    borderRadius: 2,
    padding: 14,
    marginTop: 20,
    fontFamily: 'Circular Book',
    fontSize: 14
  },
  sectionTitle: {
    fontSize: 20,
    color: '#2C405A',
    fontWeight: 'normal',
    fontFamily: 'Circular Medium',
    marginTop: 20,
    marginBottom: 8
  },
  subSectionTitle: {
    fontSize: 18,
    color: '#2C405A',
    fontWeight: 'normal',
    fontFamily: 'Circular Medium',
    marginTop: 15,
    marginBottom: 5
  },
  link: {
    color: '#2C405A',
    fontSize: 14,
    textDecorationLine: 'underline',
    marginTop: 10,
    marginBottom: 10
  },
  submission: {
    color: 'black',
    marginTop: 20,
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6
  },
  submissionAnon: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  anonLabel: {
    color: '#666',
    fontSize: 10,
    marginRight: 10
  },
  submitButton: {
    marginTop: 21,
    disabledColor: mangoOrange
  }
}

export default FlagGroupContent
