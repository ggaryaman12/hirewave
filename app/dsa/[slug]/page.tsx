import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { db } from '@/lib/db';
import { boilerplatesFor } from '@/lib/dsa/boilerplate';
import { ProblemWorkspace, type ProblemPayload } from '@/components/dsa/problem-workspace';

function parseStringArray(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export default async function DsaProblemPage({ params }: { params: { slug: string } }) {
  const problem = await db.dsaProblem.findUnique({
    where: { slug: params.slug },
    include: { testCases: { orderBy: { sortOrder: 'asc' } } },
  });

  if (!problem || problem.status !== 'published') {
    return (
      <div className="grid min-h-screen place-items-center bg-[#111] px-6 text-paper">
        <div className="text-center">
          <p className="text-5xl font-black text-white/15">404</p>
          <h1 className="mt-3 text-lg font-black">Problem not found</h1>
          <p className="mt-1 text-sm text-white/50">
            This problem does not exist or has not been published.
          </p>
          <Link
            href="/dsa"
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-[#f15a29] px-4 py-2.5 text-sm font-black text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to problems
          </Link>
        </div>
      </div>
    );
  }

  // SANITIZED payload — only sample cases reach the client. Hidden (non-sample)
  // test cases must never leave the server.
  const payload: ProblemPayload = {
    title: problem.title,
    difficulty: problem.difficulty,
    statementMd: problem.statementMd,
    constraintsMd: problem.constraintsMd,
    inputFormat: problem.inputFormat,
    outputFormat: problem.outputFormat,
    timeLimitMs: problem.timeLimitMs,
    memoryLimitMb: problem.memoryLimitMb,
    kind: problem.kind,
    functionMode: Boolean(problem.signatureJson) || Boolean(problem.designSpecJson),
    functionName: problem.functionName,
    boilerplates: boilerplatesFor(problem),
    categoryTags: parseStringArray(problem.categoryTagsJson),
    companyTags: parseStringArray(problem.companyTagsJson),
    hints: parseStringArray(problem.hintsJson),
    samples: problem.testCases
      .filter((testCase) => testCase.isSample)
      .map((testCase) => ({ input: testCase.input, expected: testCase.expected })),
  };

  return <ProblemWorkspace slug={problem.slug} problem={payload} />;
}
