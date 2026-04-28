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
      setProjectMessage("Project updated successfully.");
    } catch (err) {
      setProjectMessage(err.message);
    } finally {
      setProjectSubmitting(false);
    }
  }

  async function handleDeleteProject() {
    const confirmed = window.confirm("Delete this project?");
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
      setMemberMessage("Member added successfully.");
    } catch (err) {
      setMemberMessage(err.message);
    } finally {
      setMemberSubmitting(false);
    }
  }

  async function handleRemoveMember(userId) {
    const confirmed = window.confirm(`Remove user ${userId} from project?`);
    if (!confirmed) {
      return;
    }

    try {
      await removeProjectMember(projectId, userId);
      await reloadMembers();
      setMemberMessage("Member removed successfully.");
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
      setTaskMessage("Task created successfully.");

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
    return <LoadingScreen label="Loading project workspace..." />;
  }

  if (!project) {
    return (
      <EmptyState
        action={
          <button
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            onClick={() => navigateTo("/projects")}
            type="button"
          >
            Back to projects
          </button>
        }
        description="Project khong ton tai hoac ban khong co quyen xem."
        title="Project not found"
      />
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard
        action={
          <button
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900"
            onClick={() => navigateTo("/projects")}
            type="button"
          >
            Back to projects
          </button>
        }
        title={project.name}
        eyebrow="Project Detail"
        description={project.description || "No description"}
      >
        <AlertBanner message={pageError} />

        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <div className="rounded-[24px] bg-slate-900 px-4 py-4 text-white">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-300">Project ID</p>
            <div className="mt-3 text-lg font-semibold">{project.id}</div>
          </div>
          <div className="rounded-[24px] bg-white/70 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.25em] text-tide">Owner ID</p>
            <div className="mt-3 text-lg font-semibold text-ink">{project.owner_id}</div>
          </div>
          <div className="rounded-[24px] bg-white/70 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.25em] text-ember">Your Project Role</p>
            <div className="mt-3 text-lg font-semibold text-ink">
              {formatRoleLabel(currentProjectMember?.role_in_project || "viewer")}
            </div>
          </div>
          <div className="rounded-[24px] bg-white/70 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.25em] text-moss">Created</p>
            <div className="mt-3 text-lg font-semibold text-ink">{formatDate(project.created_at)}</div>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard
          title="Project Settings"
          eyebrow="Management"
          description="Cap nhat thong tin project hoac xoa project neu ban la owner."
        >
          <form className="space-y-4" onSubmit={handleUpdateProject}>
            <AlertBanner
              message={projectMessage}
              tone={projectMessage === "Project updated successfully." ? "success" : "error"}
            />

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-700">Project name</span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-tide disabled:opacity-60"
                disabled={!canManageProject}
                onChange={(event) => setProjectForm((prev) => ({ ...prev, name: event.target.value }))}
                required
                value={projectForm.name}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-700">Description</span>
              <textarea
                className="min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-tide disabled:opacity-60"
                disabled={!canManageProject}
                onChange={(event) =>
                  setProjectForm((prev) => ({ ...prev, description: event.target.value }))
                }
                value={projectForm.description}
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={!canManageProject || projectSubmitting}
                type="submit"
              >
                {projectSubmitting ? "Saving..." : "Update project"}
              </button>
              <button
                className="rounded-2xl border border-red-300 px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canDeleteProject}
                onClick={handleDeleteProject}
                type="button"
              >
                Delete project
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard
          title="Members"
          eyebrow="Team"
          description="API hien tai add member theo user ID. Moi user co the lay ID cua minh o header sau khi dang nhap."
        >
          <form className="space-y-4" onSubmit={handleAddMember}>
            <AlertBanner
              message={memberMessage}
              tone={
                memberMessage === "Member added successfully." ||
                memberMessage === "Member removed successfully."
                  ? "success"
                  : "error"
              }
            />

            <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">User ID</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-tide disabled:opacity-60"
                  disabled={!canManageProject}
                  min="1"
                  onChange={(event) => setMemberForm((prev) => ({ ...prev, user_id: event.target.value }))}
                  placeholder="2"
                  required
                  type="number"
                  value={memberForm.user_id}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Role in project</span>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-tide disabled:opacity-60"
                  disabled={!canManageProject}
                  onChange={(event) =>
                    setMemberForm((prev) => ({ ...prev, role_in_project: event.target.value }))
                  }
                  value={memberForm.role_in_project}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </label>

              <div className="flex items-end">
                <button
                  className="rounded-2xl bg-ember px-5 py-3 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!canManageProject || memberSubmitting}
                  type="submit"
                >
                  {memberSubmitting ? "Adding..." : "Add member"}
                </button>
              </div>
            </div>
          </form>

          <div className="mt-5 grid gap-3">
            {members.map((member) => (
              <article
                className="rounded-[24px] border border-slate-200 bg-white/80 px-4 py-4"
                key={member.user_id}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-lg font-semibold text-ink">{member.name}</div>
                    <div className="text-sm text-slate-600">{member.email}</div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <span>User ID: {member.user_id}</span>
                      <span>{formatRoleLabel(member.role_in_project)}</span>
                      <span>Joined: {formatDate(member.joined_at)}</span>
                    </div>
                  </div>

                  <button
                    className="rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!canManageProject || member.role_in_project === "owner"}
                    onClick={() => handleRemoveMember(member.user_id)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Tasks"
        eyebrow="Execution"
        description="Task moi co the duoc assign cho member trong project. Member thuong se chi duoc update status cua task duoc giao."
      >
        <form className="space-y-4" onSubmit={handleCreateTask}>
          <AlertBanner
            message={taskMessage}
            tone={taskMessage === "Task created successfully." ? "success" : "error"}
          />

          <div className="grid gap-4 xl:grid-cols-[1fr_1fr_0.8fr_auto]">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-700">Title</span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-tide disabled:opacity-60"
                disabled={!canManageProject}
                onChange={(event) => setTaskForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Design auth API"
                required
                value={taskForm.title}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-700">Description</span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-tide disabled:opacity-60"
                disabled={!canManageProject}
                onChange={(event) =>
                  setTaskForm((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Short summary"
                value={taskForm.description}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-700">Assignee</span>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-tide disabled:opacity-60"
                disabled={!canManageProject}
                onChange={(event) => setTaskForm((prev) => ({ ...prev, assignee_id: event.target.value }))}
                value={taskForm.assignee_id}
              >
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.name} (#{member.user_id})
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end">
              <button
                className="rounded-2xl bg-moss px-5 py-3 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!canManageProject || taskSubmitting}
                type="submit"
              >
                {taskSubmitting ? "Creating..." : "Create task"}
              </button>
            </div>
          </div>
        </form>

        <div className="mt-5 space-y-4">
          {tasks.length === 0 ? (
            <EmptyState
              description="Project nay chua co task nao. Tao task o form ben tren."
              title="No tasks yet"
            />
          ) : (
            <>
              {tasks.map((task) => (
                <article
                  className="rounded-[28px] border border-slate-200 bg-white/80 px-5 py-5 transition hover:-translate-y-0.5 hover:shadow-lg"
                  key={task.id}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-2xl text-ink">{task.title}</h3>
                        <StatusBadge status={task.status} />
                      </div>
                      <p className="text-sm text-slate-600">{task.description || "No description"}</p>
                      <div className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <span>Task ID: {task.id}</span>
                        <span>Assignee: {task.assignee_id || "None"}</span>
                        <span>Created: {formatDate(task.created_at)}</span>
                      </div>
                    </div>

                    <button
                      className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                      onClick={() => navigateTo(`/tasks/${task.id}`)}
                      type="button"
                    >
                      Open task
                    </button>
                  </div>
                </article>
              ))}

              <Pagination pagination={taskPagination} onPageChange={setTaskPage} />
            </>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
