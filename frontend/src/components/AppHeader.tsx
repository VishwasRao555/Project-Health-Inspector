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
    <header className="sticky top-0 z-30 border-b border-line bg-white shadow-sm">
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
          <Link to="/history" className="btn-nav">
            <ClockCounterClockwise size={14} /> History
          </Link>
          <span className="hidden text-xs text-slate-400 sm:inline">{user?.email}</span>
          <button
            onClick={logout}
            className="grid h-9 w-9 place-items-center rounded-full border border-line bg-rose-50 text-rose-500 transition hover:bg-rose-100 hover:text-rose-600 active:translate-y-px"
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
