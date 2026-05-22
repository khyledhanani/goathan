import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isPublicRoute = createRouteMatcher(["/"]);
const isAuthedOnlyRoute = createRouteMatcher([
  "/onboarding",
  "/dashboard",
  "/group(.*)",
  "/profile",
]);

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    const isAuthenticated = await convexAuth.isAuthenticated();

    if (isAuthedOnlyRoute(request) && !isAuthenticated) {
      return nextjsMiddlewareRedirect(request, "/");
    }

    if (isPublicRoute(request) && isAuthenticated) {
      return nextjsMiddlewareRedirect(request, "/dashboard");
    }
  },
  {
    cookieConfig: { maxAge: THIRTY_DAYS_SECONDS },
  },
);

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
