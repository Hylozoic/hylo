# Payment Failed_i18n

**Template ID**: `tem_DPgwbvvxfkPc83JkPwBvpChQ`  
**Version ID**: `ver_yffvmmFDSwm9tb8KyP7XSFFT`  
**Version Name**: New Version  
**Locale**: en-US  
**Downloaded**: 2026-01-29T01:25:42.015Z

## Subject

\`\`\`liquid
{% trans %}Payment Failed: {{offering_name}}{% endtrans %}
\`\`\`

## Preheader

\`\`\`liquid
(empty)
\`\`\`

## HTML Content

\`\`\`liquid
{% snippet 'header_redesign' %}

<p>{% trans %}Hi {{user_name}}{% endtrans %},</p>

<p><strong>{% trans %}Action Required:{% endtrans %}</strong> {% trans %}We were unable to process your payment for your subscription to {% endtrans %}<strong>{{offering_name}}</strong> {% trans %}for {% endtrans %}{{group_name}}.</p>

<p><strong>{% trans %}Reason:{% endtrans %}</strong> {{failure_reason}}</p>

{% if retry_date %}
  <p>{% trans %}We will automatically retry your payment on {% endtrans %}<strong>{{retry_date}}</strong>{% trans %}.{% endtrans %}</p>
{% endif %}

{% if access_ends_date %}
  <p><strong>{% trans %}Important:{% endtrans %}</strong> {% trans %}Your access will end on {% endtrans %}{{access_ends_date}} {% trans %}if payment is not successful.{% endtrans %}</p>
{% endif %}

<p>{% trans %}Please update your payment method to ensure uninterrupted access:{% endtrans %}</p>

<a class='btn btn-blue' href="{{update_payment_url}}" clicktracking="off">{% trans %}Update Payment Method{% endtrans %}</a>
<br>
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
  "failure_reason": "Card declined",
  "retry_date": "January 5, 2026",
  "access_ends_date": "January 10, 2026",
  "update_payment_url": "https://billing.stripe.com/p/session/...",
  "manage_subscription_url": "https://hylo.com/settings/subscriptions"
}
\`\`\`

---
