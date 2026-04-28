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
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
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
      <SectionCard
        action={
          <button
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900"
            onClick={() => navigateTo(`/projects/${task.project_id}`)}
            type="button"
          >
            Back to project
          </button>
        }
        title={task.title}
        eyebrow="Task Detail"
        description={`Project: ${project.name}`}
      >
        <AlertBanner message={pageError} />

        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <div className="rounded-[24px] bg-slate-900 px-4 py-4 text-white">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-300">Task ID</p>
            <div className="mt-3 text-lg font-semibold">{task.id}</div>
          </div>
          <div className="rounded-[24px] bg-white/70 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.25em] text-tide">Status</p>
            <div className="mt-3">
              <StatusBadge status={task.status} />
            </div>
          </div>
          <div className="rounded-[24px] bg-white/70 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.25em] text-ember">Assignee</p>
            <div className="mt-3 text-lg font-semibold text-ink">{task.assignee_id || "None"}</div>
          </div>
          <div className="rounded-[24px] bg-white/70 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.25em] text-moss">Your Role</p>
            <div className="mt-3 text-lg font-semibold text-ink">
              {formatRoleLabel(currentProjectMember?.role_in_project || "viewer")}
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard
          title="Task Update"
          eyebrow="Workflow"
          description={
            canManageTask
              ? "Ban co the update day du title, description, status va assignee."
              : canUpdateTask
                ? "Ban la nguoi duoc assign task nay, frontend chi mo cho ban update status."
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
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-tide disabled:opacity-60"
                disabled={!canManageTask}
                onChange={(event) => setTaskForm((prev) => ({ ...prev, title: event.target.value }))}
                value={taskForm.title}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-700">Description</span>
              <textarea
                className="min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-tide disabled:opacity-60"
                disabled={!canManageTask}
                onChange={(event) =>
                  setTaskForm((prev) => ({ ...prev, description: event.target.value }))
                }
                value={taskForm.description}
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Status</span>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-tide disabled:opacity-60"
                  disabled={!canUpdateTask}
                  onChange={(event) => setTaskForm((prev) => ({ ...prev, status: event.target.value }))}
                  value={taskForm.status}
                >
                  <option value="todo">Todo</option>
                  <option value="in-progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Assignee</span>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-tide disabled:opacity-60"
                  disabled={!canManageTask}
                  onChange={(event) =>
                    setTaskForm((prev) => ({ ...prev, assignee_id: event.target.value }))
                  }
                  value={taskForm.assignee_id}
                >
                  <option value="">Keep current</option>
                  {members.map((member) => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.name} (#{member.user_id})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={!canUpdateTask || taskSubmitting}
                type="submit"
              >
                {taskSubmitting ? "Saving..." : "Update task"}
              </button>
              <button
                className="rounded-2xl border border-red-300 px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canManageTask}
                onClick={handleDeleteTask}
                type="button"
              >
                Delete task
              </button>
            </div>

            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Backend hien tai luu status dang `todo`, `in_progress`, `done`. Frontend hien thi va
              gui theo nhan de doc hon, nhung van bam sat API thuc te.
            </div>
          </form>
        </SectionCard>

        <SectionCard
          title="Comments"
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
              <span className="text-sm font-semibold text-slate-700">New comment</span>
              <textarea
                className="min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-tide"
                onChange={(event) => setNewComment(event.target.value)}
                placeholder="Them nhan xet hoac cap nhat tien do..."
                required
                value={newComment}
              />
            </label>

            <button
              className="rounded-2xl bg-ember px-5 py-3 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={commentSubmitting}
              type="submit"
            >
              {commentSubmitting ? "Posting..." : "Create comment"}
            </button>
          </form>

          <div className="mt-5 space-y-4">
            {comments.length === 0 ? (
              <EmptyState
                description="Task nay chua co comment nao. Tao comment dau tien de demo luong trao doi."
                title="No comments yet"
              />
            ) : (
              <>
                {comments.map((comment) => {
                  const canEditComment =
                    currentUser.role === "admin" ||
                    canManageTask ||
                    comment.author_id === currentUser.id;

                  const isEditing = editingCommentId === comment.id;

                  return (
                    <article
                      className="rounded-[28px] border border-slate-200 bg-white/80 px-5 py-5"
                      key={comment.id}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <span>Comment ID: {comment.id}</span>
                            <span>Author ID: {comment.author_id}</span>
                            <span>Created: {formatDate(comment.created_at)}</span>
                          </div>

                          {isEditing ? (
                            <textarea
                              className="min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-tide"
                              onChange={(event) => setEditingContent(event.target.value)}
                              value={editingContent}
                            />
                          ) : (
                            <p className="text-sm leading-7 text-slate-700">{comment.content}</p>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {canEditComment && !isEditing ? (
                            <button
                              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900"
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
                                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                                onClick={() => handleSaveComment(comment.id)}
                                type="button"
                              >
                                Save
                              </button>
                              <button
                                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
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
                              className="rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
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
              </>
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Quick Facts"
        eyebrow="Metadata"
        description="Tach rieng phan metadata de khi demo co the doi chieu nhanh voi API response."
      >
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-[24px] bg-white/70 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.25em] text-tide">Project</p>
            <div className="mt-3 text-lg font-semibold text-ink">{project.name}</div>
          </div>
          <div className="rounded-[24px] bg-white/70 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.25em] text-ember">Created By</p>
            <div className="mt-3 text-lg font-semibold text-ink">{task.created_by}</div>
          </div>
          <div className="rounded-[24px] bg-white/70 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.25em] text-moss">Created At</p>
            <div className="mt-3 text-lg font-semibold text-ink">{formatDate(task.created_at)}</div>
          </div>
          <div className="rounded-[24px] bg-white/70 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Readable Status</p>
            <div className="mt-3 text-lg font-semibold text-ink">{formatTaskStatus(task.status)}</div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
