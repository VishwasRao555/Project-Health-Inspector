import { ClockCounterClockwise, SignOut } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Brand } from "./brand";

interface AppHeaderProps {
  /** If provided, the brand resets in-page state instead of navigating. */
  onLogoClick?: () => void;
  /** Page-specific buttons rendered before the History link. */
  children?: ReactNode;
}

export function AppHeader({ onLogoClick, children }: AppHeaderProps) {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-line/0 bg-transparent">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {onLogoClick ? (
          <button onClick={onLogoClick} className="transition hover:opacity-80" aria-label="Home">
            <Brand />
          </button>
        ) : (
          <Link to="/" className="transition hover:opacity-80" aria-label="Home">
            <Brand />
          </Link>
        )}
        <div className="flex items-center gap-3">
          {children}
          <Link to="/history" className="btn-ghost !px-4 !py-2 text-xs">
            <ClockCounterClockwise size={14} /> History
          </Link>
          <span className="hidden text-xs text-slate-400 sm:inline">{user?.email}</span>
          <button
            onClick={logout}
            className="grid h-9 w-9 place-items-center rounded-full border border-rose-500/25 bg-rose-500/10 text-rose-500 transition hover:border-rose-500/50 hover:bg-rose-500/15 hover:text-rose-600 hover:shadow-[0_8px_20px_-12px_rgba(244,63,94,0.5)] active:translate-y-px"
            aria-label="Sign out"
            title="Sign out"
          >
            <SignOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
