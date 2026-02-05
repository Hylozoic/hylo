# Post Mention Notification_i18n

**Template ID**: `tem_77d99tkvmTBJt7rD83DD4XRP`  
**Version ID**: `ver_DhYJF3hfBKkSpW4gRRFDpHKM`  
**Version Name**: New Version  
**Locale**: en-US  
**Downloaded**: 2026-01-29T01:25:44.782Z

## Subject

\`\`\`liquid
{% trans %}{{group_name}}: {{post.user.name}} mentioned you in "{{post.title}}"{% endtrans %}
\`\`\`

## Preheader

\`\`\`liquid
(empty)
\`\`\`

## HTML Content

\`\`\`liquid
{% snippet 'header_redesign' %}
{% snippet 'macro: post_card' %}

{{ post_card(post, false, '{% trans %}mentioned you{% endtrans %}') }}
 
<p class="center">
  {% trans %}Reply to this email to comment on the post, or{% endtrans %}
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
  "group_name": "Terran Collective",
  "post": {
    "details": "You gonna love this <a href='mention'>@person</a>",
    "title": "Check this out",
    "url": "https://hylo.com",
    "user": {
      "name": "Octavia Butler",
      "avatar_url": "http://hylo-dev.s3.amazonaws.com/community/1933/avatar/1475424224039_TigerFace.png"
    }
  }
}
\`\`\`

---
