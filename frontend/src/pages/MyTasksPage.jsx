import { useEffect, useMemo, useState } from "react";
import { listProjects } from "../api/projectApi";
import { listMyTasks } from "../api/taskApi";
import AlertBanner from "../components/AlertBanner";
import DeadlineBadge from "../components/DeadlineBadge";
import EmptyState from "../components/EmptyState";
import LoadingScreen from "../components/LoadingScreen";
import Pagination from "../components/Pagination";
import PriorityBadge from "../components/PriorityBadge";
import ProgressIndicator from "../components/ProgressIndicator";
import ReminderBadge from "../components/ReminderBadge";
import SectionCard from "../components/SectionCard";
import StatusBadge from "../components/StatusBadge";
import { useRealtimeSubscription } from "../hooks/useRealtimeSubscription";
import {
  formatDate,
  formatDeadline,
  formatTaskStatus,
  getDeadlineState,
  normalizeTaskPriority,
  normalizeTaskProgress
} from "../utils/format";
import { navigateTo } from "../utils/router";

const STATUS_OPTIONS = ["all", "todo", "in-progress", "done"];
const initialPagination = {
  page: 1,
  page_size: 10,
  total: 0,
  total_pages: 0
};

function normalizeStatus(status) {
  if (status === "in_progress") {
    return "in-progress";
  }
  return status || "todo";
}

function MetricCard({ label, value, hint, tone = "default" }) {
  const tones = {
    default: "border-slate-200 bg-white",
    blue: "border-blue-200 bg-blue-50",
    amber: "border-amber-200 bg-amber-50",
    red: "border-red-200 bg-red-50",
    emerald: "border-emerald-200 bg-emerald-50"
  };

  return (
    <div className={`rounded-lg border px-4 py-4 shadow-panel ${tones[tone] || tones.default}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-ink">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

function ProjectRealtimeSubscription({ projectId, currentUserId, onRefresh }) {
  useRealtimeSubscription({
    enabled: Boolean(projectId),
    scope: "project",
    projectId,
    currentUserId,
    onEvent: (event) => {
      if (
        event.type?.startsWith("task.") ||
        event.type?.startsWith("comment.") ||
        event.type?.startsWith("checklist.")
      ) {
        onRefresh();
      }
    }
  });

  return null;
}

export default function MyTasksPage({ currentUser }) {
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [metricsSource, setMetricsSource] = useState([]);
  const [pagination, setPagination] = useState(initialPagination);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedProjectId, setSelectedProjectId] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    let active = true;

    async function loadWorkspace() {
      setLoading(true);
      setPageError("");

      try {
        const projectPayload = await listProjects(1, 100);
        const visibleProjects = projectPayload.data || [];
        const [taskPayload, metricPayload] = await Promise.all([
          listMyTasks({
            page,
            pageSize: 10,
            projectId: selectedProjectId,
            status: statusFilter
          }),
          listMyTasks({
            page: 1,
            pageSize: 100
          })
        ]);

        if (!active) {
          return;
        }

        setProjects(visibleProjects);
        setTasks(taskPayload.data || []);
        setPagination(taskPayload.pagination || initialPagination);
        setMetricsSource(metricPayload.data || []);
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
  }, [currentUser.id, page, refreshKey, selectedProjectId, statusFilter]);

  function handleProjectFilterChange(value) {
    setSelectedProjectId(value);
    setPage(1);
  }

  function handleStatusFilterChange(value) {
    setStatusFilter(value);
    setPage(1);
  }

  const metrics = useMemo(() => {
    return metricsSource.reduce(
      (acc, task) => {
        const status = normalizeStatus(task.status);
        const deadlineState = getDeadlineState(task.deadline, task.status);
        const progress = normalizeTaskProgress(task.progress);
        const priority = normalizeTaskPriority(task.priority);

        acc.total += 1;
        acc.progressTotal += progress;
        if (status in acc) {
          acc[status] += 1;
        }
        if (deadlineState === "overdue") {
          acc.overdue += 1;
        }
        if (deadlineState === "today" || deadlineState === "soon") {
          acc.upcoming += 1;
        }
        if (priority === "urgent" || priority === "high") {
          acc.important += 1;
        }
        return acc;
      },
      {
        total: 0,
        todo: 0,
        "in-progress": 0,
        done: 0,
        overdue: 0,
        upcoming: 0,
        important: 0,
        progressTotal: 0
      }
    );
  }, [metricsSource]);

  const averageProgress = metrics.total > 0 ? Math.round(metrics.progressTotal / metrics.total) : 0;

  return (
    <div className="space-y-6">
      {projects.map((project) => (
        <ProjectRealtimeSubscription
          currentUserId={currentUser.id}
          key={project.id}
          onRefresh={() => setRefreshKey((prev) => prev + 1)}
          projectId={project.id}
        />
      ))}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Công việc của tôi</h1>
          <p className="mt-1 text-sm text-slate-600">
            Theo dõi các công việc đang giao cho bạn, không bao gồm task đã lưu trữ hoặc đã xóa mềm.
          </p>
        </div>
        <button
          className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-400 hover:text-blue-700"
          onClick={() => setRefreshKey((prev) => prev + 1)}
          type="button"
        >
          Làm mới
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-7">
        <MetricCard label="Tổng việc" value={metrics.total} hint="Đang hoạt động" />
        <MetricCard label="Cần làm" value={metrics.todo} />
        <MetricCard label="Đang làm" value={metrics["in-progress"]} tone="blue" />
        <MetricCard label="Hoàn thành" value={metrics.done} tone="emerald" />
        <MetricCard label="Quá hạn" value={metrics.overdue} tone={metrics.overdue > 0 ? "red" : "default"} />
        <MetricCard label="Sắp đến hạn" value={metrics.upcoming} tone="amber" />
        <MetricCard label="Tiến độ TB" value={`${averageProgress}%`} />
      </div>

      <SectionCard
        title="Danh sách công việc"
        eyebrow="Công việc được giao"
        description="Lọc nhanh theo project và trạng thái để biết hôm nay cần xử lý việc nào trước."
      >
        <AlertBanner message={pageError} />

        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid gap-3 md:grid-cols-[240px_1fr]">
            <select
              className="rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              onChange={(event) => handleProjectFilterChange(event.target.value)}
              value={selectedProjectId}
            >
              <option value="all">Tất cả dự án</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>

            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((status) => (
                <button
                  className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                    statusFilter === status
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                  key={status}
                  onClick={() => handleStatusFilterChange(status)}
                  type="button"
                >
                  {status === "all" ? "Tất cả" : formatTaskStatus(status)}
                </button>
              ))}
            </div>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Cập nhật realtime theo project
          </span>
        </div>

        {loading ? <LoadingScreen label="Đang tải công việc được giao..." /> : null}

        {!loading && tasks.length === 0 ? (
          <EmptyState
            description="Không có task nào khớp bộ lọc hiện tại."
            title="Chưa có công việc được giao"
          />
        ) : null}

        {!loading && tasks.length > 0 ? (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Công việc</th>
                    <th className="px-4 py-3">Dự án</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">Ưu tiên</th>
                    <th className="px-4 py-3">Tiến độ</th>
                    <th className="px-4 py-3">Hạn chót</th>
                    <th className="px-4 py-3">Cập nhật</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {tasks.map((task) => (
                    <tr className="transition hover:bg-slate-50" key={task.id}>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-ink">{task.title}</div>
                        <div className="mt-1 max-w-xl truncate text-xs text-slate-500">
                          {task.description || "Chưa có mô tả"}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {task.project_name || `Project #${task.project_id}`}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={task.status} />
                      </td>
                      <td className="px-4 py-4">
                        <PriorityBadge priority={task.priority} />
                      </td>
                      <td className="px-4 py-4">
                        <ProgressIndicator compact progress={task.progress} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1">
                          <DeadlineBadge deadline={task.deadline} status={task.status} />
                          <span className="text-xs text-slate-500">{formatDeadline(task.deadline)}</span>
                          {task.reminder_at ? (
                            <ReminderBadge deadline={task.deadline} reminderAt={task.reminder_at} />
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {formatDate(task.updated_at || task.created_at)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                          onClick={() => navigateTo(`/tasks/${task.id}`)}
                          type="button"
                        >
                          Mở
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination pagination={pagination} onPageChange={setPage} />
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}
