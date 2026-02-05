# Event RSVP_i18n

**Template ID**: `tem_93YXdBV6bg4WmD8w3krpGP7H`  
**Version ID**: `ver_x3wxv4wKBwwgXGDVfT4DJfCP`  
**Version Name**: New Version  
**Locale**: en-US  
**Downloaded**: 2026-01-29T01:25:33.106Z

## Subject

\`\`\`liquid
{% trans %}You RSVPed {{response}} {{event_name}}{% endtrans %}
\`\`\`

## Preheader

\`\`\`liquid
(empty)
\`\`\`

## HTML Content

\`\`\`liquid
{% snippet header_redesign %}

<p>{% trans %}Hi {{user_name}},{% endtrans %}</p>

<p>{% trans %}You indicated you are{% endtrans %} <i>{{response}}</i></p>
<h2>{{event_name}}</h2> 
<p>{% trans %}from{% endtrans %} {{group_names}}</p> 
<strong>{{date}}</strong>

<br>
<br>

<a class='btn btn-blue' href="{{event_url}}" clicktracking="off">{% trans %}Event Page{% endtrans %}</a>

<br>
<br>

<p>{% trans %}Attached is an invite to add this event to your calendar.{% endtrans %}</p>

{% snippet footer_redesign %}
\`\`\`

## Plain Text Content

\`\`\`liquid
{% trans %}Hi {{user_name}},{% endtrans %}

{% trans %}You indicated you are {{response}}{% endtrans %}

{% trans %}{{event_name}}{% endtrans %}

{% trans %}from {{group_names}}{% endtrans %}
{% trans %}{{date}}{% endtrans %}

{% trans %}Event Page [{% endtrans %} {{event_url}} {% trans %}]{% endtrans %}

{% trans %}Attached is an invite to add this event to your calendar.{% endtrans %}

{% trans %}[ https://hylo.com ]{% endtrans %}
{% if group_name %}{% trans %}{{group_name}} is hosted on {% endtrans %}{% else %}{% trans %} This email sent from {% endtrans %}{% endif %} {% trans %}hylo.com {% endtrans %}{% trans %}[ https://hylo.com ]{% endtrans %} 
{%if email_settings_url %}{% trans %} Email settings [{% endtrans %} {{email_settings_url}} {% trans %}] {% endtrans %}{% endif %}

{% trans %}View this email in a browser [{% endtrans %} {{swu.webview_url}} {% trans %}]%{ endtrans %}
\`\`\`

## Sample Data

\`\`\`json
{
  "date": "March 3, 2024 at 2:34pm",
  "event_name": "Picnic in the Park",
  "group_names": "Building Hylo",
  "response": "Going to",
  "user_name": "Kevin Triplett"
}
\`\`\`

---
