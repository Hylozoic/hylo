# HyloReactNative

## Quick Start

1. Run through the React Native environment setup on the [React Native website](https://reactnative.dev/docs/environment-setup)
2. `yarn install` in the monorepo
3. Run the backend *and* web apps; mobile depends on both of these running to work correctly
4. Ask a teammate for a copy of the `.env` file, copy that into the root of this project (also available in Hylo 1Password)
5. Then run `scripts/configure.sh`
6. Install the correct version of Java (currently v17). On a mac https://sdkman.io is the easiest way to do this.
7. `cd ios` (do the next commands inside the apps/mobile/ios folder)
8. `bundle install` (** assuming you have a functioning version of Ruby)
9. `pod install`
10. `cd ..` (leave the ios folder)
11. `yarn start` (must be within apps/mobile) launches `metro`, the heart of the mobile dev experience
12. You will see the metro options for launching the different environments and the devtools, and reload
13. To build/install the android app run `yarn run android` in a different terminal window.
13. To build/install the ios app run `yarn run ios` in a different terminal window. If it fails with error code 70 you need to specify the destination device or simulator you want to build for. You can select which to build for by running `yarn react-native run-ios --list-devices`

## Quick debug
1. Most code changes will hot-reload into the devices; sometimes you need to hit 'r' in the metro terminal instance to reload (what you see afer hitting `yarn start`)
2. Sometimes iOS or Android devices will disconnect from metro; hit `i` or `a` to rebuild/reconnect
3. Can't log in? Weird errors about currentUser? Either the backend is down (restart) or the ports for android aren't open (`yarn run android`)
4. You added a new dependency or pulled in changes with a new mobile dependency? You'll probably have to run `pod install` inside the ios folder.
5. The builds seem out of sync or not working? If you've already tried restarting metro, you can run `yarn start --reset-cache`
6. If things are still out of wack, you can `yarn run clean` and selectively reset different parts of the build cache/process
7. Routing/linking is weird/confusing? Turn on debugging in `useOpenURL` (boolean at the top of the file)

## Contributions and Code of Conduct

Please review our [Contribution Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) to step into co-creative stewardship with us.

## Additional Docs for Hylo App Dev

### Boot Splash Screen

Currently the splash screen on boot for both iOS and Android is handled by `react-native-boot-splash` and is limited to using only a centered icon with a choice of background color. It can be readily re-generated using the provided cli utility with the library, see: [react-native-bootstrap#asset-generation](https://github.com/zoontek/react-native-bootsplash#assets-generation)

Current Bootsplash screens / logo were generated using this command and parameters:

```
yarn react-native generate-bootsplash ./bootsplash_logo.png \
  --platforms=android,ios \
  --background=0DC39F \
  --logo-width=160
```

### Release checklist

- Merge desired changes to a release branch (release-6.1.12 for example) 
- Update and commit `CHANGELOG`:
  - Ensure version numbers across the mobile rep actually MATCH the version you are putting out
    - Often I do this with a search for the prior version number; it should only exist in the changelog
    - AS PART OF DOING THIS, the android `versionCode` and the iOS `CFBundleVersion` needs to be incremented by 1, or build chaos ensues.
  - Review git history and Github Milestone for the release and existing entries in `CHANGELOG` for the current pre-release
- Go into Bitrise, into our app, and find an hit the 'start build' button.
  - select the branch you want to build
  - under target, select the option for a STAGING or a PRODUCTION build based on what part of the release process you are in
- Wait for Bitrise build and confirm it built successfully
- Install and manually test Bitrise builds:
  - For iOS install from TestFlight
  - For Android manually install APK file on physical device (or emulator if no physical device available)
  - Android APK is available in BITRISE under ARTIFACTS, for successful builds
- for STAGING BUILDS: you have to manually get the android APK file to android test users. I usually attach in a gmail mail, so that the apk attachment creates a google drive link. iOS will be available on testers testFlight app
- For PROD BUILDS: Go into EACH app store and start a new draft release. 
  - Prepare release notes appropriate for stores by reviewing `CHANGELOG` and the related issues and PRs on the release Github Milestone
  - The iOS release build is available once its been uploaded to the test flight servers. Be sure you select the correct BUILD, cross check the build number to the bitrise build you are actually intending to release.
  - Google play console need you to download the APK from BITRISE under ARTIFACTS for the build, and then upload that APK to the specific draft release
- Submit to Apple App Store:
  - Be sure to double-check that you're submitting the exactly version/Bitrise build number which was build and tested above
  - Add release notes (the changelogs. DONT MENTION ANDROID SPECIFIC FIXES HERE OR THEY WILL HAVE A FIT)
  - Submit the draft release for review
- Submit to Google Play Store:
  - Upload the APK file downloaded from Bitrise and tested above
  - Add release notes
  - Submit the draft release for review
- Once the release is accepted by both the stores update the version numbers to the next patch version x.x.10 => x.x.11
  - An example of this step [can be seen here](https://github.com/Hylozoic/hylo/commit/27ff587c72c6699220816afad4614f2d1cc07b27)
  - If you don't do this, iOS builds will fail on upload to test flight
- Open a new Milestone with the current pre-release version:

###### In-between release testings and ongoing dev
Now, you might have cut a release branch, then the next day merged a big new mobile feature to dev, AND THEN you get some bug feedback. Those bugs need to be reflected in both dev AND the release branch, so its best to do the bug fixes on the release branch and update the release tag, and then merge those changes from the release branch into dev (aka, don't add the fixes branched off dev and then accidentally deploy a whole new untested feature). 

### Enabling Sentry exception tracking in dev

Sentry error reporting is always on in production, and optionally enabled in dev. To enable it in dev you need to set `SENTRY_DEV_DSN_URL` to be the DSN URL for the Sentry "hyloreactnative-dev" project. This can be found by logging into Sentry and is also available in the Hylo password vault under the Sentry record.

## Debugging, how-things-are-set-up, quirks, work-arounds

### Navigation
Mobile navigation is structured differently from the concepts we are familiar with with the web. This is sad :( Since we have both a web app and a mobile app, we still heavily rely on path/url based navigation and have recently added much more tooling to our mobile app to handle this.

The biggests pieces of this are:
1. useOpenURL; were we can, we feed paths/urls to this and it handles most of the navigations needs of the app
2. the [linking/routing table](https://github.com/Hylozoic/hylo/blob/dev/apps/mobile/src/navigation/linking/index.js); this is the backbone that useOpenURL depends on; if a path is wrong here or missing, useOpenURL and external deep links will fail
3. How we handle 'the current group', with [`useHandleCurrentGroup` and `useHandleCurrentGroupSlug`](https://github.com/Hylozoic/hylo/blob/dev/apps/mobile/src/hooks/useHandleCurrentGroup.js)

Many of views in web and mobile rely on knowing the `currentGroup`; this is much more straightforward in web than mobile, as the required state is consistently available in web paths/urls but that is not always the case for mobile navigation.

Mobile apps have 'navigators', 'stacks' and 'screens', instead of routes, and pages. They aren't direct parallel concepts, so you have to start getting cozy with the mobile way of organizing navigation. Best to review the docs for [React Navigation](https://reactnavigation.org/docs/hello-react-navigation) and see how we have setup things.

##### Our navigation stack

We have a `RootNavigator`, that wraps `AuthRootNavigator` and `NonAuthRootNavigator`. Most of the app is then under the `AuthRootNavigator`, which is where a lot of top-level data-admin happens. `AuthRootNavigator` then wraps the `DrawerNavigator`, which handles most of the navigation menu UI, several of the modal screens and a few other bits and pieces. `DrawerNavigator` then wraps `TabsNavigator`, which handles the UI for the bottom tabs navigation UI and in turn wraps `HomeNavigator`, notifications, search, messages.... And finally HomeNavigator wraps most of the actual content/views/screens of the app.

I'm still quite interested in whether we can optimize our app and all of the nested of the above navigators as suggested in here: https://github.com/react-navigation/react-navigation/discussions/11290

##### Debugging navigation and links
use `yarn open-link`. It is really handy to get around the app and to manually test how links will resolve.

### Webview
We use webviews a lot. These allow us to point at pieces of the web app in mobile screens. It is both very cool and has quirks.

You’ll want to get familiar with the tooling for debugging actual WebView loads: https://github.com/react-native-webview/react-native-webview/blob/master/docs/Debugging.md#debugging-webview-contents

### Urql
We use urql for most of our graphQL and data fetching/handling needs. Its good to get familiar with the devtools for this. https://github.com/urql-graphql/urql-devtools-exchange#usage

#### Subscriptions
Real-time updates are handled in urql by subscriptions. These are integrated into our app in the [`AuthRootNavigator`](https://github.com/Hylozoic/hylo/blob/dev/apps/mobile/src/navigation/AuthRootNavigator.js)

### Push Notification testing
This requires tweaks to your local backend env; PUSH_NOTIFICATIONS_TESTING_ENABLED needs to be set to TRUE or sometimes you can get away with just adding specific hylo user ids to the HYLO_TESTER_IDS. And you'll need to add valid OneSignal ID and key to your backend env

After you have done this, the quick-n-dirty way to test is to go to the OneSignal model in the backend, insert a url you want to test, and then trigger a notification on a user that you have control of, and that exists in both in your local db and the prod db.

## Prior art (aka not in use)

These two sections related to releases are not current because iOS now hates the '5.4.0-0' style of version number and there was an issue with the yarn bump-version utility which we haven't unpacked yet

### Old Release checklist

- Merge changes to `dev`
- Update and commit `CHANGELOG`:
  - Remove any pre-release version qualifiers in the version heading (e.g. 5.4.0-0 becomes 5.4.0)
  - Review git history and Github Milestone for the release and existing entries in `CHANGELOG` for the current pre-release
- Wait for Bitrise build and confirm it built successfully
- Install and manually test Bitrise builds:
  - For iOS install from TestFlight
  - For Android manually install APK file on physical device (or emulator if no physical device available)
- Prepare release notes appropriate for stores by reviewing `CHANGELOG` and the related issues and PRs on the release Github Milestone
- Submit to Apple App Store:
  - Login to Apple Developer account and submit app for review / release
  - Be sure to double-check that you're submitting the exactly version/Bitrise build number which was build and tested above
  - Add release notes
  - Submit for review
- Submit to Google Play Store:
  - Login to Google Play Store Console
  - Upload the APK file downloaded from Bitrise and tested above
  - Add release notes
  - Submit for review/release
- Once the release is accepted by both the stores run `yarn bump-version prepatch` and commit the changes to `dev` to setup the next patch version in a pre-release state (necessary for Apple to accept beta build after the current version is in production).
- Open a new Milestone with the current pre-release version:
  - Look to `package.json#version` to get the new version, but leave off the `-0`

### OLD Versioning

We use the conventional commits standard for for our versioning, so please brush-up on that here: https://www.conventionalcommits.org/en/v1.0.0. Run `yarn bump-version patch|minor|major|prerelease` to manage the version, which manages setting the version in `package.json` as well as the appropriately places in each of the native app's code.

⚠️ Note `yarn bump-version` is not `yarn version` which is a yarn 4 version command which we do not use.

Here are the common scenarios in which we should run the `bump-version` command:

1) To reset to a prerelease version as which should always be done as the last step in the release process: `yarn bump-version prerelease`. So if the currently released version is "5.4.0" this changes it to "5.4.1-0". This is important as otherwise TestFlight will reject builds for an already released major.minor.patch version number.
2) To move up to a minor version for a new feature release still in development: `yarn bump-version preminor` (or `yarn bump-version premajor` if we're wanting to go there)
   - Current version is "5.4.0-19", running `yarn bump-version preminor` will move the version to "5.5.0-0"
   - Current version is "5.4.0-19", running `yarn bump-version premajor` will move the version to "6.0.0-0"
3) Optional: We want to increment the prereelase number. Current version is "5.4.0-19", running `yarn bump-version prerelease` will move the version to "5.4.0-20". This can be done anytime in development, but is not strictly necessary as the build number is always incremented by bitrise at build and that satisfies the TestFlight unique version test as long as is not an already released `<major>.<minor>.<patch>` version. So generally unnecessary unless pushing iOS builds directly to TestFlight from your own computer via Xcode, or otherwise feels helpful to clarity in development.