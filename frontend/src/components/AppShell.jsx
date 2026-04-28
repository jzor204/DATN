import { navigateTo } from "../utils/router";
import { formatRoleLabel } from "../utils/format";

export default function AppShell({ currentUser, onLogout, children }) {
  return (
    <div className="min-h-screen px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="glass-panel mb-6 rounded-[28px] border border-white/70 px-5 py-5 shadow-panel">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <button
                className="text-left"
                onClick={() => navigateTo("/projects")}
                type="button"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-tide">
                  Task Management Workspace
                </p>
                <h1 className="text-3xl text-ink sm:text-4xl">Board, member, task, comment</h1>
              </button>
              <p className="max-w-2xl text-sm text-slate-600">
                Frontend MVP bat sat voi backend hien tai: auth JWT, project, member, task, comment,
                pagination va guard route.
              </p>
            </div>

            {currentUser ? (
              <div className="flex flex-col gap-3 rounded-3xl bg-white/70 px-4 py-4 sm:flex-row sm:items-center">
                <div className="text-sm text-slate-600">
                  <div className="font-semibold text-ink">{currentUser.name}</div>
                  <div>{currentUser.email}</div>
                  <div>
                    User ID: <span className="font-semibold text-ink">{currentUser.id}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                    {formatRoleLabel(currentUser.role)}
                  </span>
                  <button
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900"
                    onClick={onLogout}
                    type="button"
                  >
                    Logout
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}
