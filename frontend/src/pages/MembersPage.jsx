import { useEffect, useMemo, useState } from "react";
import {
  addProjectMember,
  listProjectMemberCandidates,
  listProjectMembers,
  listProjects
} from "../api/projectApi";
import AlertBanner from "../components/AlertBanner";
import EmptyState from "../components/EmptyState";
import LoadingScreen from "../components/LoadingScreen";
import SectionCard from "../components/SectionCard";
import { useHashRoute } from "../hooks/useHashRoute";
import { useRealtimeSubscription } from "../hooks/useRealtimeSubscription";
import { formatDate, formatRoleLabel } from "../utils/format";

const roleRank = {
  owner: 3,
  admin: 2,
  member: 1
};

const initialAddForm = {
  project_id: "",
  user_id: "",
  role_in_project: "member"
};

function RoleChip({ role }) {
  const tone =
    role === "owner" || role === "admin-global"
      ? "bg-slate-900 text-white"
      : role === "admin"
        ? "bg-blue-100 text-blue-700"
        : "bg-slate-100 text-slate-700";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {role === "admin-global" ? "Quản trị" : formatRoleLabel(role)}
    </span>
  );
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
      if (event.type === "project.members.changed") {
        onRefresh();
      }
    }
  });

  return null;
}

function buildMemberDirectory(projects, memberLists, currentUser) {
  const directory = new Map();

  projects.forEach((project, index) => {
    const members = memberLists[index] || [];

    members.forEach((member) => {
      const existing = directory.get(member.user_id) || {
        user_id: member.user_id,
        name: member.name,
        email: member.email,
        global_role: Number(member.user_id) === Number(currentUser.id) ? currentUser.role : "member",
        highest_role: "member",
        updated_at: member.joined_at,
        projects: []
      };

      existing.projects.push({
        id: project.id,
        name: project.name,
        role: member.role_in_project
      });

      if (roleRank[member.role_in_project] > roleRank[existing.highest_role]) {
        existing.highest_role = member.role_in_project;
      }

      if (member.joined_at && (!existing.updated_at || new Date(member.joined_at) > new Date(existing.updated_at))) {
        existing.updated_at = member.joined_at;
      }

      directory.set(member.user_id, existing);
    });
  });

  return Array.from(directory.values()).sort((a, b) => Number(a.user_id) - Number(b.user_id));
}

export default function MembersPage({ currentUser }) {
  const route = useHashRoute();
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [addForm, setAddForm] = useState(initialAddForm);
  const [addMessage, setAddMessage] = useState("");
  const [adding, setAdding] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [candidateMessage, setCandidateMessage] = useState("");

  useEffect(() => {
    const routeSearch = route.searchParams.get("search") || "";
    if (routeSearch) {
      setSearch(routeSearch);
    }
  }, [route.searchParams]);

  useEffect(() => {
    let active = true;

    async function loadMembers() {
      setLoading(true);
      setPageError("");

      try {
        const projectPayload = await listProjects(1, 100);
        const visibleProjects = projectPayload.data || [];
        const memberPayloads = await Promise.all(
          visibleProjects.map((project) => listProjectMembers(project.id, 1, 100))
        );

        if (!active) {
          return;
        }

        setProjects(visibleProjects);
        setMembers(
          buildMemberDirectory(
            visibleProjects,
            memberPayloads.map((payload) => payload.data || []),
            currentUser
          )
        );

        setAddForm((prev) => ({
          ...prev,
          project_id: prev.project_id || (visibleProjects[0]?.id ? String(visibleProjects[0].id) : "")
        }));
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

    loadMembers();

    return () => {
      active = false;
    };
  }, [currentUser, refreshKey]);

  useEffect(() => {
    let active = true;

    if (!addForm.project_id) {
      setCandidates([]);
      setCandidateMessage("");
      return () => {
        active = false;
      };
    }

    setCandidateLoading(true);
    setCandidateMessage("");

    const timer = window.setTimeout(async () => {
      try {
        const payload = await listProjectMemberCandidates(addForm.project_id, {
          q: candidateSearch,
          page: 1,
          pageSize: 20
        });
        const nextCandidates = payload.data || [];

        if (!active) {
          return;
        }

        setCandidates(nextCandidates);
        setCandidateMessage(nextCandidates.length === 0 ? "Không tìm thấy user có thể thêm." : "");
        setAddForm((prev) => {
          const selectedStillAvailable = nextCandidates.some(
            (candidate) => Number(candidate.user_id) === Number(prev.user_id)
          );

          return prev.user_id && !selectedStillAvailable ? { ...prev, user_id: "" } : prev;
        });
      } catch (err) {
        if (active) {
          setCandidates([]);
          setCandidateMessage(err.message);
          setAddForm((prev) => ({ ...prev, user_id: "" }));
        }
      } finally {
        if (active) {
          setCandidateLoading(false);
        }
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [addForm.project_id, candidateSearch, refreshKey]);

  const filteredMembers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return members.filter((member) => {
      const matchesSearch =
        !keyword ||
        member.name?.toLowerCase().includes(keyword) ||
        member.email?.toLowerCase().includes(keyword) ||
        String(member.user_id).includes(keyword);

      const matchesRole = roleFilter === "all" || member.global_role === roleFilter;
      const matchesProject =
        projectFilter === "all" ||
        member.projects.some((project) => Number(project.id) === Number(projectFilter));

      return matchesSearch && matchesRole && matchesProject;
    });
  }, [members, projectFilter, roleFilter, search]);

  const metrics = useMemo(() => {
    return members.reduce(
      (acc, member) => {
        acc.total += 1;
        if (member.global_role === "admin") {
          acc.admin += 1;
        } else {
          acc.member += 1;
        }
        acc.projectRoles += member.projects.length;
        return acc;
      },
      { total: 0, admin: 0, member: 0, projectRoles: 0 }
    );
  }, [members]);

  async function handleAddMember(event) {
    event.preventDefault();
    setAdding(true);
    setAddMessage("");

    try {
      await addProjectMember(addForm.project_id, {
        user_id: Number(addForm.user_id),
        role_in_project: addForm.role_in_project
      });

      setAddMessage("Thêm thành viên thành công.");
      setAddForm((prev) => ({ ...prev, user_id: "" }));
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      setAddMessage(err.message);
    } finally {
      setAdding(false);
    }
  }

  function handleAddProjectChange(projectId) {
    setAddForm((prev) => ({
      ...prev,
      project_id: projectId,
      user_id: ""
    }));
    setCandidateSearch("");
    setCandidateMessage("");
  }

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
          <h1 className="text-2xl font-semibold text-ink">Thành viên</h1>
          <p className="mt-1 text-sm text-slate-600">
            Tổng hợp thành viên từ các project bạn có quyền truy cập.
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
        <MetricCard label="Tổng thành viên" value={metrics.total} />
        <MetricCard label="Admin" value={metrics.admin} />
        <MetricCard label="Member" value={metrics.member} />
        <MetricCard label="Project roles" value={metrics.projectRoles} hint="Trên các project hiển thị" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <SectionCard title="Danh sách thành viên" eyebrow="Danh bạ">
          <AlertBanner message={pageError} />

          <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_180px_220px]">
            <input
              className="rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo tên, email, user ID"
              value={search}
            />
            <select
              className="rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              onChange={(event) => setRoleFilter(event.target.value)}
              value={roleFilter}
            >
              <option value="all">Tất cả vai trò</option>
              <option value="admin">Quản trị</option>
              <option value="member">Thành viên</option>
            </select>
            <select
              className="rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              onChange={(event) => setProjectFilter(event.target.value)}
              value={projectFilter}
            >
              <option value="all">Tất cả dự án</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          {loading ? <LoadingScreen label="Đang tải thành viên..." /> : null}

          {!loading && filteredMembers.length === 0 ? (
            <EmptyState
              description="Không có thành viên nào khớp bộ lọc hiện tại."
              title="Không tìm thấy thành viên"
            />
          ) : null}

          {!loading && filteredMembers.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Thành viên</th>
                    <th className="px-4 py-3">Global role</th>
                    <th className="px-4 py-3">Dự án tham gia</th>
                    <th className="px-4 py-3">Vai trò cao nhất</th>
                    <th className="px-4 py-3">User ID</th>
                    <th className="px-4 py-3">Cập nhật lúc</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredMembers.map((member) => (
                    <tr className="transition hover:bg-slate-50" key={member.user_id}>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-ink">{member.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{member.email}</div>
                      </td>
                      <td className="px-4 py-4">
                        <RoleChip role={member.global_role === "admin" ? "admin-global" : "member"} />
                      </td>
                      <td className="px-4 py-4 text-slate-600">{member.projects.length}</td>
                      <td className="px-4 py-4">
                        <RoleChip role={member.highest_role} />
                      </td>
                      <td className="px-4 py-4 text-slate-600">#{member.user_id}</td>
                      <td className="px-4 py-4 text-slate-600">{formatDate(member.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Thêm thành viên" eyebrow="Project access">
            <form className="space-y-4" onSubmit={handleAddMember}>
              <AlertBanner
                message={addMessage}
                tone={addMessage === "Thêm thành viên thành công." ? "success" : "error"}
              />

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Dự án</span>
                <select
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  onChange={(event) => handleAddProjectChange(event.target.value)}
                  required
                  value={addForm.project_id}
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Tìm user</span>
                <input
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  onChange={(event) => setCandidateSearch(event.target.value)}
                  placeholder="Name, email, or user ID"
                  value={candidateSearch}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Người dùng</span>
                <select
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  disabled={candidateLoading || candidates.length === 0}
                  onChange={(event) => setAddForm((prev) => ({ ...prev, user_id: event.target.value }))}
                  required
                  value={addForm.user_id}
                >
                  <option value="">
                    {candidateLoading ? "Đang tải users..." : "Chọn user để thêm"}
                  </option>
                  {candidates.map((candidate) => (
                    <option key={candidate.user_id} value={candidate.user_id}>
                      #{candidate.user_id} - {candidate.name} ({candidate.email})
                    </option>
                  ))}
                </select>
                {candidateMessage ? (
                  <span className="block text-xs text-slate-500">{candidateMessage}</span>
                ) : null}
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Role</span>
                <select
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  onChange={(event) =>
                    setAddForm((prev) => ({ ...prev, role_in_project: event.target.value }))
                  }
                  value={addForm.role_in_project}
                >
                  <option value="member">Thành viên</option>
                  <option value="admin">Quản trị</option>
                </select>
              </label>

              <button
                className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={adding || projects.length === 0 || !addForm.user_id}
                type="submit"
              >
                {adding ? "Đang thêm..." : "Thêm"}
              </button>
            </form>
          </SectionCard>

          <SectionCard title="Ghi chú API" eyebrow="Backend">
            <div className="space-y-3 text-sm text-slate-600">
              <p>Backend gọi `/tasks/me?status=candidates&project_id=...` để tìm user có thể thêm.</p>
              <p>Màn hình này tổng hợp dữ liệu từ `/projects` và `/projects/:id/members`.</p>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
