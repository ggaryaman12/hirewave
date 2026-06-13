const RESERVED_WORKSPACE_ROOTS = new Set(['.git', '.hirewave', 'node_modules']);

export type WorkspacePathValidation =
  | { ok: true; path: string }
  | {
      ok: false;
      path: string;
      reason: 'empty_path' | 'absolute_path' | 'path_traversal' | 'reserved_path';
    };

export function normalizeWorkspacePath(path: string) {
  return path
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^(\.\/)+/, '');
}

export function validateWorkspacePath(rawPath: string): WorkspacePathValidation {
  const trimmedPath = rawPath.trim();
  const normalizedPath = normalizeWorkspacePath(rawPath);

  if (!normalizedPath) {
    return { ok: false, path: rawPath, reason: 'empty_path' };
  }

  if (trimmedPath.startsWith('/') || trimmedPath.startsWith('\\') || normalizedPath.startsWith('/')) {
    return { ok: false, path: rawPath, reason: 'absolute_path' };
  }

  if (/^[a-zA-Z]:[\\/]/.test(trimmedPath)) {
    return { ok: false, path: rawPath, reason: 'absolute_path' };
  }

  const parts = normalizedPath.split('/');
  if (parts.some((part) => !part || part === '..' || part === '.')) {
    return { ok: false, path: rawPath, reason: 'path_traversal' };
  }

  if (RESERVED_WORKSPACE_ROOTS.has(parts[0])) {
    return { ok: false, path: rawPath, reason: 'reserved_path' };
  }

  return { ok: true, path: normalizedPath };
}

