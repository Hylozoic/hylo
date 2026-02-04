# Event Canceled_i18n

**Template ID**: `tem_YCTQy4pJywkRDw6pfhShDg9H`  
**Version ID**: `ver_kHBw7hcPdb3SPkTBPxkVtgcW`  
**Version Name**: New Version  
**Locale**: en-US  
**Downloaded**: 2026-01-29T01:25:31.718Z

## Subject

\`\`\`liquid
{% trans %}{{event_name}} has been canceled{% endtrans %}
\`\`\`

## Preheader

\`\`\`liquid
(empty)
\`\`\`

## HTML Content

\`\`\`liquid
{% snippet header_redesign %}

<p>{% trans %}Hi {{user_name}}{% endtrans %},</p>

<p>{% trans %}The event{% endtrans %}</p>
<h2>{{event_name}}</h2> 
<p>{% trans %}from {{group_names}}{% endtrans %}</p> 

<p>{% trans %}has been canceled. You can remove from your calendar.{% endtrans %}</p>

{% snippet footer_redesign %}
\`\`\`

## Plain Text Content

\`\`\`liquid
{% trans %}Hi {{user_name}},{% endtrans %}

{% trans %}You indicated you are {% endtrans %}{{response}}{% trans %}.{% endtrans %}

{% trans %}{{event_name}}{% endtrans %}

{% trans %}from {% endtrans %}{{group_names}}{% trans %} 
{% endtrans %}{{date}}{% trans %} 

Event Page [{% endtrans %} {{event_url}} {% trans %}]{% endtrans %}

{% trans %}Attached is an invite to add this event to your calendar.{% endtrans %}

{% trans %}[ https://hylo.com ]{% endtrans %}
{% if group_name %}{{group_name}} {% trans %}is hosted on {% endtrans %} {% else %} {% trans %} This email sent from {% endtrans %} {% endif %} {% trans %}hylo.com {% endtrans %}[ https://hylo.com ]
{%if email_settings_url %} {% trans %}Email settings [{% endtrans %} {{email_settings_url}} {% trans %}] {% endtrans %} {% endif %}

{% trans %}View this email in a browser [{% endtrans %} {{swu.webview_url}} {% trans %}]{% endtrans %}
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
