// ════════════════════════════════════════════════════════════════════════
// Translate a notification's target into an in-app route.
//
// The standalone group screens (/group/[id], /groups) are gone — group &
// receipt notifications now open the dashboard, which switches to the group
// and highlights the post. Inbox taps have structured groupId/completionId;
// push payloads only carry deepLinkPath, so we also parse that.
// ════════════════════════════════════════════════════════════════════════

export function notifRoute(opts: {
  deepLinkPath?: string | null;
  groupId?: string | null;
  completionId?: string | null;
}): string {
  const { deepLinkPath, groupId, completionId } = opts;

  // Prefer structured ids (present on inbox notifications).
  if (completionId) {
    return groupId
      ? `/dashboard?group=${groupId}&highlight=${completionId}`
      : `/dashboard?highlight=${completionId}`;
  }
  if (groupId) return `/dashboard?group=${groupId}`;

  // Fall back to parsing the deepLinkPath (push payloads).
  const p = deepLinkPath ?? "";
  const receipt = p.match(/^\/r\/(.+)$/);
  if (receipt) return `/dashboard?highlight=${receipt[1]}`;
  const group = p.match(/^\/group\/([^/]+)$/);
  if (group) return `/dashboard?group=${group[1]}`;
  if (p === "/groups") return "/dashboard";

  return p || "/dashboard";
}
