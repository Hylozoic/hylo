# Group Peer Group Invite Notification_i18n

**Template ID**: `tem_8SjfcXpkCgdCVxrBXd9KD8YY`  
**Version ID**: `ver_XP9V7PXcg9XrmFGW7JWCY6HG`  
**Version Name**: New Version  
**Locale**: en-US  
**Downloaded**: 2026-01-29T01:25:37.369Z

## Subject

\`\`\`liquid
{% trans %}{{child_group_name}} has been invited to connect to {{parent_group_name}}{% endtrans %}
\`\`\`

## Preheader

\`\`\`liquid
(empty)
\`\`\`

## HTML Content

\`\`\`liquid
{% snippet "header_redesign" %}
{% snippet "macro: actor_pill" %}

<p>
{% trans %}{{actor_pill(inviter_name, inviter_avatar_url, inviter_profile_url)}} has invited {{actor_pill(child_group_name, child_group_avatar_url, child_group_settings_url)}} to connect to {{actor_pill(parent_group_name, parent_group_avatar_url, parent_group_url)}}{% endtrans %}
</p>

<p>{% trans %}They described your relationship as '{{description}}'{% endtrans %}</p>

<p>{% trans %}When your group connects to another group, your members will be able to join that group.{% endtrans %}</p>  

<a class='btn btn-blue' href="{{child_group_settings_url}}">{% trans %}Respond to this Invitation{% endtrans %}</a>

{% snippet "footer_redesign" %}
\`\`\`

## Plain Text Content

\`\`\`liquid
{% macro avatar_box(class, avatar_url) -%}
{{ caller() }}
{%- endmacro %} {% call avatar_box('post section', requester_avatar_url) %} {% trans %}{{requester_name}} [ {{requester_profile_url}} ] has asked to join {{community_name}}.{% endtrans %}

{% trans %}Manage their request [ {{settings_url}} ]{% endtrans %} {% endcall %}
\`\`\`

## Sample Data

\`\`\`json
{
  "child_group_name": "Child Group",
  "child_group_settings_url": "http://hylo.com/groups/child_group/settings/groups#invites",
  "description": "Collaborators and stuff",
  "email_settings_url": true,
  "inviter_avatar_url": "http://hylo-dev.s3.amazonaws.com/community/1933/avatar/1475424224039_TigerFace.png",
  "inviter_name": "Joe Awesome",
  "inviter_profile_url": "http://hylo.com/members/1",
  "parent_group_avatar_url": "http://hylo-dev.s3.amazonaws.com/community/1933/avatar/1475424224039_TigerFace.png",
  "parent_group_name": "Parent Group",
  "parent_group_url": "http://hylo.com/groups/parent_group"
}
\`\`\`

---
