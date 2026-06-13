'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, CheckCircle2, Clock, FileCode2, FileDiff as FileDiffIcon, Play, Send, Terminal, UploadCloud } from 'lucide-react';
import { formatTokenUsage, type TokenUsage } from '@/lib/ai/token-usage';
import { buildFileDiff, type FileDiff as CodeFileDiff } from '@/lib/diff/text-diff';
import { cn } from '@/lib/utils';

type SessionFile = {
  path: string;
  language: string;
  content: string;
  version: number;
};

type StarterFile = {
  path: string;
  language: string;
  content: string;
};

type AiMessage = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  tokenUsage?: TokenUsage | null;
};

type AgentChatMessage = { id: string; role: string; content: string };

type AgentProposalView = {
  id: string;
  path: string;
  rationale: string | null;
  status: string;
  decisionReason: string | null;
  diff: CodeFileDiff | null;
  createdAt: string;
  decidedAt: string | null;
};

type CommandRun = {
  id: string;
  command: string;
  status: string;
  output: string;
  outputChunks?: { stream: 'system' | 'stdout' | 'stderr'; content: string; truncated?: boolean }[];
  exitCode: number | null;
  startedAt: string;
  finishedAt: string | null;
  sandbox?: {
    providerId: string;
    providerKind: string;
    executionMode: string;
    isolationLevel: string;
    capabilities?: { readiness?: string };
    cleanupPolicy?: string;
    execution?: {
      sandboxRunId?: string;
      cleanupStatus?: string;
      skippedReason?: string;
      outputTruncated?: boolean;
    };
  };
  testResults: { id: string; name: string; status: string; message: string | null }[];
};

type SessionPayload = {
  id: string;
  status: string;
  expiresAt: string;
  candidate: { name: string; email: string };
  assessment: {
    title: string;
    role: string;
    durationMinutes: number;
    aiMode: string;
  };
  challenge: {
    title: string;
    scenario: string;
    instructions: string;
    stack: string[];
  };
  starterFiles: StarterFile[];
  files: SessionFile[];
  aiMessages: AiMessage[];
  commandRuns: CommandRun[];
  agentProposals?: AgentProposalView[];
  reportId: string | null;
};

export function AssessmentRoom({
  sessionToken,
  initialSession,
}: {
  sessionToken: string;
  initialSession: SessionPayload;
}) {
  const router = useRouter();
  const closed = ['submitted', 'expired', 'report_ready'].includes(initialSession.status);
  const isAgentMode = initialSession.assessment.aiMode === 'agent';
  const [files, setFiles] = useState(initialSession.files);
  const [activePath, setActivePath] = useState(initialSession.files[0]?.path || '');
  const [messages, setMessages] = useState(initialSession.aiMessages);
  const [agentMessages, setAgentMessages] = useState<AgentChatMessage[]>(
    initialSession.aiMessages.map((message) => ({ id: message.id, role: message.role, content: message.content })),
  );
  const [agentProposals, setAgentProposals] = useState<AgentProposalView[]>(initialSession.agentProposals || []);
  const [agentPrompt, setAgentPrompt] = useState('');
  const [agentPending, setAgentPending] = useState(false);
  const [decisionPendingId, setDecisionPendingId] = useState<string | null>(null);
  const [commands, setCommands] = useState(initialSession.commandRuns);
  const [prompt, setPrompt] = useState('');
  const [terminalCommand, setTerminalCommand] = useState('');
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [aiPending, setAiPending] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [workspaceView, setWorkspaceView] = useState<'code' | 'changes'>('code');
  const [activeDiffPath, setActiveDiffPath] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatViewportRef = useRef<HTMLDivElement>(null);

  const activeFile = useMemo(
    () => files.find((file) => file.path === activePath) || files[0],
    [activePath, files],
  );
  const starterByPath = useMemo(() => {
    const map = new Map<string, StarterFile>();
    for (const file of initialSession.starterFiles) {
      map.set(file.path, file);
    }
    return map;
  }, [initialSession.starterFiles]);
  const fileDiffs = useMemo(() => files.map((file) => {
    const starter = starterByPath.get(file.path);
    return buildFileDiff({
      path: file.path,
      language: file.language || starter?.language || 'text',
      originalContent: starter?.content || '',
      currentContent: file.content,
    });
  }), [files, starterByPath]);
  const changedFileDiffs = useMemo(
    () => fileDiffs.filter((file) => file.changed),
    [fileDiffs],
  );
  const activeDiff = useMemo(
    () => changedFileDiffs.find((file) => file.path === activeDiffPath) ||
      changedFileDiffs.find((file) => file.path === activePath) ||
      changedFileDiffs[0] ||
      fileDiffs.find((file) => file.path === activePath) ||
      fileDiffs[0],
    [activeDiffPath, activePath, changedFileDiffs, fileDiffs],
  );

  const logEvent = useCallback((type: string, payload: Record<string, unknown>) => {
    fetch(`/api/session/${sessionToken}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
    }).catch(() => undefined);
  }, [sessionToken]);

  useEffect(() => {
    const onBlur = () => logEvent('focus_changed', { state: 'blurred' });
    const onFocus = () => logEvent('focus_changed', { state: 'focused' });
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, [logEvent]);

  useEffect(() => {
    const chatViewport = chatViewportRef.current;
    if (!chatViewport) return;
    chatViewport.scrollTop = chatViewport.scrollHeight;
  }, [messages, pendingPrompt, aiPending]);

  useEffect(() => {
    if (!changedFileDiffs.length) {
      setActiveDiffPath('');
      return;
    }

    if (!activeDiffPath || !changedFileDiffs.some((file) => file.path === activeDiffPath)) {
      setActiveDiffPath(changedFileDiffs[0].path);
    }
  }, [activeDiffPath, changedFileDiffs]);

  function openFile(path: string) {
    setActivePath(path);
    setActiveDiffPath(path);
    logEvent('file_opened', { path });
  }

  function updateActiveFile(content: string) {
    if (!activeFile || closed) return;
    const nextFile = { ...activeFile, content };
    setFiles((current) => current.map((file) => (file.path === activeFile.path ? nextFile : file)));

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveFile(nextFile), 700);
  }

  async function saveFile(file: SessionFile) {
    setSaving(true);
    try {
      const response = await fetch(`/api/session/${sessionToken}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(file),
      });
      if (!response.ok) throw new Error('Failed to save file');
    } catch (error) {
      logEvent('error_occurred', { message: error instanceof Error ? error.message : 'Failed to save file' });
    } finally {
      setSaving(false);
    }
  }

  async function runCommand(commandInput?: string) {
    const command = (commandInput ?? terminalCommand).trim();
    if (!command || running || closed) return;

    setRunning(true);
    if (!commandInput) setTerminalCommand('');
    try {
      if (activeFile) await saveFile(activeFile);
      const response = await fetch(`/api/session/${sessionToken}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });
      if (!response.ok) throw new Error('Command failed');
      const body = await response.json();
      setCommands((current) => [...current, body.commandRun]);
    } catch (error) {
      if (!commandInput) setTerminalCommand(command);
      logEvent('error_occurred', { message: error instanceof Error ? error.message : 'Failed to run command' });
    } finally {
      setRunning(false);
    }
  }

  async function runTests() {
    await runCommand('npm test');
  }

  async function sendMessage() {
    const trimmed = prompt.trim();
    if (!trimmed || closed || aiPending) return;
    setPrompt('');
    setPendingPrompt(trimmed);
    setAiPending(true);
    try {
      const response = await fetch(`/api/session/${sessionToken}/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      });
      if (!response.ok) throw new Error('AI request failed');
      const body = await response.json();
      setMessages((current) => [...current, ...body.messages]);
    } catch (error) {
      setPrompt(trimmed);
      logEvent('error_occurred', { message: error instanceof Error ? error.message : 'AI request failed' });
    } finally {
      setPendingPrompt(null);
      setAiPending(false);
    }
  }

  async function sendAgentMessage() {
    const trimmed = agentPrompt.trim();
    if (!trimmed || closed || agentPending) return;
    setAgentPrompt('');
    setAgentMessages((current) => [...current, { id: `pending-${Date.now()}`, role: 'user', content: trimmed }]);
    setAgentPending(true);
    try {
      const response = await fetch(`/api/session/${sessionToken}/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      });
      if (!response.ok) throw new Error('Agent request failed');
      const body = await response.json();
      setAgentMessages((current) => [
        ...current,
        ...(body.assistantMessages as AgentChatMessage[]).map((message) => ({ ...message, role: 'assistant' })),
      ]);
      setAgentProposals(body.pendingProposals as AgentProposalView[]);
    } catch (error) {
      setAgentPrompt(trimmed);
      logEvent('error_occurred', { message: error instanceof Error ? error.message : 'Agent request failed' });
    } finally {
      setAgentPending(false);
    }
  }

  async function decideProposal(proposal: AgentProposalView, decision: 'approve' | 'reject') {
    if (closed || decisionPendingId) return;
    const reason = decision === 'reject' ? window.prompt('Why are you rejecting this edit? (optional)') ?? undefined : undefined;
    setDecisionPendingId(proposal.id);
    try {
      const response = await fetch(`/api/session/${sessionToken}/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: proposal.id, decision, reason }),
      });
      if (!response.ok) throw new Error('Decision failed');
      const body = await response.json();
      setAgentProposals(body.pendingProposals as AgentProposalView[]);

      // Reflect an approved agent edit in the workspace immediately.
      if (decision === 'approve' && proposal.diff) {
        const newContent = proposal.diff.currentContent;
        setFiles((current) =>
          current.some((file) => file.path === proposal.path)
            ? current.map((file) =>
                file.path === proposal.path ? { ...file, content: newContent, version: file.version + 1 } : file,
              )
            : [...current, { path: proposal.path, language: proposal.diff?.language || 'text', content: newContent, version: 1 }],
        );
      }
    } catch (error) {
      logEvent('error_occurred', { message: error instanceof Error ? error.message : 'Decision failed' });
    } finally {
      setDecisionPendingId(null);
    }
  }

  async function submit() {
    setSubmitting(true);
    try {
      if (activeFile) await saveFile(activeFile);
      const response = await fetch(`/api/session/${sessionToken}/submit`, { method: 'POST' });
      if (!response.ok) throw new Error('Submit failed');
      const body = await response.json();
      router.push(body.completionUrl ?? `/session/${sessionToken}/complete`);
    } catch (error) {
      logEvent('error_occurred', { message: error instanceof Error ? error.message : 'Submit failed' });
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#111] text-paper lg:h-screen lg:min-h-0 lg:overflow-hidden">
      <header className="flex h-16 items-center justify-between border-b border-white/10 bg-[#171717] px-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-black">{initialSession.assessment.title}</p>
          <p className="truncate text-xs text-white/45">
            {initialSession.candidate.name} · {initialSession.challenge.title}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Timer expiresAt={initialSession.expiresAt} />
          <button
            type="button"
            disabled={closed || submitting}
            onClick={submit}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-[#f15a29] px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            <UploadCloud className="h-4 w-4" />
            {submitting ? 'Submitting' : 'Submit'}
          </button>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:min-h-0 lg:grid-cols-[240px_minmax(0,1fr)_360px]">
        <aside className="border-b border-white/10 bg-[#151515] p-4 lg:min-h-0 lg:overflow-auto lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-white/40">
            <FileCode2 className="h-4 w-4" />
            Files
          </div>
          <div className="mt-4 grid gap-1">
            {files.map((file) => (
              <button
                key={file.path}
                type="button"
                onClick={() => openFile(file.path)}
                className={cn(
                  'truncate rounded-md px-3 py-2 text-left font-mono text-xs text-white/65 hover:bg-white/10 hover:text-white',
                  activePath === file.path && 'bg-white/10 text-white',
                )}
              >
                {file.path}
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/40">Challenge</p>
            <p className="mt-2 text-sm leading-6 text-white/70">{initialSession.challenge.instructions}</p>
          </div>
        </aside>

        <main className="grid min-h-[720px] grid-rows-[minmax(0,1fr)_260px] overflow-hidden lg:min-h-0">
          <section className="flex min-h-0 flex-col">
            <div className="flex h-11 items-center justify-between border-b border-white/10 bg-[#181818] px-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="truncate font-mono text-xs text-white/60">{activeFile?.path}</span>
                <div className="inline-flex h-7 rounded-md border border-white/10 bg-white/[0.04] p-0.5">
                  <button
                    type="button"
                    onClick={() => setWorkspaceView('code')}
                    aria-pressed={workspaceView === 'code'}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded px-2 text-xs font-bold text-white/50 hover:text-white',
                      workspaceView === 'code' && 'bg-white text-black hover:text-black',
                    )}
                  >
                    <FileCode2 className="h-3.5 w-3.5" />
                    Code
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkspaceView('changes')}
                    aria-pressed={workspaceView === 'changes'}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded px-2 text-xs font-bold text-white/50 hover:text-white',
                      workspaceView === 'changes' && 'bg-white text-black hover:text-black',
                    )}
                  >
                    <FileDiffIcon className="h-3.5 w-3.5" />
                    Changes
                  </button>
                </div>
              </div>
              <span className="shrink-0 text-xs text-white/40">{saving ? 'Saving...' : 'Saved'}</span>
            </div>
            {workspaceView === 'code' ? (
              <textarea
                value={activeFile?.content || ''}
                onChange={(event) => updateActiveFile(event.target.value)}
                spellCheck={false}
                disabled={closed}
                className="min-h-0 flex-1 resize-none bg-[#101010] p-5 font-mono text-sm leading-6 text-white outline-none disabled:opacity-70"
              />
            ) : (
              <ChangesPanel
                changedFiles={changedFileDiffs}
                activeDiff={activeDiff}
                onSelectPath={setActiveDiffPath}
              />
            )}
          </section>

          <section className="border-t border-white/10 bg-[#0c0c0c]">
            <div className="flex h-11 items-center justify-between border-b border-white/10 px-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-white/45">
                  <Terminal className="h-4 w-4" />
                  Terminal / tests
                </div>
                <p className="mt-0.5 truncate text-[11px] text-white/35">
                  Controlled runner, not a host shell. Simulated by default; provider evidence is logged per command.
                </p>
              </div>
              <button
                type="button"
                disabled={running || closed}
                onClick={runTests}
                className="inline-flex h-8 items-center gap-2 rounded-md bg-white px-3 text-xs font-black text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" />
                {running ? 'Running' : 'Run tests'}
              </button>
            </div>
            <div className="grid h-[216px] grid-rows-[minmax(0,1fr)_48px]">
              <div className="min-h-0 overflow-auto p-4 font-mono text-xs leading-5 text-white/75">
                <TerminalHistory commands={commands} running={running} />
              </div>
              <form
                className="flex items-center gap-2 border-t border-white/10 px-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void runCommand();
                }}
              >
                <span className="font-mono text-xs text-white/35">$</span>
                <input
                  aria-label="Terminal command"
                  value={terminalCommand}
                  onChange={(event) => setTerminalCommand(event.target.value)}
                  disabled={closed || running}
                  placeholder="Type a command such as npm test or cat src/cart.ts"
                  className="min-w-0 flex-1 bg-transparent font-mono text-xs text-white outline-none placeholder:text-white/25 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!terminalCommand.trim() || running || closed}
                  className="inline-flex h-8 items-center rounded-md border border-white/10 px-3 text-xs font-black text-white/70 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Run command
                </button>
              </form>
            </div>
          </section>
        </main>

        {isAgentMode ? (
          <AgentPanel
            messages={agentMessages}
            proposals={agentProposals}
            prompt={agentPrompt}
            setPrompt={setAgentPrompt}
            onSend={sendAgentMessage}
            pending={agentPending}
            closed={closed}
            decisionPendingId={decisionPendingId}
            onDecide={decideProposal}
          />
        ) : (
        <aside className="flex min-h-[720px] flex-col border-l border-white/10 bg-[#151515] lg:min-h-0 lg:overflow-hidden">
          <div className="flex h-11 items-center gap-2 border-b border-white/10 px-4 text-xs font-bold uppercase tracking-[0.18em] text-white/45">
            <Bot className="h-4 w-4" />
            AI assistant
          </div>
          <div
            ref={chatViewportRef}
            data-testid="ai-chat-scroll"
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4"
          >
            {messages.length === 0 && !pendingPrompt && !aiPending ? (
              <div className="rounded-lg border border-dashed border-white/15 p-4 text-sm leading-6 text-white/55">
                Ask for help, but verify everything. Prompts and responses are part of the evaluation evidence.
              </div>
            ) : (
              <div className="grid gap-3">
                {messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
                {pendingPrompt && (
                  <ChatMessage
                    message={{
                      id: 'pending-user-message',
                      role: 'user',
                      content: pendingPrompt,
                      createdAt: new Date().toISOString(),
                      tokenUsage: null,
                    }}
                  />
                )}
                {aiPending && <AssistantThinking />}
              </div>
            )}
          </div>
          <div className="border-t border-white/10 p-3">
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              disabled={closed}
              rows={3}
              placeholder="Ask for a debugging plan, a review, or a specific hint..."
              className="w-full resize-none rounded-md border border-white/10 bg-[#101010] p-3 text-sm text-white outline-none placeholder:text-white/30 disabled:opacity-50"
            />
            <button
              type="button"
              disabled={!prompt.trim() || closed || aiPending}
              onClick={sendMessage}
              className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-white text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Send className="h-4 w-4" />
              {aiPending ? 'Waiting for AI' : 'Send'}
            </button>
          </div>
        </aside>
        )}
      </div>
    </div>
  );
}

function ChangesPanel({
  changedFiles,
  activeDiff,
  onSelectPath,
}: {
  changedFiles: CodeFileDiff[];
  activeDiff?: CodeFileDiff;
  onSelectPath: (path: string) => void;
}) {
  const totalAdditions = changedFiles.reduce((sum, file) => sum + file.additions, 0);
  const totalDeletions = changedFiles.reduce((sum, file) => sum + file.deletions, 0);

  if (!changedFiles.length || !activeDiff) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center bg-[#101010] p-6 text-center">
        <div>
          <FileDiffIcon className="mx-auto h-8 w-8 text-white/30" />
          <p className="mt-3 text-sm font-bold text-white">No changes yet</p>
          <p className="mt-1 text-sm text-white/45">Starter files and current files match.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#101010]">
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-white/45">
          <FileDiffIcon className="h-4 w-4" />
          {changedFiles.length} {changedFiles.length === 1 ? 'file' : 'files'} changed
        </div>
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="rounded bg-emerald-500/15 px-2 py-1 text-emerald-200">+{totalAdditions}</span>
          <span className="rounded bg-red-500/15 px-2 py-1 text-red-200">-{totalDeletions}</span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="border-b border-white/10 p-3 lg:border-b-0 lg:border-r">
          <div className="grid gap-1">
            {changedFiles.map((file) => (
              <button
                key={file.path}
                type="button"
                onClick={() => onSelectPath(file.path)}
                className={cn(
                  'rounded-md px-3 py-2 text-left hover:bg-white/10',
                  activeDiff.path === file.path && 'bg-white/10',
                )}
              >
                <span className="block truncate font-mono text-xs text-white/75">{file.path}</span>
                <span className="mt-1 block font-mono text-[10px] text-white/35">
                  +{file.additions} / -{file.deletions}
                </span>
              </button>
            ))}
          </div>
        </div>

        <SplitDiffViewer diff={activeDiff} />
      </div>
    </div>
  );
}

function SplitDiffViewer({ diff }: { diff: CodeFileDiff }) {
  return (
    <div className="min-h-0 overflow-auto">
      <div className="sticky top-0 z-10 grid min-w-[900px] grid-cols-2 border-b border-white/10 bg-[#181818] text-xs font-black uppercase tracking-[0.16em] text-white/40">
        <div className="border-r border-white/10 px-4 py-3">Original</div>
        <div className="px-4 py-3">Current</div>
      </div>
      <div className="min-w-[900px] font-mono text-xs leading-5">
        {diff.rows.map((row) => (
          <div
            key={row.id}
            className={cn(
              'grid grid-cols-2 border-b border-white/[0.04]',
              row.kind === 'added' && 'bg-emerald-500/[0.06]',
              row.kind === 'removed' && 'bg-red-500/[0.06]',
            )}
          >
            <div
              className={cn(
                'grid min-w-0 grid-cols-[48px_minmax(0,1fr)] border-r border-white/10',
                row.kind === 'removed' && 'bg-red-500/[0.08] text-red-100',
              )}
            >
              <span className="select-none px-3 py-1 text-right text-white/25">{row.oldLineNumber ?? ''}</span>
              <code
                data-testid="split-diff-code-cell"
                className="min-w-0 whitespace-pre-wrap break-words px-3 py-1 text-white/70 [overflow-wrap:anywhere]"
              >
                {row.oldContent}
              </code>
            </div>
            <div
              className={cn(
                'grid min-w-0 grid-cols-[48px_minmax(0,1fr)]',
                row.kind === 'added' && 'bg-emerald-500/[0.08] text-emerald-100',
              )}
            >
              <span className="select-none px-3 py-1 text-right text-white/25">{row.newLineNumber ?? ''}</span>
              <code
                data-testid="split-diff-code-cell"
                className="min-w-0 whitespace-pre-wrap break-words px-3 py-1 text-white/70 [overflow-wrap:anywhere]"
              >
                {row.newContent}
              </code>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TerminalHistory({ commands, running }: { commands: CommandRun[]; running: boolean }) {
  if (!commands.length && !running) {
    return (
      <div className="whitespace-pre-wrap text-white/45">
        No commands run yet. Try `ls`, `cat README.md`, `cat src/solution-plan.ts`, or `npm test`.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {commands.map((command) => {
        const chunks = command.outputChunks?.length
          ? command.outputChunks
          : [{ stream: 'stdout' as const, content: command.output }];
        const readiness = command.sandbox?.capabilities?.readiness;
        const skippedReason = command.sandbox?.execution?.skippedReason;

        return (
          <div key={command.id} className="rounded-md border border-white/10 bg-white/[0.03]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
              <span className="text-white">$ {command.command}</span>
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em]', command.exitCode === 0 ? 'bg-emerald-500/15 text-emerald-200' : 'bg-red-500/15 text-red-200')}>
                {command.exitCode === 0 ? 'exit 0' : `exit ${command.exitCode ?? 'n/a'}`}
              </span>
            </div>
            {command.sandbox && (
              <div className="grid gap-1 border-b border-white/10 px-3 py-2 text-[11px] text-white/45 sm:grid-cols-2">
                <span>provider: {command.sandbox.providerId}</span>
                <span>readiness: {readiness || 'unknown'}</span>
                <span>execution: {command.sandbox.executionMode}</span>
                <span>isolation: {command.sandbox.isolationLevel}</span>
                <span>cleanup: {command.sandbox.execution?.cleanupStatus || command.sandbox.cleanupPolicy || 'unknown'}</span>
                <span>run: {command.sandbox.execution?.sandboxRunId || 'not captured'}</span>
                {skippedReason && <span className="sm:col-span-2 text-amber-200">skipped: {skippedReason}</span>}
                {command.sandbox.execution?.outputTruncated && <span className="sm:col-span-2 text-amber-200">output truncated</span>}
              </div>
            )}
            <div className="grid gap-1 p-3">
              {chunks.map((chunk, index) => (
                <pre
                  key={`${command.id}-${index}`}
                  className={cn(
                    'whitespace-pre-wrap break-words',
                    chunk.stream === 'stderr' && 'text-red-200',
                    chunk.stream === 'system' && 'text-white/45',
                  )}
                >
                  {chunk.stream !== 'stdout' ? `[${chunk.stream}] ` : ''}
                  {chunk.content}
                  {chunk.truncated ? '\n[chunk truncated]' : ''}
                </pre>
              ))}
            </div>
          </div>
        );
      })}
      {running && <div className="text-white/45">Running command...</div>}
    </div>
  );
}

function ChatMessage({ message }: { message: AiMessage }) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'min-w-0 break-words rounded-lg p-3 text-sm leading-6 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.85)]',
        isUser
          ? 'bg-[#f15a29] text-white'
          : 'border border-white/10 bg-white/[0.08] text-white/80',
      )}
    >
      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] opacity-60">
        {isUser ? 'Candidate' : 'Hirewave AI'}
      </p>
      {isUser ? (
        <p className="whitespace-pre-wrap">{message.content}</p>
      ) : (
        <>
          <MarkdownMessage content={message.content} />
          {message.tokenUsage && (
            <div className="mt-3 rounded-md border border-white/10 bg-black/20 px-3 py-2 font-mono text-[11px] text-white/45">
              Tokens: {formatTokenUsage(message.tokenUsage)}
              <span className="ml-2 text-white/30">
                input {message.tokenUsage.promptTokens.toLocaleString()} · output {message.tokenUsage.completionTokens.toLocaleString()}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AssistantThinking() {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3 text-sm text-white/70">
      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/45">Hirewave AI</p>
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1" aria-hidden="true">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/45" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/45 [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/45 [animation-delay:300ms]" />
        </span>
        <span>Hirewave AI is thinking</span>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
        <span className="block h-full w-1/2 animate-pulse rounded-full bg-[#f15a29]" />
      </div>
    </div>
  );
}

function AgentPanel({
  messages,
  proposals,
  prompt,
  setPrompt,
  onSend,
  pending,
  closed,
  decisionPendingId,
  onDecide,
}: {
  messages: AgentChatMessage[];
  proposals: AgentProposalView[];
  prompt: string;
  setPrompt: (value: string) => void;
  onSend: () => void;
  pending: boolean;
  closed: boolean;
  decisionPendingId: string | null;
  onDecide: (proposal: AgentProposalView, decision: 'approve' | 'reject') => void;
}) {
  const pendingProposals = proposals.filter((proposal) => proposal.status === 'pending');

  return (
    <aside className="flex min-h-[720px] flex-col border-l border-white/10 bg-[#151515] lg:min-h-0 lg:overflow-hidden">
      <div className="flex h-11 items-center gap-2 border-b border-white/10 px-4 text-xs font-bold uppercase tracking-[0.18em] text-white/45">
        <Bot className="h-4 w-4" />
        AI agent
        <span className="ml-auto rounded-full bg-[#f15a29]/20 px-2 py-0.5 text-[10px] text-[#f8b39c]">agent mode</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        {messages.length === 0 && !pending ? (
          <div className="rounded-lg border border-dashed border-white/15 p-4 text-sm leading-6 text-white/55">
            Delegate a task. The agent inspects the workspace and proposes edits — you review and approve each diff. Your steering and review are part of the evaluation.
          </div>
        ) : (
          <div className="grid gap-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'min-w-0 break-words rounded-lg p-3 text-sm leading-6',
                  message.role === 'user' ? 'bg-[#f15a29] text-white' : 'border border-white/10 bg-white/[0.08] text-white/80',
                )}
              >
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] opacity-60">
                  {message.role === 'user' ? 'Candidate' : 'Hirewave Agent'}
                </p>
                {message.role === 'user' ? <p className="whitespace-pre-wrap">{message.content}</p> : <MarkdownMessage content={message.content} />}
              </div>
            ))}
            {pending && <AssistantThinking />}
          </div>
        )}

        {pendingProposals.length > 0 && (
          <div className="mt-4 grid gap-3">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">
              Proposed edits ({pendingProposals.length}) — review before applying
            </p>
            {pendingProposals.map((proposal) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                disabled={closed || decisionPendingId !== null}
                deciding={decisionPendingId === proposal.id}
                onDecide={onDecide}
              />
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-white/10 p-3">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          disabled={closed}
          rows={3}
          placeholder="Delegate a task, e.g. 'Find why the checkout tests fail and propose a fix.'"
          className="w-full resize-none rounded-md border border-white/10 bg-[#101010] p-3 text-sm text-white outline-none placeholder:text-white/30 disabled:opacity-50"
        />
        <button
          type="button"
          disabled={!prompt.trim() || closed || pending}
          onClick={onSend}
          className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-white text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Send className="h-4 w-4" />
          {pending ? 'Agent working' : 'Send to agent'}
        </button>
      </div>
    </aside>
  );
}

function ProposalCard({
  proposal,
  disabled,
  deciding,
  onDecide,
}: {
  proposal: AgentProposalView;
  disabled: boolean;
  deciding: boolean;
  onDecide: (proposal: AgentProposalView, decision: 'approve' | 'reject') => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-[#f15a29]/25 bg-[#f15a29]/[0.05]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <span className="truncate font-mono text-xs text-white/80">{proposal.path}</span>
        {proposal.diff && (
          <span className="flex items-center gap-2 font-mono text-[10px]">
            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-200">+{proposal.diff.additions}</span>
            <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-red-200">-{proposal.diff.deletions}</span>
          </span>
        )}
      </div>
      {proposal.rationale && <p className="px-3 py-2 text-xs leading-5 text-white/65">{proposal.rationale}</p>}

      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="text-[11px] font-bold text-white/55 underline-offset-2 hover:text-white hover:underline"
        >
          {expanded ? 'Hide diff' : 'Review diff'}
        </button>
      </div>
      {expanded && proposal.diff && (
        <div className="max-h-72 overflow-auto border-t border-white/10">
          <SplitDiffViewer diff={proposal.diff} />
        </div>
      )}

      <div className="flex gap-2 border-t border-white/10 p-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onDecide(proposal, 'approve')}
          className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md bg-emerald-500 text-xs font-black text-black disabled:cursor-not-allowed disabled:opacity-45"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {deciding ? 'Working' : 'Approve'}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onDecide(proposal, 'reject')}
          className="inline-flex h-8 flex-1 items-center justify-center rounded-md border border-white/15 text-xs font-black text-white/75 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Reject
        </button>
      </div>
    </div>
  );
}

type MarkdownBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'ordered'; items: string[] }
  | { type: 'unordered'; items: string[] }
  | { type: 'code'; language?: string; code: string };

function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  let paragraph: string[] = [];
  let ordered: string[] = [];
  let unordered: string[] = [];
  let code: string[] | null = null;
  let codeLanguage = '';

  function flushParagraph() {
    if (!paragraph.length) return;
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  }

  function flushLists() {
    if (ordered.length) blocks.push({ type: 'ordered', items: ordered });
    if (unordered.length) blocks.push({ type: 'unordered', items: unordered });
    ordered = [];
    unordered = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();
    const codeFence = trimmed.match(/^```([a-zA-Z0-9_-]*)/);

    if (codeFence) {
      if (code) {
        blocks.push({ type: 'code', language: codeLanguage || undefined, code: code.join('\n') });
        code = null;
        codeLanguage = '';
      } else {
        flushParagraph();
        flushLists();
        code = [];
        codeLanguage = codeFence[1] || '';
      }
      continue;
    }

    if (code) {
      code.push(line);
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushLists();
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushLists();
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
      continue;
    }

    const orderedItem = trimmed.match(/^\d+\.\s+(.+)$/);
    if (orderedItem) {
      flushParagraph();
      unordered = [];
      ordered.push(orderedItem[1]);
      continue;
    }

    const unorderedItem = trimmed.match(/^[-*]\s+(.+)$/);
    if (unorderedItem) {
      flushParagraph();
      ordered = [];
      unordered.push(unorderedItem[1]);
      continue;
    }

    paragraph.push(trimmed);
  }

  if (code) blocks.push({ type: 'code', language: codeLanguage || undefined, code: code.join('\n') });
  flushParagraph();
  flushLists();

  return blocks;
}

function MarkdownMessage({ content }: { content: string }) {
  const blocks = parseMarkdownBlocks(content);

  return (
    <div className="grid gap-3">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          const className = block.level === 1
            ? 'text-base font-black text-white'
            : 'text-sm font-black text-white';
          return (
            <h3 key={`${block.type}-${index}`} className={className}>
              {renderInline(block.text)}
            </h3>
          );
        }

        if (block.type === 'ordered') {
          return (
            <ol key={`${block.type}-${index}`} className="ml-5 grid list-decimal gap-1.5 text-white/75">
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>{renderInline(item)}</li>
              ))}
            </ol>
          );
        }

        if (block.type === 'unordered') {
          return (
            <ul key={`${block.type}-${index}`} className="ml-5 grid list-disc gap-1.5 text-white/75">
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }

        if (block.type === 'code') {
          return (
            <div key={`${block.type}-${index}`} className="overflow-hidden rounded-md border border-white/10 bg-black/35">
              {block.language && (
                <div className="border-b border-white/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">
                  {block.language}
                </div>
              )}
              <pre className="overflow-auto p-3 font-mono text-xs leading-5 text-white/80">
                <code>{block.code}</code>
              </pre>
            </div>
          );
        }

        return (
          <p key={`${block.type}-${index}`} className="text-white/75">
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}

function renderInline(text: string) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={`${part}-${index}`} className="rounded bg-black/35 px-1 py-0.5 font-mono text-[0.85em] text-white/90">
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={`${part}-${index}`} className="font-black text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }

    return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
  });
}

function Timer({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, new Date(expiresAt).getTime() - Date.now()));

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  return (
    <div className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 font-mono text-sm">
      <Clock className="h-4 w-4 text-white/45" />
      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      {remaining === 0 && <CheckCircle2 className="h-4 w-4 text-amber-300" />}
    </div>
  );
}
