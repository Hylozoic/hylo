# New Chats in Chat Room Digest_i18n

**Template ID**: `tem_XjjSPdy6ykMpwq4JGpchmFk6`  
**Version ID**: `ver_SQ3h38QJTmpB4mSVgSJhYdSS`  
**Version Name**: New Version  
**Locale**: en-US  
**Downloaded**: 2026-01-29T01:25:40.146Z

## Subject

\`\`\`liquid
{% trans %}New chats in {{group_name}} #{{chat_topic}}{% endtrans %}
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

<p>{% trans %}{{count}} new chat{% endtrans %}{% if count > 1 %}s{% endif %} {% trans %}in {{actor_pill(group_name + ' #' + chat_topic, group_avatar_url, chat_room_url)}} {# on {{date}} #}{% endtrans %}</p>

<div class='card'>
{% for post in posts %}
  {% call avatar_box('comment', post.creator_avatar_url) %}
    <p>
      <span style='font-weight: bold;'>{{post.creator_name}}</span>
      {# <span style='color: gray; font-size: 11px; float: right;'>{{post.timestamp}}</span> #}
      <br style='clear: right;'/>
      <span>{{post.content}}</span>
      {% for image in post.images %}
        <br/>
        <a clicktracking="off" data-click-track-id="4420" href="{{image.url}}" target="_blank">
          <img src="{{image.thumbnail_url}}">
        </a>
      {% endfor %}
    </p>
  {% endcall %}
{% endfor %}
</div>

    <a class='btn btn-blue' href='{{chat_room_url}}'>{% trans %}Join the conversation or change your notifications{% endtrans %}</a>

{% snippet "footer_redesign" %}
\`\`\`

## Plain Text Content

\`\`\`liquid
(empty)
\`\`\`

## Sample Data

\`\`\`json
{
  "chat_room_url": "https://hylo.com/groups/building-hylo/chat/home",
  "chat_topic": "home",
  "count": 3,
  "date": "Mon, March 3",
  "group_avatar_url": "https://d3ngex8q79bk55.cloudfront.net/community/1/avatar/devAvatar.png",
  "group_name": "Building Hylo",
  "posts": [
    {
      "announcement": false,
      "content": "hello",
      "creator_avatar_url": "https://hylo-dev.s3.amazonaws.com/dev-evo-uploads/user/25566/userAvatar/25566/pexels-photo-614810.jpg",
      "creator_name": "A dude",
      "images": [
        {
          "thumbnail_url": "http://hylo-dev.s3.amazonaws.com/user/22317/post/20335/1485904427502_5475199813_114f842f0d_o-resized128x128.jpg",
          "url": "http://hylo-dev.s3.amazonaws.com/user/22317/post/20335/1485904427502_5475199813_114f842f0d_o.jpg"
        }
      ],
      "post_url": "https://hylo.com/groups/building-hylo/chat/home?postId=1111",
      "timestamp": "12:34pm"
    },
    {
      "announcement": false,
      "content": "hello",
      "creator_avatar_url": "https://hylo-dev.s3.amazonaws.com/dev-evo-uploads/user/24917/userAvatar/24917/face-beautiful-young-girl-clean-260nw-328676489.jpg",
      "creator_name": "Starhawk",
      "images": [],
      "post_url": "https://hylo.com/groups/building-hylo/chat/home?postId=1111",
      "timestamp": "12:35pm"
    }
  ]
}
\`\`\`

---
