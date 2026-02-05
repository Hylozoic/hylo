# New Comments Digest_i18n

**Template ID**: `tem_Kyq6CbvMmbdjcf7KvpJJFpmX`  
**Version ID**: `ver_WcFdM7kxqqkjPBWcmmpwRQH8`  
**Version Name**: New Version  
**Locale**: en-US  
**Downloaded**: 2026-01-29T01:25:40.614Z

## Subject

\`\`\`liquid
{% trans %}{{subject_prefix}} "{{post_title}}"{% endtrans %}
\`\`\`

## Preheader

\`\`\`liquid
(empty)
\`\`\`

## HTML Content

\`\`\`liquid
{% snippet "header_redesign" %}
{% snippet "macro: avatar_box" %}
{% snippet "macro: actor_pill" %}

<p>{% trans %}{{count}} new comment{% if count > 1 %}s{% endif %} on{% endtrans %} <a href='{% trans %}{{thread_url}}{% endtrans %}'>{{post_title}}</a> {% trans %}on {{date}}{% endtrans %}</p>

<div class='card'>
  <div style='border-bottom: 1px solid gray; padding-bottom: 10px; margin-bottom: 10px;'>
    <img src='{% trans %}{{post_creator_avatar_url}}{% endtrans %}' class='avatar' style='vertical-align: middle;'/>
    <span style='vertical-align: middle;'>{% trans %}{{post_title}}{% endtrans %}</span>
  </div> 
  
  {% for comment in comments %}
    {% call avatar_box('comment', comment.avatar_url) %}
      <p>
        <span style='font-weight: bold;'>{% trans %}{{comment.name}}{% endtrans %}</span>
        <span style='color: gray; font-size: 11px; float: right;'>{% trans %}{{comment.timestamp}}{% endtrans %}</span>
        <br style='clear: right;'/>
        {% if comment.text|length > 0 %}<span>{% trans %}{{comment.text}}{% endtrans %}</span>{% endif %}
        {% if comment.image %}
          <br />
          <a clicktracking="off" data-click-track-id="4420" href='{% trans %}{{comment.image.url}}{% endtrans %}' target="_blank">
            <img src='{% trans %}{{comment.image.thumbnail_url}}{% endtrans %}'>
          </a>
        {% endif %}
      </p>
    {% endcall %}
  {% endfor %}
</div>

<p class='center'>{% trans %}Reply to this email to comment or{% endtrans %}</p>
  
<a class='btn btn-blue' href='{% trans %}{{thread_url}}{% endtrans %}'>{% trans %}Join the conversation on Hylo{% endtrans %}</a>

{% snippet "footer_redesign" %}
\`\`\`

## Plain Text Content

\`\`\`liquid
(empty)
\`\`\`

## Sample Data

\`\`\`json
{
  "comments": [
    {
      "avatar_url": "https://hylo-dev.s3.amazonaws.com/dev-evo-uploads/user/24917/userAvatar/24917/face-beautiful-young-girl-clean-260nw-328676489.jpg",
      "name": "Shauna Benz",
      "text": "Hey Steven! I live right next to there and can come help out. I've never done petitioning, but I'm open to learn.",
      "timestamp": "1:12pm"
    },
    {
      "avatar_url": "https://hylo-dev.s3.amazonaws.com/dev-evo-uploads/user/24917/userAvatar/24917/face-beautiful-young-girl-clean-260nw-328676489.jpg",
      "name": "Squiggly Berry",
      "text": "wheee",
      "timestamp": "1:12pm"
    },
    {
      "avatar_url": "https://hylo-dev.s3.amazonaws.com/dev-evo-uploads/user/24917/userAvatar/24917/face-beautiful-young-girl-clean-260nw-328676489.jpg",
      "name": "Tim Garret",
      "text": "Hey Steven! I live right next to there and can come help out. I've never done petitioning, but I'm open to learn. Hey Steven! I live right next to there and can come help out. I've never done petitioning, but I'm open to learn",
      "timestamp": "1:13pm"
    },
    {
      "avatar_url": "https://hylo-dev.s3.amazonaws.com/dev-evo-uploads/user/24917/userAvatar/24917/face-beautiful-young-girl-clean-260nw-328676489.jpg",
      "image": {
        "thumbnail_url": "http://hylo-dev.s3.amazonaws.com/user/22317/post/20335/1485904427502_5475199813_114f842f0d_o-resized128x128.jpg",
        "url": "http://hylo-dev.s3.amazonaws.com/user/22317/post/20335/1485904427502_5475199813_114f842f0d_o.jpg"
      },
      "name": "Tim Garret",
      "text": "Check this one out",
      "timestamp": "1:14pm"
    }
  ],
  "count": 8,
  "date": "March 3, 2025",
  "post_creator_avatar_url": "https://hylo-dev.s3.amazonaws.com/dev-evo-uploads/user/25566/userAvatar/25566/pexels-photo-614810.jpg",
  "post_title": "Anyone have a cat?",
  "subject_prefix": "New comments on",
  "thread_url": "https://www.hylo.com/t/20675"
}
\`\`\`

---
