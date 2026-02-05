# Member Joined Group_i18n

**Template ID**: `tem_rvbqYrfMK8VQkqCPJXBRd6KR`  
**Version ID**: `ver_TwtyGYjV9tVGtby8pGpgXVh7`  
**Version Name**: New Version  
**Locale**: en-US  
**Downloaded**: 2026-01-29T01:29:42.839Z

## Subject

\`\`\`liquid
{% trans %}A new member has joined {{group_name}}: {{member_name}}{% endtrans %}
\`\`\`

## Preheader

\`\`\`liquid
(empty)
\`\`\`

## HTML Content

\`\`\`liquid
{% snippet 'header_redesign' %}
{% snippet 'macro: actor_pill' %}

<p>{% trans %}Your group is growing!{% endtrans %}</p>

<div class='card center'>
{{actor_pill(member_name, member_avatar_url, member_profile_url)}} {% trans %}has joined{% endtrans %} {{actor_pill(group_name, group_avatar_url, group_url)}}
</div>

{% if join_question_answers %}
{% for question in join_question_answers %}
<div class='card'>
  {{actor_pill(group_name, group_avatar_url, group_url)}}
  <h3>{% trans %}{{question.text}}{% endtrans %}</h3>
  
  {{actor_pill(member_name, member_avatar_url, member_profile_url)}}
  <p>{% trans %}{{question.answer|e}}{% endtrans %}</p>
  </ul>
</div>
{% endfor %}
{% endif %}

<a href='{{group_url}}' class='btn btn-blue'>{% trans %}Welcome {{member_name}} to the group{% endtrans %}</a>

{% snippet 'footer_redesign' %}
\`\`\`

## Plain Text Content

\`\`\`liquid
[ https://www.hylo.com ]
{% trans %}Your group {{group_name}} [ {{group_url}} ] is growing!{% endtrans %}

{% trans %}Your newest member is {{member_name|e}} [ {{member_profile_url}} ] , send them a note to say hello [ {{message_url}} ] !{% endtrans %}
{% if join_questions %} 
{% trans %}Their join question responses:{% endtrans %} 
{% for question in join_questions %} 
{% trans %}- {{question.text|e}}: {{question.answer|e}}{% endtrans %} 
{% endfor %} 
{% endif %}
\`\`\`

## Sample Data

\`\`\`json
{
  "group_name": "Building Hylo",
  "group_url": "https://hylo.com/groups/building-hylo",
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
  "member_name": "Harold Murple",
  "member_url": "https://hylo.com/groups/building-hylo/members/1"
}
\`\`\`

---
