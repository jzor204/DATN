import { navigateTo } from "../utils/router";
import { formatRoleLabel } from "../utils/format";
import { useHashRoute } from "../hooks/useHashRoute";

function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default function AppShell({ currentUser, onLogout, children }) {
  const route = useHashRoute();

  const navItems = [
    {
      label: "Du an",
      path: "/projects",
      isActive: (pathname) =>
        pathname === "/projects" || pathname.startsWith("/projects/") || pathname.startsWith("/tasks/")
    },
    {
      label: "Cong viec cua toi",
      path: "/my-tasks",
      isActive: (pathname) => pathname === "/my-tasks"
    },
    {
      label: "Thanh vien",
      path: "/members",
      isActive: (pathname) => pathname === "/members"
    },
    {
      label: "Cai dat",
      path: "/settings",
      isActive: (pathname) => pathname === "/settings"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-ink">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <button
          className="border-b border-slate-200 px-5 py-5 text-left"
          onClick={() => navigateTo("/projects")}
          type="button"
        >
          <div className="text-base font-semibold text-ink">Task Management</div>
          <div className="mt-1 text-xs text-slate-500">Trello/Jira mini</div>
        </button>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const active = item.isActive(route.pathname);

            return (
              <button
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium transition ${
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
                key={item.label}
                onClick={() => navigateTo(item.path)}
                type="button"
              >
                <span>{item.label}</span>
                {active ? <span className="h-2 w-2 rounded-full bg-blue-600" /> : null}
              </button>
            );
          })}
        </nav>

        {currentUser ? (
          <div className="border-t border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                {getInitials(currentUser.name) || "U"}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-ink">{currentUser.name}</div>
                <div className="truncate text-xs text-slate-500">ID #{currentUser.id}</div>
              </div>
            </div>
          </div>
        ) : null}
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
          <div className="flex min-h-16 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 lg:hidden"
                onClick={() => navigateTo("/projects")}
                type="button"
              >
                Task Management
              </button>
              <div className="hidden min-w-[280px] items-center rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 md:flex">
                Search projects, tasks, members
              </div>
            </div>

            {currentUser ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Realtime connected
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {formatRoleLabel(currentUser.role)}
                </span>
                <div className="hidden text-right text-sm sm:block">
                  <div className="font-semibold text-ink">{currentUser.name}</div>
                  <div className="text-xs text-slate-500">{currentUser.email}</div>
                </div>
                <button
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500 hover:text-slate-900"
                  onClick={onLogout}
                  type="button"
                >
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </header>

        <main className="px-4 py-6 lg:px-6">{children}</main>
      </div>
    </div>
  );
}
