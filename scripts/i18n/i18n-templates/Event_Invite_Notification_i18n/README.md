# Event Invite Notification_i18n

**Template ID**: `tem_8pt9FjFkxRGQ7XYhRRW3BBrK`  
**Version ID**: `ver_7WhSSJCmq8SS6gRQQGfWVg4c`  
**Version Name**: New Version  
**Locale**: en-US  
**Downloaded**: 2026-01-29T01:25:32.642Z

## Subject

\`\`\`liquid
{% trans %}{{group_name}}: {{post.user.name}} invited you to "{% trans %}{{post.title}}{% endtrans %}"{% endtrans %}
\`\`\`

## Preheader

\`\`\`liquid
(empty)
\`\`\`

## HTML Content

\`\`\`liquid
{% snippet 'header_redesign' %}
{% snippet 'macro: post_card' %}

{{ post_card(post, false, '{% trans %}invited you{% endtrans %}') }}
 
<p class="center">
  {% trans %}Reply to this email to comment on the event, or{% endtrans %}
</p>
  
<a href='{{post.url}}' class='btn btn-blue'>{% trans %}Reply in the Group{% endtrans %}</a>

{% snippet 'footer_redesign' %}
\`\`\`

## Plain Text Content

\`\`\`liquid
(empty)
\`\`\`

## Sample Data

\`\`\`json
{
  "email_settings_url": "http://localhost:3000/notifications?expand=account",
  "group_name": "Party Community",
  "post": {
    "day": "10",
    "details": "<p>Let's get together to celebrate Hawaiian style! Meet some new friends, get together with old friends</p>",
    "id": 1,
    "image_url": "http://hylo-dev.s3.amazonaws.com/user/11204/seeds/1472250189300_maxresdefault.jpg",
    "location": "Tiki Haven SF",
    "month": "Oct",
    "title": "Lu'au for British Expats",
    "type": "event",
    "unfollow_url": "https://hylo.com/unfollow",
    "user": {
      "avatar_url": "http://rs795.pbsrc.com/albums/yy236/terminatoraf/Funny/mrbeabn.jpg~c200",
      "name": "Shana Trevanna"
    },
    "when": "Tue, October 10, 2018 5pm- 9pm"
  },
  "post_date": "October 10, 2018",
  "post_description": "<div>This event will be awesome</div>",
  "post_title": "Awesome Event!",
  "post_url": "/post/url",
  "post_user_avatar_url": "",
  "post_user_name": "Mr Poster",
  "post_user_profile_url": "https://localhost:3000/members/12344",
  "unfollow_url": "/unfollow/url"
}
\`\`\`

---
