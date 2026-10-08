import { Alert } from 'react-native'
import { gql, useMutation } from 'urql'
import { useTranslation } from 'react-i18next'
import Config from 'react-native-config'
import Share from 'react-native-share'
import { useNavigation } from '@react-navigation/native'
import { filter, isEmpty } from 'lodash/fp'
import Clipboard from '@react-native-clipboard/clipboard'
import { AnalyticsEvents } from '@hylo/shared'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import mixpanel from 'services/mixpanel'
import { postUrl as postUrlCreator } from '@hylo/navigation'
import useHyloActionSheet from 'hooks/useHyloActionSheet'
import useHasResponsibility, { RESP_MANAGE_CONTENT } from '@hylo/hooks/useHasResponsibility'
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5'
import Icon from 'components/Icon'

export const deletePostMutation = gql`
  mutation DeletePostMutation ($id: ID) {
    deletePost(id: $id) {
      success
    }
  }
`

export const removePostMutation = gql`
  mutation RemovePostMutation ($postId: ID, $slug: String) {
    removePost(postId: $postId, slug: $slug) {
      success
    }
  }
`

export const savePostMutation = gql`
  mutation SavePostMutation ($postId: ID) {
    savePost(postId: $postId) {
      id
      savedAt
    }
  }
`

export const unsavePostMutation = gql`
  mutation UnsavePostMutation ($postId: ID) {
    unsavePost(postId: $postId) {
      id
      savedAt
    }
  }
`

export default function usePostActionSheet ({
  baseHostURL = Config.HYLO_WEB_BASE_URL,
  closeOnDelete,
  creator,
  postId,
  savedAt,
  setFlaggingVisible,
  title
}) {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const [, deletePost] = useMutation(deletePostMutation)
  const [, removePost] = useMutation(removePostMutation)
  const [, savePost] = useMutation(savePostMutation)
  const [, unsavePost] = useMutation(unsavePostMutation)
  const { showHyloActionSheet } = useHyloActionSheet()
  const [{ currentGroup }] = useCurrentGroup()
  const [{ currentUser }] = useCurrentUser()
  const hasResponsibility = useHasResponsibility({ forCurrentGroup: true, forCurrentUser: true })
  const canModerate = hasResponsibility(RESP_MANAGE_CONTENT)

  const createActionSheetActions = () => {
    const isCreator = currentUser && creator && currentUser.id === creator.id
    const postUrl = currentGroup?.isStaticContext
      ? postUrlCreator(postId, { context: currentGroup?.slug })
      : postUrlCreator(postId, { groupSlug: currentGroup?.slug })
    const editPost = isCreator
      ? () => navigation.navigate('Edit Post', { id: postId })
      : null

    const handleDeletePost = isCreator
      ? () => deletePost({ id: postId })
      : null

    const handleDeletePostAndClose = () => {
      if (isCreator) {
        deletePost({ id: postId })
        navigation.goBack()
      }
    }

    const handleRemovePost = currentGroup && !isCreator && canModerate && !currentGroup.isStaticContext
      ? () => removePost({ postId, slug: currentGroup?.slug })
      : null

    const share = async () => {
      try {
        await Share.open({
          message: t('shareMessage', { title, name: creator.name, url: `${baseHostURL}${postUrl}` })
          // Used only by iOS and will repeat the URL in some contexts if we also include
          // it in the message. Refine this area as later effort.
          // url: `${baseHostURL}${postUrl}`
        }, {
          dialogTitle: t('shareDialogTitle', { title, name: creator.name }),
          subject: t('shareSubject', { title, name: creator.name })
        })

        mixpanel.track(AnalyticsEvents.POST_SHARED)
      } catch (e) {
        console.log(e)
      }
    }

    const copyLink = () => Clipboard.setString(`${baseHostURL}${postUrl}`)

    const flagPost = !isCreator
      ? () => setFlaggingVisible(true)
      : null

    const deletePostWithConfirm = handleDeletePost
      ? () => Alert.alert(
          t('Confirm Delete'),
          t('Are you sure you want to delete this post?'),
          [
            {
              text: t('Yes'),
              onPress: () => closeOnDelete
                ? handleDeletePostAndClose()
                : handleDeletePost()
            },
            { text: t('Cancel'), style: 'cancel' }
          ]
        )
      : null

    const removePostWithConfirm = handleRemovePost
      ? () => Alert.alert(
          t('Confirm Removal'),
          t('Are you sure you want to remove this post from this group?'),
          [
            { text: t('Yes'), onPress: () => handleRemovePost() },
            { text: t('Cancel'), style: 'cancel' }
          ])
      : null

    // const handleCopy = () => Clipboard.setString(TextHelpers.presentHTMLToText(post.details))

    /*

      Action menu items are defined as:

      `['Label', action, { icon, destructive }]`

      The action is excluded from the menu if the `action` param is falsy.

    */
    return filter(x => x[1], [
      [t('Edit'), editPost, {
        icon: <FontAwesome5Icon name='pencil-alt' style={styles.actionSheetIcon} />
      }],
      [t('Share'), share, {
        icon: <FontAwesome5Icon name='share' style={styles.actionSheetIcon} />
      }],
      [t('Copy Link'), copyLink, {
        icon: <Icon name='Copy' style={styles.actionSheetIcon} />
      }],
      [savedAt ? t('Unsave Post') : t('Save Post'), savedAt ? () => unsavePost({ postId }) : () => savePost({ postId }), {
        icon: savedAt ? <Icon name='Bookmark' style={styles.actionSheetIcon} /> : <Icon name='BookmarkCheck' style={styles.actionSheetIcon} />
      }],
      [t('Flag'), flagPost, {
        icon: <FontAwesome5Icon name='flag' style={styles.actionSheetIcon} />,
        destructive: true
      }],
      [t('Delete'), deletePostWithConfirm, {
        icon: <FontAwesome5Icon name='trash-alt' style={styles.actionSheetIcon} />,
        destructive: true
      }],
      [t('Remove From Group'), removePostWithConfirm, {
        icon: <FontAwesome5Icon name='trash-alt' style={styles.actionSheetIcon} />,
        destructive: true
      }]
    ])
  }

  return {
    showPostActionSheet: () => {
      const actionSheetActions = createActionSheetActions()

      return !isEmpty(actionSheetActions) && showHyloActionSheet({ actions: actionSheetActions })
    }
  }
}

const styles = {
  actionSheetIcon: {
    fontSize: 20
  }
}
