# Creating a Post

How a member writes and publishes a post: choosing a type, choosing where it goes, writing it, attaching things, and what happens when they press send. Editing, duplicating and deleting are covered at the end.

What a post looks like once published (cards, the post page, comments, reactions) is covered in *Viewing Posts*. The deeper behaviour of Events (RSVPs), Proposals (voting) and Projects (members) is covered in their own sections; this section only covers the fields they add to the editor.

**In this section**
1. Post types
2. Starting a new post
3. The post editor window
4. The editor, field by field
5. Writing the body: formatting, mentions, topics, links
6. Attachments
7. Announcements
8. Publishing
9. Drafts and closing without saving
10. Editing, duplicating and deleting
11. Who can post where
12. Rules & limits
13. Notes for review

---

## 1. Post types

Every post has one type. The type decides which fields the editor shows, which views the post appears in, and how it is displayed.

| Type | Description shown to members | Colour | Icon |
|---|---|---|---|
| Discussion | "Talk about what's important with others" | Blue | Speech bubble |
| Event | "Invite people to your event" | Red | Calendar |
| Offer | "What do you have for others?" | Green | Gift |
| Request | "What can people help you with?" | Purple | Heart |
| Resource | "Let people know about available resources" | Yellow | Book |
| Project | "Create a project that people can help with" | Orange | Project folder |
| Proposal | "Suggest a proposal for others to vote on" | Blue | Ballot |

Each type's colour is used for its badge on post cards and its markers on the map. Discussion is the default type.

Three further kinds of post exist but are not created from the main editor: **chat messages** (see *Chat Rooms*), **track actions** (see *Tracks*) and **funding round submissions** (see *Funding Rounds*). They use the same editor with a reduced set of fields, noted below where relevant.

A group can limit which types its members may post (see *Group Settings → Content*). Types a group doesn't accept are hidden from the type menu and that group won't appear as a destination for them.

---

## 2. Starting a new post

A member can start a post from:

- **The "+" create menu** in the main navigation. It opens a panel headed "What would you like to create?" listing one row per type the current group accepts, in this order: Discussion, Event, Offer, Request, Resource, Project, Proposal, followed by "Group" (which starts *Create Group* instead). Each row is a rounded, outlined button with the type's icon and name; on hover it grows slightly and a small "Create" pill fades in on its right.
- **A view's own create button** (for example the "+" in the Events view). The editor opens with that view's type already selected; in a combined view such as Requests & Offers, only those types are offered.
- **The map.** Long-pressing a spot, or using the map's "+" button, opens the create menu headed "New post at this location: ". The new post's location is pre-filled with that spot.
- **The calendar.** Clicking a day starts a new Event on that date with sensible default start and end times.

The editor opens over whatever page the member was on, so closing it returns them exactly where they were. The editor has its own web address, so reloading the page keeps it open.

---

## 3. The post editor window

**Overlay.** The editor appears in a centred window up to about 800px wide, over a dimmed, slightly blurred view of the page underneath. It slides in from the right and fades in. A close × sits in the top-right corner. Clicking the dimmed area, pressing ×, or using a device's back button all count as closing (see §9).

**Editor panel.** A rounded panel with a visible border and a strong shadow. Fields are stacked vertically with even spacing. Each field sits in a lightly shaded rounded strip with a small grey label on its left ("To", "Title", "Location", and so on). The strip's border highlights in the accent colour while the field is focused.

**First-time tour.** The first time a member opens the editor, a small floating prompt offers "Want a quick tour of the post editor?". Accepting steps through five tips, each pointing at the relevant part of the editor:

| Tip | Text |
|---|---|
| Post types | "Discussions start conversations, requests and offers exchange help, proposals collect votes, and events gather people." |
| Post to one or more groups | "A post can reach several groups at once. Groups that don't accept this post type are not listed." |
| Topics | "Type # in the body to tag up to three topics, so your post is easier to find." |
| Announcement | "Marks the post as important and sends a notification to every member." |
| Public posts | "Make a post visible beyond your groups — anyone can see it and it can appear in The Commons." |

---

## 4. The editor, field by field

Fields appear in this order. The table shows which types include each one.

| Field | Discussion | Request, Offer, Resource | Project | Event | Proposal |
|---|---|---|---|---|---|
| Type menu | ✓ | ✓ | ✓ | ✓ | ✓ |
| To | ✓ | ✓ | ✓ | ✓ | ✓ |
| Title | ✓ | ✓ | ✓ | ✓ | ✓ |
| Details (body), link preview, images, files | ✓ | ✓ | ✓ | ✓ | ✓ |
| Project Members | | | ✓ | | |
| Public switch | ✓ | ✓ | ✓ | ✓ | ✓ |
| Proposal options, voting method, quorum, anonymous voting | | | | | ✓ |
| Timeframe and timezone | | ✓ | ✓ | ✓ | ✓ ("Voting window") |
| Location | on request | ✓ | ✓ | ✓ ("Venue") | on request |
| Join link | | | | ✓ | |
| Invite People | | | | ✓ | |
| Donation Link, Project Management link, Budget Total | | | ✓ | | |
| Action bar | ✓ | ✓ | ✓ | ✓ | ✓ |

"On request" means the field is hidden until the member presses the location pin in the action bar.

### 4.1 Type menu

A compact dropdown at the top showing the current type's name. It lists only the types allowed in the current view and group.

Switching type keeps everything already written. Destinations that don't accept the new type are removed from **To**, and the cursor moves to the title. If the member has a saved draft of the type they're switching to *and* has already written something, Hylo asks:

- Title: "Load saved {type} draft?"
- Text: "You already have a saved draft for this post type. Keep what you are currently writing, or replace it with the saved draft."
- Buttons: "Keep what I am writing" / "Load saved draft"

### 4.2 To (where the post goes)

Lists the groups and spaces the post will be published in. A post can go to several at once (cross-posting); it appears in each.

- Each chosen destination appears as a chip with its picture and name. Typing filters the list; a dropdown shows matching options.
- **Options** are the groups the member belongs to and the spaces they have joined. A space is shown as "Parent Group / Space Name". Groups and spaces that don't accept the current post type are left out. Archived groups and paid groups the member hasn't paid for are left out.
- **Order:** the group the member is currently in comes first, followed by its spaces (alphabetically), then every other group alphabetically, each followed by its spaces.
- **Default:** the current group or space is pre-selected. Once the member changes the selection, Hylo stops re-adding it.

### 4.3 Title

A single line. Placeholder-free; labelled "Title". It is focused when the editor opens. Titles are limited to 80 characters; on reaching the limit a yellow banner reads "Title limited to 80 characters" and further typing is blocked.

### 4.4 Details

A rich-text area with the placeholder "Add a description" that grows as the member types. A formatting toolbar sits above it (see §5). Beneath the text, inside the same box, appear the link preview (if any) and the images and files sections (once anything is attached).

### 4.5 Project Members (Projects)

A people picker for choosing project members from the selected groups. The author is always a member of their own project.

### 4.6 Public switch

A switch with an explanation beside it that changes with its state:

- Off: "Make Public - Currently this post will only be visible within groups you select."
- On, and at least one selected group appears in The Commons: "Public Post - This post will be publicly visible and shareable. This post will be visible in The Commons."
- On, otherwise: "Public Post - This post will be publicly visible and shareable."

The switch starts **on** when the member is writing from The Commons and **off** everywhere else.

A post only actually becomes public if at least one of its groups allows public content (see *Group Settings → Privacy*). Otherwise it is saved as a group-only post even if the switch was on. A public post can be seen by anyone with the link, including people without an account, and is listed in The Commons.

### 4.7 Proposal fields (Proposals)

Summarised here; full behaviour is in *Proposals*.

- **Proposal template** — shown only while no options have been added. Choosing a template fills in a standard set of options: Yes/No, Poll Single Vote, Multiple Choice, Advice, Consent, Consensus, Gradient of Agreement.
- **Proposal options** — a list where each option has an emoji (chosen from a fixed set), a short description ("Describe option") and a remove ×. Add more with "Add an option to vote on...". At least one option is required: "Proposals require at least one option".
- **Voting method** — "Single vote per person" or "Multiple votes allowed".
- **Quorum** — a 0–100% slider with an ⓘ explaining: "Quorum is the percentage of members who need to participate in the decision for it to be considered valid".
- **Anonymous voting** — a switch.
- When editing a proposal that already has options, a warning reads: "When options are changed, existing votes will be discarded".

### 4.8 Timeframe and timezone

Labelled "Timeframe" ("Voting window" for proposals). Two date-and-time pickers, "Select Start" and "Select End", separated by "to". Times are chosen to the minute and shown in the member's 12- or 24-hour preference. On phones and tablets the device's own date and time pickers are used.

- Changing the start moves the end to keep the same duration (one hour by default).
- Except for events, each picker has a small × to remove it ("Remove start time" / "Remove end time"). Removing the start also removes the end. For proposals Hylo asks first: "Remove the voting window?" or "Remove the voting end time?", with "Cancel" and a red "Remove".
- If the end is not after the start, a red banner reads "End Time must be after Start Time".
- **Timezone** — a dropdown defaulting to the member's current timezone. Changing it keeps the same clock times (10:00 stays 10:00, in the new zone).

### 4.9 Location / Venue

A place-search field that suggests matching places as the member types. Placeholder: "Where is the event taking place?" for events, "Is there a relevant location for this proposal?" for proposals, and "Where is your {type} located?" otherwise. Shown by default for Requests, Offers, Resources, Projects and Events; for other types it appears when the member presses the pin in the action bar.

### 4.10 Event fields

- **Join link** — placeholder "Add a video call link (Zoom, Meet, Jitsi, etc.)". The label turns red if the text isn't a valid web address. If the member pastes a Zoom, Google Meet, Jitsi or Teams link into the body and this field is empty, it is filled in automatically.
- **Invite People** — a people picker limited to members of the selected groups. Invitees are notified and can RSVP (see *Events*).

### 4.11 Project fields

- **Donation Link** — placeholder "Add a donation link (must be valid URL)".
- **Project Management** — placeholder "Add a project management link (must be valid URL)".
- **Budget Total** — free text.

Labels turn red when a link isn't a valid web address. A link typed without "https://" has it added automatically.

### 4.12 Action bar

A row along the bottom of the editor.

Left side, small icon buttons (they turn green on hover):
- **Add images** (picture icon) — opens the image picker (§6). Once images are attached this icon is shown as active and further images are added from the "+" tile in the images section.
- **Add files** (paperclip icon) — opens the file picker. Same behaviour.
- **Add Location** (pin icon) — reveals the Location field. Hidden once the field is showing.
- **Send Announcement** (megaphone icon) — a toggle, shown only to members allowed to make announcements (§7).

Right side:
- A grey italic hint: "Alt-Enter to post" ("Option-Enter to post" on Mac; "…to save" when editing).
- The **send** button (a paper-plane arrow). It is greyed out until the post is valid; hovering it lists what's missing (§8.1).

---

## 5. Writing the body: formatting, mentions, topics, links

**Toolbar:** Bold, Italic, Strikethrough, Code, Link, Emoji, Bulleted list, Numbered list, Quote, Code block, Undo, Redo, Clear formatting.

- **Link** opens a small form with "Link text" and "URL" and buttons "Cancel", "Remove link" and "Add" (or "Save" when editing a link). Web addresses typed or pasted into the body become links automatically.
- **Emoji** opens an emoji picker and inserts into whichever of title or body was last focused.
- Pasted images are removed from pasted text; images must be attached (§6).
- **Alt+Enter** (Option+Enter on Mac) in the title or body publishes the post.

**Mentions.** Typing **@** opens a list of up to 7 matching people from the selected groups, with more loading on scroll. Choosing one inserts their name as a highlighted mention. Mentioned people are notified and automatically follow the post.

**Topics.** Typing **#** opens a list of up to 7 matching topics from the selected groups. If what the member has typed is longer than 2 characters it is offered first as a new topic. Choosing one inserts it as a highlighted "#topic". The first **3** topics used become the post's topics (used for search and filtering); any further #topics stay in the text but aren't attached. Topic names are not case-sensitive.

**Link previews.** When the first link appears in the body, Hylo fetches a preview of that page and shows it beneath the text as a card: a small square image on the left, the page title in bold with a link icon, a two-line description, and the site's domain in grey, with a "Remove" × to discard it. Only the first link gets a preview. Placing the cursor in a different link shows an "Add Preview" button to switch the preview to that link.
- For YouTube and Vimeo videos, the preview can be **featured**: the video then plays at full width above the post's text. New video previews are featured by default; hovering the preview image offers Expand / Shrink to change this. While featured a blue banner reads: "Featured: This video will be full-width, displayed above the description, and playable."
- A link to another Hylo post previews that post only if it is public; private posts never reveal their content in a preview.
- If the member removes the preview, Hylo won't add one later.

---

## 6. Attachments

**Images and files** are added through a picker that accepts files from the device or from a web address, Google Drive or Dropbox (images also from the camera, Instagram, Facebook and an image search).

- Up to **10** items per pick, each up to **50 MB**.
- Images: any image format. Files: documents, audio, video, PDFs and other common file types.
- Large images are scaled down to at most 1200px wide and rotated the right way up automatically.

**In the editor:**
- An **"Images"** section shows thumbnails in a row with a dashed "+" tile to add more. Thumbnails can be dragged to reorder; the first image is the one shown on post cards. Each has a remove ×.
- A **"Files"** section lists each file with a document icon and its file name, a remove ×, and a "+ Add File" tile.
- Both sections appear only once something has been added or is uploading.

---

## 7. Announcements

An announcement is a post marked as important that also notifies every member of its groups (except those who have turned post notifications off).

- The megaphone toggle appears only if the member is a steward with administration rights in **every** selected group, and only for Discussions, Events, Offers, Requests, Resources, Projects and Proposals.
- With the toggle on, pressing send first shows a confirmation:
  - Heading: "MAKE AN ANNOUNCEMENT"
  - Text (one group): "This marks the post as important and notifies everyone who hasn't turned off post notifications."
  - Text (several groups): "This marks the post as important and notifies everyone in the {number} selected groups who hasn't turned off post notifications."
  - Buttons: "Go Back" and "Send It". "Send It" publishes.
- Announcements show a megaphone badge on the post card.
- A post can only be made an announcement when it is first published, not by editing later.

---

## 8. Publishing

### 8.1 What must be filled in

The send button stays disabled until all of the following are true. Hovering it lists every unmet requirement:

| Requirement | Message |
|---|---|
| A title, at most 80 characters | "Title is required" |
| At least one destination | "At least one group required" |
| Events: a start and an end, end after start | "Valid start and end time required" |
| Events: join link, if given, is a valid web address | "Video call link must be a valid URL" |
| Projects: donation / project management links, if given, are valid | "Donations and project management links must be valid URLs" |
| Proposals: at least one option | "At least one proposal option required" |

### 8.2 What happens on send

1. The post appears immediately at the top of the relevant streams, before the server confirms it.
2. The editor closes and the member's draft for this post is discarded.
3. The post is published in every chosen group and space. Its author and anyone mentioned follow it, so they hear about new comments.
4. **Notifications** go out (delivery depends on each person's notification settings — see *Notifications*):
   - every member of each destination group hears about the new post;
   - people mentioned with @ are told they were mentioned;
   - for announcements, every member is additionally notified as an announcement;
   - for events, invitees receive an invitation. The author is automatically marked as "Going".
5. The new post appears live for other members currently looking at those groups.
6. The author sees the post as already read.

### 8.3 If publishing fails

The editor stays open with everything intact and a red banner above the action bar:
- If one or more destinations don't accept this type: "{Group A} does not accept {type} posts" or "{Group A, Group B and Group C} do not accept {type} posts" (spaces written as "Parent / Space").
- Otherwise the server's message, or "There was an error, please try again."

The banner disappears when the member changes the type or destinations.

---

## 9. Drafts and closing without saving

- Hylo saves the post being written as a **draft** about a second and a half after each change, as long as there is a title or some body text. The draft is stored on the member's account, so it is there on any device.
- Drafts are kept separately per group and per post type. Opening the editor again in the same place with the same type restores the draft.
- Clearing both title and body deletes the draft.

**Closing with unsaved changes** shows a dialog:
- Title: "Save draft before closing?"
- Text: "You have unsaved changes to this post. Save a draft to continue later, or discard them."
- Buttons, stacked full width: "Continue editing" (returns to the editor), "Discard" (red; throws away the changes and the draft), "Save" (green, pre-selected; keeps the draft and closes).

Closing an unchanged editor closes immediately.

---

## 10. Editing, duplicating and deleting

All three are in the **⋯ (More)** menu on the post.

**Edit** (author only). Opens the same editor filled with the post. Everything can be changed, including destinations, except that a post cannot be turned into an announcement afterwards. The hint and send button say "save" instead of "post". After saving, the post shows "Edited {time ago}". Newly mentioned people are notified; previously mentioned people are not notified again.
- If an event's time, location or join link changes, people who RSVP'd are sent the update.
- Saving changes to a proposal asks first: "Changing proposal options will reset the votes. Are you sure you want to continue?" (see note 2).

**Duplicate** (any signed-in member). Opens a new post pre-filled from the original, titled "Copy of {original title}" and without the original's event invitations. Saving creates a separate new post.

**Delete** (author only). Asks "Are you sure you want to delete this post? You cannot undo this." The post disappears everywhere, and if the member was viewing it they are returned to the list it was opened from.

**Remove From Group** (members who can manage content in the group, for posts by others). Asks "Are you sure you want to remove this post? You cannot undo this." The post is removed from that group only and stays in its other groups.

---

## 11. Who can post where

- A member can post to any group they belong to and any space they've joined, as long as the group accepts that post type.
- A post must go to at least one group or space, and the author must belong to every destination.
- Only stewards with administration rights in every destination can make announcements.
- Paid groups the member hasn't paid for don't appear as destinations.

---

## 12. Rules & limits

| Rule | Value |
|---|---|
| Title length | Maximum 80 characters; required |
| Topics per post | Maximum 3 (first three #topics in the body) |
| Attachments | Up to 10 per pick; up to 50 MB each |
| Image size | Scaled down to 1200px wide maximum |
| Link previews | One per post, from the first link |
| Destinations | At least one; author must be a member of each |
| Draft autosave | About 1.5 seconds after the last change |

---

## 13. Notes for review

Places where today's product behaves in a way that may not be intended. Each needs a decision on whether a rebuild should copy it.

1. **Anyone in a post's groups can edit it behind the scenes.** Only the author sees "Edit", but the system doesn't actually check who is saving changes. *Proposed: only the author (and possibly moderators) may edit.*
2. **Saving any proposal edit discards all votes**, even when only the title or text changed, because the options are always re-saved. *Proposed: only reset votes when the options themselves change, and only warn in that case.*
3. **The "Save" button in the close dialog** does nothing extra (the draft is already saved). Fine as reassurance, or should it say "Keep draft"?
4. **There's no list of drafts.** Drafts are restored only by reopening the editor in the same group with the same type. *Should there be a "My Drafts" list?*
5. **Topics aren't shown on posts.** Topics only appear inline in the body text (where clicking one searches for it); there's no separate topic line on cards or the post page. *Confirm.*
6. **Chat messages can't be turned into full posts** from the editor; editing a chat message keeps it a chat message. *Confirm.*
7. **No dedicated topic picker.** Topics are added only by typing # in the body. *Confirm.*
8. **The public switch can silently do nothing.** If none of the selected groups allows public content, the switch can still be turned on (and says "This post will be publicly visible and shareable"), but the post is saved as group-only. *Proposed: disable the switch, or explain why, when no selected group allows public posts.*
