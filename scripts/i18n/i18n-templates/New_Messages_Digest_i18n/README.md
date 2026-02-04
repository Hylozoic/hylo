# New Messages Digest_i18n

**Template ID**: `tem_y8HpjwxFSxC9jRqwfVpPxY8d`  
**Version ID**: `ver_fQPG4cygr3XDtpYMrF6STmq3`  
**Version Name**: New Version  
**Locale**: en-US  
**Downloaded**: 2026-01-29T01:25:41.075Z

## Subject

\`\`\`liquid
{% trans %}New messages from {{participant_names}}{% endtrans %}
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

<p>{% trans %}{{count}} new direct message{% endtrans %}{% if count > 1 %}{% trans %}s{% endtrans %}{% endif %} {#on {{date}}#}</p>

<div class='card'>
  <div style='border-bottom: 1px solid gray; padding-bottom: 10px; margin-bottom: 10px;'>
    <img src='{{participant_avatars}}' class='avatar' style='vertical-align: middle;' />
    <span style='vertical-align: middle; margin-left: 5px;'>{{participant_names}}</span>
  </div> 
  
  {% for message in messages %}
    {% call avatar_box('comment', message.avatar_url) %}
      <p>
        <span style='font-weight: bold;'>{{message.name}}</span>
        {# <span style='color: gray; font-size: 11px; float: right;'>{{message.timestamp}}</span> #}
        <br style='clear: right;'/>
        {% if message.text|length > 0 %}<span>{{message.text}}</span>{% endif %}
        {% if message.image %}
          <br />
          <a clicktracking="off" data-click-track-id="4420" href="{{comment.image.url}}" target="_blank">
            <img src="{{message.image.thumbnail_url}}">
          </a>
        {% endif %}
      </p>
    {% endcall %}
  {% endfor %}
</div>

<p class='center'>{% trans %}Reply to this email to respond or{% endtrans %}</p>
  
<a class='btn btn-blue' href='{{thread_url}}'>{% trans %}Join the conversation on Hylo{% endtrans %}</a>

{% snippet "footer_redesign" %}
\`\`\`

## Plain Text Content

\`\`\`liquid
(empty)
\`\`\`

## Sample Data

\`\`\`json
{
  "count": 8,
  "date": "Mon, March 10",
  "messages": [
    {
      "avatar_url": "https://hylo-dev.s3.amazonaws.com/dev-evo-uploads/user/24917/userAvatar/24917/face-beautiful-young-girl-clean-260nw-328676489.jpg",
      "image": null,
      "name": "Shauna Benz",
      "text": "Hey Steven! I live right next to there and can come help out. I've never done petitioning, but I'm open to learn.",
      "timestamp": "1:23pm"
    },
    {
      "avatar_url": "https://hylo-dev.s3.amazonaws.com/dev-evo-uploads/user/24917/userAvatar/24917/face-beautiful-young-girl-clean-260nw-328676489.jpg",
      "image": {
        "thumbnail_url": "http://hylo-dev.s3.amazonaws.com/user/22317/post/20335/1485904427502_5475199813_114f842f0d_o-resized128x128.jpg",
        "url": "http://hylo-dev.s3.amazonaws.com/user/22317/post/20335/1485904427502_5475199813_114f842f0d_o.jpg"
      },
      "name": "Squiggly Berry",
      "text": "Hey Steven! I live right next to there and can come help out. I've never done petitioning, but I'm open to learn. Hey Steven! I live right next to there and can come help out. I've never done petitioning, but I'm open to learn",
      "timestamp": "1:23pm"
    },
    {
      "avatar_url": "https://hylo-dev.s3.amazonaws.com/dev-evo-uploads/user/24917/userAvatar/24917/face-beautiful-young-girl-clean-260nw-328676489.jpg",
      "name": "Tim Garret",
      "text": "wheee",
      "timestamp": "1:24pm"
    },
    {
      "avatar_url": "https://hylo-dev.s3.amazonaws.com/dev-evo-uploads/user/24917/userAvatar/24917/face-beautiful-young-girl-clean-260nw-328676489.jpg",
      "image": {
        "thumbnail_url": "http://hylo-dev.s3.amazonaws.com/user/22317/post/20335/1485904427502_5475199813_114f842f0d_o-resized128x128.jpg",
        "url": "http://hylo-dev.s3.amazonaws.com/user/22317/post/20335/1485904427502_5475199813_114f842f0d_o.jpg"
      },
      "name": "Tim Garret",
      "timestamp": "1:25pm"
    }
  ],
  "participant_avatars": "https://hylo-dev.s3.amazonaws.com/dev-evo-uploads/user/25566/userAvatar/25566/pexels-photo-614810.jpg",
  "participant_names": "Squanto Berry, Shauna Benz & Tim Garret",
  "thread_url": "https://www.hylo.com/t/20675"
}
\`\`\`

---
