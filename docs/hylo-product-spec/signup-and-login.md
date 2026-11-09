# Signup & Login

How a visitor becomes a Hylo member, how members sign in and out, and what a brand-new member sees the first time they arrive.

**In this section**
1. The sign-in pages (shared look)
2. Signing in
3. Signing up
4. Resetting a password
5. The welcome wizard (first run)
6. Signing out
7. Where people land after signing in
8. Arriving from an invitation link
9. Cookie preferences
10. Rules & limits
11. Notes for review

---

## 1. The sign-in pages (shared look)

Every page a logged-out visitor sees while signing in, signing up or resetting a password shares the same frame.

**Background.** A soft, slowly drifting network of small green dots joined by thin green lines, over a pale white-to-mint gradient that deepens toward the bottom-right. The dots move gently on their own and do not react to the mouse. The background fills the window.

**Top bar.**
- Left: the horizontal Hylo logo, which links to the home page. A light version of the logo is used in dark mode.
- Right: a language menu labelled "Locale: " followed by the current language code and a flag (for example "Locale: en 🇺🇸"). Choosing a language switches the page immediately.

**Centre.** A single card, about 320px wide, centred on the page, with rounded corners and a soft shadow. The card holds the page's form.

**Under the card.** A smaller card with a prompt to switch between signing in and signing up (each page says what it shows), and below that a line with two links that open in a new tab: "Terms of Service" + "Privacy Policy".

**Form style.**
- Text fields have their label shown inside the field, a visible border, and a small × to clear the field's contents.
- The main button on each card is full width and uses Hylo's green when it can be pressed; it is grey and unclickable until the form is ready.
- Errors appear in a red-bordered box with a light red background, above the fields.

**The "Continue with Google" button.** Full width, Google blue, white text "Continue with Google", with a white circle holding the Google "G" on the left. It grows slightly on hover.

The browser tab title is "Sign in to Hylo" on the sign-in page, "Sign up for Hylo" on the signup page, "Reset your Hylo password" on the reset page, and "Hylo" elsewhere.

---

## 2. Signing in

**Card contents, top to bottom**
- Heading: "Sign in to Hylo"
- Error box (only when there is an error)
- "Email" field (focused when the page opens)
- "Password" field (pressing Enter here signs in)
- Centred link: "Forgot password?" → the reset password page
- Button: "Sign in" — disabled until both fields have something in them
- "Continue with Google" button

**Under the card:** "Not a member of Hylo?" with a "Sign Up" button.

**Signing in with email and password**
- On success the person goes to where they were headed (see §7). If they never finished signing up, they are taken to the step of signup they still need to complete (see §3.5).
- If the email and password don't match, the error reads: "Incorrect email or password. If you signed up with Google, log in with Google instead. Reset your password" — where "Reset your password" is a link to the reset page. The same message is used whether the email is unknown or the password is wrong, so the page never reveals whether an account exists.
- After too many failed attempts (see §10) the error reads: "Too many attempts. Please wait a few minutes and try again."

**Signing in with Google**
- Opens a small Google sign-in window centred over the page. When the person finishes, the window closes and they are signed in.
- If there is already a Hylo account with the same email address, the Google account is connected to it and the person is signed into that account.
- If there is no Hylo account, one is created on the spot using the name and email from Google. Because Google has already confirmed the email address, the person skips email verification, the agreements step and the name/password step, and goes straight to the welcome wizard (§5).
- If the person closes the Google window or Google returns no account: "Login was canceled or no user data was found."
- If that Google account is already connected to a *different* Hylo account: "This account is already connected to a different Hylo user. Log out and sign in with it instead."

**Deactivated accounts.** A person who deactivated their account can simply sign in again; this reactivates the account with no extra step.

---

## 3. Signing up

Signup has four steps: **email → confirmation code → community agreements → name and password**. A person can stop at any point and pick up where they left off later.

### 3.1 Step 1 — Email

- Heading: "Welcome to Hylo"
- Subheading: "Enter your email to get started:"
- Field: "Your email address" (focused; pre-filled when arriving from an email invitation)
- Button: "Create account" — enabled only when the text looks like a valid email address. Enter also submits.
- "Continue with Google" button (same behaviour as in §2)
- Under the card: "Already have an account?" with a "Sign in" button.

When submitted, Hylo emails a 6-digit code (and a one-click confirmation link) to the address and moves to step 2. If the address already belongs to an account, a code is still sent; entering it signs the person into that account.

If the email is not valid: "Please enter a valid email address."

### 3.2 Step 2 — Confirm email

- A "← back" link at the top-left returns to step 1.
- Heading: "Check your email"
- Text: "We've sent a 6 digit code to {email}. The code will expire shortly, so please enter it here soon."
- Six separate boxes, one per digit, each large enough for a single big character. The first box is focused. The box being typed in has a green border; filled boxes are tinted green.
- Link: "Resend code". After resending, a short-lived message "Email verification re-sent" appears above for about 10 seconds.

Behaviour:
- Typing the sixth digit submits automatically; the card shows a spinner while checking.
- Clicking the link in the email opens this page and confirms automatically, without typing.
- Wrong or expired code: "Invalid code, please try again". Expired or already-used link: "Link expired, please start over".
- Each code works once and expires 4 hours after it is sent. Requesting a new code cancels the old one.
- On success, the person goes to step 3.

### 3.3 Step 3 — Community agreements

A wider card (about 640px on larger screens, full width on phones), with a scrolling body and a fixed footer.

- An × in the top-right corner. Clicking it asks "We're almost done, are you sure you want to cancel?" Confirming signs the person out and returns them to step 1.
- Heading: "Hylo Platform Agreements"
- Subheading: "Please review and accept our community agreements to continue"
- Introductory paragraph:

  > You are warmly invited to be a part of this community! Our invitation to you is to come to the platform and its communities as a contributor and co-creator. We know you have a unique role to play in making this place more enjoyable and more useful for everyone. We ask all Hylo participants to commit to upholding our Code of Conduct & Cultural Norms and Terms of Use by consenting to the Hylo Platform Agreements. We are so happy you are with us on this journey. Welcome to Hylo!

  "Code of Conduct & Cultural Norms", "Terms of Use" and "Hylo Platform Agreements" are links to the corresponding pages on the Hylo website, opening in a new tab.

- Six pledges, each a bulleted paragraph in medium-weight text:
  - "I pledge to behave on Hylo in ways that contribute to an open, welcoming, and healthy community, and to support other members in feeling respected and appreciated."
  - "I will respect differing viewpoints and experiences, and work to find common ground and shared values with other Hylo members."
  - "I commit to learning from every interaction. I will listen to feedback, adapt, and embrace responsibility for mistakes as opportunities for growth."
  - "I pledge to share my voice, ideas, and skills in service to my group(s) on Hylo, recognizing that working together leads to better outcomes."
  - "If I see an opportunity to improve something on the Hylo platform or within my group, I will take action to make it better."
  - "I commit to upholding the Code of Conduct & Cultural Norms, and Terms of Use, and I agree to participate in accountability processes when necessary."
- Link: "View detailed agreements"
- Footer: a checkbox "I accept the agreements" and a "Continue" button that is disabled until the box is ticked.

### 3.4 Step 4 — Name and password

- Same × in the top-right as step 3.
- Heading: "One more step!"
- Text: "{email} was successfully added to your profile."
- Text: "Please enter a name and password to secure your account."
- Fields: "Name" (focused; pre-filled if Hylo already knows a name), "Password (at least 9 characters)", "Confirm Password" (Enter submits).
- Button: "Jump in to Hylo!" — enabled once the name has at least 2 characters (not counting spaces at either end) and both password fields have at least 9 characters.

If the two passwords differ: "Passwords don't match". On success the person's account is complete and they enter the welcome wizard (§5).

### 3.5 Resuming an unfinished signup

Hylo always sends a person to the earliest step they haven't completed:
- Email not yet confirmed → the confirmation-code page.
- Email confirmed but no name/password yet → the agreements page (even if they had ticked the box before).
- Account complete but welcome wizard not finished → the welcome wizard.

Visiting a later step directly simply redirects to the correct one.

---

## 4. Resetting a password

**Page**
- Heading: "Reset your password"
- Text: "Enter your email address and we'll send you an email that lets you reset your password."
- Field: "Your email address"
- Button: "Send reset email" — enabled only for a valid-looking email.
- Under the card: "Sign up" and "Sign in" buttons separated by "or".

**After submitting**, the page always shows (in green): "If your email address matched an account in our system, we sent you an email. Please check your inbox." — whether or not the email belongs to an account. If the request fails outright: "There was a problem with your request. Please check your email and try again." Typing again clears either message.

**The email** contains a one-click sign-in link valid for 4 hours. Following it signs the person in and opens their Account settings, where they can set a new password without entering the old one. An expired link returns them to the sign-in page with "Link expired, please start over".

---

## 5. The welcome wizard (first run)

Immediately after finishing signup, a new member sees a short three-step welcome. Until it is finished, every page in Hylo redirects back to it.

**Look.** A card about 360px wide, centred over a dimmed background, sliding in gently. It has rounded corners, generous padding, and a small step counter ("STEP 1/3") in the top-right. A footer holds a "Back" button on the left (except on step 1) and a continue button on the right. The continue button can always be pressed — leaving a step empty skips it — but it changes from an outline style to solid green once the step has been filled in.

**Step 1 — Profile photo** ("STEP 1/3")
- A large round preview of the person's current picture (a generic silhouette if they have none), inside a dashed circle, with a small upload badge at the bottom-right. Clicking the picture opens a file picker; a spinner shows while uploading, then the new photo appears.
- Title: "Upload a profile image"
- Text: "Almost done setting up your profile! Click the above profile icon to upload a custom profile image. Your profile image will be visible when you post or comment in groups."
- Continue button: "Next: Where are you from?"

**Step 2 — Location** ("STEP 2/3")
- A large map-pin illustration.
- A place-search field with the placeholder "Where do you call home?" that suggests matching places as the person types.
- Text: "Add your location to see more relevant content, and find people and projects around you."
- Continue button: "Next: Welcome to Hylo!"

Finishing this step completes signup. If the person was originally heading somewhere specific (for example, they followed an invitation link), they now go straight there and step 3 is skipped. Otherwise they see step 3. A welcome email is sent a couple of minutes later.

**Step 3 — Welcome** (no step counter)
- Title: "Welcome to Hylo!"
- Text: "We're glad you're here, {first name}. To get started, explore public groups and posts, or create your own group!"
- Four stacked cards, each with a small square picture on the left, a bold title and a one-line description. Each lifts slightly with a coloured glow on hover:
  1. Globe picture — "View the public map" / "Find out what's happening around you, and groups you can join" → the public map.
  2. Stream picture — "Public stream" / "View and participate in public discussions, projects, events & more" → the public stream in The Commons.
  3. Group picture — "Create a group" / "Gather your collaborators & people who share your interests" → opens Create Group over The Commons.
  4. The person's own photo with a warm red-to-yellow tint — "Complete your profile" / "Share about who you are, your skills & interests" → the Edit Profile page.

---

## 6. Signing out

"Logout" is available from the user menu in the main navigation (shown as "Logout {email}") and at the bottom of the My Home menu. Signing out ends the session on this device, forgets any remembered destination, and returns to the sign-in page.

Changing your password, deactivating or deleting your account signs you out on all *other* devices.

---

## 7. Where people land after signing in

- If a logged-out visitor opens a page that requires an account, they are sent to the sign-in page and Hylo remembers where they were going. After signing in — or after finishing signup and the welcome wizard — they are taken there.
- The remembered destination survives closing the tab and is cleared once reached or when the person signs out.
- If there is no remembered destination, a signed-in person lands on their default home view.
- Some pages are visible without an account and never force sign-in: The Commons, public posts, public groups' landing pages, public member profiles and invitation links.

---

## 8. Arriving from an invitation link

When a logged-out visitor opens a group invitation (an emailed invite or a shareable invite link):
- If the invitation is valid, Hylo remembers the group's About page as the destination and opens the signup page with the email field pre-filled from the invitation where known. After signup and the welcome wizard, the person lands on the group's About page, where they can join (see *Joining a Group*).
- If they already have an account they can choose "Sign in" instead; they arrive at the same place.
- If the invitation is expired, used up or invalid, the signup page shows: "Sorry, your invitation to this group is expired, has already been used, or is invalid. Please contact a group Host for another one."
- Someone already signed in who opens an invitation goes directly to the group's About page.

---

## 9. Cookie preferences

On a person's first visit (signed in or not) a cookie preferences panel appears: a card in the bottom-right corner on larger screens, or a sheet across the bottom of the screen on phones.

- Title: "Cookie Preferences"
- Text: "We use essential cookies to help understand whether you are logged in and to understand your preferences and where you are in Hylo."
- Two switches, both on by default, each with an ⓘ button:
  - "Analytics (Mixpanel)" — ⓘ explains: "We use a service called Mixpanel to understand how people like you use Hylo. Your identity is anonymized but your behavior is recorded so that we can make improvements to Hylo based on how people are using it."
  - "Support (Intercom)" — ⓘ explains: "When people on Hylo need help or want to report a bug, they are interacting with a service called Intercom. Intercom stores cookies in your browser to keep track of conversations with us, the development team."
  - On phones the service names in brackets are hidden.
- Buttons: "Reject Non-Essential" (turns both off and saves) and "Save and Continue" (saves the current choices; shown in reversed colours for emphasis).

The choice is remembered for a year on that browser and, once the person signs in, on their account, so they are not asked again on other devices. It can be changed later from Account settings. The panel is not shown when Hylo is embedded in another website or inside the mobile app.

---

## 10. Rules & limits

| Rule | Value |
|---|---|
| Password length | At least 9 characters, and not only spaces |
| Name | Required; at least 2 visible characters; not only spaces |
| Confirmation code | 6 digits, single use, valid for 4 hours; a new code cancels the previous one |
| Email links (confirm, reset password) | Single sign-in links valid for 4 hours |
| Failed sign-ins | After 10 failures for one email (or 50 from one network) within 15 minutes, sign-in is paused for that window |
| Failed code entries | After 10 wrong codes for one email (or 50 from one network) within an hour, entry is paused for that window |
| Code / reset emails | At most 5 per email address per hour |
| Session length | Signed in for 60 days on a device unless signing out |
| Emails are case-insensitive | "Ann@Example.com" and "ann@example.com" are the same account |
| Deleted accounts | The email address becomes free to register again as a new account |

---

## 11. Notes for review

These are places where today's product behaves in a way that may not be intended. Each needs a decision on whether a rebuild should copy it.

1. **Agreements aren't recorded.** Ticking "I accept the agreements" isn't stored anywhere, and the name/password step can be reached without ticking it. *Proposed: store acceptance (with a date and agreement version) and require it.*
2. **A confirmation code also works as a sign-in for existing accounts.** Entering an existing member's email on the signup page and typing the emailed code signs them in without a password. This is effectively passwordless login. *Keep it as a deliberate feature, or restrict it?*
3. **Reset page always reports success**, even when the person has hit the email limit and no email was sent. *Proposed: show "Too many attempts…" in that case.*
4. **Only Google is offered** on the web. The mobile app also offers Sign in with Apple. Older Facebook and LinkedIn sign-in options no longer work. *Confirm that a rebuild should offer Google on web and Google + Apple on mobile only.*
5. **The name/password step pre-fills a name** when Hylo already has one (e.g. for accounts created by partner integrations). The emailed "finish your registration" link sent to those accounts currently fails; the person has to sign up normally with the same email. *Proposed: make that link work.*
6. **"Link expired" vs "Invalid code"** wording is used for both expired and mistyped codes. Fine to keep, or distinguish?
