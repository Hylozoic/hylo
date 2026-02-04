# Moderation Action_i18n

**Template ID**: `tem_BXYk4Hxt74R9jH3pkdGfqbJM`  
**Version ID**: `ver_G8Gkhx3vy3hPHrcqhxVSmRKG`  
**Version Name**: New Version  
**Locale**: en-US  
**Downloaded**: 2026-01-29T01:25:39.689Z

## Subject

\`\`\`liquid
{% trans %}{{subject}}{% endtrans %}
\`\`\`

## Preheader

\`\`\`liquid
(empty)
\`\`\`

## HTML Content

\`\`\`liquid
{% snippet 'header_redesign' %}

<p>
  {% trans %}{{body}}{% endtrans %}
</p>

<a href='btn btn-blue' href='{{post_url}}'>{% trans %}View the post{% endtrans %}</a>

{% snippet 'footer_redesign' %}
\`\`\`

## Plain Text Content

\`\`\`liquid
[ https://www.hylo.com ]
{% trans %}{{body}}{% endtrans %}
\`\`\`

## Sample Data

\`\`\`json
{
  "body": "Your post 'Free Cookies' in group Glen View Neighborhood was flagged as violating a group agreement.",
  "post_url": "https://hylo.com",
  "subject": "Your post was flagged"
}
\`\`\`

---
