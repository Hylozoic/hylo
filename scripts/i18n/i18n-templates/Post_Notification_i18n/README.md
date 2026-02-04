# Post Notification_i18n

**Template ID**: `tem_cPYpXw7d9pCdm6M8QmtPvPGG`  
**Version ID**: `ver_FTVm4qvQkBT8d346CRbwHJcH`  
**Version Name**: New Version  
**Locale**: en-US  
**Downloaded**: 2026-01-29T01:25:45.247Z

## Subject

\`\`\`liquid
{% trans %}New post in {{group_name}}{% if post.topic_name %} #{{post.topic_name}}{% endif %}: {{post.title}}{% endtrans %}
\`\`\`

## Preheader

\`\`\`liquid
(empty)
\`\`\`

## HTML Content

\`\`\`liquid
{% snippet 'header_redesign' %}
{% snippet 'macro: post_card' %}

{{ post_card(post, false, 'announced' if post.announcement else {% trans %}'posted in #{% endtrans %}{{ post.topic_name }}{% trans %}' if post.topic_name else  {% trans %}'posted'{% endtrans %}) }}
 
<p class="center">
  {% trans %}Reply to this email to comment on the post, or {% endtrans %}
</p> 
  
<a href='{{post.url}}' class='btn btn-blue'>{% trans %}Reply in the Group{% endtrans %}</a>

<p style='text-align: center; margin-top: 40px;'><a clicktracking="off" data-click-track-id="6388" href="{{unfollow_url}}">{% trans %}Turn off notifications for this post{% endtrans %}</a>
</p>

{% snippet 'footer_redesign' %}
\`\`\`

## Plain Text Content

\`\`\`liquid
(empty)
\`\`\`

## Sample Data

\`\`\`json
{
  "group_name": "Plantery Health Alliance",
  "post": {
    "announcement": true,
    "date": "October 6, 2021",
    "details": "<p>New regulations throughout all regions which will impact you! New regulations throughout all regions which will impact you! New regulations throughout all regions which will impact you! New regulations throughout all regions which will impact you! New regulations throughout all regions which will impact you! New regulations throughout all regions which will impact you! New regulations throughout all regions which will impact you!</p>",
    "title": "New regulations affecting all chapters!",
    "topic_name": "home",
    "type": "discussion",
    "unfollow_url": "https://hylo.com",
    "user": {
      "avatar_url": "https://www.sololearn.com/Icons/Avatars/4604247.jpg",
      "name": "Loren Johnson",
      "profile_url": "https://hylo.com"
    }
  }
}
\`\`\`

---
