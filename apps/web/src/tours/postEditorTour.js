export const POST_EDITOR_TOUR_ID = 'post-editor'

/**
 * First time in the post editor. Surfaces the things the form itself never
 * explains: what post types mean, multi-group posting, #topics, announcements,
 * and the public toggle.
 */
export function postEditorTourSteps (t) {
  return [
    {
      element: '[data-tour="post-type"]',
      popover: {
        title: t('Post types'),
        description: t('Discussions start conversations, requests and offers exchange help, proposals collect votes, and events gather people.'),
        side: 'bottom'
      }
    },
    {
      element: '[data-tour="post-to"]',
      popover: {
        title: t('Post to one or more groups'),
        description: t("A post can reach several groups at once. Groups that don't accept this post type are not listed."),
        side: 'bottom'
      }
    },
    {
      element: '[data-tour="post-body"]',
      popover: {
        title: t('Topics'),
        description: t('Type # in the body to tag up to three topics, so your post is easier to find.'),
        side: 'top'
      }
    },
    {
      element: '[data-testid="announcement-icon"]',
      popover: {
        title: t('Announcement'),
        description: t('Marks the post as important and sends a notification to every member.'),
        side: 'top'
      }
    },
    {
      element: '[data-tour="post-public"]',
      popover: {
        title: t('Public posts'),
        description: t('Make a post visible beyond your groups — anyone can see it and it can appear in The Commons.'),
        side: 'top'
      }
    }
  ]
}
