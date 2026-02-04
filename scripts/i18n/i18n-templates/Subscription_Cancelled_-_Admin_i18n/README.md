# Subscription Cancelled - Admin_i18n

**Template ID**: `tem_c9Qh9Q634XcSwdFyVCbCWCqS`  
**Version ID**: `ver_hcftX9BpDbyxwFQxW9x6fcKM`  
**Version Name**: New Version  
**Locale**: en-US  
**Downloaded**: 2026-01-29T01:25:46.238Z

## Subject

\`\`\`liquid
{% trans %}Subscription Cancelled: {{offering_name}} in {{group_name}}{% endtrans %}
\`\`\`

## Preheader

\`\`\`liquid
(empty)
\`\`\`

## HTML Content

\`\`\`liquid
{% snippet 'header_redesign' %}

<p>{% trans %}Hi {{admin_name}}{% endtrans %},</p>

<p>{% trans %}A subscription has been cancelled for {{group_name}}.{% endtrans %}</p>

<p><strong>{% trans %}User:{% endtrans %}</strong> <a data-click-track-id="1273" href="{{user_profile_url}}">{{user_name}}</a> ({{user_email}})</p>
<p><strong>{% trans %}Offering:{% endtrans %}</strong> {{offering_name}}</p>
<p><strong>{% trans %}Cancelled:{% endtrans %}</strong> {{cancelled_at}}</p>

{% if access_ends_at %}
  <p><strong>{% trans %}Access Ends:{% endtrans %}</strong> {{access_ends_at}}</p>
{% endif %}

{% if reason %}
  <p><strong>{% trans %}Reason:{% endtrans %}</strong> {{reason}}</p>
{% endif %}

<p><strong>{% trans %}Revenue Impact:{% endtrans %} {{subscription_amount}} {% trans %}per{% endtrans %} {{subscription_period}}</p>
<p>
<a class='btn btn-blue' href="{{view_content_access_url}}" clicktracking="off">{% trans %}View Content Access{% endtrans %}</a>
</p>
<a class='btn btn-blue' href="{{contact_user_url}}" clicktracking="off">{% trans %}Contact User{% endtrans %}</a>

{% snippet 'footer_redesign' %}
\`\`\`

## Plain Text Content

\`\`\`liquid
(empty)
\`\`\`

## Sample Data

\`\`\`json
{
  "admin_name": "Admin User",
  "admin_email": "admin@example.com",
  "user_name": "John Doe",
  "user_email": "john@example.com",
  "user_profile_url": "https://hylo.com/u/john-doe",
  "offering_name": "Premium Membership",
  "group_name": "My Community",
  "group_url": "https://hylo.com/groups/my-community",
  "cancelled_at": "January 2, 2026",
  "access_ends_at": "January 15, 2026",
  "cancellation_type": "at_period_end",
  "reason": "User requested",
  "subscription_amount": "$19.99",
  "subscription_period": "monthly",
  "revenue_lost": "$19.99",
  "view_content_access_url": "https://hylo.com/groups/my-community/settings/paid-content/access",
  "contact_user_url": "https://hylo.com/u/john-doe/message"
}
\`\`\`

---
