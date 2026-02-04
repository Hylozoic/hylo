# API User Create - Finish Registration_i18n

**Template ID**: `tem_fqGSrDrSK6WpjTBFXSfY79k4`  
**Version ID**: `ver_9Fk3HxbWCvbHtSTgTM3H77mC`  
**Version Name**: New Version  
**Locale**: es-ES  
**Downloaded**: 2026-01-29T01:25:28.902Z

## Subject

\`\`\`liquid
{% trans %}Welcome to Hylo!{% endtrans %}
\`\`\`

## Preheader

\`\`\`liquid
(empty)
\`\`\`

## HTML Content

\`\`\`liquid
{% snippet 'header_redesign' %}

<p class="lead">
  {% trans %}You've been invited to join{% endtrans %} <a class='group-pill' href="{{group_url}}" clicktracking="off"><img src='{{group_avatar_url}}' /> {{group_name|default(api_client)}}</a> {% trans %}on Hylo!{% endtrans %}
</p> 
 
<div class='card'>
  {% trans %}Welcome to Hylo, the community platform for purpose driven groups.{% endtrans %} {{group_name|default(api_client)}} {% trans %}is using Hylo for their community.{% endtrans %}
</div>   

<a class='btn btn-blue' href='{{verify_url}}'>{% trans %}Complete your registration{% endtrans %}</a> 

{% snippet 'footer_redesign' %}
\`\`\`

## Plain Text Content

\`\`\`liquid
(empty)
\`\`\`

## Sample Data

\`\`\`json
{
  "api_client": "OpenTEAM",
  "group_avatar_url": "https://d3ngex8q79bk55.cloudfront.net/community/1/avatar/devAvatar.png",
  "group_name": "Black Farmer's Rising",
  "group_url": "http://hylo.com/groups/bfr",
  "verify_url": "https://hylo.com"
}
\`\`\`

---
