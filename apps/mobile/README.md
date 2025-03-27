# HyloReactNative

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
#### Versioning

We use the conventional commits standard for for our versioning, so please brush-up on that here: https://www.conventionalcommits.org/en/v1.0.0. Run `yarn bump-version patch|minor|major|prerelease` to manage the version, which manages setting the version in `package.json` as well as the appropriately places in each of the native app's code. 

⚠️ Note `yarn bump-version` is not `yarn version` which is a yarn 4 version command which we do not use.

Here are the common scenarios in which we should run the `bump-version` command:

1) To reset to a prerelease version as which should always be done as the last step in the release process: `yarn bump-version prerelease`. So if the currently released version is "5.4.0" this changes it to "5.4.1-0". This is important as otherwise TestFlight will reject builds for an already released major.minor.patch version number.
2) To move up to a minor version for a new feature release still in development: `yarn bump-version preminor` (or `yarn bump-version premajor` if we're wanting to go there)
   - Current version is "5.4.0-19", running `yarn bump-version preminor` will move the version to "5.5.0-0"
   - Current version is "5.4.0-19", running `yarn bump-version premajor` will move the version to "6.0.0-0"
3) Optional: We want to increment the prereelase number. Current version is "5.4.0-19", running `yarn bump-version prerelease` will move the version to "5.4.0-20". This can be done anytime in development, but is not strictly necessary as the build number is always incremented by bitrise at build and that satisfies the TestFlight unique version test as long as is not an already released `<major>.<minor>.<patch>` version. So generally unnecessary unless pushing iOS builds directly to TestFlight from your own computer via Xcode, or otherwise feels helpful to clarity in development.

#### Release checklist

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
- Once the release is accepted by both the stores run `yarn bump-version version prereleaase` on `dev`, commit the changes, then `git push --tags` to setup the next prerelease build versioning.
- Open a new Milestone with the current pre-release version:
  - Look to `package.json#version` to get the new version, but leave off the `-0`

### Enabling Sentry exception tracking in dev

Sentry error reporting is always on in production, and optionally enabled in dev. To enable it in dev you need to set `SENTRY_DEV_DSN_URL` to be the DSN URL for the Sentry "hyloreactnative-dev" project. This can be found by logging into Sentry and is also available in the Hylo password vault under the Sentry record.

### Debugging, quirks, work-arounds

You’ll want to get familiar with the tooling for debugging actual WebView loads: https://github.com/react-native-webview/react-native-webview/blob/master/docs/Debugging.md#debugging-webview-contents