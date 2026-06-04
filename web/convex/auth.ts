import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { convexAuth, type AuthProviderConfig } from "@convex-dev/auth/server";

const providers: AuthProviderConfig[] = [Google, Password];

if (process.env.AUTH_DEV_BYPASS === "true") {
  providers.push(
    Anonymous({
      profile: () => ({
        name: "Dev User",
        email: "dev@receipts.local",
        image: "https://api.dicebear.com/9.x/initials/svg?seed=Dev%20User",
        isAnonymous: true,
      }),
    }),
  );
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers,
});
