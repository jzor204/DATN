import { useEffect, useMemo, useState } from "react";
import { createComment, deleteComment, listCommentsByTask, updateComment } from "../api/commentApi";
import { getProject, listProjectMembers } from "../api/projectApi";
import { deleteTask, getTask, updateTask } from "../api/taskApi";
import AlertBanner from "../components/AlertBanner";
import EmptyState from "../components/EmptyState";
import LoadingScreen from "../components/LoadingScreen";
import Pagination from "../components/Pagination";
import SectionCard from "../components/SectionCard";
import StatusBadge from "../components/StatusBadge";
import { useRealtimeSubscription } from "../hooks/useRealtimeSubscription";
import {
  formatDate,
  formatRoleLabel,
  formatTaskStatus,
  toOptionalNumber,
  toTaskStatusInput
} from "../utils/format";
import { navigateTo } from "../utils/router";

const initialTaskForm = {
  title: "",
  description: "",
  status: "todo",
  assignee_id: ""
};

const initialCommentPagination = {
  page: 1,
  page_size: 8,
  total: 0,
  total_pages: 0
};

function getMemberName(members, userId) {
  const member = members.find((item) => Number(item.user_id) === Number(userId));
  return member?.name || (userId ? `User #${userId}` : "Unassigned");
}

function MetadataRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 text-sm last:border-b-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-semibold text-ink">{value}</span>
    </div>
  );
}

export default function TaskDetailPage({ currentUser, taskId }) {
  const [task, setTask] = useState(null);
  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [comments, setComments] = useState([]);
  const [commentPagination, setCommentPagination] = useState(initialCommentPagination);
  const [commentPage, setCommentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [taskForm, setTaskForm] = useState(initialTaskForm);
  const [taskMessage, setTaskMessage] = useState("");
  const [taskSubmitting, setTaskSubmitting] = useState(false);

  const [newComment, setNewComment] = useState("");
  const [commentMessage, setCommentMessage] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingContent, setEditingContent] = useState("");

  const currentProjectMember = useMemo(
    () => members.find((member) => member.user_id === currentUser.id),
    [currentUser.id, members]
  );

  const canManageTask =
    currentUser.role === "admin" ||
    currentProjectMember?.role_in_project === "owner" ||
    currentProjectMember?.role_in_project === "admin";

  const canUpdateTask = canManageTask || task?.assignee_id === currentUser.id;

  useEffect(() => {
    let active = true;

    async function loadWorkspace() {
      setLoading(true);
      setPageError("");

      try {
        const taskPayload = await getTask(taskId);
        const [projectPayload, memberPayload, commentPayload] = await Promise.all([
          getProject(taskPayload.project_id),
          listProjectMembers(taskPayload.project_id, 1, 100),
          listCommentsByTask(taskId, commentPage, 8)
        ]);

        if (!active) {
          return;
        }

        setTask(taskPayload);
        setProject(projectPayload);
        setMembers(memberPayload.data || []);
        setComments(commentPayload.data || []);
        setCommentPagination(commentPayload.pagination || initialCommentPagination);
        setTaskForm({
          title: taskPayload.title || "",
          description: taskPayload.description || "",
          status: toTaskStatusInput(taskPayload.status),
          assignee_id: taskPayload.assignee_id ? String(taskPayload.assignee_id) : ""
        });
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
  }, [taskId, commentPage]);

  async function reloadTaskWorkspace(pageToLoad = commentPage) {
    const taskPayload = await getTask(taskId);
    const [projectPayload, memberPayload, commentPayload] = await Promise.all([
      getProject(taskPayload.project_id),
      listProjectMembers(taskPayload.project_id, 1, 100),
      listCommentsByTask(taskId, pageToLoad, 8)
    ]);

    setTask(taskPayload);
    setProject(projectPayload);
    setMembers(memberPayload.data || []);
    setComments(commentPayload.data || []);
    setCommentPagination(commentPayload.pagination || initialCommentPagination);
    setTaskForm({
      title: taskPayload.title || "",
      description: taskPayload.description || "",
      status: toTaskStatusInput(taskPayload.status),
      assignee_id: taskPayload.assignee_id ? String(taskPayload.assignee_id) : ""
    });
  }

  useRealtimeSubscription({
    enabled: Boolean(project?.id),
    scope: "project",
    projectId: project?.id,
    currentUserId: currentUser.id,
    onEvent: async (event) => {
      if (!event.type || !event.type.startsWith("project.")) {
        return;
      }

      if (event.type === "project.deleted") {
        navigateTo("/projects", { replace: true });
        return;
      }

      try {
        await reloadTaskWorkspace(commentPage);
        setEditingCommentId(null);
        setEditingContent("");
      } catch (err) {
        setPageError(err.message);

        if (err.status === 403 || err.status === 404) {
          navigateTo("/projects", { replace: true });
        }
      }
    }
  });

  useRealtimeSubscription({
    enabled: Boolean(taskId),
    scope: "task",
    taskId,
    currentUserId: currentUser.id,
    onEvent: async (event) => {
      if (!event.type) {
        return;
      }

      if (event.type === "task.deleted") {
        navigateTo(task?.project_id ? `/projects/${task.project_id}` : "/projects", { replace: true });
        return;
      }

      try {
        await reloadTaskWorkspace(commentPage);
        setEditingCommentId(null);
        setEditingContent("");
      } catch (err) {
        setPageError(err.message);

        if (err.status === 403 || err.status === 404) {
          navigateTo("/projects", { replace: true });
        }
      }
    }
  });

  async function handleUpdateTask(event) {
    event.preventDefault();
    if (!task) {
      return;
    }

    setTaskSubmitting(true);
    setTaskMessage("");

    try {
      const payload = {};
      const nextTitle = taskForm.title.trim();
      const nextDescription = taskForm.description.trim();
      const nextAssigneeId = toOptionalNumber(taskForm.assignee_id);

      if (canManageTask && nextTitle && nextTitle !== task.title) {
        payload.title = nextTitle;
      }

      if (canManageTask && nextDescription !== (task.description || "")) {
        payload.description = nextDescription;
      }

      if (taskForm.status !== toTaskStatusInput(task.status)) {
        payload.status = taskForm.status;
      }

      if (canManageTask && nextAssigneeId && nextAssigneeId !== task.assignee_id) {
        payload.assignee_id = nextAssigneeId;
      }

      if (Object.keys(payload).length === 0) {
        setTaskMessage("No changes detected.");
        return;
      }

      await updateTask(taskId, payload);
      await reloadTaskWorkspace();
      setTaskMessage("Task updated successfully.");
    } catch (err) {
      setTaskMessage(err.message);
    } finally {
      setTaskSubmitting(false);
    }
  }

  async function handleDeleteTask() {
    if (!task) {
      return;
    }

    const confirmed = window.confirm("Delete this task?");
    if (!confirmed) {
      return;
    }

    try {
      await deleteTask(taskId);
      navigateTo(`/projects/${task.project_id}`);
    } catch (err) {
      setPageError(err.message);
    }
  }

  async function handleCreateComment(event) {
    event.preventDefault();
    setCommentSubmitting(true);
    setCommentMessage("");

    try {
      await createComment(taskId, {
        content: newComment.trim()
      });
      setNewComment("");
      setCommentMessage("Comment created successfully.");

      if (commentPage !== 1) {
        setCommentPage(1);
      } else {
        await reloadTaskWorkspace(1);
      }
    } catch (err) {
      setCommentMessage(err.message);
    } finally {
      setCommentSubmitting(false);
    }
  }

  async function handleSaveComment(commentId) {
    try {
      await updateComment(commentId, {
        content: editingContent.trim()
      });
      setEditingCommentId(null);
      setEditingContent("");
      setCommentMessage("Comment updated successfully.");
      await reloadTaskWorkspace();
    } catch (err) {
      setCommentMessage(err.message);
    }
  }

  async function handleDeleteComment(commentId) {
    const confirmed = window.confirm("Delete this comment?");
    if (!confirmed) {
      return;
    }

    try {
      await deleteComment(commentId);
      setCommentMessage("Comment deleted successfully.");
      await reloadTaskWorkspace();
    } catch (err) {
      setCommentMessage(err.message);
    }
  }

  if (loading) {
    return <LoadingScreen label="Loading task detail..." />;
  }

  if (!task || !project) {
    return (
      <EmptyState
        action={
          <button
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            onClick={() => navigateTo("/projects")}
            type="button"
          >
            Back to projects
          </button>
        }
        description="Task khong ton tai hoac ban khong co quyen xem."
        title="Task not found"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white px-5 py-5 shadow-panel xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Du an / {project.name} / Task #{task.id}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-ink">{task.title}</h1>
            <StatusBadge status={task.status} />
          </div>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            {task.description || "No description"}
          </p>
        </div>

        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
          onClick={() => navigateTo(`/projects/${task.project_id}`)}
          type="button"
        >
          Back to project
        </button>
      </div>

      <AlertBanner message={pageError} />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <SectionCard title="Noi dung cong viec" eyebrow="Task detail">
            <div className="rounded-lg bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
              {task.description ||
                "Frontend subscribe theo scope projects/project/task va refetch lai du lieu khi nhan event realtime."}
            </div>
          </SectionCard>

          <SectionCard
            title="Binh luan"
            eyebrow="Discussion"
            description={`Co ${commentPagination.total} comment trong task nay.`}
          >
            <form className="space-y-4" onSubmit={handleCreateComment}>
              <AlertBanner
                message={commentMessage}
                tone={
                  commentMessage === "Comment created successfully." ||
                  commentMessage === "Comment updated successfully." ||
                  commentMessage === "Comment deleted successfully."
                    ? "success"
                    : "error"
                }
              />

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Viet binh luan</span>
                <textarea
                  className="min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  onChange={(event) => setNewComment(event.target.value)}
                  placeholder="Viet binh luan..."
                  required
                  value={newComment}
                />
              </label>

              <button
                className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={commentSubmitting}
                type="submit"
              >
                {commentSubmitting ? "Dang gui..." : "Gui binh luan"}
              </button>
            </form>

            <div className="mt-5 space-y-3">
              {comments.length === 0 ? (
                <EmptyState
                  description="Task nay chua co comment nao."
                  title="No comments yet"
                />
              ) : null}

              {comments.map((comment) => {
                const canEditComment =
                  currentUser.role === "admin" ||
                  canManageTask ||
                  comment.author_id === currentUser.id;

                const isEditing = editingCommentId === comment.id;

                return (
                  <article
                    className="rounded-lg border border-slate-200 bg-white px-4 py-4"
                    key={comment.id}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                          <span className="font-semibold text-slate-700">Author #{comment.author_id}</span>
                          <span>{formatDate(comment.created_at)}</span>
                        </div>

                        {isEditing ? (
                          <textarea
                            className="mt-3 min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            onChange={(event) => setEditingContent(event.target.value)}
                            value={editingContent}
                          />
                        ) : (
                          <p className="mt-3 text-sm leading-6 text-slate-700">{comment.content}</p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {canEditComment && !isEditing ? (
                          <button
                            className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-500"
                            onClick={() => {
                              setEditingCommentId(comment.id);
                              setEditingContent(comment.content);
                            }}
                            type="button"
                          >
                            Edit
                          </button>
                        ) : null}

                        {canEditComment && isEditing ? (
                          <>
                            <button
                              className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                              onClick={() => handleSaveComment(comment.id)}
                              type="button"
                            >
                              Save
                            </button>
                            <button
                              className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                              onClick={() => {
                                setEditingCommentId(null);
                                setEditingContent("");
                              }}
                              type="button"
                            >
                              Cancel
                            </button>
                          </>
                        ) : null}

                        {canEditComment ? (
                          <button
                            className="rounded-md border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                            onClick={() => handleDeleteComment(comment.id)}
                            type="button"
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}

              <Pagination pagination={commentPagination} onPageChange={setCommentPage} />
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Metadata" eyebrow="Task">
            <div className="rounded-lg border border-slate-200 px-4">
              <MetadataRow label="Trang thai" value={formatTaskStatus(task.status)} />
              <MetadataRow label="Nguoi phu trach" value={getMemberName(members, task.assignee_id)} />
              <MetadataRow label="Nguoi tao" value={`User #${task.created_by}`} />
              <MetadataRow label="Project" value={project.name} />
              <MetadataRow label="Task ID" value={`#${task.id}`} />
              <MetadataRow label="Created at" value={formatDate(task.created_at)} />
              <MetadataRow label="Updated at" value={formatDate(task.updated_at)} />
              <MetadataRow label="Your role" value={formatRoleLabel(currentProjectMember?.role_in_project || "viewer")} />
            </div>
          </SectionCard>

          <SectionCard
            title="Cap nhat cong viec"
            eyebrow="Workflow"
            description={
              canManageTask
                ? "Ban co the update title, description, status va assignee."
                : canUpdateTask
                  ? "Ban duoc assign task nay, co the update status."
                  : "Ban chi co quyen xem task nay."
            }
          >
            <form className="space-y-4" onSubmit={handleUpdateTask}>
              <AlertBanner
                message={taskMessage}
                tone={
                  taskMessage === "Task updated successfully." || taskMessage === "No changes detected."
                    ? "success"
                    : "error"
                }
              />

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Title</span>
                <input
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                  disabled={!canManageTask}
                  onChange={(event) => setTaskForm((prev) => ({ ...prev, title: event.target.value }))}
                  value={taskForm.title}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Description</span>
                <textarea
                  className="min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                  disabled={!canManageTask}
                  onChange={(event) =>
                    setTaskForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  value={taskForm.description}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Trang thai</span>
                <select
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                  disabled={!canUpdateTask}
                  onChange={(event) => setTaskForm((prev) => ({ ...prev, status: event.target.value }))}
                  value={taskForm.status}
                >
                  <option value="todo">todo</option>
                  <option value="in-progress">in-progress</option>
                  <option value="done">done</option>
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Nguoi phu trach</span>
                <select
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                  disabled={!canManageTask}
                  onChange={(event) =>
                    setTaskForm((prev) => ({ ...prev, assignee_id: event.target.value }))
                  }
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

              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  disabled={!canUpdateTask || taskSubmitting}
                  type="submit"
                >
                  {taskSubmitting ? "Saving..." : "Luu thay doi"}
                </button>
                <button
                  className="rounded-md border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canManageTask}
                  onClick={handleDeleteTask}
                  type="button"
                >
                  Xoa cong viec
                </button>
              </div>
            </form>
          </SectionCard>

          <SectionCard title="Realtime event log" eyebrow="WebSocket">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700">
                <span>task.updated</span>
                <span className="text-xs font-semibold">listening</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2 text-blue-700">
                <span>comment.created</span>
                <span className="text-xs font-semibold">task scope</span>
              </div>
              <div className="text-xs text-slate-500">
                Frontend refetch task detail khi nhan event hop le.
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
