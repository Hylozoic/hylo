# Purchase Confirmation_i18n

**Template ID**: `tem_dPGv63tFydFJrhCd3jtMcPMM`  
**Version ID**: `ver_q6tYGqf7CY6SBFHgPyXM3vfY`  
**Version Name**: New Version  
**Locale**: en-US  
**Downloaded**: 2026-01-29T01:25:45.707Z

## Subject

\`\`\`liquid
{% trans %}Purchase Confirmation: {{offering_name}}{% endtrans %}
\`\`\`

## Preheader

\`\`\`liquid
(empty)
\`\`\`

## HTML Content

\`\`\`liquid
{% snippet 'header_redesign' %}

<p>{% trans %}Hi {{user_name}}{% endtrans %},</p>

<p>{% trans %}Thank you for your purchase! Your payment has been processed successfully.{% endtrans %}</p>

<h2>{{offering_name}}</h2>

{% if offering_description %}
  <p>{{offering_description}}</p>
{% endif %}

<p><strong>{% trans %}Amount:{% endtrans %}</strong> {{price_formatted}} {{currency}}</p>
<p><strong>{% trans %}Purchase Date:{% endtrans %}</strong> {{purchase_date}}</p>

{% if is_subscription %}
  <p>{% trans %}This is a recurring subscription that will renew automatically.{% endtrans %}</p>
  <p><strong>{% trans %}Next Renewal:{% endtrans %}</strong> {{renewal_date}}</p>
  <p><strong>{% trans %}Billing Period:{% endtrans %}</strong> {{renewal_period}}</p>
  <a class='btn btn-blue' href="{{manage_subscription_url}}" clicktracking="off">{% trans %}Manage Subscription{% endtrans %}</a>
{% else %}
  {% if expires_at %}
    <p><strong>{% trans %}Access Expires:{% endtrans %}</strong> {{expires_at}}</p>
  {% else %}
    <p>{% trans %}You have lifetime access to this content.{% endtrans %}</p>
  {% endif %}
{% endif %}
<br>
{% if access_type == 'group' %}
  <p>{% trans %}You now have access to {% endtrans %}<strong>{{group_name}}</strong>.</p>
  <a class='btn btn-blue' href="{{group_url}}" clicktracking="off">{% trans %}Visit Group{% endtrans %}</a>
{% elif access_type == 'track' %}
  <p>{% trans %}You now have access to the track {% endtrans %}<strong>{{track_name}}</strong> {% trans %}in {% endtrans %}{{group_name}}.</p>
  <a class='btn btn-blue' href="{{track_url}}" clicktracking="off">{% trans %}Start Learning{% endtrans %}</a>
{% endif %}

{% if stripe_receipt_url %}
  <br>
  <br>
  <p><a data-click-track-id="5325" href="{{stripe_receipt_url}}">{% trans %}View Receipt{% endtrans %}</a></p>
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
  "access_type": "group",
  "currency": "USD",
  "group_name": "My Community",
  "group_url": "https://hylo.com/groups/my-community",
  "is_subscription": true,
  "manage_subscription_url": "https://hylo.com/settings/subscriptions",
  "offering_description": "Access to all premium content and exclusive features",
  "offering_name": "Premium Membership",
  "price_formatted": "$19.99",
  "purchase_date": "January 2, 2026",
  "renewal_date": "February 2, 2026",
  "renewal_period": "monthly",
  "stripe_receipt_url": "https://pay.stripe.com/receipts/...",
  "user_email": "john@example.com",
  "user_name": "John Doe"
}
\`\`\`

---
