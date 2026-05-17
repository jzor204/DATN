import { useEffect, useState } from "react";
import { createProject, listProjects } from "../api/projectApi";
import AlertBanner from "../components/AlertBanner";
import EmptyState from "../components/EmptyState";
import LoadingScreen from "../components/LoadingScreen";
import Pagination from "../components/Pagination";
import SectionCard from "../components/SectionCard";
import { useRealtimeSubscription } from "../hooks/useRealtimeSubscription";
import { formatDate } from "../utils/format";
import { navigateTo } from "../utils/router";

const initialForm = {
  name: "",
  description: ""
};

const initialPagination = {
  page: 1,
  page_size: 6,
  total: 0,
  total_pages: 0
};

function MetricCard({ label, value, hint }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-panel">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-ink">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

function getProjectRole(project, currentUser) {
  if (Number(project.owner_id) === Number(currentUser.id)) {
    return "owner";
  }
  if (currentUser.role === "admin") {
    return "admin";
  }
  return "member";
}

function getRoleTone(role) {
  if (role === "owner") {
    return "bg-slate-900 text-white";
  }
  if (role === "admin") {
    return "bg-blue-100 text-blue-700";
  }
  return "bg-slate-100 text-slate-700";
}

export default function ProjectListPage({ currentUser }) {
  const [projects, setProjects] = useState([]);
  const [pagination, setPagination] = useState(initialPagination);
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState("");

  async function reloadProjects(pageToLoad = page) {
    const payload = await listProjects(pageToLoad, 6);
    setProjects(payload.data || []);
    setPagination(payload.pagination || initialPagination);
  }

  useRealtimeSubscription({
    enabled: Boolean(currentUser?.id),
    scope: "projects",
    currentUserId: currentUser.id,
    onEvent: async (event) => {
      if (!event.type || !event.type.startsWith("project.")) {
        return;
      }

      try {
        await reloadProjects(page);
      } catch (err) {
        setPageError(err.message);
      }
    }
  });

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setPageError("");

      try {
        const payload = await listProjects(page, 6);
        if (!active) {
          return;
        }

        setProjects(payload.data || []);
        setPagination(payload.pagination || initialPagination);
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

    loadData();

    return () => {
      active = false;
    };
  }, [page, refreshKey]);

  async function handleCreateProject(event) {
    event.preventDefault();
    setSubmitting(true);
    setFormMessage("");

    try {
      await createProject({
        name: form.name.trim(),
        description: form.description.trim()
      });

      setForm(initialForm);
      setFormMessage("Project created successfully.");

      if (page !== 1) {
        setPage(1);
      } else {
        await reloadProjects(1);
      }
    } catch (err) {
      setFormMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Du an</h1>
          <p className="mt-1 text-sm text-slate-600">
            Quan ly cac project ban co quyen truy cap va theo doi cap nhat realtime.
          </p>
        </div>
        <button
          className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          onClick={() => setRefreshKey((prev) => prev + 1)}
          type="button"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Tong du an" value={pagination.total || projects.length} hint="Theo quyen truy cap" />
        <MetricCard label="Dang hoat dong" value={projects.length} hint="Trang hien tai" />
        <MetricCard label="Cong viec cua toi" value="--" hint="Theo API task hien co" />
        <MetricCard label="Cap nhat realtime" value="On" hint="WebSocket projects scope" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <SectionCard title="Tao du an" eyebrow="Workspace">
          <form className="space-y-4" onSubmit={handleCreateProject}>
            <AlertBanner
              message={formMessage}
              tone={formMessage === "Project created successfully." ? "success" : "error"}
            />

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-700">Ten du an</span>
              <input
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Website Redesign"
                required
                value={form.name}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-700">Mo ta</span>
              <textarea
                className="min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Muc tieu ngan gon cua project"
                value={form.description}
              />
            </label>

            <button
              className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={submitting}
              type="submit"
            >
              {submitting ? "Dang tao..." : "Tao du an"}
            </button>
          </form>

          <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
            User ID cua ban: <span className="font-semibold text-slate-700">#{currentUser.id}</span>
          </div>
        </SectionCard>

        <SectionCard title="Danh sach du an" eyebrow="Listing">
          <AlertBanner message={pageError} />

          {loading ? <LoadingScreen label="Loading projects..." /> : null}

          {!loading && projects.length === 0 ? (
            <EmptyState
              description="Ban chua co project nao. Tao project dau tien de bat dau."
              title="No projects yet"
            />
          ) : null}

          {!loading && projects.length > 0 ? (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Ten du an</th>
                      <th className="px-4 py-3">Vai tro</th>
                      <th className="px-4 py-3">Owner</th>
                      <th className="px-4 py-3">Cap nhat luc</th>
                      <th className="px-4 py-3 text-right">Hanh dong</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {projects.map((project) => (
                      <tr className="transition hover:bg-slate-50" key={project.id}>
                        <td className="px-4 py-4">
                          <div className="font-semibold text-ink">{project.name}</div>
                          <div className="mt-1 max-w-xl truncate text-xs text-slate-500">
                            {project.description || "No description"}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getRoleTone(
                              getProjectRole(project, currentUser)
                            )}`}
                          >
                            {getProjectRole(project, currentUser)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-600">#{project.owner_id}</td>
                        <td className="px-4 py-4 text-slate-600">{formatDate(project.updated_at || project.created_at)}</td>
                        <td className="px-4 py-4 text-right">
                          <button
                            className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                            onClick={() => navigateTo(`/projects/${project.id}`)}
                            type="button"
                          >
                            Open
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
    </div>
  );
}
