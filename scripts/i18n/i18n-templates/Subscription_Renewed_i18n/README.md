# Subscription Renewed_i18n

**Template ID**: `tem_9JSpqvqVFYywR8X8dBfvFjBG`  
**Version ID**: `ver_bkbPpGqmtffHTRWXFx8d9Jq4`  
**Version Name**: New Version  
**Locale**: en-US  
**Downloaded**: 2026-01-29T01:25:47.619Z

## Subject

\`\`\`liquid
{% trans %}Your {{offering_name}} subscription has been renewed{% endtrans %}
\`\`\`

## Preheader

\`\`\`liquid
(empty)
\`\`\`

## HTML Content

\`\`\`liquid
{% snippet 'header_redesign' %}

<p>{% trans %}Hi {{user_name}}{% endtrans %},</p>

<p>{% trans %}Your subscription to{% endtrans %} <strong>{{offering_name}}</strong> {% trans %}for{% endtrans %} {{group_name}} {% trans %}has been renewed successfully.{% endtrans %}</p>

<p><strong>{% trans %}Amount Paid:{% endtrans %}</strong> {{amount_paid}}</p>
<p><strong>{% trans %}Payment Date:{% endtrans %}</strong> {{payment_date}}</p>
<p><strong>{% trans %}Next Renewal:{% endtrans %}</strong> {{next_renewal_date}}</p>

{% if stripe_receipt_url %}
  <p><a data-click-track-id="8498" href="{{stripe_receipt_url}}">{% trans %}View Receipt{% endtrans %}</a></p>
{% endif %}

<p><a class='btn btn-blue' href="{{group_url}}" clicktracking="off">{% trans %}Continue Accessing Content{% endtrans %}</a></p>
<a class='btn btn-blue' href="{{manage_subscription_url}}" clicktracking="off">{% trans %}Manage Subscription{% endtrans %}</a>

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
  "offering_name": "Premium Membership",
  "group_name": "My Community",
  "group_url": "https://hylo.com/groups/my-community",
  "amount_paid": "$19.99",
  "payment_date": "January 2, 2026",
  "next_renewal_date": "February 2, 2026",
  "stripe_receipt_url": "https://pay.stripe.com/receipts/...",
  "manage_subscription_url": "https://hylo.com/settings/subscriptions"
}
\`\`\`

---
