# Email Verification_i18n

**Template ID**: `tem_h99yGHv9MXTpMrPSDVTjQFyB`  
**Version ID**: `ver_ychtcSYckCjhjJDPBHP4pfH6`  
**Version Name**: New Version  
**Locale**: en-US  
**Downloaded**: 2026-01-29T01:25:31.259Z

## Subject

\`\`\`liquid
{% trans %}Hylo confirmation code {{code}}{% endtrans %}
\`\`\`

## Preheader

\`\`\`liquid
(empty)
\`\`\`

## HTML Content

\`\`\`liquid
{% snippet 'header_redesign' %}
<p>{% trans %}Welcome to Hylo! We’re so glad you’re here 🤗 Secure your account by copying this access code or pressing the button.{% endtrans %}</p>

<div class='card center'>
  <strong class='small'>{% trans %}Your access code{% endtrans %}</strong>
  <h1 style='margin-top: 20px;'>{{code}}</h1>
</div>

<a class='btn btn-blue' href="{{verify_url}}" clicktracking="off">{% trans %}Or click here to confirm this email address{% endtrans %}</a>

<p style='text-align: center; margin-top: 20px; font-size: 12px;'>{% trans %}If you didn’t request this email, there’s nothing to worry about — you can safely ignore it.{% endtrans %}</p>

{% snippet 'footer_redesign' %}
\`\`\`

## Plain Text Content

\`\`\`liquid
(empty)
\`\`\`

## Sample Data

\`\`\`json
{
  "code": "456 345",
  "verify_url": "https://hylo.com"
}
\`\`\`

---
