export function formatDate(value) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function formatDeadline(value) {
  if (!value) {
    return "Chưa có deadline";
  }

  return formatDate(value);
}

export function getDeadlineState(deadline, status) {
  if (!deadline) {
    return "none";
  }

  if (status === "done") {
    return "completed";
  }

  const dueAt = new Date(deadline);
  if (Number.isNaN(dueAt.getTime())) {
    return "invalid";
  }

  const now = new Date();
  if (dueAt.getTime() < now.getTime()) {
    return "overdue";
  }

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  if (dueAt.getTime() < tomorrowStart.getTime()) {
    return "today";
  }

  const hoursUntilDue = (dueAt.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursUntilDue <= 72) {
    return "soon";
  }

  return "scheduled";
}

export function formatDeadlineState(state) {
  const labels = {
    none: "Chưa có deadline",
    completed: "Đã hoàn thành",
    invalid: "Deadline không hợp lệ",
    overdue: "Quá hạn",
    today: "Đến hạn hôm nay",
    soon: "Sắp đến hạn",
    scheduled: "Còn hạn"
  };

  return labels[state] || "Không rõ";
}

export function toDeadlineInputValue(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (number) => String(number).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function toDeadlinePayload(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return null;
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return normalized;
  }

  return date.toISOString();
}

export function normalizeTaskProgress(value) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(parsed)));
}

export function formatTaskStatus(status) {
  if (status === "in_progress" || status === "in-progress") {
    return "Đang làm";
  }
  if (status === "todo") {
    return "Cần làm";
  }
  if (status === "done") {
    return "Hoàn thành";
  }
  return status || "Không rõ";
}

export function toTaskStatusInput(status) {
  if (status === "in_progress") {
    return "in-progress";
  }
  return status || "todo";
}

export function formatRoleLabel(role) {
  if (!role) {
    return "--";
  }

  const roleLabels = {
    admin: "Quản trị",
    member: "Thành viên",
    owner: "Chủ sở hữu",
    viewer: "Người xem",
    admin_global: "Quản trị hệ thống",
    "admin-global": "Quản trị hệ thống"
  };

  if (roleLabels[role]) {
    return roleLabels[role];
  }

  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function toOptionalNumber(value) {
  if (value === "" || value === null || typeof value === "undefined") {
    return undefined;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}
