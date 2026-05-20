import { useEffect, useMemo, useState } from "react";
import { listProjects } from "../api/projectApi";
import { listMyTasks } from "../api/taskApi";
import AlertBanner from "../components/AlertBanner";
import EmptyState from "../components/EmptyState";
import LoadingScreen from "../components/LoadingScreen";
import Pagination from "../components/Pagination";
import SectionCard from "../components/SectionCard";
import StatusBadge from "../components/StatusBadge";
import { useRealtimeSubscription } from "../hooks/useRealtimeSubscription";
import { formatDate, formatTaskStatus } from "../utils/format";
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

function MetricCard({ label, value, hint }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-panel">
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
      if (event.type?.startsWith("task.") || event.type?.startsWith("comment.")) {
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
        acc.total += 1;
        acc[normalizeStatus(task.status)] += 1;
        return acc;
      },
      { total: 0, todo: 0, "in-progress": 0, done: 0 }
    );
  }, [metricsSource]);

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
            Các công việc đang được gán cho bạn trên tất cả dự án.
          </p>
        </div>
        <button
          className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          onClick={() => setRefreshKey((prev) => prev + 1)}
          type="button"
        >
          Làm mới
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Tổng công việc" value={metrics.total} hint="Được gán cho tôi" />
        <MetricCard label="Cần làm" value={metrics.todo} />
        <MetricCard label="Đang làm" value={metrics["in-progress"]} />
        <MetricCard label="Hoàn thành" value={metrics.done} />
      </div>

      <SectionCard title="Danh sách công việc" eyebrow="Công việc của tôi">
        <AlertBanner message={pageError} />

        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid gap-3 md:grid-cols-[220px_1fr]">
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
            Đang lắng nghe event task trong project
          </span>
        </div>

        {loading ? <LoadingScreen label="Đang tải công việc được gán..." /> : null}

        {!loading && tasks.length === 0 ? (
          <EmptyState
            description="Không có task nào khớp bộ lọc hiện tại."
            title="Chưa có công việc được gán"
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
                    <th className="px-4 py-3">Cập nhật lúc</th>
                    <th className="px-4 py-3 text-right">Hành động</th>
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

      <SectionCard title="Realtime scope" eyebrow="Sự kiện">
        <div className="grid gap-3 md:grid-cols-3">
          {["task.updated", "task.deleted", "comment.created"].map((eventType) => (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3" key={eventType}>
              <div className="text-sm font-semibold text-ink">{eventType}</div>
              <div className="mt-1 text-xs text-slate-500">
                Tải lại công việc được gán khi nhận event.
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
