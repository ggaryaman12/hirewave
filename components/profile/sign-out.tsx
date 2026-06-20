'use client';

import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: '/' })}
      className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-xs font-bold text-white/60 hover:bg-white/10 hover:text-white"
    >
      <LogOut className="h-3.5 w-3.5" /> Sign out
    </button>
  );
}
