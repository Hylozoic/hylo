## Testing & Verification

### Functional Testing

- [ ] **Authentication flows**
  - [ ] Native login -> WebView loads correctly
  - [ ] Session persists across app restarts
  - [ ] Logout from web notifies native
  - [ ] Session expiration handled

- [ ] **Navigation & Deep Linking**
  - [ ] Push notification tap opens correct screen
  - [ ] Email links work
  - [ ] Universal links work (iOS)
  - [ ] App links work (Android)
  - [ ] Back button behavior (Android)
  - [ ] Swipe back gesture (iOS)
  - [ ] Open drawer, tap group, verify navigation

- [ ] **File operations**
  - [ ] Upload image from camera (iOS & Android)
  - [ ] Upload image from gallery
  - [ ] Multi-image selection
  - [ ] Upload document/PDF
  - [ ] Verify files appear in posts/comments

- [ ] **Geolocation**
  - [ ] Grant location permission
  - [ ] Deny permission -> prompt to settings
  - [ ] Location appears in post creation
  - [ ] Map centers on current location

- [ ] **Push notifications**
  - [ ] Receive notification
  - [ ] Tap notification
  - [ ] Correct screen opens in WebView
  - [ ] Badge count updates

- [ ] **Core User Flows**
  - [ ] Create a post (with image, location, topics)
  - [ ] Comment on a post
  - [ ] View a member profile
  - [ ] Send a direct message
  - [ ] Search for posts/members
  - [ ] Join a group
  - [ ] View group settings
  - [ ] Edit user settings

- [ ] **WebView-Specific**
  - [ ] Web app renders correctly in WebView
  - [ ] Scrolling is smooth
  - [ ] Keyboard behavior is correct
  - [ ] Touch interactions work
  - [ ] Modals/dialogs work
  - [ ] Navigation in web works

---

### Cross-Platform Testing

- [ ] **iOS**
  - [ ] Test on iPhone SE (small screen)
  - [ ] Test on iPhone 14 Pro (notch)
  - [ ] Test on iPad (if supported)
  - [ ] Different iOS versions (16, 17, 18)
  - [ ] Safe area / notch handling
  - [ ] Keyboard avoiding

- [ ] **Android**
  - [ ] Test on old device (Android 10)
  - [ ] Test on new device (Android 14+)
  - [ ] Different screen sizes
  - [ ] Different WebView versions
  - [ ] Hardware back button

---

### Performance Testing

- [ ] **Load Times**
  - [ ] Cold start (app launch)
  - [ ] Warm start (app backgrounded)
  - [ ] Tab switching
  - [ ] Navigation between screens
  - [ ] Compare to previous native version

- [ ] **Memory & Battery**
  - [ ] Monitor RAM usage over 1-hour session
  - [ ] Check for memory leaks (repeated actions)
  - [ ] Compare to current native app
  - [ ] 1-hour active usage test

- [ ] **Network usage**
  - [ ] Measure data transfer
  - [ ] Check for excessive re-fetching

---

### Edge Cases & Error Handling

- [ ] **Network issues**
  - [ ] WebView fails to load (offline)
  - [ ] Session API call fails
  - [ ] Image upload fails

- [ ] **Permission issues**
  - [ ] Camera permission denied
  - [ ] Location permission denied
  - [ ] Storage permission denied (Android)

- [ ] **State synchronization**
  - [ ] Kill and restart app
  - [ ] Switch to background and return
  - [ ] Low memory warnings

---

### Signup Flow Testing

- [ ] **Complete signup flow from start to finish**
  - [ ] Start signup from login screen
  - [ ] Enter email and verify
  - [ ] Complete registration form
  - [ ] Upload avatar (if file uploads working)
  - [ ] Set location (geolocation should work)
  - [ ] Finish signup

- [ ] **Verify transition to authenticated state**
  - [ ] After signup completes, should navigate to PrimaryWebView
  - [ ] Should load web app correctly
  - [ ] Session should be established
  - [ ] User should be logged in

- [ ] **Potential issues to check**
  - [ ] Does signup completion redirect correctly?
  - [ ] Is the session cookie set properly for WebView?
  - [ ] Does the native → WebView transition feel smooth?
  - [ ] Are there any navigation edge cases?

**Files that may need adjustment:**
- `apps/mobile/src/screens/Signup/*` - Signup flow screens
- `apps/mobile/src/navigation/NonAuthRootNavigator.js` - Non-auth navigation
- `apps/mobile/src/navigation/RootNavigator.js` - Root navigation logic
- `@hylo/contexts/AuthContext.js` - Auth state management

---

## Notes & Considerations

### Questions to Answer During Implementation
1. **Native Share UX:** Should we implement a WebView → Native bridge for sharing?
   - `usePostActionSheet` provides native share sheets and action menus
   - `react-native-share` is still available in the codebase
   - Could expose native share functionality via message bridge
   - Consider: Does the native share UX provide enough value to justify the bridge?
