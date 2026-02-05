# Digest for Saved Searches_i18n

**Template ID**: `tem_yfgPbhVHbRHYpy6Dc3hgKjcX`  
**Version ID**: `ver_pQrqSX4tJYHrjTtmGmpSJ6M8`  
**Version Name**: New Version  
**Locale**: en-US  
**Downloaded**: 2026-01-29T01:25:29.837Z

## Subject

\`\`\`liquid
{% if no_new_activity %}
{% trans %}No new search results{% endtrans %}
{% else %}
{{subject}}
{% endif %}
\`\`\`

## Preheader

\`\`\`liquid
(empty)
\`\`\`

## HTML Content

\`\`\`liquid
{% snippet 'header_redesign' %}

{% macro avatar_box(class, avatar_url) -%}
  <table class='{{class}}'>
    <tbody>
      <tr>
        <td class='avatar-cell'>
          <img class='avatar' src='{{avatar_url}}' />
        </td>
        <td class='content-cell'>
          {{ caller() }}
        </td>
      </tr>
    </tbody>
  </table>
{%- endmacro %} 

{% macro jump_to_sub_section(name, post_list) %}
  {% if post_list|length > 0 %}
    <a href='#{{name}}'>{% trans %}{{name}}{% endtrans %}</a> - 
  {% endif %} 
{% endmacro %} 

{% macro posts_section(name, posts) %}
  {% if posts|length > 0 %} 
    <div id='{{name}}' class='section'>
      <h3 class='section-title'>{% trans %}New {{name}}{% endtrans %}</h3>
      {% for post in posts %}{{ post_item(post) }}{% endfor %}
    </div>
  {% endif %}
{% endmacro %} 

{% macro post_item(post) -%}
  <div class='card post'> 
    <div class='post-header'> 
      <img class='avatar' style='vertical-align: middle;' src='{{post.user.avatar_url}}' />
      <span class='post-author'>{{post.user.name}}</span>
      <span style='float: right;'>
        <a class='btn btn-black' href={{post.url}}>
          {% if post.type == 'event' %}
            {% trans %}RSVP{% endtrans %}
          {% elsif post.type == 'project' %}
            {% trans %}Join{% endtrans %}
          {% elsif post.type == 'proposal' %}
            {% trans %}Vote{% endtrans %}
          {% else %}
            {% trans %}Reply{% endtrans %}
          {% endif %}
        </a>
      </span>
    </div>
    
    <table class='post-title-container'><tbody>
      <tr> 
        {% if post.type == 'event' %}
          <td class='calendar-icon-container'> 
            <div class='calendar-icon'>
              <div class='calendar-month'>{{post.month}}</div>
              <div class='calendar-day'>{{post.day}}</div>
            </div>
          </td>
        {% endif %}
        <td>
          {% if post.when %}<div class='post-when'>{{post.when}}</div>{% endif %}
          <h1 class='post-title'>{{post.title}}</h1>
          {% if post.location %}<div class='post-location'>{{post.location}}</div>{% endif %}
        </td>
      </tr>
    </tbody></table> 
    
    <div class='details'>{{post.details|safe}}</div>
    
    {% if post.link_preview %} 
    <a class="link-preview" data-click-track-id="4762" href="{{post.link_preview.url}}">
      {% if post.link_preview.image_url %}
        <img src="{{post.link_preview.image_url}}" />
      {% endif %}
      <div class="title">{% trans %}{{post.link_preview.title}}{% endtrans %}</div>
      <div class="description">{% trans %}{{post.link_preview.description|truncate(140) if post.link_preview.description}}{% endtrans %}</div>
      <div class="clearfix"></div>
    </a>
    {% endif %}
  </div> 
{%- endmacro %}

<div class='section'>
  <table class='header'>
    <tr>
      <td>
        <a href='{{group_url}}'><img class='avatar' src='{{group_avatar_url}}'></a>
      </td>
      <td>
        <h2 class='group-name' ><a href='{{group_url}}'>{{group_name}}</a></h2>
      </td> 
    </tr>
  </table>

{% if num_sections > 1 %}
  <div class='internal-menu'>
    <strong>{% trans %}Jump to section:{% endtrans %} </h3>
    {{jump_to_sub_section('Discussions', discussions)}}
    {{jump_to_sub_section('Events', events)}}
    {{jump_to_sub_section('Offers', offers)}}
    {{jump_to_sub_section('Requests', requests)}}
    {{jump_to_sub_section('Resources', resources)}}
    {{jump_to_sub_section('Projects', projects)}}
    {{jump_to_sub_section('Proposals', projects)}}
  </div>
{% endif %}

</div> 

{% if postsWithNewComments|length > 0 or topicsWithChats|length > 0 %}
<div class='section'>
  <h3 class='section-title'>{% trans %}Active Conversations{% endtrans %}</h3>
  <div class='card'>
    {% for topic in topicsWithChats %}
      <div class='post-headline'>
        {% trans %}{{topic.num_new_chats}} new chat{% endtrans %}{% if topic.num_new_chats > 1 -%}s{% endif %} {% trans %}in{% endtrans %} 
        <a class='title' href='{{topic.url}}'>#{{topic.name}}</a>
      </div>
    {% endfor %}
  
    {% for post in postsWithNewComments %}
      <div class='post-headline'>
        <span class='name'>{% trans %}{{post.comment_count}} new comment{% endtrans %}{% if post.comment_count > 1 -%}s{% endif %} {% trans %}in{% endtrans %}</span>
        <a href='{{post.url}}' class='title'>{{post.title}}</a>  
      </div>
    {% endfor %}
  </div>
</div> 
{% endif %}

{{posts_section('Discussions', discussions)}}  
{{posts_section('Events', events)}}
{{posts_section('Offers', offers)}}
{{posts_section('Requests', requests)}}
{{posts_section('Resources', resources)}}
{{posts_section('Projects', projects)}}
{{posts_section('Proposals', proposals)}}

{% snippet 'footer_redesign' %}
\`\`\`

## Plain Text Content

\`\`\`liquid
```jinja
{% macro avatar_box(class, avatar_url) -%}
{{ caller() }}
{%- endmacro %} {% macro post_anchor(post) -%}post{{post.id}}{% endmacro -%} {% macro post_item(post) -%} {% call avatar_box('post sub-section', post.user.avatar_url) %}
{% trans %}{{post.title}}{% endtrans %}

{% trans %}Created by: {{post.user.name}}{% endtrans %}

{% trans %}{{post.details}}{% endtrans %}
{% if post.requests|length > 0 %}
{% trans %}Requests:{% endtrans %}

{% for request in post.requests %}
{% trans %}{{request}}{% endtrans %}
{% endfor %}
{% endif %} {% if post.when or post.location %}
{% if post.when %}
{% trans %}When: {{post.when}}{% endtrans %}
{% endif %} {% if post.location %}
{% trans %}Where: {{post.location}}{% endtrans %}
{% endif %}
{% endif %} {% if post.link_preview %} {% if post.link_preview.image_url %}{% endif %}
{% trans %}{{post.link_preview.title}}{% endtrans %}

{% trans %}{{post.link_preview.description|truncate(140) if post.link_preview.description}}{% endtrans %}

{% trans %}[ {{post.link_preview.url}} ]{% endtrans %} {% endif %} {% trans %}View and Respond on Hylo [ {{post.url}} ]{% endtrans %} {% endcall %} {%- endmacro %} {% macro generic_headline(name, title, href='') -%}
{% trans %}{{name}} {% endtrans %}{% trans %}{{title}}{% endtrans %} {% trans %}[ {{href}} ]{% endtrans %}
{% endmacro %} {% macro post_headline(post) -%} {% trans %}{{ generic_headline(post.user.name ~ ':', post.title, '#' ~ post_anchor(post)) }}{% endtrans %} {% endmacro %} {% macro comment_count(n) -%} {% trans %}{{n}} new comment{% if n > 1 -%}s{% endif %} {% endtrans %}{% trans %}in Hylo{% endtrans %} {% endmacro%} {% macro new_activity_headline(activity) -%} {% trans %}{{ generic_headline(activity.title, comment_count(activity.comment_count), activity.url) }}{% endtrans %} {% endmacro %} {% macro headline_sub_section(name, post_list, divider=true) %} {% if post_list|length > 0 %}

{% trans %}{{name}}{% endtrans %}
{% for post in post_list %}{% trans %}{{ post_headline(post) }}{% endtrans %}{% endfor %}
{% endif %} {% endmacro %}
{% trans %}View this email in a browser [ {{swu.webview_url}} ]{% endtrans %}

{% trans %}{{search.name}}{% endtrans %}
{% if no_new_activity %}{% else %}
{% trans %}Hey, {{recipient.name.split(' ')|first}}! Here are some new results for your saved search.{% endtrans %}
{% endif %}
{% if requests|length > 0 or offers|length > 0 or resources|length > 0 or discussions|length > 0 or events|length > 0 or projects|length > 0 %}

{% trans %}Summary of new posts {{time_period}}{% endtrans %}
{% trans %}{{headline_sub_section('Requests', requests)}}{% endtrans %} {% trans %}{{headline_sub_section('Offers', offers)}}{% endtrans %} {% trans %}{{headline_sub_section('Resources', resources)}}{% endtrans %} {% trans %}{{headline_sub_section('Discussions', discussions, false)}}{% endtrans %} {% trans %}{{headline_sub_section('Events', events)}}{% endtrans %} {% trans %}{{headline_sub_section('Projects', projects, false)}}{% endtrans %}
{% endif %} {% if requests|length > 0 %}

{% trans %}New Requests{% endtrans %}
{% for post in requests %}{% trans %}{{ post_item(post) }}{% endtrans %}{% endfor %}
{% endif %} {% if offers|length > 0%}

{% trans %}New Offers{% endtrans %}
{% for post in offers %}{% trans %}{{ post_item(post) }}{% endtrans %}{% endfor %}
{% endif %} {% if resources|length > 0%}

{% trans %}New Resources{% endtrans %}
{% for post in resources %}{% trans %}{{ post_item(post) }}{% endtrans %}{% endfor %}
{% endif %} {% if discussions|length > 0%}

{% trans %}New Discussions{% endtrans %}
{% for post in discussion %}{% trans %}{{ post_item(post) }}{% endtrans %}{% endfor %}
{% endif %} {% if projects|length %}

{% trans %}New Projects{% endtrans %}
{% for project in projects %}{% trans %}{{ post_item(project) }}{% endtrans %}{% endfor %}
{% endif %} {% if events|length > 0 %}

{% trans %}New Events{% endtrans %}
{% for event in events %}{% trans %}{{ post_item(event) }}{% endtrans %}{% endfor %}
{% endif %}
{% trans %}Email us at hello@hylo.com [ mailto:hello@hylo.com ] if you have questions or comments for the Hylo team.{% endtrans %}

{% trans %}Click here [ {{email_settings_url}} ] to unsubscribe or change your email settings.{% endtrans %}
```
\`\`\`

## Sample Data

\`\`\`json
{
  "discussions": [
    {
      "details": "<h1>header 1</h1><h2>header 2</h2><h3>header 3</h3><p><strong>Bold</strong></p><p><em>Italic</em></p><p><s>sdfsf</s></p><p><code>sdfsfsfsf</code></p><blockquote><p>sdfsfsdfsf</p></blockquote><ul><li><p>sdf</p></li><li><p>sdf</p></li></ul><p></p><ol><li><p>sdfsf</p></li><li><p>sdfsfsf</p></li></ol><pre><code>sdfsf sdfsf</code></pre>",
      "id": 5,
      "title": "Hylo: bug reports, feature requests, and general",
      "type": "discussion",
      "user": {
        "avatar_url": "http://www.picgifs.com/avatars/animals/parrot/avatars-parrot-925060.jpg",
        "name": "Squawky McSquawkface"
      }
    },
    {
      "details": "<p><a href=\"/u/21\" data-user-id=\"21\">Edward West</a> <a href=\"/u/16325\" data-user-id=\"16325\">Julia Pope</a> <a>#woo</a></p>",
      "id": 6,
      "title": "Could you please post the recipe for your magic supplements?",
      "type": "discussion",
      "user": {
        "avatar_url": "https://d3ngex8q79bk55.cloudfront.net/user/11204/avatar/fGvpYNkTXeE9rg0aZg3L_Screen_Shot_2015-02-04_at_2.53.53_PM.png",
        "name": "Robbie Carlton"
      }
    }
  ],
  "email_settings_url": "http://localhost:3000/settings?expand=account",
  "ending": [
    {
      "details": "<p>Come dance among the garden gnomes!</p>",
      "id": 3,
      "title": "The winter cultivator",
      "type": "event",
      "user": {
        "avatar_url": "http://www.picgifs.com/avatars/animals/parrot/avatars-parrot-925060.jpg",
        "name": "Squawky McSquawkface"
      },
      "when": "Mon, March 15, 1pm - 10pm "
    },
    {
      "details": "<p>I got so many tools. Take all of them! Please!</p>",
      "id": 3,
      "title": "Sweet cheese",
      "type": "offer",
      "user": {
        "avatar_url": "http://www.picgifs.com/avatars/animals/parrot/avatars-parrot-925060.jpg",
        "name": "Squawky McSquawkface"
      },
      "when": "Mon, Oct 10, 2pm - Oct 12, 5pm"
    },
    {
      "details": "<p>I got so many tools. Take all of them! Please!</p>",
      "id": 3,
      "title": "Fixing democracy",
      "type": "project",
      "user": {
        "avatar_url": "http://www.picgifs.com/avatars/animals/parrot/avatars-parrot-925060.jpg",
        "name": "Squawky McSquawkface"
      },
      "when": "Mon, Oct 10, 4pm - 8pm "
    },
    {
      "details": "<p>I got so many tools. Take all of them! Please!</p>",
      "id": 3,
      "title": "Which pizza spot?",
      "type": "proposal",
      "user": {
        "avatar_url": "http://www.picgifs.com/avatars/animals/parrot/avatars-parrot-925060.jpg",
        "name": "Squawky McSquawkface"
      },
      "when": "Mon, Oct 10, 4pm - 8pm "
    },
    {
      "details": "<p>I got so many tools. Take all of them! Please!</p>",
      "id": 3,
      "title": "A tutor for empathy",
      "type": "request",
      "user": {
        "avatar_url": "http://www.picgifs.com/avatars/animals/parrot/avatars-parrot-925060.jpg",
        "name": "Squawky McSquawkface"
      },
      "when": "Mon, Oct 10, 4pm - 8pm "
    },
    {
      "details": "<p>I got so many tools. Take all of them! Please!</p>",
      "id": 3,
      "title": "A bunch of stuff",
      "type": "resource",
      "user": {
        "avatar_url": "http://www.picgifs.com/avatars/animals/parrot/avatars-parrot-925060.jpg",
        "name": "Squawky McSquawkface"
      },
      "when": "Mon, Oct 10, 4pm - 8pm "
    }
  ],
  "events": [
    {
      "day": "30",
      "details": "<p>Let's get together to celebrate Hawaiian style! Meet some new friends, get together with old friends</p>",
      "id": 1,
      "image": "http://hylo-dev.s3.amazonaws.com/user/11204/seeds/1472250189300_maxresdefault.jpg",
      "location": "Tiki Haven SF",
      "month": "Jan",
      "title": "Lu'au for British Expats",
      "type": "event",
      "user": {
        "avatar_url": "http://rs795.pbsrc.com/albums/yy236/terminatoraf/Funny/mrbeabn.jpg~c200",
        "name": "Shana Trevanna"
      },
      "when": "October 10, 2018"
    }
  ],
  "form_action_url": "http://localhost:3000/noo/hook/postForm",
  "group_avatar_url": "https://d3ngex8q79bk55.cloudfront.net/community/1/avatar/devAvatar.png",
  "group_name": "Collaborative Technology Alliance",
  "group_url": "http://localhost:3000/g/sandbox",
  "num_sections": 4,
  "offers": [
    {
      "details": "<p>There they are, all standing in a row. Big ones, small ones, some as big as your head</p>",
      "id": 3,
      "link_preview": {
        "description": "I do not own any rights to this movie or Disney. I own nothing.",
        "image_url": "http://img.youtube.com/vi/fBBBxQHxqmg/hqdefault.jpg",
        "image_width": 480,
        "title": "The Lion King Coconut Song",
        "url": "https://www.youtube.com/watch?v=fBBBxQHxqmg"
      },
      "title": "I've got a lovely bunch of coconuts",
      "type": "offer",
      "user": {
        "avatar_url": "http://www.picgifs.com/avatars/animals/parrot/avatars-parrot-925060.jpg",
        "name": "Squawky McSquawkface"
      }
    },
    {
      "details": "<p>I implemented a crash analytics and I will be able to see all crashes on a dashboard online (if there will be any) and I could fix all the bugs faster that way.</p>",
      "id": 4,
      "title": "I'd like to install Hylo iOS app on all iPhones we have in our team to beta test the features.",
      "type": "offer",
      "user": {
        "avatar_url": "http://graph.facebook.com/10156248948240099/picture?type=large",
        "name": "Damian Madray"
      }
    }
  ],
  "postsWithNewComments": [
    {
      "comment_count": "3",
      "title": "Where is the bathroom?"
    },
    {
      "comment_count": "2",
      "title": "I'm trying to figure out how to eat without chewing."
    }
  ],
  "projects": [
    {
      "details": "<p>There is a big wall. We want to get together and take it down. It's going to take a lot of help from all of us. There are a lot of ways we can...</p>",
      "id": 1,
      "image": "http://hylo-dev.s3.amazonaws.com/user/11204/seeds/1472250189300_maxresdefault.jpg",
      "title": "It's time to take down that wall.",
      "type": "project",
      "user": {
        "avatar_url": "http://rs795.pbsrc.com/albums/yy236/terminatoraf/Funny/mrbeabn.jpg~c200",
        "name": "Cynthia Hellen"
      }
    }
  ],
  "recipient": {
    "avatar_url": "https://d3ngex8q79bk55.cloudfront.net/user/42/avatar/1463689351761_10209542281777297.jpg",
    "name": "Lawrence Wang"
  },
  "requests": [
    {
      "details": "<p>The U.Lab participants at Impact Hub MSP recently got together to try and distill down some of the complex components and definitions in theory U into a bite size one(ish) page document. They're happy to invite others to contribute if you would like or use as a reference if you find it useful. </p><p>Access it using the link below or let me know if you have trouble getting access. </p><p>https://docs.google.com/document/d/1wQy_jVMXeXFHmPk4nhX5TRSp5hEL-_gbMPQnJZUxBTU/edit?usp=sharing<br /></p>",
      "id": 1,
      "title": "Looking for an intro to Richard Branson, Tony Hsieh, or Bill Gates",
      "type": "request",
      "user": {
        "avatar_url": "http://rs795.pbsrc.com/albums/yy236/terminatoraf/Funny/mrbeabn.jpg~c200",
        "name": "Cynthia Hellen"
      }
    },
    {
      "details": "<p>Someone make him stop!</p>",
      "id": 2,
      "link_preview": {
        "title": "Inside joke",
        "url": "http://lmgtfy.com/?q=ghost+in+the+shell"
      },
      "title": "Batou's been putting organic oil in the Tachikomas again!",
      "type": "request",
      "user": {
        "avatar_url": "http://media.steampowered.com/steamcommunity/public/images/avatars/ff/ff652c5079d65d0c98d107586b7630e7275cde74_full.jpg",
        "name": "Motoko Kusanagi"
      }
    }
  ],
  "resources": [
    {
      "details": "<p>I got so many tools. Take all of them! Please!</p>",
      "id": 3,
      "title": "This is a resource!",
      "type": "resource",
      "user": {
        "avatar_url": "http://www.picgifs.com/avatars/animals/parrot/avatars-parrot-925060.jpg",
        "name": "Squawky McSquawkface"
      }
    }
  ],
  "subject": "Your Sandbox Daily Digest",
  "time_period": "last week",
  "topicsWithChats": [
    {
      "name": "bayarea",
      "num_new_chats": 5
    },
    {
      "name": "cheese",
      "num_new_chats": 1
    }
  ],
  "tracking_pixel_url": "TODO(tracking_pixel_url)",
  "upcoming": [
    {
      "details": "<p>Come dance among the garden gnomes!</p>",
      "id": 3,
      "title": "The spring fling",
      "type": "event",
      "user": {
        "avatar_url": "http://www.picgifs.com/avatars/animals/parrot/avatars-parrot-925060.jpg",
        "name": "Squawky McSquawkface"
      },
      "when": "Mon, March 15, 1pm - 10pm "
    },
    {
      "details": "<p>I got so many tools. Take all of them! Please!</p>",
      "id": 3,
      "title": "Fresh pressed cider",
      "type": "offer",
      "user": {
        "avatar_url": "http://www.picgifs.com/avatars/animals/parrot/avatars-parrot-925060.jpg",
        "name": "Squawky McSquawkface"
      },
      "when": "Mon, Oct 10, 2pm - Oct 12, 5pm"
    },
    {
      "details": "<p>I got so many tools. Take all of them! Please!</p>",
      "id": 3,
      "title": "Cleaning up trash",
      "type": "project",
      "user": {
        "avatar_url": "http://www.picgifs.com/avatars/animals/parrot/avatars-parrot-925060.jpg",
        "name": "Squawky McSquawkface"
      },
      "when": "Mon, Oct 10, 4pm - 8pm "
    },
    {
      "details": "<p>I got so many tools. Take all of them! Please!</p>",
      "id": 3,
      "title": "Who shall be our secretary?",
      "type": "proposal",
      "user": {
        "avatar_url": "http://www.picgifs.com/avatars/animals/parrot/avatars-parrot-925060.jpg",
        "name": "Squawky McSquawkface"
      },
      "when": "Mon, Oct 10, 4pm - 8pm "
    },
    {
      "details": "<p>I got so many tools. Take all of them! Please!</p>",
      "id": 3,
      "title": "Looking for a steam cleaner",
      "type": "request",
      "user": {
        "avatar_url": "http://www.picgifs.com/avatars/animals/parrot/avatars-parrot-925060.jpg",
        "name": "Squawky McSquawkface"
      },
      "when": "Mon, Oct 10, 4pm - 8pm "
    },
    {
      "details": "<p>I got so many tools. Take all of them! Please!</p>",
      "id": 3,
      "title": "Federal grant",
      "type": "resource",
      "user": {
        "avatar_url": "http://www.picgifs.com/avatars/animals/parrot/avatars-parrot-925060.jpg",
        "name": "Squawky McSquawkface"
      },
      "when": "Mon, Oct 10, 4pm - 8pm "
    }
  ]
}
\`\`\`

---
