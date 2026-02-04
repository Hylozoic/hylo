# Subscription Renewal Reminder_i18n

**Template ID**: `tem_Vtq9VGMyPJ79d39hdBqj34PS`  
**Version ID**: `ver_6K6PHmj3bbQjySDYgCfTSJ3V`  
**Version Name**: New Version  
**Locale**: en-US  
**Downloaded**: 2026-01-29T01:25:47.163Z

## Subject

\`\`\`liquid
{% trans %}Your {{offering_name}} subscription renews in 7 days{% endtrans %}
\`\`\`

## Preheader

\`\`\`liquid
(empty)
\`\`\`

## HTML Content

\`\`\`liquid
{% snippet 'header_redesign' %}

<p>{% trans %}Hi {{user_name}},{% endtrans %}</p>

<p>{% trans %}Your subscription to{% endtrans %} <strong>{{offering_name}}</strong> {% trans %}for{% endtrans %} {{group_name}} {% trans %}will renew in 7 days.{% endtrans %}</p>

<p><strong>{% trans %}Renewal Date:{% endtrans %}</strong> {{renewal_date}}</p>
<p><strong>{% trans %}Amount:{% endtrans %}</strong> {{renewal_amount}}</p>
<p><strong>{% trans %}Billing Period:{% endtrans %}</strong> {{renewal_period}}</p>

<p>{% trans %}Your payment method on file will be charged automatically. If you need to update your payment method or cancel your subscription, please do so before the renewal date.{% endtrans %}</p>

<a class='btn btn-blue' href="{{manage_subscription_url}}" clicktracking="off">{% trans %}Manage Subscription{% endtrans %}</a>
<br>
{% if update_payment_url %}
  <a class='btn btn-blue' href="{{update_payment_url}}" clicktracking="off">{% trans %}Update Payment Method{% endtrans %}</a>
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
  "offering_name": "Premium Membership",
  "group_name": "My Community",
  "group_url": "https://hylo.com/groups/my-community",
  "renewal_date": "January 9, 2026",
  "renewal_amount": "$19.99",
  "renewal_period": "monthly",
  "manage_subscription_url": "https://hylo.com/settings/subscriptions",
  "update_payment_url": "https://billing.stripe.com/p/session/..."
}
\`\`\`

---
