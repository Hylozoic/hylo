# Join Request Notification_i18n

**Template ID**: `tem_Dkvtfv9HGgYgjqD4KCXPPdy6`  
**Version ID**: `ver_PJCbHpwMF36bKKMr6JJgBv8Y`  
**Version Name**: New Version  
**Locale**: en-US  
**Downloaded**: 2026-01-29T01:29:41.611Z

## Subject

\`\`\`liquid
{% trans %}{{requester_name}} asked to join {{group_name}}{% endtrans %}
\`\`\`

## Preheader

\`\`\`liquid
(empty)
\`\`\`

## HTML Content

\`\`\`liquid
{% snippet "header_redesign" %}
{% snippet "macro: actor_pill" %}

<p>{% trans %}{{ actor_pill(requester_name, requester_avatar_url, requester_profile_url) }} wants to join {{actor_pill(group_name, group_avatar_url, group_url)}}!{% endtrans %}</p>

{% if join_question_answers %}
{% for question in join_question_answers %}
<div class='card'>
  {{actor_pill(group_name, group_avatar_url, group_url)}}
  <h3>{% trans %}{{question.text}}{% endtrans %}</h3>
  
  {{actor_pill(requester_name, requester_avatar_url, requester_profile_url)}}
  <p>{% trans %}{{question.answer|e}}{% endtrans %}</p>
  </ul>
</div>
{% endfor %}
{% endif %}

<a class='btn btn-blue' href="{{settings_url}}">{% trans %}Respond to their Request{% endtrans %}</a>

{% snippet "footer_redesign" %}
\`\`\`

## Plain Text Content

\`\`\`liquid
(empty)
\`\`\`

## Sample Data

\`\`\`json
{
  "group_avatar_url": "http://hylo-dev.s3.amazonaws.com/community/1933/avatar/1475424224039_TigerFace.png",
  "group_name": "Awesome People",
  "group_url": "https://hylo.com",
  "join_question_answers": [
    {
      "answer": "You're not fooling me this time. Carrots are not real. They are way too orange to be real. Did an oompaloompah's nose fall off? Also, that crunch? Must be artificial. No way. ",
      "text": "Do you like carrots?"
    },
    {
      "answer": "The dark night of the soul",
      "text": "What time is it?"
    }
  ],
  "requester_avatar_url": "http://hylo-dev.s3.amazonaws.com/community/1933/avatar/1475424224039_TigerFace.png",
  "requester_name": "Joe Awesome",
  "requester_profile_url": "http://hylo.com/u/1",
  "settings_url": "http://hylo.com/c/hylo/settings?expand=access"
}
\`\`\`

---
