# Group Child Group Invite Accepted Notification_i18n

**Template ID**: `tem_VYrh6YFTB3X6yq66Rm6qMtgD`  
**Version ID**: `ver_crK9XgKVbvBGXCWhJtHQyHRY`  
**Version Name**: New Version  
**Locale**: en-US  
**Downloaded**: 2026-01-29T01:25:35.056Z

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
  <p>{% trans %}Your group {{actor_pill(child_group_name, child_group_avatar_url, child_group_url)}} has joined group {{actor_pill(parent_group_name, parent_group_avatar_url, parent_group_url)}}.{% endtrans %} {% if prent_group_accessibility != 'closed' %} {% trans %}You can now join {{actor_pill(parent_group_name, parent_group_avatar_url, parent_group_url)}}.{% endtrans %} {% endif %}</p>
{% elif memberOf == 'child' and memberType == 'moderator' %}
  <p>{% trans %}Your group {{actor_pill(child_group_name, child_group_avatar_url, child_group_url)}} has joined group {{actor_pill(parent_group_name, parent_group_avatar_url, parent_group_url)}}!{% endtrans %} {% if accepter_name %}{{accepter_name}} {% trans %}accepted the invitation to join.{% endtrans %} {% endif %} {% if parent_group_accessibility != 'closed' %} {% trans %}You can now join {{actor_pill(parent_group_name, parent_group_avatar_url, parent_group_url)}}.{% endtrans %} {% endif %}
  </p>
{% elif memberOf == 'parent' and memberType == 'member' %}
  <p>{% trans %}The group {{actor_pill(child_group_name, child_group_avatar_url, child_group_url)}} has joined your group {{actor_pill(parent_group_name, parent_group_avatar_url, parent_group_url)}}!{% endtrans %} {% if child_group_accessibility != 'closed' %} {% trans %}You can now join {{actor_pill(child_group_name, child_group_avatar_url, child_group_url)}}.{% endtrans %} {% endif %}
  </p>
{% elif memberOf == 'parent' and memberType == 'moderator' %}
<p>{% trans %}The group {{actor_pill(child_group_name, child_group_avatar_url, child_group_url)}} has joined your group {{actor_pill(parent_group_name, parent_group_avatar_url, parent_group_url)}}!{% endtrans %} {% if child_group_accessibility != 'closed' %} {% trans %}You can now join {{actor_pill(child_group_name, child_group_avatar_url, child_group_url)}}.{% endtrans %} {% endif %} </p>
{% endif %}

{% snippet "footer_redesign" %}
\`\`\`

## Plain Text Content

\`\`\`liquid
{% macro actor_pill(name, avatar, url) %} {{name}} [ {{url}} ] {% endmacro %} {% if memberOf == 'child' and memberType == 'member' %}
{% trans %}Your group {% endtrans %} {{actor_pill(child_group_name, child_group_avatar_url, child_group_url)}} {% trans %}has joined group {% endtrans %} {{actor_pill(parent_group_name, parent_group_avatar_url, parent_group_url)}}. {% if prent_group_accessibility != 'closed' %} {% trans %}You can now join {% endtrans %} {{actor_pill(parent_group_name, parent_group_avatar_url, parent_group_url)}}. {% endif %}
{% elif memberOf == 'child' and memberType == 'moderator' %}
{% trans %}Your group {% endtrans %} {{actor_pill(child_group_name, child_group_avatar_url, child_group_url)}} {% trans %}has joined group {% endtrans %} {{actor_pill(parent_group_name, parent_group_avatar_url, parent_group_url)}}! {% if accepter_name %}{{accepter_name}} {% trans %}accepted the invitation to join.{% endtrans %} {% endif %} {% if parent_group_accessibility != 'closed' %} {% trans %}You can now join {% endtrans %} {{actor_pill(parent_group_name, parent_group_avatar_url, parent_group_url)}}. {% endif %}
{% elif memberOf == 'parent' and memberType == 'member' %}
{% trans %}The group {% endtrans %} {{actor_pill(child_group_name, child_group_avatar_url, child_group_url)}} {% trans %}has joined your group {% endtrans %} {{actor_pill(parent_group_name, parent_group_avatar_url, parent_group_url)}}! {% if child_group_accessibility != 'closed' %} {% trans %}You can now join {% endtrans %} {{actor_pill(child_group_name, child_group_avatar_url, child_group_url)}}. {% endif %}
{% elif memberOf == 'parent' and memberType == 'moderator' %}
{% trans %}The group {% endtrans %} {{actor_pill(child_group_name, child_group_avatar_url, child_group_url)}} {% trans %}has joined your group {% endtrans %} {{actor_pill(parent_group_name, parent_group_avatar_url, parent_group_url)}}! {% if child_group_accessibility != 'closed' %} {% trans %}You can now join {% endtrans %} {{actor_pill(child_group_name, child_group_avatar_url, child_group_url)}}. {% endif %}
{% endif %}
[ https://hylo.com ]
{% if group_name %}{{group_name}} {% trans %}is hosted on {% endtrans %} {% else %} {% trans %}This email sent from {% endtrans %} {% endif%} hylo.com [ https://hylo.com ]
{%if email_settings_url %} {% trans %}Email settings {% endtrans %} [ {{email_settings_url}} ] {% endif %}

{% trans %}View this email in a browser {% endtrans %} [ {{swu.webview_url}} ]
\`\`\`

## Sample Data

\`\`\`json
{
  "accepter_name": "Joe Awesome",
  "child_group_accessibility": "restricted",
  "child_group_avatar_url": "http://hylo-dev.s3.amazonaws.com/community/1933/avatar/1475424224039_TigerFace.png",
  "child_group_name": "Child Group",
  "email_settings_url": "https://hylo.com",
  "memberOf": "parent",
  "memberType": "member",
  "parent_group_accessibility": "open",
  "parent_group_name": "Parent Group",
  "parent_group_url": "http://hylo.com/groups/parent_group/groups"
}
\`\`\`

---
