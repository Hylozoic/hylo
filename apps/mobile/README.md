# HyloReactNative

## ⚠️ URQL CONVERSION IN PROGRESS

### Currently known app issues, URQL and otherwise:

*Major Functional Areas Still needing URQL*

~~- MemberList for Group, likely requiring some refactoring~~
~~- Search~~
- Messages, likely requiring some refactoring
- Sign-up flow (partially converted, needs testing)
- PostBodyProposal

*Known Bugs*

- Converted Search pages has some minor refreshing status and stale bugs (particularly with the Person tab which doesn't re-fetch when switched away and back to)
- useHasResponsibilty stopped working...
- Stream sort doesn't seem to be working currently, was at some point
- Login auths correctly but doesn't re-direct, needs testing and ironing out
- Strange hooks related error though this function doesn't use hooks
- Create Group workflow was already URQL'ified and working, but seems to be broken again
- It used to work.
- Analytics needs to be brought-back in some way for relavent URQL mutations or interactions, mostly have left TODO's inline to indicate where
- MemberProfile tab switching between different feed types is slow and visually not what is expected (tab 1/2 switches but not all the way until fetching is done)
- The entire test suite is likely quite broken at this point
- Post and Comment editing doesn't seem to get the existing content into the TipTap editor hosted on Web, this changes I think with the vite+ conversion--but could be something else--needs to be explored

---

## Quick Start

1. Run through the React Native environment setup on the [React Native website](https://reactnative.dev/docs/environment-setup)
2. `yarn install`
3. Ask a teammate for a copy of the `.env` file, copy that into the root of this project (also available in Hylo 1Password)
4. Then run `scripts/configure.sh`
5. `cd ios`
6. `bundle install` (** assuming you have a functioning version of Ruby)
7. `pod install`
8. `cd ..`
9. `yarn start`
10. `yarn run android` or `yarn run ios`

## Contributions and Code of Conduct

Please review our [Contribution Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) to step into co-creative stewardship with us.

## Additional Docs for Hylo App Dev

## Boot Splash Screen

Currently the splash screen on boot for both iOS and Android is handled by `react-native-boot-splash` and is limited to using only a centered icon with a choice of background color. It can be readily re-generated using the provided cli utility with the library, see: [react-native-bootstrap#asset-generation](https://github.com/zoontek/react-native-bootsplash#assets-generation)

Current Bootsplash screens / logo were generated using this command and parameters:

```
yarn react-native generate-bootsplash ./bootsplash_logo.png \
  --platforms=android,ios \
  --background=0DC39F \
  --logo-width=160
```

#### Release checklist

- Merge changes to `dev`
- Make sure tests are passing
- Update and commit `CHANGELOG`:
  - Remove any pre-release qualifier from the version heading (e.g. 5.4.0-0 becomes 5.4.0)
  - Review Github Milestone for release and existing entries in `CHANGELOG` for the current pre-release
- Run `npm version patch|minor|major` to move off current pre-release version:
  - For example, if current version is 5.4.0-0 running `npm version minor` will move the version to 5.4.0
- `git push --tags`
- Wait for Bitrise build and confirm it built successfully
- Install and manually test Bitrise builds
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
- Once the release is accepted by both the stores run `npm version prereleaase` on `dev` and `git push --tags` to setup the next prereleae build versioning (will bump up on patch version and add `-0` to the end of the version number)
- Open a new Milestone with the current pre-release patch version:
  - Look to `package.json#version` to get the version generated, but leave off the `-0`

### Enabling Sentry exception tracking in dev

Sentry error reporting is always on in production, and optionally enabled in dev. To enable it in dev you need to set `SENTRY_DEV_DSN_URL` to be the DSN URL for the Sentry "hyloreactnative-dev" project. This can be found by logging into Sentry and is also available in the Hylo password vault under the Sentry record.
