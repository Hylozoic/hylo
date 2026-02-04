# Group Parent Group Request to Join Accepted Notification_i18n

**Template ID**: `tem_mm6hdXBxRc9dckCp6C386rGG`  
**Version ID**: `ver_qpTXWS3W9Hd8F4vSrTtJxwKD`  
**Version Name**: New Version  
**Locale**: en-US  
**Downloaded**: 2026-01-29T01:25:35.985Z

## Subject

\`\`\`liquid
{% if memberOf == 'child' %}
  {% trans %}Your group {{child_group_name}} has joined {{parent_group_name}}{% endtrans %}
{% else %} 
  {% trans %}{{child_group_name}} has joined your group {{parent_group_name}}{% endtrans %}
{% endif %}
\`\`\`

## Preheader

\`\`\`liquid
(empty)
\`\`\`

## HTML Content

\`\`\`liquid
{% snippet "header_redesign" %}
{% snippet "macro: actor_pill" %}

{% if memberOf == 'child' and memberType == 'member' %}
  <p>{% trans %}Your group {{actor_pill(child_group_name, child_group_avatar_url, child_group_url)}} has joined group {{actor_pill(parent_group_name, parent_group_avatar_url, parent_group_url)}}.{% endtrans %} {% if parent_group_accessibility != 'closed' %} {% trans %} You can now join {{actor_pill(parent_group_name, parent_group_avatar_url, parent_group_url)}}.{% endtrans %} {% endif %}</p>
{% elif memberOf == 'child' and memberType == 'moderator' %}
  <p>{% trans %}The request from your group {{actor_pill(child_group_name, child_group_avatar_url, child_group_url)}} to join group {{actor_pill(parent_group_name, parent_group_avatar_url, parent_group_url)}} has been accepted!{% endtrans %} {% if parent_group_accessibility != 'closed' %} {% trans %} You can now join {{actor_pill(parent_group_name, parent_group_avatar_url, parent_group_url)}}.{% endtrans %} {% endif %}
  </p>
{% elif memberOf == 'parent' and memberType == 'member' %}
  <p>{% trans %}The group {{actor_pill(child_group_name, child_group_avatar_url, child_group_url)}} has joined your group {{actor_pill(parent_group_name, parent_group_avatar_url, parent_group_url)}}!{% endtrans %} {% if child_group_accessibility != 'closed' %} {% trans %} You can now join {{actor_pill(child_group_name, child_group_avatar_url, child_group_url)}}.{% endtrans %} {% endif %}
  </p>
{% elif memberOf == 'parent' and memberType == 'moderator' %}
<p>{% trans %}The group {{actor_pill(child_group_name, child_group_avatar_url, child_group_url)}} has joined your group {{actor_pill(parent_group_name, parent_group_avatar_url, parent_group_url)}}!{% endtrans %} {% if accepter_name %}{{accepter_name}} {% trans %}accepted the request to join.{% endtrans %} {% endif %} {% if child_group_accessibility != 'closed' %} {% trans %} You can now join {{actor_pill(child_group_name, child_group_avatar_url, child_group_url)}}.{% endtrans %} {% endif %} </p>
{% endif %}

{% snippet "footer_redesign" %}
\`\`\`

## Plain Text Content

\`\`\`liquid
{% macro avatar_box(class, avatar_url) -%}
{{ caller() }}
{%- endmacro %} {% call avatar_box('post section', requester_avatar_url) %} {% trans %}{{requester_name}} [ {{requester_profile_url}} ] has asked to join {% endtrans %}{{community_name}}{% trans %}. 

Manage their request [ {{settings_url}} ] {% endtrans %}{% endcall %}
\`\`\`

## Sample Data

\`\`\`json
{
  "accepter_name": "Joe Awesome",
  "child_group_accessibility": "open",
  "child_group_avatar_url": "http://hylo-dev.s3.amazonaws.com/community/1933/avatar/1475424224039_TigerFace.png",
  "child_group_name": "Child Group",
  "child_group_url": "https://hylo.com",
  "memberOf": "parent",
  "memberType": "member",
  "parent_group_accessibility": "open",
  "parent_group_avatar_url": "http://hylo-dev.s3.amazonaws.com/community/1933/avatar/1475424224039_TigerFace.png",
  "parent_group_name": "Parent Group",
  "parent_group_url": "http://hylo.com/groups/parent_group/groups"
}
\`\`\`

---
