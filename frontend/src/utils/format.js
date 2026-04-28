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

export function formatTaskStatus(status) {
  if (status === "in_progress" || status === "in-progress") {
    return "In Progress";
  }
  if (status === "todo") {
    return "Todo";
  }
  if (status === "done") {
    return "Done";
  }
  return status || "Unknown";
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
