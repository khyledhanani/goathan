import { WebView } from "react-native-webview";
import { View, StyleSheet } from "react-native";

const APP_URL = "https://goathan.vercel.app";

export default function App() {
  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: APP_URL }}
        style={styles.webview}
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
