# Hylo Product Specification

This document describes **what Hylo is and how it looks and behaves for the people who use it** — every screen, flow, rule and piece of on-screen text — without reference to how it is built. It is intended to be complete enough that a team could rebuild Hylo on any technology and end up with a product that looks and works the same.

For how the *current* codebase implements these features (data model, API, source files), see the separate technical spec in [`../product-spec/`](../product-spec/README.md).

## Status

**Draft — style review.** Only the first two sections are written. Once the style is agreed, the remaining sections will follow the same pattern.

| Section | Status |
|---|---|
| [Signup & Login](signup-and-login.md) | Draft for review |
| [Creating a Post](creating-a-post.md) | Draft for review |

## How sections are written

- **From the user's point of view.** Each section walks through screens in the order a person meets them: what is on the screen, what each control does, what happens next.
- **Exact text.** Words that appear on screen are quoted exactly, in English. (Hylo is also fully translated into German, Spanish, French, Hindi and Brazilian Portuguese; a rebuild must offer all of these.)
- **Rules as rules.** Limits, validation and permissions are stated plainly ("a title can be at most 80 characters"), along with the message the user sees when they break one.
- **Look as well as behaviour.** Layout and visual treatment are described in plain terms (placement, relative size, emphasis, colour role). Exact colours, fonts and spacing live in a shared Visual Design section.
- **No implementation detail.** No database fields, APIs, libraries or file names. Third-party services are named only where the user can see them (e.g. "Continue with Google").
- **Notes for review.** Where today's product does something that looks unintended, the section describes the behaviour and flags it at the end so a decision can be made about whether a rebuild should copy it.

## Common terms

| Term | Meaning |
|---|---|
| Group | A community on Hylo. People join groups; content lives in groups. |
| Space | A sub-area inside a group with its own content and (optionally) its own membership. |
| Steward | A member with administrative responsibilities in a group. |
| Post | A piece of content of a particular type: Discussion, Event, Offer, Request, Resource, Project or Proposal. |
| The Commons | The public area of Hylo, visible to anyone, showing public posts and groups. |
| My Home | A person's own area: their content, mentions, saved posts and settings. |
