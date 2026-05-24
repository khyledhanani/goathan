import { WebView } from "react-native-webview";
import { View, StyleSheet, Linking } from "react-native";
import * as WebBrowser from "expo-web-browser";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";

const APP_URL = "https://goathan.vercel.app";

const GOOGLE_AUTH_PATTERNS = [
  "accounts.google.com",
  "accounts.youtube.com",
  "oauth2/v2/auth",
];

export default function App() {
  const handleNavigationRequest = (request: ShouldStartLoadRequest): boolean => {
    const { url } = request;

    // Intercept Google OAuth URLs and open in system browser
    if (GOOGLE_AUTH_PATTERNS.some((pattern) => url.includes(pattern))) {
      WebBrowser.openAuthSessionAsync(url, "receipts://").then((result) => {
        // Auth session completed — the WebView will pick up the session
        // via shared cookies when the user returns
      });
      return false;
    }

    return true;
  };

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: APP_URL }}
        style={styles.webview}
        onShouldStartLoadWithRequest={handleNavigationRequest}
        allowsBackForwardNavigationGestures
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        sharedCookiesEnabled
        pullToRefreshEnabled
        allowsFullscreenVideo
        decelerationRate="normal"
        contentMode="mobile"
        setSupportMultipleWindows={false}
        overScrollMode="never"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#090B0A",
    paddingTop: 0,
  },
  webview: {
    flex: 1,
    backgroundColor: "#090B0A",
  },
});
