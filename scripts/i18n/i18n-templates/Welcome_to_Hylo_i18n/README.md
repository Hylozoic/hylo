# Welcome to Hylo_i18n

**Template ID**: `tem_jkdjbcSVK9cmGvwXbtX9PQbJ`  
**Version ID**: `ver_RthQxKTd397Kq3y4FpKSJQh3`  
**Version Name**: New Version  
**Locale**: en-US  
**Downloaded**: 2026-01-29T01:25:49.455Z

## Subject

\`\`\`liquid
{% if group_name %}
  {% trans %}Welcome to {{group_name}} on Hylo!{% endtrans %}
{% else %}
  {% trans %}Welcome to Hylo – Together, Let's Create a Thriving World{% endtrans %}
{% endif %}
\`\`\`

## Preheader

\`\`\`liquid
(empty)
\`\`\`

## HTML Content

\`\`\`liquid
{% snippet 'header_redesign' %}

<style type='text/css'>
  p {
    font-size: 16px;
  }
</style>

<img src='https://d1ergv6ync1qqr.cloudfront.net/iRHhrkgxQTmSFfuLupQg_welcome-email-header.png' alt='welcome-email-header.png' />

<br/><br/>

<p>{% trans %}Dear {{member_name}},{% endtrans %}</p>

{% if group_name %}
  <p>{% trans %}Warmest greetings and a big welcome to {{group_name}}! {{group_name}} is hosted on Hylo, the home of purpose-driven collaboration!{% endtrans %}</p>
  <p style='margin-bottom: 0px'>{% trans %}Hylo is free, non-profit, open-source, and community-led. It’s a vibrant ecosystem dedicated to the care of our communities and our planet. We're thrilled to have you with us on this journey towards creating a world that works for all!{% endtrans %}</p>
</p>
{% else %}
  <p>{% trans %}Warmest greetings and a big welcome to Hylo, the home of purpose-driven collaboration!{% endtrans %}</p>
  <p style='margin-bottom: 0px'>{% trans %}You're now part of a vibrant ecosystem dedicated to the care of our communities and our planet. We're thrilled to have you with us on this journey towards creating a world that works for all!{% endtrans %}</p>
{% endif %}

{% if group_name %}
  <a href='{{group_url}}'><img src='https://d1ergv6ync1qqr.cloudfront.net/KkIiPahTvmqlR0DONcFA_welcome-email-hi.png' alt='welcome-email-hi.png' /></a>
{% else %}
  <a data-click-track-id="2569" href="https://hylo.com/public/map"><img src='https://d1ergv6ync1qqr.cloudfront.net/t9tNzozGTbeX8tlqQEef_welcome-email-explore.png' alt='welcome-email-explore.png' /></a>
{% endif %}

{% if group_name %}
  <a data-click-track-id="3329" href="https://hylo.com/public/map"><img src='https://d1ergv6ync1qqr.cloudfront.net/t9tNzozGTbeX8tlqQEef_welcome-email-explore.png' alt='welcome-email-explore.png' /></a>
{% else %}
  <img src='https://d1ergv6ync1qqr.cloudfront.net/iZkgPYFBTcuz7mAYne9a_welcome-email-hi-general.png' alt='welcome-email-hi-general.png' />
{% endif %}

{% if group_name %}
<a href='https://hylozoic.gitbook.io/hylo/guides/hylo-admin-guide/onboarding-your-group/setting-up-your-group-s-on-hylo'><img src='https://d1ergv6ync1qqr.cloudfront.net/qlQ2BXmSTOeUQKHVfXeS_welcome-email-activate.png' alt='welcome-email-activate.png' /></a>
{% else %}
<a href='https://hylo.com/groups/building-hylo'><img src='https://d1ergv6ync1qqr.cloudfront.net/UM8wiyVCTjFj7fMNnmQJ_welcome-email-cocreate.png' alt='welcome-email-cocreate.png' /></a>
{% endif %}

{% if group_name %}
<a href='https://hylo.com/groups/building-hylo'><img src='https://d1ergv6ync1qqr.cloudfront.net/UM8wiyVCTjFj7fMNnmQJ_welcome-email-cocreate.png' alt='welcome-email-cocreate.png' /></a>
{% else %}
<a href='https://hylozoic.gitbook.io/hylo/guides/hylo-admin-guide/onboarding-your-group/setting-up-your-group-s-on-hylo'><img src='https://d1ergv6ync1qqr.cloudfront.net/Q6OVU9BzS9OsKnLmmluW_welcome-email-activate-general.png' alt='welcome-email-activate-general.png' /></a>
{% endif %}

{% if group_name %}
  <p>{% trans %}Check out the <a href='https://hylozoic.gitbook.io/hylo/guides/hylo-user-guide'>Hylo Member Guide</a> for tips, and if you need help, click the question mark (?) button in the bottom left of the interface to ask a question. We're here to support you every step of the way.{% endtrans %}</p>
{% else %}
  <p>{% trans %}Hylo is free, non-profit, open-source, and community-led! Check out the <a href='https://hylozoic.gitbook.io/hylo/guides/hylo-user-guide'>Hylo Member Guide</a> for tips, and if you need help, click the question mark (?) button in the bottom left of the interface to ask a question. We're here to support you every step of the way.{% endtrans %}</p>
{% endif %}

<p>{% trans %}Once again, welcome to Hylo. We're honored to walk this path with you.{% endtrans %}</p>

<p>{% trans %}Warm regards,{% endtrans %}</p>

<p>
Clare Politano <br/>
Director of Product
</p>

<p>{% trans %}P.S. Join us for an upcoming <a href='https://www.hylo.com/participate/#gatherings'>Hylo Community Call</a>. It's a great opportunity to meet the stewardship team and fellow members, and learn more about how you can make the most of your Hylo experience.{% endtrans %}</p>

{% snippet 'footer' %}
\`\`\`

## Plain Text Content

\`\`\`liquid
(empty)
\`\`\`

## Sample Data

\`\`\`json
{
  "member_name": "Octavia Butler",
  "group_url": "https://hylo.com"
}
\`\`\`

---
