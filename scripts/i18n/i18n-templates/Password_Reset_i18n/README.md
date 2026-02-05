# Password Reset_i18n

**Template ID**: `tem_phRPHm3y6RHvRFww6Vc3VBVB`  
**Version ID**: `ver_WFGJqCw4GpSBPSQF9K3BDb4R`  
**Version Name**: New Version  
**Locale**: en-US  
**Downloaded**: 2026-01-29T01:25:41.552Z

## Subject

\`\`\`liquid
{% trans %}Reset your Hylo password{% endtrans %}
\`\`\`

## Preheader

\`\`\`liquid
(empty)
\`\`\`

## HTML Content

\`\`\`liquid
{% snippet 'header_redesign' %}
<p>{% trans %}We’ve received a request to reset your Hylo password. If you did not make this request, you can safely ignore this email.{% endtrans %}</p>

<a class='btn btn-blue' href="{{login_url}}" clicktracking="off">{% trans %}Reset your password{% endtrans %}</a>
<br/>

<p style='font-size: 10px'>{% trans %}If the link above doesnt work you can copy and paste this link into your browser:{% endtrans %} </p>
<a name='dontautlink' style='font-size: 10px; color: black; text-decoration: none; word-wrap: break-word; word-break: break-word;'>{{login_url}}</a>

{% snippet 'footer_redesign' %}
\`\`\`

## Plain Text Content

\`\`\`liquid
(empty)
\`\`\`

## Sample Data

\`\`\`json
{
  "login_url": "http://localhost:3000/noo/login/token?u=7650&t=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2h5bG8uY29tIiwiYXVkIjoiaHR0cHM6Ly9oeWxvLmNvbSIsInN1YiI6Ijc2NTAiLCJleHAiOjE2MzcyOTExMDQsInVzZXJfaWQiOiI3NjUwIiwiZW1haWwiOiJ0aWJldEB0ZXJyYW4uaW8iLCJpYXQiOjE2MzcyNzY3MDR9.UTxqVq176OxtYI5DuO3pGDhBzrYtaFY5AB942r281HE&n=http%3A%2F%2Flocalhost%3A3000%2Fsettings%2Faccount"
}
\`\`\`

---
