import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { notifRoute } from "./notifTarget";

// Show notifications even when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function useNotificationSetup(isAuthenticated: boolean) {
  const router = useRouter();
  const registerToken = useMutation(api.expoPushTokens.upsert);
  const registeredRef = useRef(false);

  // Register push token when authenticated
  useEffect(() => {
    if (!isAuthenticated || registeredRef.current) return;

    (async () => {
      try {
        const { status: existingStatus } =
          await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== "granted") return;

        const projectId = "0c2b1892-8aea-4dca-9de9-6efe161d6392";
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId,
        });
        await registerToken({ token: tokenData.data });
        registeredRef.current = true;
      } catch (err) {
        console.warn("Push token registration failed:", err);
      }
    })();
  }, [isAuthenticated]);

  // Handle notification taps → deep link
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        if (data?.deepLinkPath && typeof data.deepLinkPath === "string") {
          router.navigate(
            notifRoute({
              deepLinkPath: data.deepLinkPath,
              groupId: typeof data.groupId === "string" ? data.groupId : null,
              completionId: typeof data.completionId === "string" ? data.completionId : null,
            }) as any,
          );
        }
      },
    );
    return () => subscription.remove();
  }, [router]);

  // Handle app opened via notification (cold start)
  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const data = response.notification.request.content.data;
        if (data?.deepLinkPath && typeof data.deepLinkPath === "string") {
          router.navigate(
            notifRoute({
              deepLinkPath: data.deepLinkPath,
              groupId: typeof data.groupId === "string" ? data.groupId : null,
              completionId: typeof data.completionId === "string" ? data.completionId : null,
            }) as any,
          );
        }
      }
    });
  }, []);
}
