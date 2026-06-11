import { useEffect, useMemo, useRef, useState } from "react";
import { approveChangeRequest, cancelChangeRequest, rejectChangeRequest } from "../api/changeRequestApi";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "../api/notificationApi";
import { listProjectMembers, listProjects } from "../api/projectApi";
import { listTasksByProject } from "../api/taskApi";
import { navigateTo } from "../utils/router";
import { formatDate, formatDeadline, formatRoleLabel, formatTaskStatus, normalizeTaskProgress } from "../utils/format";
import { useHashRoute } from "../hooks/useHashRoute";
import { useRealtimeSubscription } from "../hooks/useRealtimeSubscription";

function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function normalizeSearchText(value = "") {
  return String(value).trim().toLowerCase();
}

function getResultText(result) {
  return [result.title, result.subtitle, result.meta].filter(Boolean).join(" ");
}

function getPreferredTheme() {
  if (typeof window === "undefined") {
    return "light";
  }

  const storedTheme = window.localStorage.getItem("task-management-theme");
  if (storedTheme === "dark" || storedTheme === "light") {
    return storedTheme;
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function buildMemberIndex(projects, memberPayloads) {
  const membersById = new Map();

  projects.forEach((project, index) => {
    const members = memberPayloads[index]?.data || [];

    members.forEach((member) => {
      const existing = membersById.get(member.user_id) || {
        id: `member-${member.user_id}`,
        type: "member",
        label: "Thành viên",
        title: member.name,
        subtitle: member.email,
        meta: `User #${member.user_id}`,
        path: `/members?search=${encodeURIComponent(member.email || member.name || member.user_id)}`,
        projects: []
      };

      existing.projects.push(project.name);
      existing.meta = `User #${member.user_id} - ${existing.projects.length} dự án`;

      membersById.set(member.user_id, existing);
    });
  });

  return Array.from(membersById.values());
}

function SearchResult({ result, onSelect }) {
  const typeTone = {
    project: "bg-blue-50 text-blue-700",
    task: "bg-emerald-50 text-emerald-700",
    member: "bg-slate-100 text-slate-700"
  };

  return (
    <button
      className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onSelect(result)}
      type="button"
    >
      <span
        className={`mt-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${
          typeTone[result.type] || typeTone.member
        }`}
      >
        {result.label}
      </span>
      <span className="min-w-0 flex-1 overflow-hidden">
        <span className="block truncate text-sm font-semibold text-ink">{result.title}</span>
        {result.subtitle ? (
          <span className="mt-0.5 block truncate text-xs text-slate-500">{result.subtitle}</span>
        ) : null}
        {result.meta ? <span className="mt-1 block truncate text-xs text-slate-400">{result.meta}</span> : null}
      </span>
    </button>
  );
}

function HeaderSearch({ currentUser }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [index, setIndex] = useState({
    projects: [],
    tasks: [],
    members: []
  });
  const rootRef = useRef(null);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!rootRef.current || rootRef.current.contains(event.target)) {
        return;
      }

      setOpen(false);
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    setQuery("");
    setOpen(false);
    setLoaded(false);
    setIndex({ projects: [], tasks: [], members: [] });
  }, [currentUser?.id]);

  async function loadSearchIndex() {
    if (loading || loaded || !currentUser?.id) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const projectPayload = await listProjects(1, 100);
      const projects = projectPayload.data || [];

      const [taskPayloads, memberPayloads] = await Promise.all([
        Promise.all(
          projects.map((project) =>
            listTasksByProject(project.id, 1, 100).catch(() => ({
              data: []
            }))
          )
        ),
        Promise.all(
          projects.map((project) =>
            listProjectMembers(project.id, 1, 100).catch(() => ({
              data: []
            }))
          )
        )
      ]);

      const projectResults = projects.map((project) => ({
        id: `project-${project.id}`,
        type: "project",
        label: "Dự án",
        title: project.name,
        subtitle: project.description || "Chưa có mô tả",
        meta: `Dự án #${project.id}`,
        path: `/projects/${project.id}`
      }));

      const taskResults = taskPayloads.flatMap((payload, index) => {
        const project = projects[index];

        return (payload.data || []).map((task) => ({
          id: `task-${task.id}`,
          type: "task",
          label: "Công việc",
          title: task.title,
          subtitle: task.description || project.name,
          meta: `${project.name} - ${formatTaskStatus(task.status)} - ${normalizeTaskProgress(
            task.progress
          )}% - ${formatDeadline(task.deadline)}`,
          path: `/tasks/${task.id}`
        }));
      });

      setIndex({
        projects: projectResults,
        tasks: taskResults,
        members: buildMemberIndex(projects, memberPayloads)
      });
      setLoaded(true);
    } catch (err) {
      setError(err.message || "Không thể tải dữ liệu tìm kiếm.");
    } finally {
      setLoading(false);
    }
  }

  const groupedResults = useMemo(() => {
    const keyword = normalizeSearchText(query);
    if (!keyword) {
      return {
        projects: [],
        tasks: [],
        members: []
      };
    }

    const matchAndLimit = (items) =>
      items
        .filter((item) => normalizeSearchText(getResultText(item)).includes(keyword))
        .slice(0, 5);

    return {
      projects: matchAndLimit(index.projects),
      tasks: matchAndLimit(index.tasks),
      members: matchAndLimit(index.members)
    };
  }, [index, query]);

  const flatResults = useMemo(
    () => [...groupedResults.projects, ...groupedResults.tasks, ...groupedResults.members],
    [groupedResults]
  );

  function handleSelect(result) {
    setOpen(false);
    setQuery("");
    navigateTo(result.path);
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }

    if (event.key === "Enter" && flatResults[0]) {
      event.preventDefault();
      handleSelect(flatResults[0]);
    }
  }

  return (
    <div className="relative w-full min-w-[280px] sm:min-w-[380px] lg:min-w-[460px] xl:min-w-[560px]" ref={rootRef}>
      <input
        className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          loadSearchIndex();
        }}
        onFocus={() => {
          setOpen(true);
          loadSearchIndex();
        }}
        onKeyDown={handleKeyDown}
        placeholder="Tìm dự án, công việc, thành viên"
        value={query}
      />

      {open ? (
        <div className="absolute left-0 top-12 z-50 w-full min-w-[320px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl sm:min-w-[520px] lg:min-w-[620px]">
          <div className="border-b border-slate-100 px-3 py-2 text-xs text-slate-500">
            {loading ? "Đang tải workspace..." : "Tìm trong dự án, công việc và thành viên bạn có quyền xem"}
          </div>

          {error ? <div className="px-3 py-3 text-sm text-red-600">{error}</div> : null}

          {!error && !query.trim() ? (
            <div className="px-3 py-3 text-sm text-slate-500">Nhập từ khóa để tìm trong workspace.</div>
          ) : null}

          {!error && query.trim() && !loading && flatResults.length === 0 ? (
            <div className="px-3 py-3 text-sm text-slate-500">Không tìm thấy kết quả phù hợp.</div>
          ) : null}

          {!error && flatResults.length > 0 ? (
            <div className="max-h-[420px] overflow-y-auto py-1">
              {groupedResults.projects.length > 0 ? (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Dự án
                  </div>
                  {groupedResults.projects.map((result) => (
                    <SearchResult key={result.id} onSelect={handleSelect} result={result} />
                  ))}
                </div>
              ) : null}

              {groupedResults.tasks.length > 0 ? (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Công việc
                  </div>
                  {groupedResults.tasks.map((result) => (
                    <SearchResult key={result.id} onSelect={handleSelect} result={result} />
                  ))}
                </div>
              ) : null}

              {groupedResults.members.length > 0 ? (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Thành viên
                  </div>
                  {groupedResults.members.map((result) => (
                    <SearchResult key={result.id} onSelect={handleSelect} result={result} />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function summarizeRequestedChanges(payload = {}) {
  const changes = payload.requested_changes || {};
  const labels = {
    title: "Tiêu đề",
    description: "Mô tả",
    status: "Trạng thái",
    assignee_ids: "Người phụ trách",
    deadline: "Deadline"
  };

  return Object.keys(changes)
    .map((key) => {
      if (key === "deadline") {
        return `${labels[key]}: ${changes[key] ? formatDate(changes[key]) : "Xóa deadline"}`;
      }
      if (key === "assignee_ids") {
        const ids = Array.isArray(changes[key]) ? changes[key] : [];
        return `${labels[key]}: ${ids.length ? ids.map((id) => `#${id}`).join(", ") : "Chưa gán"}`;
      }
      if (key === "status") {
        return `${labels[key]}: ${formatTaskStatus(changes[key])}`;
      }

      return labels[key] || key;
    })
    .join(" · ");
}

function getChangeRequestStatusLabel(status) {
  if (status === "approved") {
    return "Đã duyệt";
  }
  if (status === "rejected") {
    return "Đã từ chối";
  }
  if (status === "cancelled") {
    return "Đã hủy";
  }
  return "Đang chờ duyệt";
}

function NotificationCenter({ currentUser }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationFilter, setNotificationFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState("");
  const rootRef = useRef(null);

  const unreadCount = notifications.filter((notification) => !notification.read_at).length;
  const visibleNotifications = notifications.filter((notification) =>
    notificationFilter === "unread" ? !notification.read_at : true
  );

  async function loadNotifications({ silent = false } = {}) {
    if (!currentUser?.id) {
      return;
    }

    if (!silent) {
      setLoading(true);
    }
    setError("");

    try {
      const payload = await listNotifications(1, 20);
      setNotifications(payload.data || []);
    } catch (err) {
      setError(err.message || "Không thể tải thông báo.");
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    loadNotifications();
  }, [currentUser?.id]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!rootRef.current || rootRef.current.contains(event.target)) {
        return;
      }

      setOpen(false);
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useRealtimeSubscription({
    enabled: Boolean(currentUser?.id),
    scope: "notifications",
    currentUserId: currentUser?.id,
    ignoreSelf: false,
    onEvent: () => loadNotifications({ silent: true })
  });

  async function handleOpenNotification(notification) {
    const taskId = notification.payload?.task_id;
    if (!notification.read_at) {
      await markNotificationRead(notification.id).catch(() => null);
      await loadNotifications({ silent: true });
    }
    if (taskId) {
      setOpen(false);
      navigateTo(`/tasks/${taskId}`);
    }
  }

  async function handleReview(notification, decision) {
    const requestId = notification.payload?.change_request_id;
    if (!requestId) {
      return;
    }

    let reviewNote = "";
    if (decision === "reject") {
      const note = window.prompt("Ghi chú từ chối (tùy chọn)");
      if (note === null) {
        return;
      }
      reviewNote = note.trim();
    }

    setActionId(`${decision}-${notification.id}`);
    setError("");

    try {
      if (decision === "approve") {
        await approveChangeRequest(requestId);
      } else {
        await rejectChangeRequest(requestId, { review_note: reviewNote });
      }
      await markNotificationRead(notification.id).catch(() => null);
      await loadNotifications({ silent: true });
    } catch (err) {
      setError(err.message || "Không thể xử lý yêu cầu.");
    } finally {
      setActionId("");
    }
  }

  async function handleCancelRequest(notification) {
    const requestId = notification.payload?.change_request_id;
    if (!requestId) {
      return;
    }

    setActionId(`cancel-${notification.id}`);
    setError("");

    try {
      await cancelChangeRequest(requestId);
      await markNotificationRead(notification.id).catch(() => null);
      await loadNotifications({ silent: true });
    } catch (err) {
      setError(err.message || "Không thể hủy yêu cầu.");
    } finally {
      setActionId("");
    }
  }

  async function handleMarkAllRead() {
    setActionId("read-all");
    setError("");

    try {
      await markAllNotificationsRead();
      await loadNotifications({ silent: true });
    } catch (err) {
      setError(err.message || "Không thể đánh dấu đã đọc.");
    } finally {
      setActionId("");
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        className="relative rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-blue-400 hover:text-blue-700"
        onClick={() => setOpen((prev) => !prev)}
        type="button"
      >
        Thông báo
        {unreadCount > 0 ? (
          <span className="ml-2 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-10 z-50 w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-ink">Thông báo</div>
              <div className="text-xs text-slate-500">{unreadCount} thông báo chưa đọc</div>
            </div>
            <button
              className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-400"
              onClick={() => loadNotifications()}
              type="button"
            >
              Tải lại
            </button>
          </div>

          {error ? <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div> : null}

          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2">
            <div className="flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
              {[
                ["all", "Tất cả"],
                ["unread", "Chưa đọc"]
              ].map(([value, label]) => (
                <button
                  className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
                    notificationFilter === value ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"
                  }`}
                  key={value}
                  onClick={() => setNotificationFilter(value)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-400 disabled:opacity-50"
              disabled={unreadCount === 0 || actionId === "read-all"}
              onClick={handleMarkAllRead}
              type="button"
            >
              {actionId === "read-all" ? "Đang lưu..." : "Đọc tất cả"}
            </button>
          </div>

          <div className="max-h-[520px] overflow-y-auto p-3">
            {loading ? <div className="px-2 py-6 text-center text-sm text-slate-500">Đang tải thông báo...</div> : null}

            {!loading && visibleNotifications.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                {notificationFilter === "unread" ? "Không có thông báo chưa đọc." : "Chưa có thông báo."}
              </div>
            ) : null}

            <div className="space-y-2">
              {visibleNotifications.map((notification) => {
                const payload = notification.payload || {};
                const requestStatus = payload.change_request_status;
                const isRequester = Number(payload.requester_id) === Number(currentUser.id);
                const canReview =
                  notification.type === "task_change_request" &&
                  payload.change_request_id &&
                  requestStatus === "pending" &&
                  !isRequester;
                const canCancel =
                  notification.type === "task_change_request" &&
                  payload.change_request_id &&
                  requestStatus === "pending" &&
                  isRequester;

                return (
                  <article
                    className={`rounded-lg border px-3 py-3 text-left ${
                      notification.read_at ? "border-slate-200 bg-white" : "border-blue-200 bg-blue-50"
                    }`}
                    key={notification.id}
                  >
                    <button
                      className="block w-full text-left"
                      onClick={() => handleOpenNotification(notification)}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-ink">{notification.title}</div>
                          <div className="mt-1 text-sm leading-5 text-slate-600">{notification.message}</div>
                        </div>
                        <span className="shrink-0 text-[11px] text-slate-500">{formatDate(notification.created_at)}</span>
                      </div>

                      {payload.requested_changes ? (
                        <div className="mt-2 rounded-md bg-white px-2.5 py-2 text-xs text-slate-600">
                          {summarizeRequestedChanges(payload) || "Có thay đổi được đề xuất."}
                          {payload.reason ? <div className="mt-1 text-slate-500">Lý do: {payload.reason}</div> : null}
                          {payload.review_note ? (
                            <div className="mt-1 text-slate-500">Ghi chú xử lý: {payload.review_note}</div>
                          ) : null}
                        </div>
                      ) : null}
                    </button>

                    {canReview || canCancel ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {canReview ? (
                          <>
                            <button
                              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:bg-slate-400"
                              disabled={Boolean(actionId)}
                              onClick={() => handleReview(notification, "approve")}
                              type="button"
                            >
                              {actionId === `approve-${notification.id}` ? "Đang duyệt..." : "Duyệt"}
                            </button>
                            <button
                              className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:border-red-300 disabled:opacity-60"
                              disabled={Boolean(actionId)}
                              onClick={() => handleReview(notification, "reject")}
                              type="button"
                            >
                              {actionId === `reject-${notification.id}` ? "Đang từ chối..." : "Từ chối"}
                            </button>
                          </>
                        ) : null}
                        {canCancel ? (
                          <button
                            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-red-200 hover:text-red-700 disabled:opacity-60"
                            disabled={Boolean(actionId)}
                            onClick={() => handleCancelRequest(notification)}
                            type="button"
                          >
                            {actionId === `cancel-${notification.id}` ? "Đang hủy..." : "Hủy yêu cầu"}
                          </button>
                        ) : null}
                      </div>
                    ) : requestStatus ? (
                      <div className="mt-3 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        {getChangeRequestStatusLabel(requestStatus)}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AppShell({ currentUser, onLogout, children }) {
  const route = useHashRoute();
  const [theme, setTheme] = useState(getPreferredTheme);
  const isDarkMode = theme === "dark";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
    window.localStorage.setItem("task-management-theme", theme);
  }, [isDarkMode, theme]);

  const navItems = [
    {
      label: "Dự án",
      path: "/projects",
      isActive: (pathname) =>
        pathname === "/projects" || pathname.startsWith("/projects/") || pathname.startsWith("/tasks/")
    },
    {
      label: "Công việc của tôi",
      path: "/my-tasks",
      isActive: (pathname) => pathname === "/my-tasks"
    },
    {
      label: "Thành viên",
      path: "/members",
      isActive: (pathname) => pathname === "/members"
    },
    {
      label: "Cài đặt",
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
              {currentUser ? <HeaderSearch currentUser={currentUser} /> : null}
            </div>

            {currentUser ? (
              <div className="flex flex-wrap items-center gap-3">
                <NotificationCenter currentUser={currentUser} />
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Realtime đã kết nối
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {formatRoleLabel(currentUser.role)}
                </span>
                <button
                  aria-label={isDarkMode ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-500 hover:text-slate-900"
                  onClick={() => setTheme(isDarkMode ? "light" : "dark")}
                  type="button"
                >
                  {isDarkMode ? "Sáng" : "Tối"}
                </button>
                <div className="hidden text-right text-sm sm:block">
                  <div className="font-semibold text-ink">{currentUser.name}</div>
                  <div className="text-xs text-slate-500">{currentUser.email}</div>
                </div>
                <button
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500 hover:text-slate-900"
                  onClick={onLogout}
                  type="button"
                >
                  Đăng xuất
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
