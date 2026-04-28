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
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <SectionCard
        title="Project Command Desk"
        eyebrow="Workspace"
        description="Tao project moi, quan sat danh sach project duoc phep truy cap va dung user ID cua ban de add vao project khac."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-[24px] bg-slate-900 px-4 py-4 text-white">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-300">Current User</p>
            <div className="mt-3 text-lg font-semibold">{currentUser.name}</div>
            <div className="mt-1 text-sm text-slate-300">{currentUser.email}</div>
          </div>
          <div className="rounded-[24px] bg-white/70 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.25em] text-tide">Role</p>
            <div className="mt-3 text-lg font-semibold text-ink">{currentUser.role}</div>
            <div className="mt-1 text-sm text-slate-600">Quyen global hien tai cua tai khoan.</div>
          </div>
          <div className="rounded-[24px] bg-white/70 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.25em] text-ember">User ID</p>
            <div className="mt-3 text-lg font-semibold text-ink">{currentUser.id}</div>
            <div className="mt-1 text-sm text-slate-600">Dung ID nay de duoc them vao project.</div>
          </div>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleCreateProject}>
          <AlertBanner
            message={formMessage}
            tone={formMessage === "Project created successfully." ? "success" : "error"}
          />

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-slate-700">Project name</span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-tide"
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Project Alpha"
              required
              value={form.name}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-slate-700">Description</span>
            <textarea
              className="min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-tide"
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Mo ta ngan gon muc tieu cua project"
              value={form.description}
            />
          </label>

          <button
            className="rounded-2xl bg-ember px-5 py-3 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "Creating..." : "Create project"}
          </button>
        </form>
      </SectionCard>

      <SectionCard
        action={
          <button
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900"
            onClick={() => setRefreshKey((prev) => prev + 1)}
            type="button"
          >
            Refresh
          </button>
        }
        title="Projects"
        eyebrow="Listing"
        description="Member se chi thay project ma minh thuoc ve. Admin global se thay tat ca."
      >
        <AlertBanner message={pageError} />

        {loading ? <LoadingScreen label="Loading projects..." /> : null}

        {!loading && projects.length === 0 ? (
          <EmptyState
            description="Ban chua co project nao. Tao project dau tien o cot ben trai de bat dau."
            title="No projects yet"
          />
        ) : null}

        {!loading && projects.length > 0 ? (
          <div className="space-y-4">
            <div className="grid gap-4">
              {projects.map((project) => (
                <article
                  className="rounded-[28px] border border-slate-200 bg-white/80 px-5 py-5 transition hover:-translate-y-0.5 hover:shadow-lg"
                  key={project.id}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <h3 className="text-2xl text-ink">{project.name}</h3>
                      <p className="text-sm text-slate-600">{project.description || "No description"}</p>
                      <div className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <span>Project ID: {project.id}</span>
                        <span>Owner ID: {project.owner_id}</span>
                        <span>Created: {formatDate(project.created_at)}</span>
                      </div>
                    </div>
                    <button
                      className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                      onClick={() => navigateTo(`/projects/${project.id}`)}
                      type="button"
                    >
                      Open project
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <Pagination pagination={pagination} onPageChange={setPage} />
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}
