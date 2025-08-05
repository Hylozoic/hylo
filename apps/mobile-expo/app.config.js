import 'dotenv/config';

export default {
  expo: {
    name: "Hylo",
    slug: "hylo",
    version: "6.1.6",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.hylo.HyloA"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.hylo.HyloA"
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
              [
          "@sentry/react-native",
          {
            organization: process.env.SENTRY_ORG || "hylo",
            project: "hylo-mobile",
            hideSourcemaps: false
          }
        ],
      [
        "onesignal-expo-plugin",
        {
          mode: "development"
        }
      ],
      [
        "@react-native-google-signin/google-signin",
        {
          iosUrlScheme: process.env.IOS_GOOGLE_CLIENT_ID,
          googleServicesFile: "./google-services.json",
          googleServiceInfoPlist: "./GoogleService-Info.plist"
        }
      ],
      "expo-document-picker"
      // "react-native-vector-icons" - will configure manually later or use @expo/vector-icons instead
    ],
    extra: {
      eas: {
        projectId: "b09cf94b-bf31-4ff9-8560-e883b0020b0a"
      },
      // Environment variables for runtime access
      oneSignalAppId: process.env.ONESIGNAL_APP_ID,
      sentryDsn: process.env.SENTRY_DSN_URL,
      sentryDevDsn: process.env.SENTRY_DEV_DSN_URL,
      mixpanelToken: process.env.MIXPANEL_TOKEN,
      intercomAppId: process.env.INTERCOM_APP_ID,
      intercomAndroidApiKey: process.env.INTERCOM_ANDROID_API_KEY,
      intercomIosApiKey: process.env.INTERCOM_IOS_API_KEY,
      apiHost: process.env.API_HOST,
      hyloWebBaseUrl: process.env.HYLO_WEB_BASE_URL,
      sessionCookieKey: process.env.SESSION_COOKIE_KEY,
      mapboxToken: process.env.MAPBOX_TOKEN,
      iosGoogleClientId: process.env.IOS_GOOGLE_CLIENT_ID,
      webGoogleClientId: process.env.WEB_GOOGLE_CLIENT_ID
    },
    doctor: {
      reactNativeDirectoryCheck: {
        listUnknownPackages: false
      }
    }
  }
};