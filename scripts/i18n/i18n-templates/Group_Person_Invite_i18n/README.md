# Group Person Invite_i18n

**Template ID**: `tem_GTwXKBfkTpTHRfHpmJWbYr9d`  
**Version ID**: `ver_PQpmP6CrTWqtkGrwkVMHBFRG`  
**Version Name**: New Version  
**Locale**: en-US  
**Downloaded**: 2026-01-29T01:29:40.315Z

## Subject

\`\`\`liquid
{% trans %}{{subject.format(group_name)}}{% endtrans %}
\`\`\`

## Preheader

\`\`\`liquid
(empty)
\`\`\`

## HTML Content

\`\`\`liquid
{% snippet 'header_redesign' %}
{% snippet "macro: actor_pill" %}

<p class="lead">
  {% trans %}You've been invited to join {{actor_pill(group_name, group_avatar_url, group_url)}} {% endtrans %} !
</p> 
 
<div class='card'>
  <div style='font-weight: bold; margin-top: 5px; margin-bottom: 10px;'>{{inviter_name}} {% trans %}invited you {% endtrans %}</div>
  <div>{{message.format(group_name)|default("{% trans %}Hi!<br><br>I'm inviting you to join my community on Hylo.{% endtrans %}", true)|safe}} 
  </div>
</div>   

<a class='btn btn-blue' href='{{invite_link}}'>{% trans %}Join {{group_name}}{% endtrans %}</a> 

{% snippet 'footer_redesign' %}
\`\`\`

## Plain Text Content

\`\`\`liquid
{{message|safe}}

{% trans %}Click this link to join me on Hylo: {{invite_link}}{% endtrans %}

{% trans %}{{inviter_name}}{% endtrans %}
\`\`\`

## Sample Data

\`\`\`json
{
  "group_avatar_url": "https://d3ngex8q79bk55.cloudfront.net/community/1/avatar/devAvatar.png",
  "group_name": "Terran Collective",
  "group_url": "https://hylo.com/groups/terran-collective",
  "invite_link": "https://helloworld.com",
  "inviter_avatar_url": "https://hylo-dev.s3.amazonaws.com/dev-evo-uploads/user/24917/userAvatar/24917/face-beautiful-young-girl-clean-260nw-328676489.jpg",
  "inviter_name": "Ray Marceau",
  "message": "do it yo {}",
  "subject": "You're invited to Terran Collective"
}
\`\`\`

---
