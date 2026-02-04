# Track Enrollment_i18n

**Template ID**: `tem_tFrcKvJvTRVYMbDYSrTHwVfV`  
**Version ID**: `ver_P67pvxKGfMTJ6Sx3RfvmvmJW`  
**Version Name**: New Version  
**Locale**: en-US  
**Downloaded**: 2026-01-29T01:25:48.992Z

## Subject

\`\`\`liquid
{% trans %}New enrollment in track {{track_name}}{% endtrans %}
\`\`\`

## Preheader

\`\`\`liquid
(empty)
\`\`\`

## HTML Content

\`\`\`liquid
{% snippet "header_redesign" %}
{% snippet "macro: actor_pill" %}

<p>{% trans %}{{actor_pill(enrollee_name, enrollee_avatar_url, enrollee_profile_url)}} has enrolled in the track: {% endtrans %}<strong>{% trans %}{{track_name}}{% endtrans %}</strong></p>

<a class='btn btn-blue' href="{{enrollee_profile_url}}">{% trans %}Welcome Them!{% endtrans %}</a>

{% snippet "footer_redesign" %}
\`\`\`

## Plain Text Content

\`\`\`liquid
{% macro actor_pill(name, avatar, url) %} {% if avatar %}{% endif %} {% trans %}{{name}}{% endtrans %} {% trans %}[ {{url}} ]{% endtrans %} {% endmacro %}
{% trans %}{{actor_pill(enrollee_name, enrollee_avatar_url, enrollee_profile_url)}}{% endtrans %} {% trans %}has enrolled in the track: {{track_name}}{% endtrans %}
{% trans %}Welcome Them!{% endtrans %} {% trans %}[ {{enrollee_profile_url}} ]{% endtrans %}
{% trans %}[ https://hylo.com ]{% endtrans %}
{% if group_name %}{% trans %}{{group_name}}{% endtrans %} {% trans %}is hosted on {% endtrans %}{% else %} {% trans %}This email sent from {% endtrans %} {% endif%} {% trans %}hylo.com{% endtrans %} {% trans %}[ https://hylo.com ]{% endtrans %}
{% if email_settings_url %} {% trans %}Email settings{% endtrans %} {% trans %}[ {{email_settings_url}} ]{% endtrans %} {% endif %}

{% trans %}View this email in a browser{% endtrans %} {% trans %}[ {{swu.webview_url}} ]{% endtrans %}
\`\`\`

## Sample Data

\`\`\`json
{
  "enrollee_avatar_url": "https://gravatar.com/avatar/d564bfed3bc3f639a900baadd834c028?s=400&d=robohash&r=x",
  "enrollee_name": "Friendly Ghost",
  "enrollee_profile_url": "hylo.com",
  "track_name": "Permaculture Design Course"
}
\`\`\`

---
