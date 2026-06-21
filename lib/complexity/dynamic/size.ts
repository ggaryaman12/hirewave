// A coarse scalar "n" for an input: number of numeric tokens if present,
// else token count, else byte length. Good enough to order test cases by size.
export function deriveSize(stdin: string): number {
  const nums = stdin.match(/-?\d+/g);
  if (nums && nums.length > 0) return nums.length;
  const tokens = stdin.trim().split(/\s+/).filter(Boolean);
  if (tokens.length > 1) return tokens.length;
  return stdin.length;
}
