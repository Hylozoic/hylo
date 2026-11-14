# Designed views ("Design your own view")

A Hylo Pro feature, stacked on group themes. A steward describes a page in a chat, an AI model builds it from Hylo building blocks, and the page is saved to the group's menu where every member can open it.

This is the first slice. Read `docs/group-themes-mvp.md` first; the AI plumbing (child process, cost summary, Pro gate) follows the same patterns.

## How it works

The assistant is called **Axl**. It greets the steward when the designer opens and offers to look at the group; "Make some suggestions" sits just above the message box until a design is started.

1. In the group menu's edit mode, Add to Menu > Add View opens the Add View dialog. It now leads with **Design your own view**, then **Your designed views**, then the common and custom views.
2. The designer is at `/groups/:slug/design/new` (or `/design/:viewId` to edit). The **chat column takes the place of the group menu**: a Back button, a small pill with the running AI cost (starting at $0.00, detail on hover), the conversation with Axl, and a message box with a "+" for adding images that grows with a long message, up to 12 lines. The **main column shows the page**, redrawn after every message; before the first design it asks "What do you want to build?".
   - **The header** of the main column holds the view's name, a status pill (Draft, Unsaved changes or Published) and, at the right, "Add to menu" ("Save changes" for a saved view).
   - **The name** is in the main column's header. Clicking it renames the view. The AI suggests a name with the first design, and leaves it alone once the steward has a name of their own (typed, or from a suggestion they picked).
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

Blocks: `hero`, `heading`, `text`, `image`, `callout`, `posts`, `events`, `members`, `button`, `divider`, `canvas`, and `columns` (2 or 3 columns of the others; no nesting). The `posts`, `events` and `members` blocks load the group's live content when the page is shown. A `button` leads to a named place in the group or an `https://` address. Posts and events in the live lists open in the post dialog over the page, as in other views.

The definition is `packages/shared/src/DesignedViewHelpers.js`: `validateDesignedView` (strict, used on save), `sanitizeDesignedView` (lenient, used when showing a page, so one bad block cannot blank it) and `designedViewJsonSchema` (what the model fills in). To add a block type, add it to `DESIGNED_VIEW_BLOCKS` there, draw it in `apps/web/src/components/DesignedView/DesignedView.js`, and describe it in the system prompt in `apps/backend/lib/designedViewDesign.js`.

## Canvas

`canvas` is an infinite canvas: a surface larger than the screen that people drag to pan and zoom (buttons, pinch, or Ctrl-scroll; arrow keys when focused). It holds 2 to 16 regions, each a titled card with an optional note, a tone and 1 to 6 blocks, placed on a 6 by 6 grid with `col` and `row`. A page can have one canvas and it cannot go inside columns. A page with a canvas gives it the whole main column, edge to edge and down to the bottom of the window, and the AI is told such a page is normally the canvas alone. Two regions given the same cell are moved apart rather than rejected.

**The AI decides when to use it.** The system prompt tells it to use a canvas for many parallel groups with no reading order (a map of everything in the group, a board per theme, a wall of resources), or whenever the steward asks for a canvas, board, map or overview, and to use an ordinary page for anything read in order. When unsure it uses the ordinary page.

The `posts` block has an optional `search` field (words the posts mention), which is how the AI groups posts by theme: it picks the words from the group's recent post titles. This uses the same search as the rest of Hylo, so it matches words, not meaning.

Drawn by `apps/web/src/components/DesignedView/DesignedCanvas.js`. The regions sit in an ordinary CSS grid, so each takes the height its content needs, and panning and zooming transform the grid as a whole.

## Attachments Axl can read

The "+" in the message box adds an image or a PDF. Axl is shown both, so a steward can attach a flyer, poster or schedule and say "turn this into a page": dates, times, places and wording come from the attachment instead of placeholders.

- Images can be read and placed on the page; PDFs (up to 3, `groupViewFile` upload type) can only be read.
- Each message shows the model the attached PDFs and the 8 most recently added images, by address, so they must be on Hylo's own storage (`isHyloHostedUrl`). An image elsewhere can still be placed but is not shown to the model; a document elsewhere is refused.
- **Attached files are sent to the AI provider.** The "+" menu says so.
- Each image adds roughly a cent to every message it is shown in, and a PDF more with its length.

## Images

Stewards add images in the designer with "Add image" and tell the AI where to use them ("use image 1 as the banner"). `hero` is a banner image with a title and subtitle over it; `image` is a picture with alt text and a caption.

- Uploads use the `groupViewImage` upload type (`apps/backend/lib/uploader/types.js`), which needs the Administration responsibility like the group banner.
- **The AI can only place images the steward added.** The browser sends the list with each message, and `removeUnlistedImages` drops any image block whose address is not on the list or already on the page. Saving accepts any `https://` image address.

## What the AI knows about the group

Every design and suggestion turn gets a short summary of the group, built by `apps/backend/lib/groupDigest.js`: its name, purpose, description, location and member count; how many posts of each type it has, in total and in the last 90 days; how many requests and offers are open; the titles of its 25 most recent posts and 8 next events; and the views already in its menu.

**This is sent to the AI provider.** It holds titles and counts only: no post bodies, no comments, nothing about individual members, and no chats.

## Suggest views

Before the first message the designer offers **Make some suggestions**: `suggestGroupViews(groupId: ID!): JSON` returns three to five ideas `{ name, why, prompt }` tied to what the summary shows (a post type that has gone quiet, requests outnumbering offers, no starting point for newcomers). "Design this" sends the idea's prompt as the first message and fills in the name. A suggestion call costs about $0.03 and counts toward the hourly limit.

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

## Phones

The AI's instructions always include designing for a phone as well as a wide screen: columns stack left column first, headings and button labels stay short, two columns are preferred to three, a canvas puts what matters most in its first region, and copy never refers to position on the page. This is in the system prompt in `apps/backend/lib/designedViewDesign.js`. The designer itself is still desktop-only (see below).

## Limits and gating

- Web flag `DESIGNED_VIEWS` (on outside production) shows the entry in the Add View dialog.
- Designing, creating and changing a designed view need the Administration responsibility and Hylo Pro (`HYLO_PRO_REQUIRED` in the error's extensions). A view made with Pro keeps showing after Pro lapses and can still be renamed, moved or deleted.
- 60 design turns per group per hour; 40 messages per conversation; 30 blocks per page.
- Spaces cannot have Hylo Pro, so they cannot have designed views.

## Not done yet

- **Phones.** The designer is a two-column desktop layout. On a phone the chat column covers the page. The canvas works with touch dragging but has no pinch zoom of its own beyond what the browser sends.
- **Canvas regions are placed by the AI only.** A steward cannot drag a region to a new spot; they ask Axl to move it.
- **Editing by hand.** A page can only be changed through the chat. There is no way to edit one block's text directly.
- **Images** can be placed but not cropped or positioned, and an uploaded image cannot be removed from the list.
- **Creating posts.** Buttons only navigate; a page cannot open the post editor or publish anything.
- **Conversation history.** Reopening a saved view starts a new conversation from its saved design.
- **Unsaved drafts** live in the browser tab only and are lost on reload.
- **The sandbox demo** refuses design turns.
- **Live lists are not cached in the store.** Each block asks the server for its own short list.
- Every save broadcasts a group update, like other view changes.
