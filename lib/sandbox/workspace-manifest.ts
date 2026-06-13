import crypto from 'crypto';
import type { SandboxWorkspaceManifest, WorkspaceFile } from './types';

function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function createWorkspaceManifest(files: WorkspaceFile[]): SandboxWorkspaceManifest {
  const workspaceFiles = files
    .map((file) => ({
      path: file.path,
      language: file.language,
      contentLength: Buffer.byteLength(file.content, 'utf8'),
      contentSha256: sha256(file.content),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));

  return {
    workspaceFileCount: files.length,
    workspaceTotalBytes: workspaceFiles.reduce((sum, file) => sum + file.contentLength, 0),
    workspaceDigest: sha256(JSON.stringify(workspaceFiles)),
    workspaceFiles,
  };
}

export function validateWorkspaceManifest(files: WorkspaceFile[], manifest: SandboxWorkspaceManifest) {
  const actual = createWorkspaceManifest(files);
  const ok =
    actual.workspaceDigest === manifest.workspaceDigest &&
    actual.workspaceFileCount === manifest.workspaceFileCount &&
    actual.workspaceTotalBytes === manifest.workspaceTotalBytes;

  return ok
    ? { ok: true as const, actual }
    : {
        ok: false as const,
        actual,
        expected: manifest,
      };
}
