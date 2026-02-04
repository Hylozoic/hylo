# Track Completed_i18n

**Template ID**: `tem_G69qyjJ6xVHxMJMqcwp98dfF`  
**Version ID**: `ver_BrvFXTdxWYRfFqMbxRyxfVV7`  
**Version Name**: New Version  
**Locale**: en-US  
**Downloaded**: 2026-01-29T01:25:48.536Z

## Subject

\`\`\`liquid
{% trans %}Track {{track_name}} completed by {{completer_name}}{% endtrans %}
\`\`\`

## Preheader

\`\`\`liquid
(empty)
\`\`\`

## HTML Content

\`\`\`liquid
{% snippet "header_redesign" %}
{% snippet "macro: actor_pill" %}

<p>{% trans %}{{actor_pill(completer_name, completer_avatar_url, completer_profile_url)}} has completed the track {% endtrans %}<strong>{% trans %}{{track_name}}{% endtrans %}</strong>{% trans %}</p>

<a class='btn btn-blue' href="{{completer_profile_url}}">{% trans %}Congratulate Them!{% endtrans %}</a>

{% snippet "footer_redesign" %}
\`\`\`

## Plain Text Content

\`\`\`liquid
{% macro actor_pill(name, avatar, url) %} {% if avatar %}{% endif %} {% trans %}{{name}}{% endtrans %} [ {% trans %}{{url}}{% endtrans %} ] {% endmacro %}
{% trans %}{{actor_pill(completer_name, completer_avatar_url, completer_profile_url)}}{% endtrans %} {% trans %}has completed the track:{% endtrans %} {% trans %}{{track_name}}{% endtrans %}
{% trans %}Congratulate Them!{% endtrans %} [ {% trans %}{{completer_profile_url}}{% endtrans %} ]
[ https://hylo.com ]
{% if group_name %}{% trans %}{{group_name}}{% endtrans %} {% trans %}is hosted on{% endtrans %} {% else %} {% trans %}This email sent from{% endtrans %} {% endif %} hylo.com [ https://hylo.com ]
{% if email_settings_url %} {% trans %}Email settings{% endtrans %} [ {% trans %}{{email_settings_url}}{% endtrans %} ] {% endif %}

{% trans %}View this email in a browser{% endtrans %} [ {% trans %}{{swu.webview_url}}{% endtrans %} ]
\`\`\`

## Sample Data

\`\`\`json
{
  "completer_avatar_url": "https://gravatar.com/avatar/d564bfed3bc3f639a900baadd834c028?s=400&d=robohash&r=x",
  "completer_name": "Friendly Ghost",
  "completer_profile_url": "hylo.com",
  "completion_message": "You did it! Wheeeeee",
  "track_name": "Permaculture Design Course"
}
\`\`\`

---
