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
  return member?.name || (userId ? `User #${userId}` : "Chưa gán");
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
        setTaskMessage("Không có thay đổi.");
        return;
      }

      await updateTask(taskId, payload);
      await reloadTaskWorkspace();
      setTaskMessage("Cập nhật công việc thành công.");
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

    const confirmed = window.confirm("Xóa công việc này?");
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
      setCommentMessage("Tạo bình luận thành công.");

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
      setCommentMessage("Cập nhật bình luận thành công.");
      await reloadTaskWorkspace();
    } catch (err) {
      setCommentMessage(err.message);
    }
  }

  async function handleDeleteComment(commentId) {
    const confirmed = window.confirm("Xóa bình luận này?");
    if (!confirmed) {
      return;
    }

    try {
      await deleteComment(commentId);
      setCommentMessage("Xóa bình luận thành công.");
      await reloadTaskWorkspace();
    } catch (err) {
      setCommentMessage(err.message);
    }
  }

  if (loading) {
    return <LoadingScreen label="Đang tải chi tiết công việc..." />;
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
            Quay lại danh sách dự án
          </button>
        }
        description="Task không tồn tại hoặc bạn không có quyền xem."
        title="Không tìm thấy task"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white px-5 py-5 shadow-panel xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Dự án / {project.name} / Task #{task.id}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-ink">{task.title}</h1>
            <StatusBadge status={task.status} />
          </div>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            {task.description || "Chưa có mô tả"}
          </p>
        </div>

        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
          onClick={() => navigateTo(`/projects/${task.project_id}`)}
          type="button"
        >
          Quay lại project
        </button>
      </div>

      <AlertBanner message={pageError} />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <SectionCard title="Nội dung công việc" eyebrow="Chi tiết task">
            <div className="rounded-lg bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
              {task.description ||
                "Frontend subscribe theo scope projects/project/task và tải lại dữ liệu khi nhận event realtime."}
            </div>
          </SectionCard>

          <SectionCard
            title="Bình luận"
            eyebrow="Thảo luận"
            description={`Có ${commentPagination.total} bình luận trong task này.`}
          >
            <form className="space-y-4" onSubmit={handleCreateComment}>
              <AlertBanner
                message={commentMessage}
                tone={
                  commentMessage === "Tạo bình luận thành công." ||
                  commentMessage === "Cập nhật bình luận thành công." ||
                  commentMessage === "Xóa bình luận thành công."
                    ? "success"
                    : "error"
                }
              />

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Viết bình luận</span>
                <textarea
                  className="min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  onChange={(event) => setNewComment(event.target.value)}
                  placeholder="Viết bình luận..."
                  required
                  value={newComment}
                />
              </label>

              <button
                className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={commentSubmitting}
                type="submit"
              >
                {commentSubmitting ? "Đang gửi..." : "Gửi bình luận"}
              </button>
            </form>

            <div className="mt-5 space-y-3">
              {comments.length === 0 ? (
                <EmptyState
                  description="Task này chưa có bình luận nào."
                  title="Chưa có bình luận"
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
                          <span className="font-semibold text-slate-700">Người viết #{comment.author_id}</span>
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
                            Sửa
                          </button>
                        ) : null}

                        {canEditComment && isEditing ? (
                          <>
                            <button
                              className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                              onClick={() => handleSaveComment(comment.id)}
                              type="button"
                            >
                              Lưu
                            </button>
                            <button
                              className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                              onClick={() => {
                                setEditingCommentId(null);
                                setEditingContent("");
                              }}
                              type="button"
                            >
                              Hủy
                            </button>
                          </>
                        ) : null}

                        {canEditComment ? (
                          <button
                            className="rounded-md border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                            onClick={() => handleDeleteComment(comment.id)}
                            type="button"
                          >
                            Xóa
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
          <SectionCard title="Thông tin task" eyebrow="Task">
            <div className="rounded-lg border border-slate-200 px-4">
              <MetadataRow label="Trạng thái" value={formatTaskStatus(task.status)} />
              <MetadataRow label="Người phụ trách" value={getMemberName(members, task.assignee_id)} />
              <MetadataRow label="Người tạo" value={`User #${task.created_by}`} />
              <MetadataRow label="Project" value={project.name} />
              <MetadataRow label="Task ID" value={`#${task.id}`} />
              <MetadataRow label="Tạo lúc" value={formatDate(task.created_at)} />
              <MetadataRow label="Cập nhật lúc" value={formatDate(task.updated_at)} />
              <MetadataRow label="Vai trò của bạn" value={formatRoleLabel(currentProjectMember?.role_in_project || "viewer")} />
            </div>
          </SectionCard>

          <SectionCard
            title="Cập nhật công việc"
            eyebrow="Quy trình"
            description={
              canManageTask
                ? "Bạn có thể cập nhật tiêu đề, mô tả, trạng thái và người phụ trách."
                : canUpdateTask
                  ? "Bạn được gán task này, có thể cập nhật trạng thái."
                  : "Bạn chỉ có quyền xem task này."
            }
          >
            <form className="space-y-4" onSubmit={handleUpdateTask}>
              <AlertBanner
                message={taskMessage}
                tone={
                  taskMessage === "Cập nhật công việc thành công." || taskMessage === "Không có thay đổi."
                    ? "success"
                    : "error"
                }
              />

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Tiêu đề</span>
                <input
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                  disabled={!canManageTask}
                  onChange={(event) => setTaskForm((prev) => ({ ...prev, title: event.target.value }))}
                  value={taskForm.title}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Mô tả</span>
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
                <span className="text-sm font-semibold text-slate-700">Trạng thái</span>
                <select
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                  disabled={!canUpdateTask}
                  onChange={(event) => setTaskForm((prev) => ({ ...prev, status: event.target.value }))}
                  value={taskForm.status}
                >
                  <option value="todo">Cần làm</option>
                  <option value="in-progress">Đang làm</option>
                  <option value="done">Hoàn thành</option>
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Người phụ trách</span>
                <select
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                  disabled={!canManageTask}
                  onChange={(event) =>
                    setTaskForm((prev) => ({ ...prev, assignee_id: event.target.value }))
                  }
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

              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  disabled={!canUpdateTask || taskSubmitting}
                  type="submit"
                >
                  {taskSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
                <button
                  className="rounded-md border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canManageTask}
                  onClick={handleDeleteTask}
                  type="button"
                >
                  Xóa công việc
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
                Frontend tải lại chi tiết task khi nhận event hợp lệ.
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
