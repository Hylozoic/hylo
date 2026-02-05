# Join Request Approval Notification_i18n

**Template ID**: `tem_JjPbSJqj4wbJqSydqw49VrfT`  
**Version ID**: `ver_YGT3YYRRT8KBD9GPtx4MwSBH`  
**Version Name**: New Version  
**Locale**: en-US  
**Downloaded**: 2026-01-29T01:25:38.291Z

## Subject

\`\`\`liquid
{% trans %}Your request to join {{group_name}} has been approved{% endtrans %}
\`\`\`

## Preheader

\`\`\`liquid
(empty)
\`\`\`

## HTML Content

\`\`\`liquid
{% snippet "header_redesign" %}
{% snippet "macro: actor_pill" %}

<p>{% trans %}Your request to join {{actor_pill(group_name, group_avatar_url, group_url)}} was approved by {{actor_pill(approver_name, approver_avatar_url, approver_profile_url)}}!{% endtrans %}</p>

<p>{% trans %}Now's a great time to introduce yourself in the chat.{% endtrans %}</p>

<a clicktracking="off" class='btn btn-blue' href="{{group_url}}">{% trans %}Jump in{% endtrans %}</a>

{% snippet "footer_redesign" %}
\`\`\`

## Plain Text Content

\`\`\`liquid
(empty)
\`\`\`

## Sample Data

\`\`\`json
{
  "approver_avatar_url": "http://hylo-dev.s3.amazonaws.com/community/1933/avatar/1475424224039_TigerFace.png",
  "approver_name": "Joe Awesome",
  "approver_profile_url": "http://hylo.com/u/1",
  "group_avatar_url": "https://d3ngex8q79bk55.cloudfront.net/community/29/avatar/1461109347506_1447730249381_1447428110647_hylo-merk.png",
  "group_name": "Awesome People",
  "group_url": "http://hylo.com/c/hylo"
}
\`\`\`

---
