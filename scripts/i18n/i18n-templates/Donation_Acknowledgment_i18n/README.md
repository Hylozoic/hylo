# Donation Acknowledgment_i18n

**Template ID**: `tem_Jx6XVgQGRC3G4RV3HBrfH8r3`  
**Version ID**: `ver_tSJP84GGtkbW49hYXCvqrfGJ`  
**Version Name**: New Version  
**Locale**: en-US  
**Downloaded**: 2026-01-29T01:25:30.334Z

## Subject

\`\`\`liquid
{% trans %}Thank you for your donation to Hylo{% endtrans %}
\`\`\`

## Preheader

\`\`\`liquid
(empty)
\`\`\`

## HTML Content

\`\`\`liquid
{% snippet 'header_redesign' %}

<p>{% trans %}Hi {{user_name}}{% endtrans %},</p>

<p>{% trans %}Thank you for your generous donation of {% endtrans %}<strong>{{donation_amount}}</strong>{% trans %} to Hylo!{% endtrans %}</p>

<p>{% trans %}Your support helps us continue building tools for social coordination and community building.{% endtrans %}</p>

<p><strong>{% trans %}Donation Date:{% endtrans %}</strong> {{donation_date}}</p>
<p><strong>{% trans %}Donation Type:{% endtrans %}</strong> {{donation_type}}</p>

{% if is_tax_deductible %}
  <div style="background-color: #f0f9ff; padding: 15px; border-left: 4px solid #0284c7; margin: 20px 0;">
    <p><strong>{% trans %}Tax-Deductible Donation{% endtrans %}</strong></p>
    <p>{% trans %}Your donation is tax-deductible in the United States. Hylo is fiscally sponsored by {% endtrans %}{{fiscal_sponsor_name}}{% trans %}, a 501(c)(3) nonprofit organization.{% endtrans %}</p>
    <p>{{tax_receipt_info}}</p>
  </div>
{% endif %}

{% if is_recurring %}
  <p>{% trans %}This is a recurring donation that will automatically repeat {% endtrans %}{{recurring_interval}}{% trans %}.{% endtrans %}</p>
  <p><strong>{% trans %}Next Donation:{% endtrans %}</strong> {{next_donation_date}}</p>
  <a class='btn btn-blue' href="{{manage_donation_url}}" clicktracking="off">{% trans %}Manage Recurring Donation{% endtrans %}</a>
{% endif %}

{% if purchase_context %}
  <p><em>{% trans %}This donation was made as part of your {% endtrans %}{{purchase_context}}{% trans %}.{% endtrans %}</em></p>
{% endif %}

<p>{{impact_message}}</p>

{% snippet 'footer_redesign' %}
\`\`\`

## Plain Text Content

\`\`\`liquid
(empty)
\`\`\`

## Sample Data

\`\`\`json
{
  "currency": "USD",
  "donation_amount": "$5.00",
  "donation_date": "January 2, 2026",
  "donation_type": "one-time",
  "fiscal_sponsor_name": "Fiscal Sponsor Name",
  "group_name": "My Community",
  "impact_message": "Your donation helps support the Hylo platform and our mission to enable better coordination and collaboration in communities worldwide.",
  "is_recurring": false,
  "is_tax_deductible": true,
  "purchase_context": "Premium Membership purchase",
  "tax_receipt_info": "A tax receipt will be issued by our fiscal sponsor for your records.",
  "user_email": "john@example.com",
  "user_name": "John Doe"
}
\`\`\`

---
