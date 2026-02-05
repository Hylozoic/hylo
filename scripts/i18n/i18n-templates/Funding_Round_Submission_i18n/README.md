# Funding Round Submission_i18n

**Template ID**: `tem_dMt4Dwm493JvYdXGWBpTxxR7`  
**Version ID**: `ver_9vHkVmkQqpFBprvSfWRWMrqc`  
**Version Name**: New Version  
**Locale**: en-US  
**Downloaded**: 2026-01-29T01:25:34.592Z

## Subject

\`\`\`liquid
{% trans %}New submission to {{funding_round_title}}: {{post.title}}{% endtrans %}
\`\`\`

## Preheader

\`\`\`liquid
(empty)
\`\`\`

## HTML Content

\`\`\`liquid
{% snippet 'header_redesign' %}
{% snippet 'macro: post_card' %}

{{ post_card(post, false, 'submitted') }}
 
<a href='{% trans %}{{post.url}}{% endtrans %}' class='btn btn-blue'>{% trans %}View in the Funding Round{% endtrans %}</a>

{% snippet 'footer_redesign' %}
\`\`\`

## Plain Text Content

\`\`\`liquid
(empty)
\`\`\`

## Sample Data

\`\`\`json
{
  "funding_round_title": "Float #1",
  "group_name": "Planetary Health Alliance",
  "post": {
    "announcement": true,
    "date": "October 6, 2025",
    "details": "<p>For this project we will read beat poetry and sing to the stars. Please fund this important work.</p>",
    "title": "A very cool project",
    "topic_name": "home",
    "type": "submission",
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
