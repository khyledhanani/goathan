import { BottomSheet } from "@/components/ui/BottomSheet";
import { LeaderboardSheetContent } from "@/components/sheets/LeaderboardSheetContent";
import type { StandingMember } from "@/components/home/types";

export function LeaderboardSheet({
  visible,
  members,
  onClose,
}: {
  visible: boolean;
  members: StandingMember[];
  onClose: () => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <LeaderboardSheetContent members={members} onClose={onClose} />
    </BottomSheet>
  );
}
