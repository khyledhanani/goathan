import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import * as SecureStore from "expo-secure-store";

const convex = new ConvexReactClient(
  process.env.EXPO_PUBLIC_CONVEX_URL!,
  { unsavedChangesWarning: false },
);

const secureStorage = {
  getItem: SecureStore.getItemAsync,
  setItem: SecureStore.setItemAsync,
  removeItem: SecureStore.deleteItemAsync,
};

export function ConvexProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConvexAuthProvider client={convex} storage={secureStorage}>
      {children}
    </ConvexAuthProvider>
  );
}
