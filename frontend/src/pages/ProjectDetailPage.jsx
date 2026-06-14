import { useEffect, useMemo, useState } from "react";
import {
  addProjectMember,
  deleteProject,
  getProject,
  listProjectMembers,
  removeProjectMember,
  updateProject
} from "../api/projectApi";
import { listChecklistsByTask } from "../api/checklistApi";
import { createTask, listTaskAttachments, listTaskLabels, listTasksByProject } from "../api/taskApi";
import AlertBanner from "../components/AlertBanner";
import DeadlineBadge from "../components/DeadlineBadge";
import EmptyState from "../components/EmptyState";
import LoadingScreen from "../components/LoadingScreen";
import Pagination from "../components/Pagination";
import PriorityBadge from "../components/PriorityBadge";
import ReminderBadge from "../components/ReminderBadge";
import SectionCard from "../components/SectionCard";
import StatusBadge from "../components/StatusBadge";
import TaskModal from "../components/TaskModal";
import { useRealtimeSubscription } from "../hooks/useRealtimeSubscription";
import {
  formatDate,
  formatDeadline,
  formatDeadlineState,
  formatRoleLabel,
  formatTaskStatus,
  getDeadlineState,
  normalizeTaskProgress,
  toDeadlinePayload,
  toOptionalNumber
} from "../utils/format";
import { navigateTo } from "../utils/router";

const initialProjectForm = {
  name: "",
  description: ""
};

const initialMemberForm = {
  user_id: "",
  role_in_project: "member"
};

const initialTaskForm = {
  title: "",
  description: "",
  assignee_id: "",
  deadline: "",
  reminder_at: "",
  priority: "none"
};

const initialTaskPagination = {
  page: 1,
  page_size: 6,
  total: 0,
  total_pages: 0
};

function normalizeStatus(status) {
  if (status === "in-progress") {
    return "in_progress";
  }
  return status || "todo";
}

function getMemberName(members, userId) {
  const member = members.find((item) => Number(item.user_id) === Number(userId));
  return member?.name || (userId ? `User #${userId}` : "Chưa gán");
}

function getMemberById(members, userId) {
  return members.find((item) => Number(item.user_id) === Number(userId));
}

function getTaskAssigneeIds(task) {
  if (!task) {
    return [];
  }

  const source = Array.isArray(task.assignee_ids) ? task.assignee_ids : [];
  const ids = source.length > 0 ? source : task.assignee_id ? [task.assignee_id] : [];

  return Array.from(new Set(ids.map((id) => Number(id)).filter(Boolean)));
}

const avatarTones = [
  "bg-sky-500 text-white",
  "bg-emerald-500 text-white",
  "bg-orange-500 text-white",
  "bg-violet-500 text-white",
  "bg-rose-500 text-white",
  "bg-cyan-600 text-white",
  "bg-amber-500 text-slate-950",
  "bg-fuchsia-500 text-white"
];

function getInitials(name = "") {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || "?";
}

function getAvatarTone(userId) {
  const index = Math.abs(Number(userId) || 0) % avatarTones.length;
  return avatarTones[index];
}

function Avatar({ member, userId, size = "sm" }) {
  const displayName = member?.name || (userId ? `User #${userId}` : "?");
  const sizeClass = size === "lg" ? "h-16 w-16 text-2xl" : "h-8 w-8 text-xs";

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ring-2 ring-white ${sizeClass} ${getAvatarTone(member?.user_id || userId)}`}
      title={displayName}
    >
      {getInitials(displayName)}
    </span>
  );
}

function AssigneePopover({ member, userId, onClose, onViewProfile }) {
  const displayName = member?.name || (userId ? `User #${userId}` : "Chưa rõ");
  const email = member?.email || "Chưa có email";

  return (
    <div
      className="absolute right-0 top-10 z-30 w-72 overflow-hidden rounded-lg border border-slate-200 bg-white text-left shadow-xl"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="relative bg-blue-500 px-4 py-4 text-white">
        <button
          className="absolute right-2 top-2 rounded-md px-2 py-1 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
          onClick={onClose}
          type="button"
        >
          X
        </button>
        <div className="flex items-center gap-3">
          <Avatar member={member} size="lg" userId={userId} />
          <div className="min-w-0">
            <div className="truncate text-base font-semibold">{displayName}</div>
            <div className="truncate text-xs text-white/80">{email}</div>
          </div>
        </div>
      </div>

      <div className="space-y-3 px-4 py-4 text-sm text-slate-700">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vai trò</div>
          <div className="mt-1 font-semibold text-ink">
            {formatRoleLabel(member?.role_in_project || "member")}
          </div>
        </div>
        <button
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
          onClick={onViewProfile}
          type="button"
        >
          Xem hồ sơ
        </button>
      </div>
    </div>
  );
}

function TaskAssignees({ members, openPopover, task, onTogglePopover, onViewProfile }) {
  const assigneeIds = getTaskAssigneeIds(task);

  if (assigneeIds.length === 0) {
    return (
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
        Chưa gán
      </span>
    );
  }

  return (
    <div className="relative ml-auto flex items-center justify-end">
      <div className="flex -space-x-2">
        {assigneeIds.map((userId) => {
          const member = getMemberById(members, userId);
          const isOpen =
            openPopover?.taskId === task.id && Number(openPopover?.userId) === Number(userId);

          return (
            <div className="relative" key={userId}>
              <button
                className="rounded-full transition hover:z-10 hover:-translate-y-0.5"
                onClick={(event) => {
                  event.stopPropagation();
                  onTogglePopover(task.id, userId);
                }}
                type="button"
              >
                <Avatar member={member} userId={userId} />
              </button>
              {isOpen ? (
                <AssigneePopover
                  member={member}
                  onClose={() => onTogglePopover(null, null)}
                  onViewProfile={() => onViewProfile(member, userId)}
                  userId={userId}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function normalizeChecklistPayload(payload) {
  const list = Array.isArray(payload) ? payload : payload?.data || [];

  return list.map((checklist) => ({
    ...checklist,
    items: Array.isArray(checklist.items) ? checklist.items : []
  }));
}

function getChecklistCount(checklists) {
  const items = checklists.flatMap((checklist) => checklist.items || []);

  return {
    done: items.filter((item) => item.is_done).length,
    total: items.length
  };
}

function normalizeListPayload(payload) {
  return Array.isArray(payload) ? payload : payload?.data || [];
}

const labelToneMap = {
  blue: "bg-blue-100 text-blue-700",
  green: "bg-emerald-100 text-emerald-800",
  yellow: "bg-amber-100 text-amber-800",
  orange: "bg-orange-100 text-orange-800",
  red: "bg-red-100 text-red-700",
  purple: "bg-violet-100 text-violet-700",
  pink: "bg-pink-100 text-pink-700",
  sky: "bg-sky-100 text-sky-700",
  slate: "bg-slate-100 text-slate-700"
};

function TaskLabelPill({ label }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${labelToneMap[label.color] || labelToneMap.blue}`}>
      {label.name}
    </span>
  );
}

function RoleChip({ role }) {
  const tone =
    role === "owner"
      ? "bg-slate-900 text-white"
      : role === "admin"
        ? "bg-blue-100 text-blue-700"
        : "bg-slate-100 text-slate-700";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {formatRoleLabel(role)}
    </span>
  );
}

export default function ProjectDetailPage({ currentUser, projectId }) {
  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [taskPagination, setTaskPagination] = useState(initialTaskPagination);
  const [taskPage, setTaskPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [projectForm, setProjectForm] = useState(initialProjectForm);
  const [projectMessage, setProjectMessage] = useState("");
  const [projectSubmitting, setProjectSubmitting] = useState(false);

  const [memberForm, setMemberForm] = useState(initialMemberForm);
  const [memberMessage, setMemberMessage] = useState("");
  const [memberSubmitting, setMemberSubmitting] = useState(false);

  const [taskForm, setTaskForm] = useState(initialTaskForm);
  const [taskMessage, setTaskMessage] = useState("");
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [taskSearch, setTaskSearch] = useState("");
  const [taskStatusFilter, setTaskStatusFilter] = useState("all");
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState("all");
  const [taskDeadlineFilter, setTaskDeadlineFilter] = useState("all");
  const [taskArchiveFilter, setTaskArchiveFilter] = useState("active");
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [taskChecklistCounts, setTaskChecklistCounts] = useState({});
  const [taskLabelsById, setTaskLabelsById] = useState({});
  const [taskAttachmentCounts, setTaskAttachmentCounts] = useState({});
  const [openAssigneePopover, setOpenAssigneePopover] = useState(null);

  const currentProjectMember = useMemo(
    () => members.find((member) => member.user_id === currentUser.id),
    [currentUser.id, members]
  );

  const canManageProject =
    currentUser.role === "admin" ||
    currentProjectMember?.role_in_project === "owner" ||
    currentProjectMember?.role_in_project === "admin";

  const canDeleteProject =
    currentUser.role === "admin" || currentProjectMember?.role_in_project === "owner";

  const filteredTasks = useMemo(() => {
    const keyword = taskSearch.trim().toLowerCase();

    return tasks.filter((task) => {
      const normalizedStatus = normalizeStatus(task.status);
      const assigneeIds = getTaskAssigneeIds(task);
      const assigneeText = assigneeIds
        .map((userId) => `${getMemberName(members, userId)} #${userId}`)
        .join(" ");
      const labels = taskLabelsById[task.id] || [];
      const deadlineState = getDeadlineState(task.deadline, normalizedStatus);
      const searchableText = [
        task.title,
        task.description,
        task.status,
        formatTaskStatus(task.status),
        task.priority,
        `${normalizeTaskProgress(task.progress)}%`,
        formatDeadline(task.deadline),
        task.reminder_at,
        labels.map((label) => label.name).join(" "),
        formatDeadlineState(deadlineState),
        assigneeText,
        assigneeIds.length > 0 ? assigneeIds.map((userId) => `#${userId}`).join(" ") : "chưa gán"
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !keyword || searchableText.includes(keyword);
      const matchesStatus = taskStatusFilter === "all" || normalizedStatus === taskStatusFilter;
      const matchesAssignee =
        taskAssigneeFilter === "all" ||
        (taskAssigneeFilter === "unassigned" && assigneeIds.length === 0) ||
        assigneeIds.includes(Number(taskAssigneeFilter));
      const matchesDeadline =
        taskDeadlineFilter === "all" ||
        deadlineState === taskDeadlineFilter ||
        (taskDeadlineFilter === "active" && deadlineState !== "none" && deadlineState !== "completed");

      return matchesSearch && matchesStatus && matchesAssignee && matchesDeadline;
    });
  }, [members, taskAssigneeFilter, taskDeadlineFilter, taskLabelsById, taskSearch, taskStatusFilter, tasks]);

  const groupedTasks = useMemo(() => {
    const groups = {
      todo: [],
      in_progress: [],
      done: []
    };

    filteredTasks.forEach((task) => {
      const status = normalizeStatus(task.status);
      if (!groups[status]) {
        groups.todo.push(task);
        return;
      }
      groups[status].push(task);
    });

    return groups;
  }, [filteredTasks]);

  const hasTaskFilters =
    taskSearch.trim() !== "" ||
    taskStatusFilter !== "all" ||
    taskAssigneeFilter !== "all" ||
    taskDeadlineFilter !== "all" ||
    taskArchiveFilter !== "active";

  function resetTaskFilters() {
    setTaskSearch("");
    setTaskStatusFilter("all");
    setTaskAssigneeFilter("all");
    setTaskDeadlineFilter("all");
    setTaskArchiveFilter("active");
  }

  function toggleAssigneePopover(taskId, userId) {
    if (!taskId || !userId) {
      setOpenAssigneePopover(null);
      return;
    }

    setOpenAssigneePopover((current) =>
      current?.taskId === taskId && Number(current?.userId) === Number(userId)
        ? null
        : { taskId, userId }
    );
  }

  function handleViewAssigneeProfile(member, userId) {
    const keyword = member?.email || member?.name || userId;
    navigateTo(`/members?search=${encodeURIComponent(keyword)}`);
  }

  useEffect(() => {
    function handleWindowClick() {
      setOpenAssigneePopover(null);
    }

    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, []);

  async function loadChecklistCountsForTasks(taskItems) {
    const entries = await Promise.all(
      taskItems.map(async (task) => {
        try {
          const payload = await listChecklistsByTask(task.id);
          return [task.id, getChecklistCount(normalizeChecklistPayload(payload))];
        } catch (err) {
          return [task.id, { done: 0, total: 0 }];
        }
      })
    );

    return Object.fromEntries(entries);
  }

  async function loadTaskMetadataForTasks(taskItems) {
    const entries = await Promise.all(
      taskItems.map(async (task) => {
        try {
          const [labelPayload, attachmentPayload] = await Promise.all([
            listTaskLabels(task.id),
            listTaskAttachments(task.id)
          ]);

          return [
            task.id,
            {
              labels: normalizeListPayload(labelPayload),
              attachmentCount: normalizeListPayload(attachmentPayload).length
            }
          ];
        } catch (err) {
          return [task.id, { labels: [], attachmentCount: 0 }];
        }
      })
    );

    const labelsById = {};
    const attachmentCounts = {};
    for (const [taskId, metadata] of entries) {
      labelsById[taskId] = metadata.labels;
      attachmentCounts[taskId] = metadata.attachmentCount;
    }

    return { labelsById, attachmentCounts };
  }

  useEffect(() => {
    let active = true;

    async function loadWorkspace() {
      setLoading(true);
      setPageError("");

      try {
        const [projectPayload, memberPayload, taskPayload] = await Promise.all([
          getProject(projectId),
          listProjectMembers(projectId, 1, 100),
          listTasksByProject(projectId, taskPage, 6, { archive: taskArchiveFilter })
        ]);
        const tasksData = taskPayload.data || [];
        const checklistCounts = await loadChecklistCountsForTasks(tasksData);
        const taskMetadata = await loadTaskMetadataForTasks(tasksData);

        if (!active) {
          return;
        }

        setProject(projectPayload);
        setProjectForm({
          name: projectPayload.name || "",
          description: projectPayload.description || ""
        });
        setMembers(memberPayload.data || []);
        setTasks(tasksData);
        setTaskChecklistCounts(checklistCounts);
        setTaskLabelsById(taskMetadata.labelsById);
        setTaskAttachmentCounts(taskMetadata.attachmentCounts);
        setTaskPagination(taskPayload.pagination || initialTaskPagination);
      } catch (err) {
        if (active) {
          setPageError(err.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadWorkspace();

    return () => {
      active = false;
    };
  }, [projectId, taskArchiveFilter, taskPage]);

  async function reloadProjectOnly() {
    const payload = await getProject(projectId);
    setProject(payload);
    setProjectForm({
      name: payload.name || "",
      description: payload.description || ""
    });
  }

  async function reloadMembers() {
    const payload = await listProjectMembers(projectId, 1, 100);
    setMembers(payload.data || []);
  }

  async function reloadTasks(pageToLoad = taskPage) {
    const payload = await listTasksByProject(projectId, pageToLoad, 6, { archive: taskArchiveFilter });
    const tasksData = payload.data || [];
    const checklistCounts = await loadChecklistCountsForTasks(tasksData);
    const taskMetadata = await loadTaskMetadataForTasks(tasksData);

    setTasks(tasksData);
    setTaskChecklistCounts(checklistCounts);
    setTaskLabelsById(taskMetadata.labelsById);
    setTaskAttachmentCounts(taskMetadata.attachmentCounts);
    setTaskPagination(payload.pagination || initialTaskPagination);
  }

  useRealtimeSubscription({
    enabled: Boolean(projectId),
    scope: "project",
    projectId,
    currentUserId: currentUser.id,
    onEvent: async (event) => {
      if (!event.type) {
        return;
      }

      try {
        if (event.type === "project.deleted") {
          navigateTo("/projects", { replace: true });
          return;
        }

        if (event.type === "project.updated" || event.type === "project.created") {
          await reloadProjectOnly();
          return;
        }

        if (event.type === "project.members.changed") {
          await reloadMembers();
          return;
        }

        if (event.type.startsWith("task.")) {
          await reloadTasks(taskPage);
        }
      } catch (err) {
        setPageError(err.message);

        if (err.status === 403 || err.status === 404) {
          navigateTo("/projects", { replace: true });
        }
      }
    }
  });

  async function handleUpdateProject(event) {
    event.preventDefault();
    setProjectSubmitting(true);
    setProjectMessage("");

    try {
      await updateProject(projectId, {
        name: projectForm.name.trim(),
        description: projectForm.description.trim()
      });
      await reloadProjectOnly();
      setProjectMessage("Cập nhật project thành công.");
    } catch (err) {
      setProjectMessage(err.message);
    } finally {
      setProjectSubmitting(false);
    }
  }

  async function handleDeleteProject() {
    const confirmed = window.confirm("Xóa project này?");
    if (!confirmed) {
      return;
    }

    try {
      await deleteProject(projectId);
      navigateTo("/projects");
    } catch (err) {
      setPageError(err.message);
    }
  }

  async function handleAddMember(event) {
    event.preventDefault();
    setMemberSubmitting(true);
    setMemberMessage("");

    try {
      await addProjectMember(projectId, {
        user_id: Number(memberForm.user_id),
        role_in_project: memberForm.role_in_project
      });
      setMemberForm(initialMemberForm);
      await reloadMembers();
      setMemberMessage("Thêm thành viên thành công.");
    } catch (err) {
      setMemberMessage(err.message);
    } finally {
      setMemberSubmitting(false);
    }
  }

  async function handleRemoveMember(userId) {
    const confirmed = window.confirm(`Xóa user ${userId} khỏi project?`);
    if (!confirmed) {
      return;
    }

    try {
      await removeProjectMember(projectId, userId);
      await reloadMembers();
      setMemberMessage("Xóa thành viên thành công.");
    } catch (err) {
      setMemberMessage(err.message);
    }
  }

  async function handleCreateTask(event) {
    event.preventDefault();
    setTaskSubmitting(true);
    setTaskMessage("");

    try {
      const assigneeId = toOptionalNumber(taskForm.assignee_id);
      const payload = {
        title: taskForm.title.trim(),
        description: taskForm.description.trim(),
        priority: taskForm.priority
      };

      if (assigneeId) {
        payload.assignee_id = assigneeId;
      }

      if (taskForm.deadline) {
        payload.deadline = toDeadlinePayload(taskForm.deadline);
      }

      if (taskForm.reminder_at) {
        payload.reminder_at = toDeadlinePayload(taskForm.reminder_at);
      }

      await createTask(projectId, payload);
      setTaskForm(initialTaskForm);
      setTaskMessage("Tạo công việc thành công.");

      if (taskPage !== 1) {
        setTaskPage(1);
      } else {
        await reloadTasks(1);
      }
    } catch (err) {
      setTaskMessage(err.message);
    } finally {
      setTaskSubmitting(false);
    }
  }

  if (loading) {
    return <LoadingScreen label="Đang tải workspace dự án..." />;
  }

  if (!project) {
    return (
      <EmptyState
        action={
          <button
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            onClick={() => navigateTo("/projects")}
            type="button"
          >
            Quay lại danh sách dự án
          </button>
        }
        description="Project không tồn tại hoặc bạn không có quyền xem."
        title="Không tìm thấy project"
      />
    );
  }

  const boardColumns = [
    { key: "todo", title: "Cần làm", hint: "Việc cần xử lý" },
    { key: "in_progress", title: "Đang làm", hint: "Đang thực hiện" },
    { key: "done", title: "Hoàn thành", hint: "Đã hoàn tất" }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 rounded-lg border border-slate-200 bg-white px-5 py-5 shadow-panel xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Dự án / {project.name}
          </div>
          {canManageProject ? (
            <form className="mt-3 space-y-3" onSubmit={handleUpdateProject}>
              <div className="flex flex-wrap items-center gap-2">
                <RoleChip role={currentProjectMember?.role_in_project || "viewer"} />
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  Project #{project.id}
                </span>
              </div>

              <div className="grid gap-3 xl:grid-cols-[minmax(220px,360px)_minmax(260px,1fr)_auto] xl:items-end">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-slate-700">Tên project</span>
                  <input
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                    disabled={!canManageProject}
                    onChange={(event) => setProjectForm((prev) => ({ ...prev, name: event.target.value }))}
                    required
                    value={projectForm.name}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-slate-700">Mô tả</span>
                  <input
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                    disabled={!canManageProject}
                    onChange={(event) =>
                      setProjectForm((prev) => ({ ...prev, description: event.target.value }))
                    }
                    value={projectForm.description}
                  />
                </label>

                <div className="flex gap-2">
                  <button
                    className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                    disabled={!canManageProject || projectSubmitting}
                    type="submit"
                  >
                    {projectSubmitting ? "Đang lưu..." : "Lưu"}
                  </button>
                  <button
                    className="rounded-md border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!canDeleteProject}
                    onClick={handleDeleteProject}
                    type="button"
                  >
                    Xóa
                  </button>
                </div>
              </div>

              <AlertBanner
                message={projectMessage}
                tone={projectMessage === "Cập nhật project thành công." ? "success" : "error"}
              />
            </form>
          ) : null}

          {!canManageProject ? (
            <>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-ink">{project.name}</h1>
            <RoleChip role={currentProjectMember?.role_in_project || "viewer"} />
          </div>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">{project.description || "Chưa có mô tả"}</p>
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
            onClick={() => navigateTo("/projects")}
            type="button"
          >
            Quay lại
          </button>
          <button
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={!canManageProject}
            form="create-task-form"
            type="submit"
          >
            Tạo công việc
          </button>
        </div>
      </div>

      <AlertBanner message={pageError} />

      <div className="flex flex-wrap items-center gap-2">
        {["Bảng", "Công việc", "Thành viên"].map((tab) => (
          <span
            className={`rounded-md px-3 py-2 text-sm font-semibold ${
              tab === "Bảng" ? "bg-blue-50 text-blue-700" : "bg-white text-slate-600"
            } border border-slate-200`}
            key={tab}
          >
            {tab}
          </span>
        ))}
        <span className="ml-auto rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          Realtime scope dự án
        </span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <SectionCard title="Lọc công việc" eyebrow="Task filter">
            <div className="grid gap-3 xl:grid-cols-[1fr_170px_210px_180px_170px_auto]">
              <input
                className="rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => setTaskSearch(event.target.value)}
                placeholder="Tìm theo tiêu đề, mô tả, người phụ trách"
                value={taskSearch}
              />

              <select
                className="rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => setTaskStatusFilter(event.target.value)}
                value={taskStatusFilter}
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="todo">Cần làm</option>
                <option value="in_progress">Đang làm</option>
                <option value="done">Hoàn thành</option>
              </select>

              <select
                className="rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => setTaskAssigneeFilter(event.target.value)}
                value={taskAssigneeFilter}
              >
                <option value="all">Tất cả người phụ trách</option>
                <option value="unassigned">Chưa gán</option>
                {members.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.name}
                  </option>
                ))}
              </select>

              <select
                className="rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => setTaskDeadlineFilter(event.target.value)}
                value={taskDeadlineFilter}
              >
                <option value="all">Tất cả hạn chót</option>
                <option value="active">Có hạn chót</option>
                <option value="overdue">Quá hạn</option>
                <option value="today">Đến hạn hôm nay</option>
                <option value="soon">Sắp đến hạn</option>
                <option value="none">Chưa có hạn chót</option>
              </select>

              <select
                className="rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => {
                  setTaskArchiveFilter(event.target.value);
                  setTaskPage(1);
                }}
                value={taskArchiveFilter}
              >
                <option value="active">Đang hoạt động</option>
                <option value="archived">Đã lưu trữ</option>
                <option value="all">Tất cả</option>
              </select>

              <button
                className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!hasTaskFilters}
                onClick={resetTaskFilters}
                type="button"
              >
                Xóa lọc
              </button>
            </div>

            <div className="mt-3 text-xs text-slate-500">
              Đang hiển thị{" "}
              <span className="font-semibold text-slate-700">{filteredTasks.length}</span> /{" "}
              <span className="font-semibold text-slate-700">{tasks.length}</span> công việc ở trang hiện tại.
            </div>
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-3">
            {boardColumns.map((column) => (
              <section className="rounded-lg border border-slate-200 bg-slate-100/70 p-3" key={column.key}>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-ink">{column.title}</h2>
                    <p className="text-xs text-slate-500">{column.hint}</p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {groupedTasks[column.key].length}
                  </span>
                </div>

                <div className="space-y-3">
                  {groupedTasks[column.key].length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
                      Chưa có công việc
                    </div>
                  ) : null}

                  {groupedTasks[column.key].map((task) => (
                    <article
                      className="task-card rounded-lg border border-slate-200 bg-white p-4 shadow-panel transition"
                      key={task.id}
                    >
                      <button
                        className="block w-full text-left"
                        onClick={() => setSelectedTaskId(task.id)}
                        type="button"
                      >
                        <div className="font-semibold text-ink">{task.title}</div>
                        <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                          {task.description || "Chưa có mô tả"}
                        </p>
                      </button>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <StatusBadge status={task.status} />
                        <PriorityBadge priority={task.priority} />
                        <DeadlineBadge deadline={task.deadline} status={normalizeStatus(task.status)} />
                        {task.archived_at ? (
                          <span className="inline-flex rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            Đã lưu trữ
                          </span>
                        ) : null}
                        {task.reminder_at ? (
                          <ReminderBadge deadline={task.deadline} reminderAt={task.reminder_at} />
                        ) : null}
                        <TaskAssignees
                          members={members}
                          onTogglePopover={toggleAssigneePopover}
                          onViewProfile={handleViewAssigneeProfile}
                          openPopover={openAssigneePopover}
                          task={task}
                        />
                      </div>
                      {(taskLabelsById[task.id] || []).length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(taskLabelsById[task.id] || []).slice(0, 4).map((label) => (
                            <TaskLabelPill key={label.id} label={label} />
                          ))}
                        </div>
                      ) : null}
                      <div className="mt-3 space-y-1 text-xs text-slate-500">
                        <div className="flex items-center justify-between gap-2">
                          <span>Hạn chót {formatDeadline(task.deadline)}</span>
                          <div className="flex shrink-0 gap-1">
                            {taskAttachmentCounts[task.id] > 0 ? (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                                File {taskAttachmentCounts[task.id]}
                              </span>
                            ) : null}
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                              {taskChecklistCounts[task.id]?.done || 0}/{taskChecklistCounts[task.id]?.total || 0}
                            </span>
                          </div>
                        </div>
                        <div>Cập nhật {formatDate(task.updated_at || task.created_at)}</div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <Pagination pagination={taskPagination} onPageChange={setTaskPage} />
        </div>

        <div className="space-y-4">
          <SectionCard title="Tạo công việc" eyebrow="Thao tác bảng">
            <form className="space-y-4" id="create-task-form" onSubmit={handleCreateTask}>
              <AlertBanner
                message={taskMessage}
                tone={taskMessage === "Tạo công việc thành công." ? "success" : "error"}
              />

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Tiêu đề</span>
                <input
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                  disabled={!canManageProject}
                  onChange={(event) => setTaskForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Kết nối realtime WebSocket"
                  required
                  value={taskForm.title}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Mô tả</span>
                <textarea
                  className="min-h-20 w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                  disabled={!canManageProject}
                  onChange={(event) =>
                    setTaskForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  placeholder="Tóm tắt ngắn"
                  value={taskForm.description}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Người phụ trách</span>
                <select
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                  disabled={!canManageProject}
                  onChange={(event) => setTaskForm((prev) => ({ ...prev, assignee_id: event.target.value }))}
                  value={taskForm.assignee_id}
                >
                  <option value="">Chưa gán</option>
                  {members.map((member) => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.name} (#{member.user_id})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Ưu tiên</span>
                <select
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                  disabled={!canManageProject}
                  onChange={(event) => setTaskForm((prev) => ({ ...prev, priority: event.target.value }))}
                  value={taskForm.priority}
                >
                  <option value="none">Không ưu tiên</option>
                  <option value="low">Thấp</option>
                  <option value="medium">Trung bình</option>
                  <option value="high">Cao</option>
                  <option value="urgent">Khẩn cấp</option>
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Hạn chót</span>
                <input
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                  disabled={!canManageProject}
                  onChange={(event) => setTaskForm((prev) => ({ ...prev, deadline: event.target.value }))}
                  type="datetime-local"
                  value={taskForm.deadline}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Nhắc hạn</span>
                <input
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                  disabled={!canManageProject}
                  onChange={(event) => setTaskForm((prev) => ({ ...prev, reminder_at: event.target.value }))}
                  type="datetime-local"
                  value={taskForm.reminder_at}
                />
              </label>

              <button
                className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={!canManageProject || taskSubmitting}
                type="submit"
              >
                {taskSubmitting ? "Đang tạo..." : "Tạo công việc"}
              </button>
            </form>
          </SectionCard>

          <SectionCard title="Thành viên" eyebrow="Nhóm project">
            <form className="space-y-3" onSubmit={handleAddMember}>
              <AlertBanner
                message={memberMessage}
                tone={
                  memberMessage === "Thêm thành viên thành công." ||
                  memberMessage === "Xóa thành viên thành công."
                    ? "success"
                    : "error"
                }
              />
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  className="rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                  disabled={!canManageProject}
                  min="1"
                  onChange={(event) => setMemberForm((prev) => ({ ...prev, user_id: event.target.value }))}
                  placeholder="User ID"
                  required
                  type="number"
                  value={memberForm.user_id}
                />
                <button
                  className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                  disabled={!canManageProject || memberSubmitting}
                  type="submit"
                >
                  Thêm
                </button>
              </div>
              <select
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                disabled={!canManageProject}
                onChange={(event) =>
                  setMemberForm((prev) => ({ ...prev, role_in_project: event.target.value }))
                }
                value={memberForm.role_in_project}
              >
                <option value="member">Thành viên</option>
                <option value="admin">Quản trị</option>
              </select>
            </form>

            <div className="mt-4 space-y-3">
              {members.map((member) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3"
                  key={member.user_id}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-ink">{member.name}</div>
                    <div className="truncate text-xs text-slate-500">#{member.user_id} {member.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <RoleChip role={member.role_in_project} />
                    <button
                      className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!canManageProject || member.role_in_project === "owner"}
                      onClick={() => handleRemoveMember(member.user_id)}
                      type="button"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      {selectedTaskId ? (
        <TaskModal
          currentUser={currentUser}
          members={members}
          onChanged={() => reloadTasks(taskPage)}
          onClose={() => setSelectedTaskId(null)}
          project={project}
          taskId={selectedTaskId}
        />
      ) : null}
    </div>
  );
}
