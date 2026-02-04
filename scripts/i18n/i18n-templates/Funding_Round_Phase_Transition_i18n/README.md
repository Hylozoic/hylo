# Funding Round Phase Transition_i18n

**Template ID**: `tem_RpRYTwYhTpRmy3Y6tcrCGMwB`  
**Version ID**: `ver_qXFTJwTvHKMQd7kxMdCqKWkW`  
**Version Name**: New Version  
**Locale**: en-US  
**Downloaded**: 2026-01-29T01:25:34.131Z

## Subject

\`\`\`liquid
{% trans %}{{funding_round_title}}: {{transition_text}}{% endtrans %}
\`\`\`

## Preheader

\`\`\`liquid
(empty)
\`\`\`

## HTML Content

\`\`\`liquid
{% snippet 'header_redesign' %}
<h3>{% trans %}{{transition_text}} in Funding Round {% endtrans %}<a href='{% trans %}{{funding_round_url}}{% endtrans %}'>{{funding_round_title}}</a></h3>

<a class='btn btn-blue' href="{% trans %}{{action_url}}{% endtrans %}">{% trans %}{{button_text}}{% endtrans %}</a>

{% snippet 'footer_redesign' %}
\`\`\`

## Plain Text Content

\`\`\`liquid
(empty)
\`\`\`

## Sample Data

\`\`\`json
{
  "action_url": "https://hylo.com/group/hello/funding-rounds/1/submissions",
  "button_text": "Vote in the Round",
  "funding_round_title": "Float #1",
  "funding_round_url": "https://hylo.com",
  "transition_text": "Voting has started"
}
\`\`\`

---
