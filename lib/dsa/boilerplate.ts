import { getAllBoilerplates, parseSignature, type HarnessLanguage } from '@/lib/judge/harness';
import { getAllDesignBoilerplates, parseDesignSpec } from '@/lib/judge/harness/design';

export type Boilerplates = Record<HarnessLanguage, string>;

// Plain stdin/stdout starters for problems WITHOUT a function signature or design
// spec (e.g. imported competitive problems). The candidate reads stdin / writes
// stdout themselves.
const STDIN_STARTERS: Boilerplates = {
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    // Read input from stdin, write the answer to stdout.

    return 0;
}`,
  java: `import java.util.*;
import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        // Read input from stdin, write the answer to stdout.

    }
}`,
  javascript: `const _input = require('fs').readFileSync(0, 'utf8').split(/\\r?\\n/);
let _ptr = 0;
const next = () => _input[_ptr++];
// Read input via next(), write the answer with console.log().
`,
};

// Resolves the per-language starter code shown in the editor:
//   design   -> class + constructor + method stubs (operations driver hidden)
//   function -> typed function stub (LeetCode-style)
//   stdin    -> stdin/stdout starter
export function boilerplatesFor(input: {
  signatureJson?: string | null;
  designSpecJson?: string | null;
}): Boilerplates {
  const design = parseDesignSpec(input.designSpecJson);
  if (design) return getAllDesignBoilerplates(design);
  const signature = parseSignature(input.signatureJson);
  if (signature) return getAllBoilerplates(signature);
  return STDIN_STARTERS;
}
