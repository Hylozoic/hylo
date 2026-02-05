# Track Access Purchased_i18n

**Template ID**: `tem_BhjXYqRvK3VdGVcG9WhmWKRF`  
**Version ID**: `ver_tShg9h8S3Cr4HTXVxHXDtVkC`  
**Version Name**: New Version  
**Locale**: en-US  
**Downloaded**: 2026-01-29T01:25:48.079Z

## Subject

\`\`\`liquid
{% trans %}Track Access Purchased: {{track_name}}{% endtrans %}
\`\`\`

## Preheader

\`\`\`liquid
(empty)
\`\`\`

## HTML Content

\`\`\`liquid
{% snippet 'header_redesign' %}

<p>{% trans %}Hi {{user_name}}{% endtrans %},</p>

<p>{% trans %}Congratulations! You now have access to:{% endtrans %}</p>

<h2>{{track_name}}</h2>

{% if track_description %}
  <p>{{track_description}}</p>
{% endif %}

<p>{% trans %}in{% endtrans %} <strong>{{group_name}}</strong></p>

<p><strong>{% trans %}Purchase Date:{% endtrans %}</strong> {{purchase_date}}</p>
<p><strong>{% trans %}Amount:{% endtrans %}</strong> {{price_formatted}}</p>

{% if is_enrolled %}
  <p>{% trans %}You've been automatically enrolled in this track and can start learning right away!{% endtrans %}</p>
  <a class='btn btn-blue' href="{{start_learning_url}}" clicktracking="off">{% trans %}Start Learning{% endtrans %}</a>
{% else %}
  <a class='btn btn-blue' href="{{track_url}}" clicktracking="off">{% trans %}View Track{% endtrans %}</a>
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
  "group_name": "My Community",
  "group_url": "https://hylo.com/groups/my-community",
  "is_enrolled": true,
  "offering_name": "Track Access",
  "price_formatted": "$49.99",
  "purchase_date": "January 2, 2026",
  "start_learning_url": "https://hylo.com/groups/my-community/tracks/123/actions",
  "track_description": "A 6-week course on leadership principles and practices",
  "track_image_url": "https://...",
  "track_name": "Leadership Fundamentals",
  "track_url": "https://hylo.com/groups/my-community/tracks/123",
  "user_email": "john@example.com",
  "user_name": "John Doe"
}
\`\`\`

---
