# Admin-Granted Access_i18n

**Template ID**: `tem_VqyXxgQk3Dp8dRtPQkkPwhFJ`  
**Version ID**: `ver_gcTp8pVp8CChpYQrV9FTStbC`  
**Version Name**: New Version  
**Locale**: de-DE  
**Downloaded**: 2026-01-29T01:25:26.124Z

## Subject

\`\`\`liquid
{% trans %}Access Granted: {{access_name}}{% endtrans %}
\`\`\`

## Preheader

\`\`\`liquid
(empty)
\`\`\`

## HTML Content

\`\`\`liquid
{% snippet 'header_redesign' %}

<p>{% trans %}Hi {{user_name}}{% endtrans %},</p>

<p>{% trans %}{{granted_by_name}} has granted you access to:{% endtrans %}</p>

<h2>{{access_name}}</h2>

{% if group_name and access_type != 'group' %}
  <p>{% trans %}in {{group_name}}{% endtrans %}</p>
{% endif %}

{% if access_url %}
  {% if access_type == 'track' %}
    <a class='btn btn-blue' href="{{access_url}}" clicktracking="off">{% trans %}Start Learning{% endtrans %}</a>
  {% elif access_type == 'group' %}
    <a class='btn btn-blue' href="{{access_url}}" clicktracking="off">{% trans %}Visit Group{% endtrans %}</a>
  {% else %}
    <a class='btn btn-blue' href="{{access_url}}" clicktracking="off">{% trans %}Access Content{% endtrans %}</a>
  {% endif %}
{% endif %}

<br>
{% if expires_at %}
  <p><strong>{% trans %}Access Expires:{% endtrans %}</strong> {{expires_at}}</p>
{% else %}
  <p>{% trans %}You have ongoing access to this content.{% endtrans %}</p>
{% endif %}

{% snippet 'footer_redesign' %}
\`\`\`

## Plain Text Content

\`\`\`liquid
(empty)
\`\`\`

## Sample Data

\`\`\`json
{
  "user_name": "John Doe",
  "user_email": "john@example.com",
  "access_type": "track",
  "access_name": "Leadership Course",
  "access_url": "https://hylo.com/groups/my-community/tracks/123",
  "group_name": "My Community",
  "group_url": "https://hylo.com/groups/my-community",
  "granted_by_name": "Admin User",
  "expires_at": "February 2, 2026"
}
\`\`\`

---
