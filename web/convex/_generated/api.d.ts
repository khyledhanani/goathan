/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aiVerify from "../aiVerify.js";
import type * as aiVerifyAction from "../aiVerifyAction.js";
import type * as auth from "../auth.js";
import type * as challenges from "../challenges.js";
import type * as comments from "../comments.js";
import type * as completions from "../completions.js";
import type * as crons from "../crons.js";
import type * as dev from "../dev.js";
import type * as groups from "../groups.js";
import type * as http from "../http.js";
import type * as lib_aiVerifyDisplay from "../lib/aiVerifyDisplay.js";
import type * as lib_notify from "../lib/notify.js";
import type * as lib_perfectDay from "../lib/perfectDay.js";
import type * as lib_period from "../lib/period.js";
import type * as likes from "../likes.js";
import type * as notificationPreferences from "../notificationPreferences.js";
import type * as notifications from "../notifications.js";
import type * as notificationsCron from "../notificationsCron.js";
import type * as notificationsPush from "../notificationsPush.js";
import type * as profiles from "../profiles.js";
import type * as proofs from "../proofs.js";
import type * as pushSubscriptions from "../pushSubscriptions.js";
import type * as streaks from "../streaks.js";
import type * as tasks from "../tasks.js";
import type * as weekResults from "../weekResults.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  aiVerify: typeof aiVerify;
  aiVerifyAction: typeof aiVerifyAction;
  auth: typeof auth;
  challenges: typeof challenges;
  comments: typeof comments;
  completions: typeof completions;
  crons: typeof crons;
  dev: typeof dev;
  groups: typeof groups;
  http: typeof http;
  "lib/aiVerifyDisplay": typeof lib_aiVerifyDisplay;
  "lib/notify": typeof lib_notify;
  "lib/perfectDay": typeof lib_perfectDay;
  "lib/period": typeof lib_period;
  likes: typeof likes;
  notificationPreferences: typeof notificationPreferences;
  notifications: typeof notifications;
  notificationsCron: typeof notificationsCron;
  notificationsPush: typeof notificationsPush;
  profiles: typeof profiles;
  proofs: typeof proofs;
  pushSubscriptions: typeof pushSubscriptions;
  streaks: typeof streaks;
  tasks: typeof tasks;
  weekResults: typeof weekResults;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
