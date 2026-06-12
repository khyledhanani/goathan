// ════════════════════════════════════════════════════════════════════════
// RECEIPTS — standings rank helper.
// "Competition ranking" (1224): players with equal points share the same
// rank, and the next distinct score skips ahead accordingly.
//   100, 100, 80      -> 1, 1, 3
//   100, 90, 90, 80   -> 1, 2, 2, 4
//   100, 100, 100, 80 -> 1, 1, 1, 4
// ════════════════════════════════════════════════════════════════════════

/**
 * Given a board already sorted by points DESCENDING, return the displayed
 * rank for each row (aligned by index). Equal adjacent scores share a rank.
 */
export function competitionRanks<T>(
  sortedDesc: T[],
  points: (item: T) => number,
): number[] {
  const ranks: number[] = [];
  for (let i = 0; i < sortedDesc.length; i++) {
    if (i > 0 && points(sortedDesc[i]) === points(sortedDesc[i - 1])) {
      ranks.push(ranks[i - 1]); // tie -> same rank as previous row
    } else {
      ranks.push(i + 1); // new score -> rank is 1-based position
    }
  }
  return ranks;
}
