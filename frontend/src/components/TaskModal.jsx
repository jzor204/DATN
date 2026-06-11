import { useEffect, useMemo, useState } from "react";
import {
  createChecklist,
  createChecklistItem,
  deleteChecklist,
  deleteChecklistItem,
  listChecklistsByTask,
  updateChecklistItem
} from "../api/checklistApi";
import { listActivitiesByTask } from "../api/activityApi";
import { createComment, deleteComment, listCommentsByTask, updateComment } from "../api/commentApi";
import {
  approveChangeRequest,
  cancelChangeRequest,
  createTaskChangeRequest,
  listTaskChangeRequests,
  rejectChangeRequest
} from "../api/changeRequestApi";
import { getTask, getTaskAssignees, updateTask } from "../api/taskApi";
import {
  formatDate,
  formatDeadline,
  formatTaskStatus,
  normalizeTaskProgress,
  toDeadlineInputValue,
  toDeadlinePayload,
  toTaskStatusInput
} from "../utils/format";
import AlertBanner from "./AlertBanner";
import DeadlineBadge from "./DeadlineBadge";
import ProgressIndicator from "./ProgressIndicator";
import StatusBadge from "./StatusBadge";
import { useRealtimeSubscription } from "../hooks/useRealtimeSubscription";

const initialTaskForm = {
  title: "",
  description: "",
  status: "todo",
  assignee_id: "",
  deadline: ""
};

const initialChangeRequestForm = {
  title: "",
  description: "",
  status: "todo",
  deadline: "",
  assignee_ids: [],
  reason: ""
};

const checklistDefaultTitle = "Việc cần làm";
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

function getMemberName(members, userId) {
  const member = members.find((item) => Number(item.user_id) === Number(userId));
  return member?.name || (userId ? `User #${userId}` : "Chưa gán");
}

function getMemberById(members, userId) {
  return members.find((item) => Number(item.user_id) === Number(userId));
}

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

function getTaskAssigneeIds(task) {
  if (!task) {
    return [];
  }

  const source = Array.isArray(task.assignee_ids) ? task.assignee_ids : [];
  const ids = source.length > 0 ? source : task.assignee_id ? [task.assignee_id] : [];
  return Array.from(new Set(ids.map((id) => Number(id)).filter(Boolean)));
}

function normalizeAssigneePayload(payload, task) {
  const ids = Array.isArray(payload) ? payload : payload?.data || [];
  const normalized = Array.from(new Set(ids.map((id) => Number(id)).filter(Boolean)));
  return normalized.length > 0 ? normalized : getTaskAssigneeIds(task);
}

function buildChangeRequestForm(task) {
  if (!task) {
    return initialChangeRequestForm;
  }

  return {
    title: task.title || "",
    description: task.description || "",
    status: toTaskStatusInput(task.status),
    deadline: toDeadlineInputValue(task.deadline),
    assignee_ids: getTaskAssigneeIds(task),
    reason: ""
  };
}

function sameNumberSet(left = [], right = []) {
  const normalize = (items) => items.map((item) => Number(item)).filter(Boolean).sort((a, b) => a - b);
  const leftItems = normalize(left);
  const rightItems = normalize(right);

  if (leftItems.length !== rightItems.length) {
    return false;
  }

  return leftItems.every((item, index) => item === rightItems[index]);
}

function Avatar({ member, userId, size = "md" }) {
  const displayName = member?.name || (userId ? `User #${userId}` : "?");
  const sizeClass = size === "sm" ? "h-8 w-8 text-xs" : "h-9 w-9 text-sm";

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ring-2 ring-white ${sizeClass} ${getAvatarTone(member?.user_id || userId)}`}
      title={displayName}
    >
      {getInitials(displayName)}
    </span>
  );
}

function normalizeChecklistPayload(payload) {
  const list = Array.isArray(payload) ? payload : payload?.data || [];

  return list.map((checklist) => ({
    ...checklist,
    items: Array.isArray(checklist.items) ? checklist.items : []
  }));
}

function getChecklistCounts(checklist) {
  const items = checklist.items || [];
  const done = items.filter((item) => item.is_done).length;
  const total = items.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  return { done, total, progress };
}

function getAllChecklistItems(checklists) {
  return checklists.flatMap((checklist) => checklist.items || []);
}

function ChecklistSummary({ checklists, progress }) {
  const items = getAllChecklistItems(checklists);
  const doneCount = items.filter((item) => item.is_done).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          {doneCount}/{items.length} mục hoàn thành
        </span>
        <span className="font-semibold text-ink">{normalizeTaskProgress(progress)}%</span>
      </div>
      <ProgressIndicator compact progress={progress} />
    </div>
  );
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
  return "Chờ duyệt";
}

function getChangeRequestStatusTone(status) {
  if (status === "approved") {
    return "bg-emerald-50 text-emerald-700";
  }
  if (status === "rejected") {
    return "bg-red-50 text-red-700";
  }
  if (status === "cancelled") {
    return "bg-slate-100 text-slate-600";
  }
  return "bg-amber-50 text-amber-700";
}

function formatChangeRequestValue(key, value, members) {
  if (value === null || value === undefined || value === "") {
    return "Trống";
  }

  if (key === "deadline") {
    return formatDeadline(value);
  }
  if (key === "status") {
    return formatTaskStatus(value);
  }
  if (key === "assignee_ids") {
    const ids = Array.isArray(value) ? value : [];
    return ids.length > 0 ? ids.map((id) => getMemberName(members, id)).join(", ") : "Chưa gán";
  }

  return String(value);
}

function getChangeRequestFieldLabel(key) {
  const labels = {
    title: "Tiêu đề",
    description: "Mô tả",
    status: "Trạng thái",
    assignee_ids: "Người phụ trách",
    deadline: "Deadline"
  };

  return labels[key] || key;
}

function Toast({ toast, onClose }) {
  if (!toast.message) {
    return null;
  }

  const tone =
    toast.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-red-200 bg-red-50 text-red-700";

  return (
    <div className="fixed right-5 top-5 z-[70] w-[min(360px,calc(100vw-2rem))]">
      <div className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm font-semibold shadow-lg ${tone}`}>
        <span>{toast.message}</span>
        <button className="text-xs opacity-70 transition hover:opacity-100" onClick={onClose} type="button">
          Đóng
        </button>
      </div>
    </div>
  );
}

function MemberPicker({
  members,
  open,
  query,
  selectedIds,
  saving,
  onClose,
  onQueryChange,
  onToggle
}) {
  if (!open) {
    return null;
  }

  const normalizedQuery = query.trim().toLowerCase();
  const filteredMembers = members.filter((member) => {
    const searchable = `${member.name || ""} ${member.email || ""} #${member.user_id}`.toLowerCase();
    return !normalizedQuery || searchable.includes(normalizedQuery);
  });

  return (
    <div className="absolute left-0 top-full z-20 mt-2 w-80 rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-ink">Thành viên</div>
        <button
          className="rounded-md px-2 py-1 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          onClick={onClose}
          type="button"
        >
          X
        </button>
      </div>

      <input
        autoFocus
        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Tìm kiếm các thành viên"
        value={query}
      />

      <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Thành viên của bảng
      </div>
      <div className="mt-2 max-h-64 space-y-1 overflow-y-auto pr-1">
        {filteredMembers.map((member) => {
          const selected = selectedIds.includes(Number(member.user_id));

          return (
            <button
              className={`flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left transition ${
                selected ? "bg-slate-100" : "hover:bg-slate-50"
              }`}
              disabled={saving}
              key={member.user_id}
              onClick={() => onToggle(Number(member.user_id))}
              type="button"
            >
              <span className="flex min-w-0 items-center gap-3">
                <Avatar member={member} size="sm" />
                <span className="truncate text-sm font-semibold text-slate-700">{member.name}</span>
              </span>
              <span className="text-sm font-semibold text-slate-500">{selected ? "X" : "+"}</span>
            </button>
          );
        })}

        {filteredMembers.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-slate-500">
            Không tìm thấy thành viên.
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function TaskModal({
  currentUser,
  members,
  project,
  taskId,
  onChanged,
  onClose
}) {
  const [task, setTask] = useState(null);
  const [taskForm, setTaskForm] = useState(initialTaskForm);
  const [checklists, setChecklists] = useState([]);
  const [comments, setComments] = useState([]);
  const [activities, setActivities] = useState([]);
  const [changeRequests, setChangeRequests] = useState([]);
  const [showChecklistComposer, setShowChecklistComposer] = useState(false);
  const [newChecklistTitle, setNewChecklistTitle] = useState(checklistDefaultTitle);
  const [activeItemComposer, setActiveItemComposer] = useState(null);
  const [newItemTitles, setNewItemTitles] = useState({});
  const [newComment, setNewComment] = useState("");
  const [commentComposerOpen, setCommentComposerOpen] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentContent, setEditingCommentContent] = useState("");
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [descriptionEditing, setDescriptionEditing] = useState(false);
  const [deadlineEditing, setDeadlineEditing] = useState(false);
  const [changeRequestOpen, setChangeRequestOpen] = useState(false);
  const [changeRequestForm, setChangeRequestForm] = useState(initialChangeRequestForm);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState({ id: 0, message: "", tone: "success" });
  const [savingTask, setSavingTask] = useState(false);
  const [savingChecklist, setSavingChecklist] = useState(false);
  const [savingComment, setSavingComment] = useState(false);
  const [sendingChangeRequest, setSendingChangeRequest] = useState(false);
  const [reviewingChangeRequestId, setReviewingChangeRequestId] = useState("");

  const currentProjectMember = useMemo(
    () => members.find((member) => member.user_id === currentUser.id),
    [currentUser.id, members]
  );

  const canManageTask =
    currentUser.role === "admin" ||
    currentProjectMember?.role_in_project === "owner" ||
    currentProjectMember?.role_in_project === "admin";

  const canUpdateTask = canManageTask || getTaskAssigneeIds(task).includes(Number(currentUser.id));
  const canRequestChange = !canManageTask && Boolean(currentProjectMember);
  const canEditChecklist =
    canManageTask ||
    currentProjectMember?.role_in_project === "member" ||
    currentUser.role === "admin";

  const totalChecklistItems = useMemo(() => getAllChecklistItems(checklists), [checklists]);
  const doneChecklistItems = totalChecklistItems.filter((item) => item.is_done).length;
  const assigneeIds = useMemo(() => getTaskAssigneeIds(task), [task]);
  const pendingChangeRequests = useMemo(
    () => changeRequests.filter((request) => request.status === "pending"),
    [changeRequests]
  );
  const myPendingChangeRequest = useMemo(
    () => pendingChangeRequests.find((request) => Number(request.requested_by) === Number(currentUser.id)),
    [currentUser.id, pendingChangeRequests]
  );
  const canMutateComments =
    currentUser.role === "admin" ||
    currentProjectMember?.role_in_project === "owner" ||
    currentProjectMember?.role_in_project === "admin";

  function showToast(messageText, tone = "success") {
    setToast({ id: Date.now(), message: messageText, tone });
  }

  async function loadModal({ silent = false } = {}) {
    if (!silent) {
      setLoading(true);
    }
    setMessage("");

    try {
      const taskPayload = await getTask(taskId);
      const initialTask = {
        ...taskPayload,
        assignee_ids: getTaskAssigneeIds(taskPayload)
      };
      setTask(initialTask);
      setTaskForm({
        title: taskPayload.title || "",
        description: taskPayload.description || "",
        status: toTaskStatusInput(taskPayload.status),
        assignee_id: taskPayload.assignee_id ? String(taskPayload.assignee_id) : "",
        deadline: toDeadlineInputValue(taskPayload.deadline)
      });
      setChangeRequestForm(buildChangeRequestForm(taskPayload));

      const [assigneeResult, checklistResult, commentResult, activityResult, changeRequestResult] = await Promise.allSettled([
        getTaskAssignees(taskId),
        listChecklistsByTask(taskId),
        listCommentsByTask(taskId, 1, 20),
        listActivitiesByTask(taskId, 1, 30),
        listTaskChangeRequests(taskId, 1, 20)
      ]);

      if (assigneeResult.status === "fulfilled") {
        const assigneeIDs = normalizeAssigneePayload(assigneeResult.value, initialTask);
        setTask((prev) => ({
          ...prev,
          assignee_id: assigneeIDs[0] || prev?.assignee_id || null,
          assignee_ids: assigneeIDs
        }));
      }

      if (checklistResult.status === "fulfilled") {
        setChecklists(normalizeChecklistPayload(checklistResult.value));
      } else {
        setChecklists([]);
        showToast(checklistResult.reason?.message || "Không thể tải checklist.", "error");
      }

      if (commentResult.status === "fulfilled") {
        const commentPayload = commentResult.value;
        setComments(Array.isArray(commentPayload) ? commentPayload : commentPayload?.data || []);
      } else {
        setComments([]);
        showToast(commentResult.reason?.message || "Không thể tải bình luận.", "error");
      }

      if (activityResult.status === "fulfilled") {
        const activityPayload = activityResult.value;
        setActivities(Array.isArray(activityPayload) ? activityPayload : activityPayload?.data || []);
      } else {
        setActivities([]);
        showToast(activityResult.reason?.message || "Không thể tải nhật ký hoạt động.", "error");
      }

      if (changeRequestResult.status === "fulfilled") {
        const changeRequestPayload = changeRequestResult.value;
        setChangeRequests(Array.isArray(changeRequestPayload) ? changeRequestPayload : changeRequestPayload?.data || []);
      } else {
        setChangeRequests([]);
        showToast(changeRequestResult.reason?.message || "Không thể tải yêu cầu thay đổi.", "error");
      }
    } catch (err) {
      setMessage(err.message);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    loadModal();
  }, [taskId]);

  useRealtimeSubscription({
    enabled: Boolean(taskId),
    scope: "task",
    taskId,
    currentUserId: currentUser.id,
    ignoreSelf: false,
    onEvent: async (event) => {
      if (!event.type) {
        return;
      }

      if (event.type === "task.deleted") {
        await onChanged?.();
        onClose();
        return;
      }

      if (
        !event.type.startsWith("task.") &&
        !event.type.startsWith("comment.") &&
        !event.type.startsWith("checklist.") &&
        !event.type.startsWith("activity.") &&
        !event.type.startsWith("change_request.")
      ) {
        return;
      }

      await loadModal({ silent: true });

      if (event.type.startsWith("task.")) {
        await onChanged?.();
      }

      if (event.type.startsWith("comment.")) {
        setEditingCommentId(null);
        setEditingCommentContent("");
      }
    }
  });

  useEffect(() => {
    if (!toast.message) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setToast((prev) => ({ ...prev, message: "" }));
    }, 3200);

    return () => window.clearTimeout(timer);
  }, [toast.id, toast.message]);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  async function refreshAfterMutation() {
    await loadModal();
    await onChanged?.();
  }

  async function saveTaskPatch(payload, onSuccess) {
    if (!task || Object.keys(payload).length === 0) {
      return false;
    }

    setSavingTask(true);

    try {
      await updateTask(task.id, payload);
      await refreshAfterMutation();
      showToast("Cập nhật công việc thành công.", "success");
      onSuccess?.();
      return true;
    } catch (err) {
      showToast(err.message, "error");
      return false;
    } finally {
      setSavingTask(false);
    }
  }

  function handleTitleKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
      return;
    }

    if (event.key === "Escape") {
      setTaskForm((prev) => ({ ...prev, title: task?.title || "" }));
      event.currentTarget.blur();
    }
  }

  async function handleTitleBlur() {
    const title = taskForm.title.trim();
    if (!task || !canManageTask || savingTask || title === task.title) {
      return;
    }

    if (!title) {
      setTaskForm((prev) => ({ ...prev, title: task.title || "" }));
      showToast("Tiêu đề không được để trống.", "error");
      return;
    }

    await saveTaskPatch({ title });
  }

  async function handleStatusChange(nextStatus) {
    setTaskForm((prev) => ({ ...prev, status: nextStatus }));

    if (!task || !canUpdateTask || nextStatus === toTaskStatusInput(task.status)) {
      return;
    }

    await saveTaskPatch({ status: nextStatus });
  }

  async function handleToggleAssignee(userId) {
    if (!task || !canManageTask || savingTask) {
      return;
    }

    const selectedIds = getTaskAssigneeIds(task);
    const exists = selectedIds.includes(userId);
    const nextAssigneeIds = exists
      ? selectedIds.filter((id) => id !== userId)
      : [...selectedIds, userId];

    await saveTaskPatch({ assignee_ids: nextAssigneeIds });
  }

  function openChangeRequestComposer() {
    if (myPendingChangeRequest) {
      showToast("Bạn đã có yêu cầu thay đổi đang chờ duyệt cho công việc này.", "error");
      return;
    }

    setChangeRequestForm(buildChangeRequestForm(task));
    setChangeRequestOpen(true);
  }

  function updateChangeRequestAssignee(userId) {
    setChangeRequestForm((prev) => {
      const selectedIds = prev.assignee_ids || [];
      const exists = selectedIds.includes(userId);
      const nextIds = exists ? selectedIds.filter((id) => id !== userId) : [...selectedIds, userId];
      return {
        ...prev,
        assignee_ids: nextIds
      };
    });
  }

  function buildChangeRequestPayload() {
    if (!task) {
      return {};
    }

    const payload = {
      reason: changeRequestForm.reason.trim()
    };

    const title = changeRequestForm.title.trim();
    if (title && title !== (task.title || "")) {
      payload.title = title;
    }

    const description = changeRequestForm.description.trim();
    if (description !== (task.description || "")) {
      payload.description = description;
    }

    const nextStatus = changeRequestForm.status;
    if (nextStatus && nextStatus !== toTaskStatusInput(task.status)) {
      payload.status = nextStatus;
    }

    if (changeRequestForm.deadline !== toDeadlineInputValue(task.deadline)) {
      payload.deadline = toDeadlinePayload(changeRequestForm.deadline);
    }

    if (!sameNumberSet(changeRequestForm.assignee_ids, getTaskAssigneeIds(task))) {
      payload.assignee_ids = changeRequestForm.assignee_ids;
    }

    return payload;
  }

  async function handleSubmitChangeRequest(event) {
    event.preventDefault();
    if (!task || !canRequestChange || sendingChangeRequest) {
      return;
    }
    if (myPendingChangeRequest) {
      setChangeRequestOpen(false);
      showToast("Bạn đã có yêu cầu thay đổi đang chờ duyệt cho công việc này.", "error");
      return;
    }

    const payload = buildChangeRequestPayload();
    const changeKeys = Object.keys(payload).filter((key) => key !== "reason");
    if (changeKeys.length === 0) {
      showToast("Bạn cần thay đổi ít nhất một thông tin trước khi gửi yêu cầu.", "error");
      return;
    }

    setSendingChangeRequest(true);

    try {
      await createTaskChangeRequest(task.id, payload);
      setChangeRequestOpen(false);
      await loadModal({ silent: true });
      showToast("Đã gửi yêu cầu thay đổi đến owner/admin.", "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSendingChangeRequest(false);
    }
  }

  async function handleReviewChangeRequest(request, decision) {
    if (!request || !canManageTask || reviewingChangeRequestId) {
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

    setReviewingChangeRequestId(`${decision}-${request.id}`);

    try {
      if (decision === "approve") {
        await approveChangeRequest(request.id);
        showToast("Đã duyệt yêu cầu thay đổi.", "success");
      } else {
        await rejectChangeRequest(request.id, { review_note: reviewNote });
        showToast("Đã từ chối yêu cầu thay đổi.", "success");
      }
      await refreshAfterMutation();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setReviewingChangeRequestId("");
    }
  }

  async function handleCancelChangeRequest(request) {
    if (!request || reviewingChangeRequestId) {
      return;
    }

    setReviewingChangeRequestId(`cancel-${request.id}`);

    try {
      await cancelChangeRequest(request.id);
      await refreshAfterMutation();
      showToast("Đã hủy yêu cầu thay đổi.", "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setReviewingChangeRequestId("");
    }
  }

  async function handleSaveDescription(event) {
    event.preventDefault();
    if (!task || !canManageTask) {
      return;
    }

    const description = taskForm.description.trim();
    if (description === (task.description || "")) {
      setDescriptionEditing(false);
      return;
    }

    await saveTaskPatch({ description }, () => setDescriptionEditing(false));
  }

  function handleCancelDescription() {
    setTaskForm((prev) => ({ ...prev, description: task?.description || "" }));
    setDescriptionEditing(false);
  }

  async function handleSaveDeadline(event) {
    event.preventDefault();
    if (!task || !canManageTask) {
      return;
    }

    const currentDeadlineInput = toDeadlineInputValue(task.deadline);
    if (taskForm.deadline === currentDeadlineInput) {
      setDeadlineEditing(false);
      return;
    }

    await saveTaskPatch({ deadline: toDeadlinePayload(taskForm.deadline) }, () => setDeadlineEditing(false));
  }

  async function handleClearDeadline() {
    if (!task || !canManageTask) {
      return;
    }

    if (!task.deadline && !taskForm.deadline) {
      setDeadlineEditing(false);
      return;
    }

    setTaskForm((prev) => ({ ...prev, deadline: "" }));
    await saveTaskPatch({ deadline: null }, () => setDeadlineEditing(false));
  }

  function handleCancelDeadline() {
    setTaskForm((prev) => ({ ...prev, deadline: toDeadlineInputValue(task?.deadline) }));
    setDeadlineEditing(false);
  }

  function openChecklistComposer() {
    setShowChecklistComposer(true);
    setNewChecklistTitle((prev) => prev.trim() || checklistDefaultTitle);
  }

  async function handleCreateChecklist(event) {
    event.preventDefault();
    const title = newChecklistTitle.trim();
    if (!title) {
      return;
    }

    setSavingChecklist(true);

    try {
      const payload = await createChecklist(taskId, { title });
      const createdChecklist = payload?.checklist;
      setNewChecklistTitle(checklistDefaultTitle);
      setShowChecklistComposer(false);
      await refreshAfterMutation();
      if (createdChecklist?.id) {
        setActiveItemComposer(createdChecklist.id);
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSavingChecklist(false);
    }
  }

  async function handleDeleteChecklist(checklistId) {
    const confirmed = window.confirm("Xóa danh sách việc cần làm này?");
    if (!confirmed) {
      return;
    }

    setSavingChecklist(true);

    try {
      await deleteChecklist(checklistId);
      await refreshAfterMutation();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSavingChecklist(false);
    }
  }

  async function handleCreateChecklistItem(event, checklistId) {
    event.preventDefault();
    const title = (newItemTitles[checklistId] || "").trim();
    if (!title) {
      return;
    }

    setSavingChecklist(true);

    try {
      await createChecklistItem(checklistId, { title });
      setNewItemTitles((prev) => ({ ...prev, [checklistId]: "" }));
      setActiveItemComposer(null);
      await refreshAfterMutation();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSavingChecklist(false);
    }
  }

  async function handleToggleChecklistItem(item) {
    setSavingChecklist(true);

    try {
      await updateChecklistItem(item.id, {
        is_done: !item.is_done
      });
      await refreshAfterMutation();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSavingChecklist(false);
    }
  }

  async function handleDeleteChecklistItem(itemId) {
    setSavingChecklist(true);

    try {
      await deleteChecklistItem(itemId);
      await refreshAfterMutation();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSavingChecklist(false);
    }
  }

  async function handleCreateComment(event) {
    event.preventDefault();
    const content = newComment.trim();
    if (!content) {
      return;
    }

    setSavingComment(true);

    try {
      await createComment(taskId, { content });
      setNewComment("");
      setCommentComposerOpen(false);
      await refreshAfterMutation();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSavingComment(false);
    }
  }

  function canEditComment(comment) {
    return canMutateComments || Number(comment.author_id) === Number(currentUser.id);
  }

  function startEditComment(comment) {
    setEditingCommentId(comment.id);
    setEditingCommentContent(comment.content || "");
  }

  async function handleUpdateComment(event) {
    event.preventDefault();
    const content = editingCommentContent.trim();
    if (!editingCommentId || !content) {
      return;
    }

    setSavingComment(true);

    try {
      await updateComment(editingCommentId, { content });
      setEditingCommentId(null);
      setEditingCommentContent("");
      await refreshAfterMutation();
      showToast("Cập nhật bình luận thành công.", "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSavingComment(false);
    }
  }

  async function handleDeleteComment(commentId) {
    const confirmed = window.confirm("Xóa bình luận này?");
    if (!confirmed) {
      return;
    }

    setSavingComment(true);

    try {
      await deleteComment(commentId);
      await refreshAfterMutation();
      showToast("Xóa bình luận thành công.", "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSavingComment(false);
    }
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 px-3 py-6 backdrop-blur-sm"
      role="dialog"
    >
      <Toast toast={toast} onClose={() => setToast((prev) => ({ ...prev, message: "" }))} />

      <button
        aria-label="Đóng modal"
        className="fixed inset-0 h-full w-full cursor-default"
        onClick={onClose}
        type="button"
      />

      <div className="relative mx-auto flex max-h-[calc(100vh-3rem)] max-w-5xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="shrink-0 flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {project?.name || "Project"} / Task #{taskId}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {task ? <StatusBadge status={task.status} /> : null}
              {task ? <DeadlineBadge deadline={task.deadline} status={task.status} /> : null}
              {assigneeIds.map((userId) => (
                <Avatar key={userId} member={getMemberById(members, userId)} size="sm" userId={userId} />
              ))}
            </div>
          </div>

          <button
            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
            onClick={onClose}
            type="button"
          >
            Đóng
          </button>
        </div>

        {loading ? (
          <div className="px-5 py-12 text-center text-sm text-slate-500">Đang tải công việc...</div>
        ) : null}

        {!loading && !task ? (
          <div className="px-5 py-8">
            <AlertBanner message={message || "Không thể tải công việc."} />
          </div>
        ) : null}

        {!loading && task ? (
          <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[1fr_340px]">
            <div className="min-h-0 space-y-6 overflow-y-auto px-5 py-5">
              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tiêu đề</span>
                <input
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-xl font-semibold text-ink outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
                  disabled={!canManageTask || savingTask}
                  onBlur={handleTitleBlur}
                  onChange={(event) => setTaskForm((prev) => ({ ...prev, title: event.target.value }))}
                  onKeyDown={handleTitleKeyDown}
                  value={taskForm.title}
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!canEditChecklist}
                  onClick={openChecklistComposer}
                  type="button"
                >
                  + Việc cần làm
                </button>
                {canRequestChange ? (
                  <button
                    className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={sendingChangeRequest || Boolean(myPendingChangeRequest)}
                    onClick={openChangeRequestComposer}
                    type="button"
                  >
                    {myPendingChangeRequest ? "Đang chờ duyệt" : "Yêu cầu thay đổi"}
                  </button>
                ) : null}
                <div className="relative min-w-[220px] flex-1">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Thành viên
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {assigneeIds.map((userId) => (
                      <Avatar key={userId} member={getMemberById(members, userId)} userId={userId} />
                    ))}
                    <button
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-lg font-semibold text-slate-700 transition hover:border-slate-500 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!canManageTask || savingTask}
                      onClick={() => setMemberPickerOpen((prev) => !prev)}
                      title="Thêm thành viên"
                      type="button"
                    >
                      +
                    </button>
                  </div>
                  <MemberPicker
                    members={members}
                    onClose={() => setMemberPickerOpen(false)}
                    onQueryChange={setMemberSearch}
                    onToggle={handleToggleAssignee}
                    open={memberPickerOpen}
                    query={memberSearch}
                    saving={savingTask}
                    selectedIds={assigneeIds}
                  />
                </div>
              </div>

              {changeRequestOpen ? (
                <form
                  className="space-y-4 rounded-lg border border-amber-200 bg-amber-50/70 p-4"
                  onSubmit={handleSubmitChangeRequest}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                        Yêu cầu thay đổi
                      </div>
                      <h3 className="text-base font-semibold text-ink">Gửi owner/admin duyệt</h3>
                    </div>
                    <button
                      className="rounded-md border border-amber-200 px-2.5 py-1.5 text-xs font-semibold text-amber-800 transition hover:border-amber-300"
                      onClick={() => setChangeRequestOpen(false)}
                      type="button"
                    >
                      Đóng
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tiêu đề đề xuất</span>
                      <input
                        className="w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                        disabled={sendingChangeRequest}
                        onChange={(event) =>
                          setChangeRequestForm((prev) => ({ ...prev, title: event.target.value }))
                        }
                        value={changeRequestForm.title}
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trạng thái đề xuất</span>
                      <select
                        className="w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                        disabled={sendingChangeRequest}
                        onChange={(event) =>
                          setChangeRequestForm((prev) => ({ ...prev, status: event.target.value }))
                        }
                        value={changeRequestForm.status}
                      >
                        <option value="todo">Cần làm</option>
                        <option value="in-progress">Đang làm</option>
                        <option value="done">Hoàn thành</option>
                      </select>
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deadline đề xuất</span>
                      <input
                        className="w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                        disabled={sendingChangeRequest}
                        onChange={(event) =>
                          setChangeRequestForm((prev) => ({ ...prev, deadline: event.target.value }))
                        }
                        type="datetime-local"
                        value={changeRequestForm.deadline}
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lý do</span>
                      <input
                        className="w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                        disabled={sendingChangeRequest}
                        onChange={(event) =>
                          setChangeRequestForm((prev) => ({ ...prev, reason: event.target.value }))
                        }
                        placeholder="Vì sao cần thay đổi?"
                        value={changeRequestForm.reason}
                      />
                    </label>
                  </div>

                  <label className="block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mô tả đề xuất</span>
                    <textarea
                      className="min-h-20 w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                      disabled={sendingChangeRequest}
                      onChange={(event) =>
                        setChangeRequestForm((prev) => ({ ...prev, description: event.target.value }))
                      }
                      value={changeRequestForm.description}
                    />
                  </label>

                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Người phụ trách đề xuất
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {members.map((member) => {
                        const selected = changeRequestForm.assignee_ids.includes(Number(member.user_id));

                        return (
                          <button
                            className={`flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition ${
                              selected
                                ? "border-amber-400 bg-white text-amber-900"
                                : "border-amber-200 bg-amber-100/60 text-slate-600 hover:border-amber-300"
                            }`}
                            disabled={sendingChangeRequest}
                            key={member.user_id}
                            onClick={() => updateChangeRequestAssignee(Number(member.user_id))}
                            type="button"
                          >
                            <Avatar member={member} size="sm" />
                            <span>{member.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                      disabled={sendingChangeRequest}
                      type="submit"
                    >
                      {sendingChangeRequest ? "Đang gửi..." : "Gửi yêu cầu"}
                    </button>
                    <button
                      className="rounded-md border border-amber-200 px-3 py-2 text-sm font-semibold text-amber-800 transition hover:border-amber-300"
                      onClick={() => setChangeRequestForm(buildChangeRequestForm(task))}
                      type="button"
                    >
                      Khôi phục
                    </button>
                  </div>
                </form>
              ) : null}

              <div className="grid gap-4 md:grid-cols-[180px_1fr]">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-slate-700">Trạng thái</span>
                  <select
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                    disabled={!canUpdateTask || savingTask}
                    onChange={(event) => handleStatusChange(event.target.value)}
                    value={taskForm.status}
                  >
                    <option value="todo">Cần làm</option>
                    <option value="in-progress">Đang làm</option>
                    <option value="done">Hoàn thành</option>
                  </select>
                </label>

                <div className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700">Tiến độ checklist</span>
                  <ChecklistSummary checklists={checklists} progress={task.progress} />
                </div>
              </div>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-700">Deadline</h3>
                  {!deadlineEditing ? (
                    <button
                      className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-900 disabled:opacity-50"
                      disabled={!canManageTask}
                      onClick={() => setDeadlineEditing(true)}
                      type="button"
                    >
                      {task.deadline ? "Chỉnh sửa" : "Thêm deadline"}
                    </button>
                  ) : null}
                </div>

                {deadlineEditing ? (
                  <form className="rounded-lg border border-slate-200 bg-slate-50 p-3" onSubmit={handleSaveDeadline}>
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                      <input
                        autoFocus
                        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                        disabled={!canManageTask || savingTask}
                        onChange={(event) => setTaskForm((prev) => ({ ...prev, deadline: event.target.value }))}
                        type="datetime-local"
                        value={taskForm.deadline}
                      />
                      <DeadlineBadge deadline={toDeadlinePayload(taskForm.deadline) || task.deadline} status={task.status} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                        disabled={!canManageTask || savingTask}
                        type="submit"
                      >
                        {savingTask ? "Đang lưu..." : "Lưu"}
                      </button>
                      <button
                        className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                        disabled={!canManageTask || savingTask}
                        onClick={handleClearDeadline}
                        type="button"
                      >
                        Xóa
                      </button>
                      <button
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
                        onClick={handleCancelDeadline}
                        type="button"
                      >
                        Hủy
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    className="flex w-full flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-left transition hover:border-slate-300 disabled:cursor-default disabled:hover:border-slate-200"
                    disabled={!canManageTask}
                    onClick={() => setDeadlineEditing(true)}
                    type="button"
                  >
                    <DeadlineBadge deadline={task.deadline} status={task.status} />
                    <span className="truncate text-sm font-semibold text-ink">{formatDeadline(task.deadline)}</span>
                  </button>
                )}
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-700">Mô tả</h3>
                  {!descriptionEditing ? (
                    <button
                      className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-900 disabled:opacity-50"
                      disabled={!canManageTask}
                      onClick={() => setDescriptionEditing(true)}
                      type="button"
                    >
                      Chỉnh sửa
                    </button>
                  ) : null}
                </div>

                {descriptionEditing ? (
                  <form className="space-y-3" onSubmit={handleSaveDescription}>
                    <textarea
                      autoFocus
                      className="min-h-28 w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
                      disabled={!canManageTask || savingTask}
                      onChange={(event) => setTaskForm((prev) => ({ ...prev, description: event.target.value }))}
                      placeholder="Thêm mô tả chi tiết hơn..."
                      value={taskForm.description}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                        disabled={!canManageTask || savingTask}
                        type="submit"
                      >
                        {savingTask ? "Đang lưu..." : "Lưu"}
                      </button>
                      <button
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
                        onClick={handleCancelDescription}
                        type="button"
                      >
                        Hủy
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    className="block w-full truncate rounded-md border border-transparent bg-slate-50 px-3 py-2.5 text-left text-sm leading-6 text-slate-700 transition hover:border-slate-200 disabled:cursor-default"
                    disabled={!canManageTask}
                    onClick={() => setDescriptionEditing(true)}
                    type="button"
                  >
                    {task.description || "Thêm mô tả chi tiết hơn..."}
                  </button>
                )}
              </section>

              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Checklist
                    </div>
                    <h3 className="text-lg font-semibold text-ink">Việc cần làm</h3>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {doneChecklistItems}/{totalChecklistItems.length}
                  </span>
                </div>

                {showChecklistComposer ? (
                  <form
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                    onSubmit={handleCreateChecklist}
                  >
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Tiêu đề checklist
                      </span>
                      <input
                        autoFocus
                        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        disabled={!canEditChecklist || savingChecklist}
                        onChange={(event) => setNewChecklistTitle(event.target.value)}
                        value={newChecklistTitle}
                      />
                    </label>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                        disabled={!canEditChecklist || savingChecklist || !newChecklistTitle.trim()}
                        type="submit"
                      >
                        Thêm
                      </button>
                      <button
                        className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
                        onClick={() => setShowChecklistComposer(false)}
                        type="button"
                      >
                        Hủy
                      </button>
                    </div>
                  </form>
                ) : null}

                {checklists.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    Chưa có danh sách việc cần làm.
                  </div>
                ) : null}

                <div className="space-y-4">
                  {checklists.map((checklist) => {
                    const counts = getChecklistCounts(checklist);
                    const isAddingItem = activeItemComposer === checklist.id;

                    return (
                      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-3" key={checklist.id}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="truncate text-base font-semibold text-ink">{checklist.title}</h4>
                            <div className="mt-2 space-y-1">
                              <div className="flex items-center justify-between text-xs text-slate-500">
                                <span>
                                  {counts.done}/{counts.total} mục hoàn thành
                                </span>
                                <span className="font-semibold text-ink">{counts.progress}%</span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                                <div
                                  className="h-full rounded-full bg-blue-600 transition-all"
                                  style={{ width: `${counts.progress}%` }}
                                />
                              </div>
                            </div>
                          </div>
                          <button
                            className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-red-200 hover:text-red-700 disabled:opacity-50"
                            disabled={!canEditChecklist || savingChecklist}
                            onClick={() => handleDeleteChecklist(checklist.id)}
                            type="button"
                          >
                            Xóa
                          </button>
                        </div>

                        <div className="space-y-2">
                          {checklist.items.length === 0 ? (
                            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
                              Chưa có mục nào.
                            </div>
                          ) : null}

                          {checklist.items.map((item) => (
                            <div
                              className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                              key={item.id}
                            >
                              <input
                                checked={item.is_done}
                                className="h-4 w-4 accent-blue-600"
                                disabled={!canEditChecklist || savingChecklist}
                                onChange={() => handleToggleChecklistItem(item)}
                                type="checkbox"
                              />
                              <span
                                className={`text-sm ${
                                  item.is_done ? "text-slate-400 line-through" : "text-slate-700"
                                }`}
                              >
                                {item.title}
                              </span>
                              <button
                                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500 transition hover:border-red-200 hover:text-red-700 disabled:opacity-50"
                                disabled={!canEditChecklist || savingChecklist}
                                onClick={() => handleDeleteChecklistItem(item.id)}
                                type="button"
                              >
                                Xóa
                              </button>
                            </div>
                          ))}
                        </div>

                        {isAddingItem ? (
                          <form
                            className="grid gap-2 sm:grid-cols-[1fr_auto]"
                            onSubmit={(event) => handleCreateChecklistItem(event, checklist.id)}
                          >
                            <input
                              autoFocus
                              className="rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                              disabled={!canEditChecklist || savingChecklist}
                              onChange={(event) =>
                                setNewItemTitles((prev) => ({ ...prev, [checklist.id]: event.target.value }))
                              }
                              placeholder="Thêm một mục"
                              value={newItemTitles[checklist.id] || ""}
                            />
                            <div className="flex gap-2">
                              <button
                                className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                                disabled={!canEditChecklist || savingChecklist || !(newItemTitles[checklist.id] || "").trim()}
                                type="submit"
                              >
                                Thêm
                              </button>
                              <button
                                className="rounded-md border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
                                onClick={() => setActiveItemComposer(null)}
                                type="button"
                              >
                                Hủy
                              </button>
                            </div>
                          </form>
                        ) : (
                          <button
                            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={!canEditChecklist}
                            onClick={() => setActiveItemComposer(checklist.id)}
                            type="button"
                          >
                            Thêm một mục
                          </button>
                        )}
                      </section>
                    );
                  })}
                </div>
              </section>
            </div>

            <aside className="min-h-0 overflow-y-auto border-t border-slate-200 bg-slate-50 px-5 py-5 lg:border-l lg:border-t-0">
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Hoạt động
                    </div>
                    <h3 className="text-base font-semibold text-ink">
                      {showActivityLog ? "Chi tiết" : "Bình luận"}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                      {showActivityLog ? changeRequests.length + activities.length : comments.length}
                    </span>
                    <button
                      className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
                      onClick={() => setShowActivityLog((prev) => !prev)}
                      type="button"
                    >
                      {showActivityLog ? "Ẩn chi tiết" : "Hiện chi tiết"}
                    </button>
                  </div>
                </div>

                {!showActivityLog ? (
                  <>
                    <form className="space-y-2" onSubmit={handleCreateComment}>
                      <textarea
                        className={`w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${
                          commentComposerOpen ? "min-h-20" : "min-h-10"
                        }`}
                        onChange={(event) => setNewComment(event.target.value)}
                        onFocus={() => setCommentComposerOpen(true)}
                        placeholder="Viết bình luận..."
                        value={newComment}
                      />
                      {commentComposerOpen ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                            disabled={savingComment || !newComment.trim()}
                            type="submit"
                          >
                            Gửi
                          </button>
                          <button
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
                            onClick={() => {
                              setCommentComposerOpen(false);
                              setNewComment("");
                            }}
                            type="button"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : null}
                    </form>

                    <div className="mt-4 space-y-3">
                      {comments.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
                          Chưa có bình luận.
                        </div>
                      ) : null}

                      {comments.map((comment) => {
                        const authorMember = getMemberById(members, comment.author_id);
                        const isEditing = editingCommentId === comment.id;

                        return (
                          <article className="flex gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3" key={comment.id}>
                            <Avatar member={authorMember} size="sm" userId={comment.author_id} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                                <span className="truncate font-semibold text-slate-700">
                                  {authorMember?.name || `User #${comment.author_id}`}
                                </span>
                                <span className="shrink-0">{formatDate(comment.updated_at || comment.created_at)}</span>
                              </div>

                              {isEditing ? (
                                <form className="mt-2 space-y-2" onSubmit={handleUpdateComment}>
                                  <textarea
                                    autoFocus
                                    className="min-h-20 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    disabled={savingComment}
                                    onChange={(event) => setEditingCommentContent(event.target.value)}
                                    value={editingCommentContent}
                                  />
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                                      disabled={savingComment || !editingCommentContent.trim()}
                                      type="submit"
                                    >
                                      Lưu
                                    </button>
                                    <button
                                      className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
                                      onClick={() => {
                                        setEditingCommentId(null);
                                        setEditingCommentContent("");
                                      }}
                                      type="button"
                                    >
                                      Hủy
                                    </button>
                                  </div>
                                </form>
                              ) : (
                                <>
                                  <p className="mt-2 break-words rounded-md bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
                                    {comment.content}
                                  </p>
                                  {canEditComment(comment) ? (
                                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                      <button
                                        className="font-semibold text-slate-500 transition hover:text-blue-700"
                                        onClick={() => startEditComment(comment)}
                                        type="button"
                                      >
                                        Chỉnh sửa
                                      </button>
                                      <button
                                        className="font-semibold text-slate-500 transition hover:text-red-700"
                                        onClick={() => handleDeleteComment(comment.id)}
                                        type="button"
                                      >
                                        Xóa
                                      </button>
                                    </div>
                                  ) : null}
                                </>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </>
                ) : null}
              </section>

              {showActivityLog ? (
              <section className="mt-6 border-t border-slate-200 pt-5">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Quy trình
                    </div>
                    <h3 className="text-base font-semibold text-ink">Yêu cầu thay đổi</h3>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {pendingChangeRequests.length}/{changeRequests.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {changeRequests.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
                      Chưa có yêu cầu thay đổi.
                    </div>
                  ) : null}

                  {changeRequests.map((request) => {
                    const requesterMember = getMemberById(members, request.requested_by);
                    const requesterName = request.requester?.name || requesterMember?.name || `User #${request.requested_by}`;
                    const payload = request.payload || {};
                    const currentValues = request.current_values || {};
                    const changedFields = Object.keys(payload);
                    const isPending = request.status === "pending";
                    const isMine = Number(request.requested_by) === Number(currentUser.id);
                    const canReviewRequest = canManageTask && isPending;
                    const canCancelRequest = isPending && (isMine || canManageTask);

                    return (
                      <article className="rounded-lg border border-slate-200 bg-white px-3 py-3" key={request.id}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <Avatar member={requesterMember || request.requester} size="sm" userId={request.requested_by} />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-slate-700">{requesterName}</div>
                              <div className="text-xs text-slate-500">{formatDate(request.created_at)}</div>
                            </div>
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${getChangeRequestStatusTone(request.status)}`}>
                            {getChangeRequestStatusLabel(request.status)}
                          </span>
                        </div>

                        {request.conflict ? (
                          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs font-semibold text-amber-800">
                            Task đã thay đổi sau khi request này được gửi. Cần kiểm tra lại trước khi duyệt.
                          </div>
                        ) : null}

                        {request.reason ? (
                          <p className="mt-3 rounded-md bg-slate-50 px-2.5 py-2 text-xs leading-5 text-slate-600">
                            Lý do: {request.reason}
                          </p>
                        ) : null}

                        <div className="mt-3 space-y-2">
                          {changedFields.map((field) => (
                            <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2" key={field}>
                              <div className="text-xs font-semibold text-slate-500">{getChangeRequestFieldLabel(field)}</div>
                              <div className="mt-1 grid gap-1 text-xs sm:grid-cols-2">
                                <div className="min-w-0">
                                  <span className="block text-slate-400">Hiện tại</span>
                                  <span className="block truncate font-semibold text-slate-700">
                                    {formatChangeRequestValue(field, currentValues[field], members)}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <span className="block text-slate-400">Đề xuất</span>
                                  <span className="block truncate font-semibold text-blue-700">
                                    {formatChangeRequestValue(field, payload[field], members)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {request.review_note ? (
                          <p className="mt-3 rounded-md bg-slate-50 px-2.5 py-2 text-xs leading-5 text-slate-600">
                            Ghi chú xử lý: {request.review_note}
                          </p>
                        ) : null}

                        {canReviewRequest || canCancelRequest ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {canReviewRequest ? (
                              <>
                                <button
                                  className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                                  disabled={Boolean(reviewingChangeRequestId) || request.conflict}
                                  onClick={() => handleReviewChangeRequest(request, "approve")}
                                  type="button"
                                >
                                  {reviewingChangeRequestId === `approve-${request.id}` ? "Đang duyệt..." : "Duyệt"}
                                </button>
                                <button
                                  className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:border-red-300 disabled:opacity-60"
                                  disabled={Boolean(reviewingChangeRequestId)}
                                  onClick={() => handleReviewChangeRequest(request, "reject")}
                                  type="button"
                                >
                                  {reviewingChangeRequestId === `reject-${request.id}` ? "Đang từ chối..." : "Từ chối"}
                                </button>
                              </>
                            ) : null}
                            {canCancelRequest ? (
                              <button
                                className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-red-200 hover:text-red-700 disabled:opacity-60"
                                disabled={Boolean(reviewingChangeRequestId)}
                                onClick={() => handleCancelChangeRequest(request)}
                                type="button"
                              >
                                {reviewingChangeRequestId === `cancel-${request.id}` ? "Đang hủy..." : "Hủy"}
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </section>
              ) : null}

              {showActivityLog ? (
                <section className="mt-6 border-t border-slate-200 pt-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Nhật ký
                      </div>
                      <h3 className="text-base font-semibold text-ink">Hoạt động</h3>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                      {activities.length}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {activities.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
                        Chưa có hoạt động.
                      </div>
                    ) : null}

                    {activities.map((activity) => {
                      const actorName = activity.actor?.name || (activity.actor_id ? `User #${activity.actor_id}` : "Hệ thống");

                      return (
                        <article className="flex gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3" key={activity.id}>
                          <Avatar member={activity.actor} size="sm" userId={activity.actor?.id || activity.actor_id} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                              <span className="truncate font-semibold text-slate-700">{actorName}</span>
                              <span className="shrink-0">{formatDate(activity.created_at)}</span>
                            </div>
                            <p className="mt-1 text-sm leading-5 text-slate-600">{activity.message}</p>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ) : null}
            </aside>
          </div>
        ) : null}
      </div>
    </div>
  );
}
