# Subscription Cancelled_i18n

**Template ID**: `tem_CBJVWhG6d9GfFpM9TbGSb6Pc`  
**Version ID**: `ver_GYXtmFg9vGrQT47Xp8R3yDDB`  
**Version Name**: New Version  
**Locale**: en-US  
**Downloaded**: 2026-01-29T01:25:46.708Z

## Subject

\`\`\`liquid
{% trans %}Your {{offering_name}} subscription has been cancelled{% endtrans %}
\`\`\`

## Preheader

\`\`\`liquid
(empty)
\`\`\`

## HTML Content

\`\`\`liquid
{% snippet 'header_redesign' %}

<p>{% trans %}Hi {{user_name}},{% endtrans %}</p>

<p>{% trans %}Your subscription to{% endtrans %} <strong>{{offering_name}}</strong> {% trans %}for{% endtrans %} {{group_name}} {% trans %}has been cancelled.{% endtrans %}</p>

<p><strong>{% trans %}Cancelled:{% endtrans %}</strong> {{cancelled_at}}</p>

{% if access_ends_at %}
  <p>{% trans %}Your access will continue until{% endtrans %} <strong>{{access_ends_at}}</strong> {% trans %}(end of your current billing period).{% endtrans %}</p>
{% else %}
  <p>{% trans %}Your access has ended immediately.{% endtrans %}</p>
{% endif %}

{% if reason %}
  <p><strong>{% trans %}Reason:{% endtrans %}</strong> {{reason}}</p>
{% endif %}

<p>{% trans %}We're sorry to see you go! If you change your mind, you can resubscribe at any time.{% endtrans %}</p>

<a class='btn btn-blue' href="{{resubscribe_url}}" clicktracking="off">{% trans %}Resubscribe{% endtrans %}</a>

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
  "cancelled_at": "January 2, 2026",
  "access_ends_at": "January 15, 2026",
  "reason": "User requested",
  "resubscribe_url": "https://hylo.com/groups/my-community/about"
}
\`\`\`

---
