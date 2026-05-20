"use client";

export type StoryItem = {
  completionId: string;
  taskName: string;
  taskCategory: "MORNING" | "MOVE" | "FUEL" | "MIND" | "REST";
  groupId: string;
  groupName: string;
  points: number;
  verifiedAt: number;
  proofUrl: string | null;
  hasR2Proof?: boolean;
};

export type StoryBundle = {
  userId: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  isYou: boolean;
  latestAt: number;
  items: StoryItem[];
};

export function StoriesRail({
  stories,
  onOpen,
}: {
  stories: StoryBundle[];
  onOpen: (index: number) => void;
}) {
  if (stories.length === 0) return null;

  return (
    <section className="stories-rail-wrap fade-up">
      <header className="stories-rail-head">
        <span className="eyebrow">Today&apos;s receipts</span>
        <span className="stories-rail-meta">
          <span className="num">{stories.length}</span>{" "}
          {stories.length === 1 ? "friend" : "friends"} posted
        </span>
      </header>
      <div className="stories-rail" role="list">
        {stories.map((s, i) => (
          <button
            key={s.userId}
            className={`story-pip ${s.isYou ? "is-you" : ""}`}
            onClick={() => onOpen(i)}
            role="listitem"
            aria-label={`View ${s.isYou ? "your" : `${s.displayName}'s`} receipts`}
          >
            <span className="story-pip-ring">
              <span className="story-pip-avatar">
                {s.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.avatarUrl}
                    alt=""
                    width={52}
                    height={52}
                    className="avatar"
                  />
                ) : (
                  <span
                    className="avatar avatar-fallback"
                    style={{ width: 52, height: 52, fontSize: 20 }}
                  >
                    {s.displayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </span>
              {s.items.length > 1 && (
                <span className="story-pip-count mono">{s.items.length}</span>
              )}
            </span>
            <span className="story-pip-label">
              {s.isYou ? "You" : firstWord(s.displayName)}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function firstWord(name: string): string {
  const trimmed = name.trim();
  const space = trimmed.indexOf(" ");
  return space === -1 ? trimmed : trimmed.slice(0, space);
}
