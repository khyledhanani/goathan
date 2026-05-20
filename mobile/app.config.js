const webUrl =
  process.env.EXPO_PUBLIC_RECEIPTS_WEB_URL || "https://goathan.vercel.app";

module.exports = {
  expo: {
    name: "Receipts",
    slug: "receipts",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    scheme: "receipts",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#F3EFE2",
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.receipts.app",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSAppTransportSecurity: {
          NSAllowsLocalNetworking: true,
          NSExceptionDomains: {
            localhost: {
              NSExceptionAllowsInsecureHTTPLoads: true,
            },
          },
        },
      },
    },
    android: {
      package: "com.receipts.app",
      usesCleartextTraffic: true,
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#F3EFE2",
      },
    },
    extra: {
      receiptsWebUrl: webUrl,
      eas: {
        projectId: "0c2b1892-8aea-4dca-9de9-6efe161d6392",
      },
    },
    runtimeVersion: {
      policy: "appVersion",
    },
    updates: {
      url: "https://u.expo.dev/0c2b1892-8aea-4dca-9de9-6efe161d6392",
    },
  },
};
