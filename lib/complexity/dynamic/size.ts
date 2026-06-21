// A coarse scalar "n" for an input: when stdin is a single integer return its
// numeric value (e.g. "40" → 40); when there are multiple numeric tokens return
// the count (e.g. "5\n1 2 3 4 5" → 6); else token count or byte length.
export function deriveSize(stdin: string): number {
  const nums = stdin.match(/-?\d+/g);
  if (nums && nums.length === 1) return Math.abs(Number(nums[0]));
  if (nums && nums.length > 1) return nums.length;
  const tokens = stdin.trim().split(/\s+/).filter(Boolean);
  if (tokens.length > 1) return tokens.length;
  return stdin.length;
}
