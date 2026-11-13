# Designed views ("Design your own view")

A Hylo Pro feature, stacked on group themes. A steward describes a page in a chat, an AI model builds it from Hylo building blocks, and the page is saved to the group's menu where every member can open it.

This is the first slice. Read `docs/group-themes-mvp.md` first; the AI plumbing (child process, cost summary, Pro gate) follows the same patterns.

## How it works

1. In the group menu's edit mode, Add to Menu > Add View opens the Add View dialog. It now leads with **Design your own view**, then **Your designed views**, then the common and custom views.
2. The designer is at `/groups/:slug/design/new` (or `/design/:viewId` to edit). The **chat column takes the place of the group menu**: a Back button, the conversation, the token and cost meter, and a name field with "Add to menu". The **main column shows the page**, redrawn after every message.
3. Saving creates a `GroupView` of type `designed`. Members open it at `/groups/:slug/designed/:viewId`. Stewards see an "Edit design" link there.

## The format

A designed view is data, never HTML, CSS or code. It is stored in the view's existing `settings` column as `settings.design`, so there is no migration:

```json
{
  "version": 1,
  "blocks": [
    { "type": "heading", "text": "Welcome", "level": 1 },
    { "type": "text", "text": "What this group is about." },
    { "type": "columns", "columns": [
      [{ "type": "posts", "title": "Latest", "postTypes": ["discussion"], "limit": 4, "layout": "list" }],
      [{ "type": "events", "title": "Coming up", "limit": 3 }]
    ] }
  ]
}
```

Blocks: `hero`, `heading`, `text`, `image`, `callout`, `posts`, `events`, `members`, `button`, `divider`, and `columns` (2 or 3 columns of the others; no nesting). The `posts`, `events` and `members` blocks load the group's live content when the page is shown. A `button` leads to a named place in the group or an `https://` address. Posts and events in the live lists open in the post dialog over the page, as in other views.

The definition is `packages/shared/src/DesignedViewHelpers.js`: `validateDesignedView` (strict, used on save), `sanitizeDesignedView` (lenient, used when showing a page, so one bad block cannot blank it) and `designedViewJsonSchema` (what the model fills in). To add a block type, add it to `DESIGNED_VIEW_BLOCKS` there, draw it in `apps/web/src/components/DesignedView/DesignedView.js`, and describe it in the system prompt in `apps/backend/lib/designedViewDesign.js`.

## Images

Stewards add images in the designer with "Add image" and tell the AI where to use them ("use image 1 as the banner"). `hero` is a banner image with a title and subtitle over it; `image` is a picture with alt text and a caption.

- Uploads use the `groupViewImage` upload type (`apps/backend/lib/uploader/types.js`), which needs the Administration responsibility like the group banner.
- **The AI can only place images the steward added.** The browser sends the list with each message, and `removeUnlistedImages` drops any image block whose address is not on the list or already on the page. Saving accepts any `https://` image address.

## What the AI knows about the group

Every design and suggestion turn gets a short summary of the group, built by `apps/backend/lib/groupDigest.js`: its name, purpose, description, location and member count; how many posts of each type it has, in total and in the last 90 days; how many requests and offers are open; the titles of its 25 most recent posts and 8 next events; and the views already in its menu.

**This is sent to the AI provider.** It holds titles and counts only: no post bodies, no comments, nothing about individual members, and no chats.

## Suggest views

Before the first message the designer offers **Suggest views**: `suggestGroupViews(groupId: ID!): JSON` returns three to five ideas `{ name, why, prompt }` tied to what the summary shows (a post type that has gone quiet, requests outnumbering offers, no starting point for newcomers). "Design this" sends the idea's prompt as the first message and fills in the name. A suggestion call costs about $0.03 and counts toward the hourly limit.

## Where things are

| File | What it does |
| --- | --- |
| `packages/shared/src/DesignedViewHelpers.js` | The block format, validation and JSON Schema |
| `apps/backend/lib/designedViewDesign.js` | The design turn and the suggestion turn with Claude, run in a child process |
| `apps/backend/lib/groupDigest.js` | The summary of a group the AI is given |
| `apps/backend/api/graphql/mutations/group_views.js` | `designGroupViewTurn`; `createGroupView` / `updateGroupView` validate `settings.design` for `designed` views |
| `apps/web/src/components/DesignedView/` | Draws a designed view; loads each live block's list |
| `apps/web/src/routes/GroupViewDesigner/` | The designer: chat column, canvas and the session they share |
| `apps/web/src/routes/GroupDesignedView/` | The saved page, as members see it |
| `apps/web/src/routes/AuthLayoutRouter/AuthLayoutRouter.js` | Routes; the `design/:viewId` route in the menu column swaps the group menu for the chat |
| `AddGroupViewDialog.jsx` | The "Design your own view" entry and the list of designed views |

## The AI turn

- Mutation: `designGroupViewTurn(groupId: ID!, messages: JSON!, currentView: JSON, images: JSON): JSON`, returning `{ reply, view, usage }`. It saves nothing.
- The conversation is not stored. The browser sends the history and the current design with each message. The model always returns the whole page, which is validated before it reaches the browser.
- A turn costs about $0.03 and takes about 10 seconds with Claude Opus 5.5. Much of the input is the block schema, which defines leaf blocks once and refers to them: listed twice (top level and inside columns) it is too large for structured output. `GROUP_VIEW_DESIGN_MODEL` on the backend picks another model; `CLAUDE_API_KEY` is required.
- The designer shows tokens and estimated cost for the last message and for the whole design.

## Limits and gating

- Web flag `DESIGNED_VIEWS` (on outside production) shows the entry in the Add View dialog.
- Designing, creating and changing a designed view need the Administration responsibility and Hylo Pro (`HYLO_PRO_REQUIRED` in the error's extensions). A view made with Pro keeps showing after Pro lapses and can still be renamed, moved or deleted.
- 60 design turns per group per hour; 40 messages per conversation; 30 blocks per page.
- Spaces cannot have Hylo Pro, so they cannot have designed views.

## Not done yet

- **Phones.** The designer is a two-column desktop layout. On a phone the chat column covers the page.
- **Editing by hand.** A page can only be changed through the chat. There is no way to edit one block's text directly.
- **Images** can be placed but not cropped or positioned, and an uploaded image cannot be removed from the list.
- **Creating posts.** Buttons only navigate; a page cannot open the post editor or publish anything.
- **Conversation history.** Reopening a saved view starts a new conversation from its saved design.
- **Unsaved drafts** live in the browser tab only and are lost on reload.
- **The sandbox demo** refuses design turns.
- **Live lists are not cached in the store.** Each block asks the server for its own short list.
- Every save broadcasts a group update, like other view changes.
