import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import WebView, {
  type WebViewMessageEvent,
  type WebViewNavigation,
} from "react-native-webview";
import { createLogger } from "./lib/logger";

const paper = "#F3EFE2";
const paper2 = "#ECE6D2";
const ink = "#14130E";
const smoke = "#57523F";
const fog = "#8F8772";
const rule = "#D5CDB3";
const accent = "#1D4F3F";
const logger = createLogger("mobile.App");

const devUrl = Platform.select({
  android: "http://10.0.2.2:3000",
  default: "http://localhost:3000",
});

function configuredWebUrl() {
  const envUrl = process.env.EXPO_PUBLIC_RECEIPTS_WEB_URL?.trim();
  const extraUrl = Constants.expoConfig?.extra?.receiptsWebUrl;
  const url =
    envUrl ||
    (__DEV__ ? devUrl : "") ||
    (typeof extraUrl === "string" ? extraUrl.trim() : "") ||
    "";

  return url ? url.replace(/\/+$/, "") : "";
}

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const webUrl = useMemo(configuredWebUrl, []);

  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const goBack = useCallback(() => {
    if (!canGoBack) return false;

    webViewRef.current?.goBack();
    return true;
  }, [canGoBack]);

  useEffect(() => {
    if (Platform.OS !== "android") return undefined;

    const subscription = BackHandler.addEventListener("hardwareBackPress", goBack);
    return () => subscription.remove();
  }, [goBack]);

  const onNavigationStateChange = useCallback((state: WebViewNavigation) => {
    setCanGoBack(state.canGoBack);
  }, []);

  const shouldStartLoad = useCallback((request: { url: string }) => {
    const { url } = request;

    if (
      url.startsWith("about:blank") ||
      url.startsWith("data:") ||
      url.startsWith("http://") ||
      url.startsWith("https://")
    ) {
      return true;
    }

    Linking.openURL(url).catch((error: unknown) => {
      logger.warn("external_link_open_failed", { url, error });
    });
    return false;
  }, []);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    if (event.nativeEvent.data === "receipts:ready") {
      setLoading(false);
    }
  }, []);

  const reload = useCallback(() => {
    setLoadFailed(false);
    setLoading(true);
    webViewRef.current?.reload();
  }, []);

  if (!webUrl) {
    return (
      <Shell>
        <StatusBar style="dark" backgroundColor={paper} />
        <Fallback
          title="Receipts"
          body="Set EXPO_PUBLIC_RECEIPTS_WEB_URL to your deployed webapp URL before building the native app."
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <StatusBar style="dark" backgroundColor={paper} />
      <WebView
        ref={webViewRef}
        source={{ uri: webUrl }}
        style={styles.webView}
        containerStyle={styles.webViewContainer}
        originWhitelist={["http://*", "https://*", "receipts://*"]}
        allowsBackForwardNavigationGestures
        applicationNameForUserAgent="ReceiptsApp"
        bounces
        decelerationRate="normal"
        domStorageEnabled
        javaScriptCanOpenWindowsAutomatically
        javaScriptEnabled
        pullToRefreshEnabled
        setSupportMultipleWindows={false}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        onError={({ nativeEvent }) => {
          logger.error("webview_load_failed", {
            url: nativeEvent.url,
            code: nativeEvent.code,
            description: nativeEvent.description,
          });
          setLoadFailed(true);
          setLoading(false);
        }}
        onHttpError={({ nativeEvent }) => {
          if (nativeEvent.statusCode >= 500) {
            logger.error("webview_http_error", {
              url: nativeEvent.url,
              statusCode: nativeEvent.statusCode,
              description: nativeEvent.description,
            });
            setLoadFailed(true);
            setLoading(false);
          }
        }}
        onLoadEnd={() => setLoading(false)}
        onLoadStart={() => {
          setLoadFailed(false);
          setLoading(true);
        }}
        onMessage={onMessage}
        onNavigationStateChange={onNavigationStateChange}
        onShouldStartLoadWithRequest={shouldStartLoad}
        injectedJavaScript={`
          window.ReactNativeWebView?.postMessage("receipts:ready");
          true;
        `}
      />
      {loading && !loadFailed ? <LoadingOverlay /> : null}
      {loadFailed ? <ErrorOverlay onRetry={reload} webUrl={webUrl} /> : null}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>{children}</SafeAreaView>
    </SafeAreaProvider>
  );
}

function LoadingOverlay() {
  return (
    <View style={styles.overlay}>
      <Text style={styles.brand}>
        Receipts<Text style={styles.version}>v0.1</Text>
      </Text>
      <ActivityIndicator color={accent} />
    </View>
  );
}

function ErrorOverlay({ onRetry, webUrl }: { onRetry: () => void; webUrl: string }) {
  return (
    <View style={styles.overlay}>
      <Fallback
        title="Receipts"
        body={`Could not load ${webUrl}. Make sure the webapp is running and reachable from this device.`}
        actionLabel="Retry"
        onAction={onRetry}
      />
    </View>
  );
}

function Fallback({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.fallback}>
      <Text style={styles.eyebrow}>Native app shell</Text>
      <Text style={styles.fallbackTitle}>{title}</Text>
      <Text style={styles.fallbackBody}>{body}</Text>
      {actionLabel && onAction ? (
        <Pressable style={styles.button} onPress={onAction}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: paper,
  },
  webView: {
    flex: 1,
    backgroundColor: paper,
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: paper,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: paper,
    justifyContent: "center",
    padding: 24,
  },
  brand: {
    color: ink,
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
    fontSize: 30,
    fontStyle: "italic",
    marginBottom: 24,
  },
  version: {
    color: fog,
    fontFamily: Platform.select({ ios: "Courier New", default: "monospace" }),
    fontSize: 10,
    fontStyle: "normal",
    letterSpacing: 1.4,
  },
  fallback: {
    alignSelf: "stretch",
    marginHorizontal: 24,
  },
  eyebrow: {
    color: fog,
    fontFamily: Platform.select({ ios: "Courier New", default: "monospace" }),
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 1.7,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  fallbackTitle: {
    color: ink,
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
    fontSize: 54,
    fontStyle: "italic",
    lineHeight: 58,
    marginBottom: 16,
  },
  fallbackBody: {
    color: smoke,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
  },
  button: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: ink,
    borderColor: rule,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  buttonText: {
    color: paper2,
    fontSize: 14,
    fontWeight: "600",
  },
});
