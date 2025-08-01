# Changelog
All notable changes to the Hylo Web app (the Hylo front-end) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

## [6.1.12] - 2025-07-31

### Aded
- Tweaks to get notifications working for the desktop app

## [6.1.11] - 2025-07-25

### Added
- Completed GDPR support! You can now fully opt out of non-essentia cookies (which are Mixpanel for analytics and Intercom for support), and this is now tracked and stored on your device and in the database. You can update your GDPR settings in the Account Settings page.

### Changed
- Only fetch all your group's chat rooms when opening up post editor for a a non chat post This will remove a ton of extra database queries from loading chat rooms.

### Fixed
- Issue where new group members couldn't navigate away from welcome page to the #general chat room

## [6.1.10] - 2025-07-15

### Added
- Add ability to pin groups to the top of the global nav. Pinned groups can be reordered by dragging and dropping.

## [6.1.9] - 2025-07-08

### Changed
- Removed some data loading on initial group load, to improve performance

### Fixed
- Content flagging/moderation in dark mode

## [6.1.8] - 2025-07-05

### Fixed
- Inability to scroll post editor when creating a post from the chat box when the post gets too tall for the screen.
- Joining groups from the group card in the group explorer

## [6.1.7] - 2025-07-04

### Changed
- Can now interact with the nav menus while a post is open
- Added a nicer UI when a group has no posts

### Fixed
- Viewing action completion responses for a long action that requires scrolling down
- Stacking of event RSVP dropdown
- Project post UI in dark mode

## [6.1.6] - 2025-07-02

### Changed
- Group Welcome Page is now centered and has a max width

### Fixed
- Filtering by topics in map drawer
- Map drawer styling in dark mode
- #topic links in Group Welcome Page
- Setting up prerequisite groups that must be joined before your group can be joined
- Fix flash of [Object] in page titles
- Remove action as a post type option for custom views
- Remove extra weird star on proposal options
- Topic selector text color in dark mode
- OAuth login and consent flow
- Ability to view posts at URL of /post/:postId when logged in
- Bug when viewing track action of Select One type
- Text color of featured groups in group explorer
- Scrolling of long public posts when not logged in

## [6.1.5] - 2025-07-01

### Changed
- Many improvements to UI/UX of the Group Explorer. Added featured groups to the top of it.
- Many improvements to styling of the My Home pages, including My Groups, My Invites, Account and more
- Many improvements to UI/UX when using Hylo in a mobile browser
- Many improvements to styling of welcome modals
- Topics load much faster when typing a # in the post editor

### Fixed
- Display of login/signup flow in dark mode
- Display of dropdowns at the top of the stream

## [6.1.4] - 2025-06-25

### Fixed
- Editing posts that have link previews
- Once again can close map drawer on mobile browser
- Many other issues when using Hylo in mobile browser
- Missing translations

## [6.1.3] - 2025-06-16

### Added
- Display join question answers in the member directory, when toggled on

### Changed
- Re-add timezone display to datetimes throughout the app

### Fixed
- Issue where people would be asked to answer join questions after joining even if they already had
- Issue where the chat room wouldn't scroll down to show new posts created by the current user when created through the plus button
- Width of multiple image attachments in safari
- Correctly navigate to first message when going to /messages

## [6.1.2] - 2025-06-12

### Changed
- Faster closing of post modal after creating a non chat post

### Fixed
- Immediate editing of a new chat post no longer removes that post
- Fix location of post dialog in stream when scrolled down.
- Add missing translations for proposal posts

## [6.1.1] - 2025-06-11

### Added
- Missing translation for unpublished tracks

### Changed
- Remove the new Hylo alert that was shown to users who signed up before the redesign

### Fixed
- Display of send announcement modal
- Display of disabled post button in post editor

## [6.1.0] - 2025-06-10

### Added
- __Tracks!__ Tracks are a way to offer a series of actions/modules/lessons to a group. They can be used for courses, workshops, or any other kind of learning experience, as well as for certain kinds of projects or any other kind of sequential group activity offered to members. Tracks are made of actions, which can have different types of completion requirements, like a text response, an uploaded file, or choosing from a list of options.

## [6.0.8] - 2025-06-05

### Added
- Information about and a link to the form for applying for a group to join The Commons, in the Privacy & Access group settings page.
- Tweaked language when toggling a post to Public in the post editor that says whether the post will display in The Commons or not based on whether any of the selected groups have been allow in The Commons.

### Changed
- More quickly clear the chat box for the next post after creating a post
- Improvements to spacing of post editor fields

### Fixed
- Make sure link preview clears from chat box after creating a post

## [6.0.7] - 2025-05-25

### Fixed
- Blank screen when some users sign up and join a group
- Extraneous borders around some dropdowns
- Invisible text in custom views and roles settings in dark mode

## [6.0.6] - 2025-05-05

### Changed
- Switch back from "home" as the name of the default chat room for groups to "general". To reduce confusion between home chat and the hpme view for your group
- Use the # icon for chat rooms instead of a message bubble icon

### Fixed
- Ensure that chat rooms for groups are always displaying in the To field in the post editor so you can easily send a post to a specific chat room / topic.

## [6.0.5] - 2025-04-30

### Changed
- Better UX on groups page when a group has no related groups

### Fixed
- Issue preventing clicking on links in post details and comments
- Emoji reactions are now displayed correctly in the post list
- Display of pending invite timing
- Issue where clicking stream view child post toggle would go to last view you were on
- Fix display of lists in comments
- Fix bold text color in comments
- Fix dropdowns in custom views settings and everywhere. And remove the unecessary x that appears when they are open
- Editing posts from custom views

## [6.0.4] - 2025-04-21

### Fixed
- New posts immediately appear at the top of the Stream and Events views after being created again.
- Display of flagging post dialog in dark mode
- Display of quoted text in posts in dark mode
- Setting proposal summary once voting is completed

## [6.0.3] - 2025-04-08

### Fixed
- Duplicate votes on proposals
- Votes now appear immediately when cast on a proposal in a chat room

## [6.0.2] - 2025-04-02

### Added
- Allow in-app notifications to be cmd/ctrl clicked

### Changed
- Many tweaks and improvements to the post editor
- Improved the UI of the Roles and Responsibilites group settings page
- Fixed and simplified styling of heading tags in global styles
- Improved padding of chat room and chat posts

### Fixed
- Added the correct color to the heading tags in hyloeditor
- Flagging of public content
- Remove file attachments from post editor after creating a post
- Fix display of badge names and resonsibilities in member directory
- If there is already a valid linkPreview, dont flicker the loading spinner for previews
- Fix display of posts in map drawer
- Once again reload them after map filters change (like post types)
- Fix zoom level when jumping to a location on the map

## [6.0.0] - 2025-03-14

Major Hylo redesign! After 6 months of work, we've redesigned the entire app more reliable, more functional,and easier to use.
There are many improvements across the board. You can see the summary of the big changes here: [https://hylozoic.gitbook.io/hylo/product/hylo-redesign-product-updates](https://hylozoic.gitbook.io/hylo/product/hylo-redesign-product-updates)

### Added
- A new look for Hylo! The Hylo interface colors are now warmer and lots of details have been updated and refined. There is also now ~dark mode~ in addition to light mode. For now, these will correspond to your device's settings (you will see the light or dark version according to your device preferences).
- New chat-centered focus that puts conversations at the heart of collaboration, making it easier to communicate and coordinate with your community in real-time. Every group now defaults to its home page being a #home chat room.
- New global navigation menus always visible on the left to easily jump between groups, your personal My space, your Messages, and the public Commons. You will also find your notifications here, and buttons to create a post and to get support.
- New customizable Group Menu that contains links to all the important views in your group. This menu can be fully edited by group stewards. The home view can be changed to any existing view. The views can be rearranged and hidden, and any existing view, member or post can be added to the menu. You can also group views into container widgets in the menu with a header. The menu also automatically updates as your group grows. Initially it starts with just the #home chat room. As posts are added new views are automatically added to the menu for the post types that are used.
- New Requests & Offers view, Resources view, and Discussions view, for these post types.
- Calendar view mode! The Events view will use this by default, and you can switch any other view to use the calendar interface.
- New notification when a member joins your group which includes answers to any join questions that were set.
- New welcome email for all new Hylo users
- Easily invite new members or copy an invite link from the Add Members link in the group Context Menu.
- New Welcome Page that be setup as the landing page for new members first joining your group. This is configured in the group settings.
- Upcoming events are now displayed with an Upcoming tag
- New toggle to show or hide "active" posts in the stream. For example this can hide completed asks and offers.
- New Link button in the post editor to add a link to the post.
- Ability to create full posts from the chat box in chat room
- New URL field for groups to link to the group's website.
- Support for publishing Murmurations profiles for public groups

### Changed
- New layout which removes the right side bar
- We updated all notifications and email messages to improve the content and make them look much nicer
- We have made significant backend updates to improve performance, speed, and reliability across the web and mobile apps.
- The experience of adding topics to posts has changed. We no longer have a separate section dedicated to it. When you are deciding where to send your post to you will see all the chat room topics as options in the “To” field. This adds that topic to the post and makes it easy to send your post to multiple chat rooms, in multiple groups. You can still use any other topic you want in a post, by typing the # symbol followed by the keyword.
- Hylo will no longer create a chat channel for every Topic. Chat rooms are now created manually by a group steward. Chat rooms are still connected to a topic and any posts that use that topic in that group will appear in the chat room if it exists.
- When joining a new group, by default you will get a notification for each chat in the home chat room. For chats in other topics you only get notified if mentioned in them. To control your notifications, click the bell icon at the top of the chatroom to adjust settings.
- Hylo still has a separate user setting for each group about whether to get a notification for every non-chat post in the group. This is on by default. When turned off, then the user only gets notifications for posts in chat rooms to which they have subscribed. If a member participates in a chat for the first time, we consider that “subscribing” to the chat/topic and we turn on notifications for them for every post in that channel. Afterwards, this setting can be manually changed per chat room to mute/unsubscribe from the channel, or re-subscribe to it.
- Redesigned & Improved Email Digest:  The email digest will be streamlined to remove top links and highlight more useful information. The number of new posts in each chat room. New comments on posts in the group. New reminders, such as: Upcoming events in the next week, proposals closing this week, requests or offers that are closing this week, and highlighting currently open requests and offers. The digest will no longer show you chats and posts you created, and will also filter out chats you have already seen.
- Access Group Settings by clicking the gear icon in the group header.
- The hylo tour has been removed for now.
- Pinning posts to the stream has been removed for now. You can pin posts to the group menu instead.
- New group creation flow.
- Moderation actions has been moved to its own view. THe decisions view is now called Proposals and only shows proposals.
- Moved most of our icons to use the Lucide icons library.
- Support longer filenames for attachments
- Removed the Explore page
- The Public space is now called The Commons.
- Improved Datetime picker for posts
- Setting a start time for an event automatically adds a default end time an hour later
- Start using Tailwind CSS for styling
- Start using Shadcn UI components throughout the app
- Update to React 18
- Pressing enter in a chat box creates a newline, press option/alt-enter to send the chat or post
- Chat post email notifications are sent in a digest every 10 minutes instead of instantly for every post

### Fixed
- When clicking on a notification for a chat, scroll to that post in the chat room
- Fix receiving real time posts after switching chat rooms

## [5.11.4] - 2024-01-14

### Fixed

- Bug causing blank posts. It would happen which clicking on a notification about a comment on a post, then closing the post. This wouldn't clear out the /comments part of the URL. So then clicking on the next post would create a weird URL with /comments stuck in the middle

## [5.11.3] - 2024-01-12

### Fixed
- Clicking on a mention or topic in a post
- Tooltips on proposal votes
- Remove random 0 at the bottom of proposal options
- Flagging of public posts

## [5.11.2] - 2024-01-06

### Fixed
- Commenting on a comment in the mobile app

## [5.11.1] - 2024-01-03

### Fixed
- Viewing public group explorer when not logged in

## [5.11.0] - 2024-12-17

### Changed
- Improved peformance and reliability of Chat Rooms. It more accurately tracks the last post you read, and scrolls to it when you come back. New posts appear more quickly. There should be less bugs.
- Improve our @mentions significantly: Works with spaces in names! Loads more people as you scroll down! Slightly improves search results coming from the backend.
- Improved blurring of flagged posts in various views, and include images in the blurring
- Use satellite with streets map view for group boundary map
- Avoid rendering proposal options in the map drawer
- Now developing and deploying from a new hylo monorepo!

### Fixed
- Fix bug where people are asked to answer join questions even after having answered them when requesting to join
- Fix bug where reactions view on user profile was not working
- Moderation action notifications are working now
- Fix incorrect child post indicator in public events stream
- Fix adding default topics to a group

## [5.10.0] - 2024-10-02

### Added
- Community Moderation version 1: When flagging an innapropriate post or comment, you are now required to say why you flagged it, and connect it with one or more group or platfom agreements that it violates. Moderated posts are blurred out in the stream. Moderators are notified and can decide whether to clear the flag or delete the post, or leave it blurred. Moderation decisions are logged under Decisions -> Moderation.

### Fixed
- Blank screen when viewing the RSVPs to an event

## [5.9.2] - 2024-09-19

### Added
- Display a message when a post or comment has been edited that includes the time of the edit
- Mousing over a post created or edited timestamp shows you the exact time the post was created or edited

### Changed
- Events show the summary of the event in the card, like other posts
- prevent ImageCarousel opening from PostCard view

### Fixed
- Squished avatars in @ mention list
- Move image carousel prev arrow into visible area

## [5.9.1] - 2024-07-31

### Fixed
- Bug that prevented editing chat posts
- Invalid post warning when changing post types
- Sometimes after requesting to join a group and being accepted in you would have to answer the join questions a second time
- Bug when clicking on a post from a notification
- Bug that prevented viewing public group landing page

## [5.9.0] - 2024-07-23

### Added
- __More powerful Roles & Responsibilities__: Groups can now have roles that have specific responsibilities, and members can have multiple roles in a group. Roles can be assigned to members by group Coordinators (described below). There are 4 built in System responsibilities: Administration (super admin that can do everything and change all group settings), Manage Content (can remove posts from the group, and edit the Explore page), Remove Members (boot members from the group), and Add Members (full access to the invite and join request functionality for the group).  There are also 3 built in Common Roles that all groups have: Coordinators have full Administration powers, Moderators can Manage Content and Remove Members, and Hosts can Add Members. Groups can also add custom roles with custom responsibilities defined by the group, or custom roles that include the system responsibilities.

## [5.8.0] - 2024-07-03

### Added
- New post type: Proposals! Proposals are an easy, flexible way to suggest a change or idea to a group, ask for advice, run a poll, or make any kind of group decision. Proposals can be created by anyone in the group, in the same way as other posts, and can be edited and deleted by the creator. Proposals can be voted on by group members, and everyone can see who has voted and how they voted (except on anonymous proposals). The creator can also close the proposal, which will prevent any more votes from being cast, and share the outcome. There are different proposal templates built in for decision processes like Consent, Consensus, Polls, etc. but you can also customize them fully.

## [5.7.6] - 2024-06-04

### Added
- Post images now open in a carousel, instead of in a separate window

## [5.7.5] - 2024-03-18

### Fixed
- Hard to read bold text on Safari
- A potential crash when posting a chat in topic based chat room

## [5.7.4] - 2024-03-16

### Added
- New post menu item to duplicate a post

### Changed
- Improved error messages in post editor

### Fixed
- Deleting images from a post

## [5.7.3] - 2024-03-04

### Added
- Notifications displayed on desktop when Hylo is run through the new Electron based Desktop app! Only tested on a mac so far. Dock badge count also updated as notifications come in or are read.

## [5.7.2] - 2024-02-20

### Added
- New setting to receive a notification for every post in your groups. This is set to only receive "important" post notifications by default, which includes Announcement posts, and posts you are mentioned in. You can change the setting to All posts or None in the Notifications settings page. Also improved the text of various notifications.
- Internationalization/language support of the Signup/Login page

## [5.7.1] - 2024-02-14

### Changed
- Maximum post title length increased from 50 characters to 80 characters

### Fixed
- Stuck on Jump In modal when trying to join a group that doesn't have join questions set

## [5.7.0] - 2024-02-05

### Added
- Group Agreements: Groups can now have agreements that members must agree to when joining the group. Each agreement has a title and description, and newly joining members must agree to them before they are let in. If agreements change then the member will be asked to agree to the newly changed agreeements.
- You can now require Join Questions for Groups that are set to Accessibility = Closed or Open, no longer just for Restricted groups. Join questions are asked after someone joins the group and before they are let in.
- About Us panel now accessible on every view of the group, not just the Explore page

### Changed
- When inviting someone to a group that has Join Questions new members are now asked to answer the join questions before being let in to the group even when invited by join link or email address.

## [5.6.2] - 2023-11-27

### Added
- New support menu which opens Intercom for Feedback & Support, links to our user guide, and has other support related links.

### Changed
- Set max file/image attachment size to 50 MB and enforce limit in file picker and tell user about the limit there too
- Move locale menu into the use menu under the user avatar.
- Removed Facebook login

### Fixed
- Greencheck script tag

## [5.6.1] - 2023-11-11

### Added
- Instructional tooltips in several places explaining things like why you can't create a post if you havent filled out the title or added a group.
- Script tag when logged in to Hylo that can be used to add your profile to Greencheck via their bookmarklet.
- You can now format and add links to your user profile bio using Markdown!

### Changed
- Notifications for new chats take you to the chat room on mobile, scrolled to that post, instead of opening the post itself.
- The placeholder text for the title field when creating a post is now "Add a title". Also changed the text at the top of the stream in the create post box from "What's on your Mind?"" to "click here to start a post".
- Optimization: When loading post topics don't load topic.postsTotal and followersTotal. This will speed up loading of posts in chat rooms, and across the app.

### Fixed
- Positioning of Groups input in the create post modal when no groups are selected.
- Don't show blank box on group details if purpose and description both empty.

## [5.6.0] - 2023-09-23

### Added
- A purpose field to Groups. This is a free form text field that can be used to describe the group's purpose, mission, vision, etc.

## [5.5.6] - 2023-09-19

### Added
- Ability to change notification settings and unsubscribe from all notifications from links in emails that still work even when not logged in.

## [5.5.5] - 2023-08-09

### Added
- MVP of timezone support for posts, for now just always use the current user's timezone when creating a post

### Fixed
- Crashing error (blank screen) after using the person suggestion autocomplete feature and then changing views
- Crashing error when loading projects page
- Crash when changing post type in post creation model when a non-english language is selected

## [5.5.4] - 2023-06-15

### Fixed
- Editing a post was causing a blank screen

## [5.5.3] - 2023-05-27

### Fixed
- Mispelling of Discussion in create modal
- Fix display of member posts on user profile
- Group Details page:
  - Always show privacy settings in main body, instead of ugly, random text describing accessibility setting
  - Hide Posts and members in body for now since we never show anything there
  - Move member count to header
  - Add header text asking people to answer join questions
- Fix closing about info pane from Explore page

## [5.5.2] - 2023-05-27

### Fixed
- Don't lose map filter when closing a post in the map drawer
- Fix display of map when not logged in and hideNav is on

## [5.5.1] - 2023-05-18

### Fixed
- Correct routing for public posts when viewing while not logged in. All post URLs will now redirect to https://hylo.com/post/:postId
- Remove all ways one could try to interact with a public post when not logged in
- Fix close button when viewing a post at https://hylo.com/post/:postId
- Fix viewing member profile of currently logged in user outside of a group context, i.e. at url https://hylo.com/members/:id

## [5.5.0] - 2023-05-12

### Added
- Beta of Internationalization support! First pass of translation into Spanish. Users can select their language using a new menu item, and that will be saved for the future.

### Fixed
- Fix close button when viewing posts or groups when not logged in and looking at the public map or group explorer

## [5.4.2] - 2023-05-04

### Added
- Show badges next to moderators in group sidebar
- Send button to all comment forms

### Changed
- Tweaked styling of group cards so they are not too big and show first two lines of description

## [5.4.1] - 2023-04-13

### Fixed
- Duplicate topics appearing in topic selector.
- Order of topics in topic selector now correctly showing more popular ones at the top
- Get Hylo working in iframes in Safari (requires using Storage Access API)

## [5.4.0] - 2023-03-15

### Added
- New group Roles and Badges! Admins can add roles/badges which are an emoji and a name, and then attach them to group members. These appear next to the member's name everywhere in the group.

### Changed
- Stop showing group topic pills in group explorer for now
- Hide childPost toggle when appropriate, in mapExplorer

### Fixed
- Posts with images have link to the first image covering the whole post, so you can't click on links in the post
- When not logged in and viewing a /groups/* page either show the public groups page for public groups, or redirect to login, instead of redirecting to the public map
- When redirecting to /login for non public group or post make sure to include correct returnToUrl

## [5.3.5] - 2023-03-04

### Added
- New product categories for farms: grains, other_row_crops

### Changed
- Small styling tweaks to notifications, selected comments, and post details

## [5.3.4] - 2023-02-15

### Added
- New Mixpanel events to track full Signup funnel, Event RSVPs and Post opens
- Track the group(s) associated with every user and every event in Mixpanel. This paves the way for group admins to have access to group analytics through Mixpanel

## [5.3.3] - 2023-02-14

### Fixed
- Double chat creation when enter is hit twice quickly
- Editing a chat post would cause it to disappear

## [5.3.2] - 2023-02-08

### Changed
- Allow for Skills & Interests with spaces and up to 30 characters

### Fixed
- Bug viewing direct messages when there's one from a deleted user
- Don't show location twice on event cards

## [5.3.1] - 2023-02-03

### Changed
- More improvements to <title> tags for various pages in Hylo
- Post cards appear with a max width in chat rooms so they dont take up the whole screen

## [5.3.0] - 2023-01-30

### Added
- Support for oAuth Authorization Code flow!
 - Skip login screen for already logged in users, but still get new auth code from the server.
 - If prompt = consent always show the Consent screen even when already have given consent previously.
 - Display previous auth message if person has previously authed with Hylo
 - Display when an app is asking for offline_access

## [5.2.0] - 2023-01-20

### Added
- My Home context with 4 new views: __My Posts__ to see all posts you created, __Interactions__ to see all posts you have commented on or reacted to, __Mentions__ to see all posts you have been mentioned in, and __Announcements__ to see all announcements made in all groups you are a member of.
- A toggle to turn on or off the aggregated display of posts from child groups, that you are a member of, in the stream of the parent group
- Visual display to indicate which posts appearing in the stream are being aggregated from child groups (that you are a member of)
- Link to our Open Collective called Contribute to Hylo added to top nav menu

### Changed
- Mentions of the current logged in user now display as a different (yellow/orange) color than other mentions
- Update farm product categories ontology list to include "Other"
- Improved styling and user experience for notifications settings page

### Fixed
- Display of public map for non logged in users
- As a non-logged in person, navigating to a link for a public post that includes the group context now correctly displays the post

## [5.1.2] - 2022-12-29

### Changed
- Prevent changing user name to blank in the user settings

### Fixed
- Infinite attempts to load more comments when viewing a post
- Inability to scroll down in navigation drawer when a post is open

## [5.1.1]

### Added
- First pass at more descriptive meta tags for various Hylo pages. New page titles will appear in browser tabs, search engines and link previews in other platforms.

### Changed
- Clicking on a "new post in #topic" notification takes you to the topic room
- Don't allow for showing chat posts in custom views

### Fixed
- Minor fixes to comment interface
- Don't show Chat as a post type option in create post modal
- Don't add new chat posts to the Stream

## [5.1.0]

### Added
- Topic streams are now Slack like chat rooms! You can do quick posts without a title, and scrolling happens from the bottom up, and it tracks the last post you read and takes you to that location when you come back.
- Emoji reactions on comments
- Clicking on a comment notification takes you to that comment in the post and highlights it
- Public group pages can now be viewed by non-logged-in users

### Changed
- Emoji reactions replace votes on posts
- Show custom create post prompt when filtering stream by Resource

## [5.0.6]

### Changed
- Adds Android AppLinking config file to `public/.well-known/assetlinks.json`
- Updated favicon

## [5.0.5] - 2022-11-23

### Fixed
- Newly created posts appear immediately in stream, as well as projects view and upcoming events view if appropriate
- Show post details when opening one from a topic stream in the /all context
- Make sure collection posts appear in Custom View settings

## [5.0.4] - 2022-11-23

### Fixed
- `CommentEditor` in HyloApp not expanding height after selecting Mention or Topic (HyloReactNative #614)

## [5.0.3] - 2022-11-16

### Added
- `groupDescription` is now "autolinked" making external links added in the markdown clickable, including proper handling of Hylo links, mention, and topic links (via application of `ClickCatcher`)
- Terms and Privacy Policy links added to Signup page

### Fixed
- Styling of `groupDescription` to eliminate extra vertical space between paragraphs
- Back button behavior in the case of `LandingPage` > "About Us"
- Unexpected underline appearing in some links in mobile
- Sticking hover state color on MapExplorer buttons in mobile

### Changed
- Added default of `all` to `groupSlug` prop of `ClickCatcher`, doesn't change current behavior
- Removes now unused `navigation#removeGroupFromUrl`

## [5.0.2] - 2022-10-27

### Changed
- Navigating from one group to another no longer stays on the same view you were looking at (explore, map, member directory...) it instead always goes to the new group's home page which is the Stream. This is a response to feedback from many folks that it was confusing to change groups and stay on the same view.

### Fixed
- Bold text in a post now actually looks bold
- We now currectly show the current context in the navigation drawer

## [5.0.1] - 2022-10-24

### Fixed
- Update `hylo-shared` to fix bug in Mention HTML generation

## [5.0.0] - 2022-10-24

### Added
- "Featured" feature such that link previews which are a video can optionally (by default) be presented atop a Post as a embedded playable video
- `HyloEditorMobile`, a WebView-targetted version of `HyloEditor` now used in the Post and Comment editors in HyloApp
- Refactors `TopicSelector` to be less confusing and ready to support filtering across multiple `groupsIds`
- `react-icons` allowing ad hoc use of common open source icon packs (using some FontAwesome icons for editor, etc)
- `*.css` files now recognized by WebPack and processed through CSSLoader, but not the SASS or PostCSS loaders
- Minimal TypeScript support (WIP)
- Post "Collections" to enable CustomViews that are curated sets of posts. Admins can add Collection CustomViews in the new Custom Views section of the Group Settings. Collections can be set to be "manually" sorted and then posts can be reordered by drag and drop.
- CustomViews of type 'post stream' can now specify a default view mode and sort but these can be changed by the user when looking at the Custom View.
- Add post stream search/filter feature. Click on the magnifying glass to enter a search term and filter any view of posts by that text.
- Add 'Abusive' as reason to flag a post

### Changed
- `HyloEditor` moves to being TipTap-based from draft-js and adds full-suite of rich text editing features
- Improves general Link Preview retrieval and display
- Link/`a` navigation handling within content is now now more consistent throughout
- Consolidates and normalizes ad hoc HTML parsing and presentation of `Post#details` and `Comment#details` (etc) and moves to backend
- Uses `HyloHTML` wrapper component for all cases where `dangerouslySetInnerHTML` was used previously
- BrowserList config changes to "default" (ref. https://github.com/Hylozoic/hylo-evo/pull/1258/files#r991717480)
- Patch and minor npm module dependency updates
- Topics stream and Projects view all use the same Stream component so they now have full Stream controls like sort and view mode
- Updated react-dnd to latest version and update AttachmentManager to use latest react-dnd.

### Fixed
- Fix display of group search menu so it isn't half covered
- Clicking on # people commented in post card opens the post details
- Fix error message when trying to create an invalid Affiliation

## [4.1.2] - 2022-09-15

### Fixed
- Bug that prevented editing a Project with an empty donation link or project management link
- Styling of donation and project management links for unknown websites
- Viewing of /post/:id URLs while logged in

## [4.1.1] - 2022-09-07

### Fixed
- Breakage when a farm has an unknown certification, instead just display it as its user entered data
- Styling of comments in activity section of user profile
- Remove group to group join request upon accepting it

## [4.1.0] - 2022-08-19

### Added
- Add Custom Views to the navigation bar for groups. These can either be a link to an external URL or a filtered view of posts in the group.
- Add a Project Management Link and Donations Link to Projects which display uniquely on Project posts. These use custom icons for certain websites like Trello, Asana, GitHub, PayPal, Open Collective and more.
- You can now view public posts even if not logged in to Hylo.
- Small and large Grid views for the Stream.
- Link to resend verification code on the verify email interface in case the first one did't come through or expired.
- New item in post menu to copy the post's current URL to the clipboard.

### Changed
- Many style improvements to posts to make them easier to read and interact with. Reorganized various information to make it easier to find
- Cleaned up style of search page
- Change the icon for the button to message someone from their profile to match the chat icon used elsewhere in the app
- Better handling of broken invite links for logged in users
- Increased visibility, readability, content density throughout the app
- Left navigation menu scroll behavior change, now the whole menu scrolls instead of just the topics
- Updated post cards to have better visual hierarchy, and to make it easier to see the content. Reorganized the header and footer.
- Updated the members page styles to bring it in line with other new styles, including updating the search input and giving the cards a shadow.

### Fixed
- Bug that could unset a location or group area polygon when saving group settings
- Setting of prerequisite groups
- Editing of welcome message on Explore view.

## [4.0.3] - 2022-07-05

### Added
- Ability to draw a region/area for a group to define its boundary. This region will display on the map when inside a group (not the publc map).
- Extended Collaboration options for farm groups

## [4.0.2] - 2022-06-11

### Added
- Hylo App WebView events/interface to `GroupDetail` and related components

### Changed
- Behaviour of "Opportunies to Connect" on Group Detail to create a New Message via Moderator personIds

## [4.0.1] - 2022-06-08

### Changed
- Mixpanel instance is moved out of Redux and Mixpanel identification is move into a `useEffect` on `AuthLayoutRouter`
- Hide showMore if not needed for farm details
- Redirect /public/groups to login screen

### Fixed
- Fixes: hylo.com takes users to static landing page, even if they are logged #1207
- Border radius on post type button on post editor

## [4.0.0] - 2022-05-24

### Added
- Our first custom group type - Farms! Right now farms can only be created through our API integration with OpenTEAM, by onboarding a farm through a SurveyStack survey using the Common Onboarding question set developed in relationship with OpenTEAM.
-- Display unique farm data from these common onboarding questions in a farm group's About/Details page
-- Add farm specific searching and filtering to the Group Explorer
- Add a widget for messaging all the moderators of a group you are not a member of so you can reach out about collaborating with that group. This also pre-fills a message based on the type of collaboration the person is looking for.
- Add a widget to display a group's location and posts on a map on the group details page
- UI supporting the oAuth 2.0 flow for Sign in With Hylo functionality
- Group setting to hide the custom "extension" data for custom group types like farm from the public.
- Ability to change the base layer of the map to several options including satellite and street view. This selection will be remembered across page loads.
- Ability to display indigenous territories as a layer on the map using data from native-land.ca
- New group setting to obfuscate a group's location on the map. Options are precise (show exact location), near (show location offset by a slight amount and display a location string that only shows city, region & country) or region (don't show a location on the map at all, and the location string shows only city, region & country). Group moderators always see the precise location and location display string.
- Add a group setting for an About Video which if it is a YouTube or Vimeo link displays the video embed above the group description in the about/details page/panel
- New group settings to change the word (and plural word) used to describe a Moderator within the group.
- New group setting to change the word used to describe the group type in the app. This cannot actually be set manually yet, only via the API.
- Added top level menu items to navigation drawer for Public Groups (Group Explorer) and Public Map and changed Public Groups & Posts to be Public Stream
- Click to create post from map now works in Mobile app

## Changed
- All Privacy & Access related group settings moved into their own Settings tab.
- Clicking add item to map a second time deactivates the add mode.

## Fixed
- Show all child groups when looking at the map within a group

## [3.6.0] - 2022-04-28

### Changed
- Major refactor of authorized vs non-authorized routing, see `RootRouter`, `AuthLayoutRouter`, and `NonAuthLayoutRouter`
- React Testing Library (RTL) setup simplified and notated

### Added
- Changes to authorization and authentication flow to accomodate related API changes
- Adds new RTL-based tests for new and existing components
- You can now click on the map to create posts at that location. Either click and hold for a couple seconds, or click the (+) button and then click on the map to add a post at that lat,lng on the map.
- Discussion posts now can have a location and appear on the map

### Fixed
- Date/time selector in posts always visible, never disappears below the screen

## [3.5.2] - 2022-03-28

### Fixed
- Display of member counts on groups in the create post modal
- Correctly display notification settings for new groups that have just been created

### Changed
- Update License to be GNU AGPLv3
- Sort groups alphabetically on notifications settings page

## [3.5.1] - 2022-03-15

### Fixed
- Can once again select suggested skills when joining a group that has that feature turned on

## [3.5.0] - 2022-03-08

### Added
- Bold and Italic inline formatting pop-up to Post Editor
- Make PostEditor in CreateModal cancellable with Escape key
- Adds minimal optional chaining support through `@babel/plugin-proposal-optional-chaining` (e.g. `thing1?.thing2` replacement for `lodash.get('thing2', thing1)`)

### Changed
- Updates PostEditor to automatically open a new `<p>` after an empty linebreak and always a `<br>` on entry of a Shift-Enter
- Move to re-written `hylo-shared` from `hylo-utils`
- Major version updates to `draft-js`, `draft-js-plugin-editor`, and related plugins
- Removal of extraneous and destructive input HTML sanitization (santization should on retrieval of content from API)
- Minor version updates to `babel`, `eslint`, and related dependencies including some relate configuration updates
- Handling of text preview in Messages and Notification dropdowns
- Treat Message.text as HTML (Comment#text is a backend sanitized HTML field)
- Code formatting: component returns and optionals (`(thing && ... <SomeComponent />))`) wrapped in `()` with linebreaks and related indentation on most components touched

### Fixed
- Linebreak handling between post editor and display for posts, comments, and messages
- Position of Mention and Topic selectors to low within PostEditor
- Numererous small text and links-in-text handling bugs

## [3.4.0] - 2022-02-23

### Added
- Tabs in the map drawer to see Groups and Members on the map separately from Posts.
- Ability to hide/show Groups on the map.
- Can sort map drawer posts by post date.
- Map parameters, including the center location and zoom, are now added to the URL as they change so you can copy and share an exact map URL with someone.

### Changed
- Load more posts on the map, more quickly.
- Searching on the map filters groups and members as well as posts.
- When adding people to a message, pressing enter without entering text first will jump straight to the message box.
- Searching on the map now ignores case.

### Fixed
- Searching for and jumping to a point location (like an address) on the map.
- When you have data in the create post modal and close it or click off of it, we now ask if you are sure whether you want to closed the modal or not before you lose the entered data.
- When creating a post in a topic stream add that topic to the post by default and stay in the current group/context.
- Allow for editing/deleting sub-comments on other people's comments.

## [3.3.0] - 2022-02-03

### Added
- Many improvements to Messages experience:
-- Render names of people in a message groups as links to user profiles
-- Only show people selector when focus is on the Add Person box
-- Make it more obvious when focus is on the Write Something box
-- Allow for using arrow keys to select a person without having to first type something
-- Add hover styling in thread list
-- Make it more obvious which current thread is being viewed
-- Names in the messages header are links to their profiles
-- Filter deleted users out of message contact lists and mentions suggest
- Added GraphQL config files for dev tools

### Changed
- When clicking on a group on the Groups page go to that group's Home, instead of going to that group's Groups page
- Switched to Node 16

### Fixed
- While loading messages view show Messages header immediately instead of weird All Groups context header

## [3.2.9] - 2022-01-25

### Fixed
- Crash when going to /settings/notifications and trying to change the setting for a group

## [3.2.8] - 2022-01-23

### Added
- WebPack bundle analyzer. To analyze bundle `yarn build` and once complete `yarn analyze`

### Changed
- Lazy load Messages and Notifications top menu items to improve initial load time and rendering
- Replaced deprecated node-sass dependency with sass (Dart SASS)
- Move to Node 16
- Change faker dependency used in tests, and remove deprecated feature that was causing it to be included in production bundle
- Clean-up package.json
- Minor WebPack optimization config changes

## [3.2.7] - 2022-01-22

### Fixed
- Remove extra whitespace on right side of Map on full browser windows

## [3.2.6] - 2022-01-21

### Changed
- Improve initial app load time: remove extra fields from current user query and parallel load current user alongside current group

## [3.2.5] - 2022-01-18

### Changed
- Minor tidy and refactor of mobile device checking code

### Fixed
- MapExplorer drawer hide mobile check corrected so that drawer shows again in web

## [3.2.4] - 2022-01-17

### Changed
- Hide MapExplorer drawer by default on mobile browsers and in Hylo App embed
- Allow MapExplorer Saved Searches navigation to happen when in Hylo App embed
- Fix hover state for MapExplorer on touch-based devices

## [3.2.3] - 2022-01-14

### Fixed
- Map styling fixes related to nav-less layout used in the embedded Hylo App WebView
- Changes login text entry field to "email" from "text" to keep auto-capitalization off in some browsers

## [3.2.2] - 2022-01-13

### Changed
- Added needed mobile app layout modifications to MapExplorer
- Added route interception to MapExplorer when in mobile app context
- Added HTTPS to MapBox API URL

## [3.2.1] - 2021-12-29

### Changed
- Cleanup display of post start and end times to be easier to read - don't uppercase text, better syntax.
- If a post was "completed" before it ended show the end date as the date it was completed
- Improve copy for comment box placeholder

### Fixed
- Fix issue where posts without a start/end time would always show as ENDED
- Make sure you can see the dropdown to block a member

## [3.2.0] - 2021-12-17

### Added
- New signup/registration flow that includes email verification, password confirmation and in general better security practices.
- You can now deactivate or delete your account from the Settings -> Account page.
- You can now use Markdown when editing the welcome message on the explore page for your group. This means links will work as well.

### Changed
- Attachments on posts now display in a list instead of a row so you can see any number of attachments. Previously you could see only the first 6 or so.

### Fixed
- Editing welcome message on explore page updates the widget instantly.

## [3.1.11] - 2021-12-3
### Fixed
- Display of map icons on latest safari
- Inviting people to public events

## [3.1.10] - 2021-12-2
### Added
- Display timezone for datetimes in requests, offers and resources
- You can now specify locations for people, groups and posts as coordinates
- Scrolling will now show more suggested event invites

### Fixed
- Saving your individual or group settings could erase your location from the map
- Hylo URLs in posts that dont have www at the front will correctly load in the same tab instead of opening a new one

## [3.1.9] - 2021-11-2
### Fixed
- Only most recent 2 child comments appearing in a comment thread

## [3.1.8] - 2021-11-1
### Added
- Add Layout Flags context to capture the `layoutFlags` query param and make it available in React context as `<layoutFlag>Layout`
- Switch on/off site header and footer for `mobileSettingsLayout`
- Update and normalize Group Settings area UI, optimizing for small/mobile screens

## [3.1.7] - 2021-10-26
### Added
- Contributor guide and code of conduct to the repo

### Changed
- Clicking on link to a Hylo post from a post loads in same tab not new one
- Update user Affiliations settings tab to say Groups & Affiliations

### Fixed
- Resetting of unread counts when viewing a group and a topic
- Scrolling list of people who have responded to an event

## [3.1.6] - 2021-08-31
### Added
- Ability to pass in a group name and slug as URL parameters to group creation modal

### Fixed
- Signup with social logins works again
- You can now export data from large groups. The exported CSV file will be sent in an email.
- Hylo links in posts now load that link in the same tab not in a new tab
- Bug loading posts on member profile page
- About button on Explore page stays on Explore page instead of going to Stream

## [3.1.5] - 2021-08-04
### Changed
- Events view now show Upcoming events in start time order and has an option to show Past events in descending start time order.

### Fixed
- (Un)subscribing to a topic from a topic feed banner

## [3.1.4] - 2021-07-08
### Added
- Show timezone for an event's start and end time
- Support local development with SSL

### Changed
- Switch back to the stream being the home page for groups. Show Explore page on the first time viewing a group.

### Fixed
- Editing a post deleting its images

## [3.1.3] - 2021-05-06
## Changed
- Longer group names on mobile

### Fixed
- Fixed editing posts on mobile web
- Fix bugs related to navigation menu on mobile

## [3.1.2] - 2021-04-30
## Changed
- You can now start typing a topic with a # and it will correctly create the topic or autocomplete existing topics
- Make join questions required before you can join a group

### Fixed
- Bug that prevented clicking on a comment to edit it at that locaion
- Broken links to posts in emails
- Bug when landing on a group page as a brand new user
- Placeholder text scrolling on top of post header

## [3.1.1] - 2021-04-21
## Added
- GDPR cookie notice when signing up for Hylo.

## Changed
- Allow for group names up to 60 characters.
- Show moderators on group about panel.
- Improved default group welcome message on landing page.

### Fixed
- Immediately navigate away from a post after deleting it.
- Immediately update the landing page when editing a post, deleting a post, or removing a post from the group.
- Correctly enable/disable ask join question form in group settings.
- Sometimes crashing bug when creating a new message.
- Style tweaks on group landing page.
- Show correct welcome tour steps on mobile and desktop.
- Show group welcome modal before showing tour.
- Dont show welcome modal twice if closed quickly.

## [3.1.0] - 2021-04-16
### Added
- __New group home page__: Groups now have a landing page that shows customizable widgets displaying recent announcements, recent posts, open requests and offers, upcoming events, recently active projects, recenty active members, sub-groups, and a customizable welcome message. Moderators can hide widgets for their group if desired.
- __Customizable post stream__: The post stream is now a separate view and has a compact list view on top of the current card view. Also the sort and post type filter settings will be remembered across groups and refreshes.
- __Prerequisite group__: If a moderator adds these to a group that means the prerequisite groups have to be joined by a user before they can join the original group.
- __Suggested skills__: A moderator can now add suggested skills & interests in a group's settings. These will be displayed on the group join form - when a user is requesting to join a group they will be shown the suggested skills and can select which ones are relevant to them. If a user is invited to a group then this join form with suggested skills will popup when they first land on the group.
- __Group to Group Join Questions__: Moderators can add join questions in the group settings that get asked when another group is requesting to join it as a child group. The answers appear in the Related Groups page for incoming group join requests.
- Add Group Network Map Visualization to Groups View
- Group moderators can now export the member directory for a Group to a CSV from a new Export Data group settings tab.

### Changed
- Added a new menu button in the top nav to open the navigation drawer. Now clicking on the current context/group icon or name in the top nav will go back to the Home page for the current context.
- Better style for Group Settings link in the group sidebar.
- When changing contexts or views we scroll back to the top of the page.
- Added group banner image to navigation drawer.
- Increased contrast between read and unread notifications.

### Fixed
- Issue that sometimes caused group join button to not be visible on group details on small screens.
- RSVPing to events on mobile web.
- Ability to add Facebook, Twitter and LinkedIn URLs to profile

## [3.0.2] - 2021-04-08
### Fixed
- Fixed issues saving and viewing Saved Searches on the map
- Fixed viewing join requests settings page
- You can edit comments once again
- Closed groups don't show request to join button

## [3.0.1] - 2021-04-07
### Fixed
- Issues on the Groups page where we would incorrectly show a person having requested membership in a group or not show that they had requested membership
- Make sure new posts appear in the stream immediately
- Join questions now correctly appearing when trying to join a group that has them specified

## [3.0.0] - 2021-04-02
### Added
- __Holonic Architecture!__ You can now add infinitely nested groups within groups within groups. And groups can have multiple "parent groups" too. This is the beginning of truly enabling us to map and connect complex organizations and ecosystems and how groups of all kinds work together.
- Added a new Groups page in the group nav menu that shows all the "parent" groups and "child" groups of the current group.
- Looking at a group's stream will show you all the posts to that group + all the posts to any descendant groups that you are also a member of
- When looking at the map for a group you will see the group itself on the map plus all descendant groups.
- __Group relationship invites/requests:__ Groups can request to join other groups or invite a group to join them, and these invites/requests can be canceled, accepted or rejected by moderators of the other group. This all happens from the new group settings page "Related Groups".
- __Group Join Questions:__ groups can now have questions that must be answered when a person is requesting to join the group. These are set up in the group settings page, and the form with the questions to answer shows up anywhere we show a Request to Join button to a user (when they are looking at a group they are not a member of that they are allowed to join because the accessibility setting is Restricted.)
- __Manage Invites & Requests__: New user settings page for Invites & Requests where you can see any current invites and requests to join a group and cancel, accept or reject them.
- __Inline Comments:__ Comments can be nested undearneath other comments.
- __Create Button:__ New button in the group navigation menu to create a post or a group within the current group.
- __Tour__: A tour for new users to introduce the basics of Hylo when you first join

### Changed
- Upgraded Projects to have location and times, appear on map, and show completion.
- Networks with communities in them have been converted into Groups with sub-groups inside them.
- The navigation drawer now shows a flat alphabetical lst of all Groups you are a part of.
- New group creation modal replaces the old community creation wizard. It now allows you to set the visibility and accessibility of the group as well as select one or more parent groups for the new group.
- Almost all of Hylo's routes have changed, in part to reflect the switch from communities and networks to groups, but also to make them more clear.
- Everywhere we show a list of groups we now sort them alphabetically. This includes in the group selector when creating a post, and in the affiliations lists on user profiles and in the user settings.
- The save button on the user and group settings pages now sticks to the bottom of the viewport so it is always visible and more clear when something needs to be saved.
- You can now create a Project or Event from the regular post creation modal instead of having to go to the Projects or Events section to do so.
- Much nicer signup wizard with welcome dialog that directs you to different things you can do
- Many small fixes and improvements to the UI on mobile web.

### Fixes
- Show posts in the public stream for users that dont have any groups yet.
- The notification when you are invited to an event now correctly links to that event

## [2.2.5] - 2021-02-01
### Added
- Link to Terms of Service and Privacy policy in the account menu
- React Testing Library (internal)

### Changed
- Upgrade Redux 3.x < 4.x (internal)
- Upgrade React Router 4.x > 5.x (internal)
- Upgrade Jest v23 > v26 (including enzyme, etc) (internal)
- Upgrade Node v12 > v15 (internal)
- Applies latest heroku-buildpack-nodejs (internal)
- Community Leaders now called Community Moderators in the community sidebar

### Fixed
- Not being able to turn on or off notifications for communities
- Initial load of Member Profile Edit takes too long #706
- Navigating to a topic from All Topics goes nowhere #747
- Navigating to a topic that doesn't exists goes into infinite loading state #744
- Avatar images not appearing for communities in the navigation drawer
- Error when trying to view profile of member you aren't allowed to see

### Added
- Removed Skills slide from account signup wizard.
- Added Terms & Privacy link to menu.

## [2.2.4] - 2021-01-12
### Fixed
- Don't allow posting of an empty comment.
- Not being able to turn on or off notifications for communities

### Added
- Add sections for a person's Hylo communities and other custom affiliations on their member profile
- Update settings page Affiliations to allow listing custom org affiliations

## [2.2.3] - 2020-12-16
### Fixed
- Adjusted signup wizard Skills slide so styles work on mobile web.

### Added
- Add events section to member profile, showing upcoming events the person is attending

## [2.2.2] - 2020-12-09
### Added
- Added Skills to Learn to user profiles

### Fixed
- Couldnt click Edit Profile button
- Bug with routing when clicking on a project from a user profile and then trying to close it

## [2.2.1] - 2020-12-05
### Added
- Projects section to member profile

### Fixed
- Adjusted signup wizard css to show Onwards button when creating an account on Hylo (web) while using a mobile device.

## [2.2.0] - 2020-11-22
### Added
- Add SavedSearches menu on MapExplorer and SavedSearchesTab in UserSettings. Users can view a list of their saved searches and delete a saved search from either of these locations. Users can create a saved search from the MapExplorer view.

### Changed
- Updates required for 1.4.0 hylo-node update and heroku stack-18
- Update Facebook and Google login and sign-up buttons to brand compliance #700
- Notification opt-in prompt covers saved searches too (in addition to communities)
- Fix editing of values on user sign-up and community create review screens (fixes #685)
- Remove editing of user name and email from Community Creation flow (fixes #579, #582)

## [2.1.9] - 2020-10-23
## Fixed
- Member Profile Action icons remaining in hover state after hover is gone
- Member Profile copy links copying object, not plain text
- Member Profile bio without tagline formatting

## [2.1.8] - 2020-10-23
### Changed
- New Member Profile layout including contact phone and email

## Fixed
- User profile changes being overwriten while editing

## [2.1.7] - 2020-10-14
## Fixed
- Fixes issue with returning signing-up users getting stuck on blank screen
- Pinned posts with Pin icon at top of feeds show once again

## [2.1.6] - 2020-10-10
### Added
- Adds contactEmail and contactPhone to Person

### Changed
- Improves Member Profile formatting
- Re-organizes Profile and Account settings and related menus items

### Fixed
- Returns to sign-up wizard on page reload if incomplete

## [2.1.6] - 2020-10-10
### Added
- Adds contactEmail and contactPhone to Person

### Changed
- Improves Member Profile formatting
- Re-organizes Profile and Account settings and related menus items

### Fixed
- Returns to sign-up wizard on page reload if incomplete

## [2.1.5] - 2020-09-28
### Changed
- Make it more obvious how to change avatar in settings, can now click on entire image to change it
- Improve text on toggle to make a post public to make it more clear what is happening

## [2.1.4] - 2020-09-12
### Added
When zoomed in enough show a label for features on the map

### Fixed
Make sure map drawer updates as viewport changes

## [2.1.3] - 2020-08-30
### Added
- Show a spinner while posts are loading on the map

### Changed
- Default to showing map drawer
- Don't show not working Members link in All Communities or Public contexts
- Make many less queries to the server while moving around the map

### Fixed
- Clicking on a post in the All Communities map view works now
- Opening map drawer shrinks map visible portion so it doesnt show posts that are not visible on the map
- When clicking to zoom in on a cluster on the map don't zoom to a location where you cant see the posts in the cluster
- Safari: Fixed gradient on about text for a community in the sidebar
- Extra whitespace in posts and comments everywhere
- Remove duplicate topics showing at network level in nav drawer

## [2.1.2] - 2020-08-19
### Added
- Beta verison of CSV post importing

### Fixed
- Bring upvoting back

## [2.1.1] - 2020-08-17
### Added
- Allow for viewing public map when not logged in to Hylo at https://hylo.com/public/map/. Can also filter the map by one or more network with the ?network=XXX query parameter

## [2.1.0] - 2020-08-14
### Added
- Show topics in Network and All Communities views
- Community Topic Management: admins can add default/suggested topics for their community which new members will be auto subscribed to and all users will see first when creating a new post. THey can also add pinned topics which appear at the top of the topic nav list and can hide topics from the all topics list for the community.
- Public community join requests. Users looking at a public community on the map can request to join it. This notifies the community admin and they can accept or reject the request. When a request is accepted the user is notified.
- Comment attachments: Images and files can added to comments.
- Can now jump to a location on the map through a new location search box.

### Changed
- Resources no longer require a location.
- Community members can no longer add a new topic to the community except by creating a post with that new topic.
