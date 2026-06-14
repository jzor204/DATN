import { formatReminder } from "../utils/format";

function getReminderState(reminderAt, deadline) {
  if (!reminderAt) {
    return "none";
  }

  const reminderDate = new Date(reminderAt);
  if (Number.isNaN(reminderDate.getTime())) {
    return "invalid";
  }

  const now = new Date();
  if (reminderDate.getTime() <= now.getTime()) {
    return "due";
  }

  if (deadline) {
    const deadlineDate = new Date(deadline);
    if (!Number.isNaN(deadlineDate.getTime()) && reminderDate.getTime() > deadlineDate.getTime()) {
      return "invalid";
    }
  }

  return "scheduled";
}

const reminderToneMap = {
  none: "bg-slate-100 text-slate-600",
  invalid: "bg-red-100 text-red-700",
  due: "bg-amber-100 text-amber-800",
  scheduled: "bg-violet-100 text-violet-700"
};

const reminderLabels = {
  none: "Chưa nhắc",
  invalid: "Nhắc lỗi",
  due: "Đến lịch nhắc",
  scheduled: "Có nhắc hạn"
};

export default function ReminderBadge({ reminderAt, deadline, showTime = false }) {
  const state = getReminderState(reminderAt, deadline);

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        reminderToneMap[state] || reminderToneMap.none
      }`}
      title={formatReminder(reminderAt)}
    >
      {showTime && reminderAt ? formatReminder(reminderAt) : reminderLabels[state]}
    </span>
  );
}
