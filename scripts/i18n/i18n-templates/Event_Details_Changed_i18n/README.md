# Event Details Changed_i18n

**Template ID**: `tem_77XY6QJTVYKKFhDtkVgW3W93`  
**Version ID**: `ver_tkbqgMRHKqq6H73wKcD6bmPJ`  
**Version Name**: New Version  
**Locale**: en-US  
**Downloaded**: 2026-01-29T01:25:32.175Z

## Subject

\`\`\`liquid
{% trans %}Details for {{event_name}} have changed{% endtrans %}
\`\`\`

## Preheader

\`\`\`liquid
(empty)
\`\`\`

## HTML Content

\`\`\`liquid
{% snippet header_redesign %}

<p>{% trans %}Hi {{user_name}}{% endtrans %},</p>

<p>{% trans %}The event details have changed for event you are {% endtrans %}{{response}}:</p>

<h2>{{event_name}}</h2> 
<p>{% trans %}from {% endtrans %}{{group_names}}</p> 

{% if newDate %} 
  <p>{% trans %}Date has changed to {% endtrans %}<strong>{{newDate}}</strong></p>
{% endif %}

{% if newLocation %} 
  <p>{% trans %}Location has changed to {% endtrans %}<strong>{{newLocation}}</strong></p>
{% endif %}

<br>

<a class='btn btn-blue' href="{{event_url}}" clicktracking="off">{% trans %}Event Page{% endtrans %}</a>

<br>
<br>

<p>{% trans %}Attached is an updated calendar invite.{% endtrans %}</p>

{% snippet footer_redesign %}
\`\`\`

## Plain Text Content

\`\`\`liquid
{% trans %}Hi {{user_name}},{% endtrans %}

{% trans %}You indicated you are {{response}}{% endtrans %}

{% trans %}{{event_name}}{% endtrans %}

{% trans %}from {{group_names}}{% endtrans %}
{% trans %}{{date}}{% endtrans %}

{% trans %}Event Page [ {{event_url}} ]{% endtrans %}

{% trans %}Attached is an invite to add this event to your calendar.{% endtrans %}

{% trans %}[ https://hylo.com ]{% endtrans %}
{% if group_name %}{% trans %}{{group_name}} {% endtrans %}{% trans %}is hosted on {% endtrans %}{% else %}{% trans %} This email sent from {% endtrans %}{% endif%} {% trans %}hylo.com [ https://hylo.com ]{% endtrans %}
{%if email_settings_url %}{% trans %} Email settings [ {{email_settings_url}} ] {% endtrans %} {% endif %}

{% trans %}View this email in a browser [ {{swu.webview_url}} ]{% endtrans %}
\`\`\`

## Sample Data

\`\`\`json
{
  "event_name": "Picnic in the Park",
  "group_names": "Building Hylo",
  "newDate": "March 3, 2024 at 2:34pm",
  "newLocation": "123 everett ave, oakland, ca",
  "response": "Going to",
  "user_name": "Kevin Triplett"
}
\`\`\`

---
