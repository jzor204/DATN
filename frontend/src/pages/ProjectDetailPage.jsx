import { useEffect, useMemo, useState } from "react";
import {
  addProjectMember,
  deleteProject,
  getProject,
  listProjectMembers,
  removeProjectMember,
  updateProject
} from "../api/projectApi";
import { createTask, listTasksByProject } from "../api/taskApi";
import AlertBanner from "../components/AlertBanner";
import EmptyState from "../components/EmptyState";
import LoadingScreen from "../components/LoadingScreen";
import Pagination from "../components/Pagination";
import SectionCard from "../components/SectionCard";
import StatusBadge from "../components/StatusBadge";
import { useRealtimeSubscription } from "../hooks/useRealtimeSubscription";
import { formatDate, formatRoleLabel, toOptionalNumber } from "../utils/format";
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
  assignee_id: ""
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

  const groupedTasks = useMemo(() => {
    const groups = {
      todo: [],
      in_progress: [],
      done: []
    };

    tasks.forEach((task) => {
      const status = normalizeStatus(task.status);
      if (!groups[status]) {
        groups.todo.push(task);
        return;
      }
      groups[status].push(task);
    });

    return groups;
  }, [tasks]);

  useEffect(() => {
    let active = true;

    async function loadWorkspace() {
      setLoading(true);
      setPageError("");

      try {
        const [projectPayload, memberPayload, taskPayload] = await Promise.all([
          getProject(projectId),
          listProjectMembers(projectId, 1, 100),
          listTasksByProject(projectId, taskPage, 6)
        ]);

        if (!active) {
          return;
        }

        setProject(projectPayload);
        setProjectForm({
          name: projectPayload.name || "",
          description: projectPayload.description || ""
        });
        setMembers(memberPayload.data || []);
        setTasks(taskPayload.data || []);
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
  }, [projectId, taskPage]);

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
    const payload = await listTasksByProject(projectId, pageToLoad, 6);
    setTasks(payload.data || []);
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
        description: taskForm.description.trim()
      };

      if (assigneeId) {
        payload.assignee_id = assigneeId;
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
      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white px-5 py-5 shadow-panel xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Dự án / {project.name}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-ink">{project.name}</h1>
            <RoleChip role={currentProjectMember?.role_in_project || "viewer"} />
          </div>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">{project.description || "Chưa có mô tả"}</p>
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
                      className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel transition hover:border-blue-200"
                      key={task.id}
                    >
                      <button
                        className="block w-full text-left"
                        onClick={() => navigateTo(`/tasks/${task.id}`)}
                        type="button"
                      >
                        <div className="font-semibold text-ink">{task.title}</div>
                        <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                          {task.description || "Chưa có mô tả"}
                        </p>
                      </button>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <StatusBadge status={task.status} />
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          {getMemberName(members, task.assignee_id)}
                        </span>
                      </div>
                      <div className="mt-3 text-xs text-slate-500">Cập nhật {formatDate(task.updated_at || task.created_at)}</div>
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

      <SectionCard title="Cài đặt project" eyebrow="Quản lý">
        <form className="grid gap-4 lg:grid-cols-[1fr_1.4fr_auto]" onSubmit={handleUpdateProject}>
          <AlertBanner
            message={projectMessage}
            tone={projectMessage === "Cập nhật project thành công." ? "success" : "error"}
          />

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

          <div className="flex items-end gap-2">
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
        </form>
      </SectionCard>
    </div>
  );
}
