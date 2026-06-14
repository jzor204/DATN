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
import { navigateTo } from "../utils/router";

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

const avatarTones = [
  "bg-emerald-500",
  "bg-sky-500",
  "bg-orange-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-teal-500"
];

function getInitials(name = "", fallback = "U") {
  const initials = String(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || fallback;
}

function Avatar({ member, size = "md" }) {
  const tone = avatarTones[Number(member.user_id || member.id || 0) % avatarTones.length];
  const sizes = {
    sm: "h-8 w-8 text-xs",
    md: "h-11 w-11 text-sm",
    lg: "h-14 w-14 text-base"
  };

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full border-2 border-white font-bold text-white shadow-sm ${
        sizes[size] || sizes.md
      } ${tone}`}
      title={member.name}
    >
      {getInitials(member.name, `#${member.user_id}`)}
    </div>
  );
}

function RoleChip({ role }) {
  const tone =
    role === "owner" || role === "admin-global"
      ? "bg-slate-900 text-white"
      : role === "admin"
        ? "bg-blue-100 text-blue-700"
        : "bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {role === "admin-global" ? "Quản trị hệ thống" : formatRoleLabel(role)}
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
        setCandidateMessage(nextCandidates.length === 0 ? "Không tìm thấy người dùng có thể thêm." : "");
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

      const matchesRole = roleFilter === "all" || member.global_role === roleFilter || member.highest_role === roleFilter;
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
        acc.projectRoles += member.projects.length;
        if (member.global_role === "admin") {
          acc.systemAdmins += 1;
        }
        if (member.highest_role === "owner" || member.highest_role === "admin") {
          acc.projectManagers += 1;
        }
        return acc;
      },
      { total: 0, systemAdmins: 0, projectManagers: 0, projectRoles: 0 }
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
      setCandidateSearch("");
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
            Quản lý người tham gia các project, vai trò và quyền thao tác trong từng project.
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

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Thành viên" value={metrics.total} />
        <MetricCard label="Quản trị hệ thống" value={metrics.systemAdmins} />
        <MetricCard label="Quản lý project" value={metrics.projectManagers} hint="Owner hoặc quản trị project" />
        <MetricCard label="Lượt tham gia" value={metrics.projectRoles} hint="Tổng vai trò trong các project" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <SectionCard
          title="Danh bạ project"
          eyebrow="Thành viên"
          description="Mỗi người có thể tham gia nhiều project với vai trò khác nhau."
        >
          <AlertBanner message={pageError} />

          <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_180px_220px]">
            <input
              className="rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo tên, email hoặc user ID"
              value={search}
            />
            <select
              className="rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              onChange={(event) => setRoleFilter(event.target.value)}
              value={roleFilter}
            >
              <option value="all">Tất cả vai trò</option>
              <option value="admin">Quản trị</option>
              <option value="owner">Chủ sở hữu</option>
              <option value="member">Thành viên</option>
            </select>
            <select
              className="rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              onChange={(event) => setProjectFilter(event.target.value)}
              value={projectFilter}
            >
              <option value="all">Tất cả project</option>
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
            <div className="grid gap-3">
              {filteredMembers.map((member) => (
                <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-panel" key={member.user_id}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <Avatar member={member} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-base font-semibold text-ink">{member.name}</h3>
                          <RoleChip role={member.global_role === "admin" ? "admin-global" : "member"} />
                          <RoleChip role={member.highest_role} />
                        </div>
                        <p className="mt-1 truncate text-sm text-slate-500">{member.email}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          User #{member.user_id} · Cập nhật {formatDate(member.updated_at)}
                        </p>
                      </div>
                    </div>

                    <button
                      className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-400 hover:text-blue-700"
                      onClick={() => navigateTo(`/members?search=${encodeURIComponent(member.email || member.name)}`)}
                      type="button"
                    >
                      Xem
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {member.projects.map((project) => (
                      <button
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-blue-300 hover:text-blue-700"
                        key={`${member.user_id}-${project.id}`}
                        onClick={() => navigateTo(`/projects/${project.id}`)}
                        type="button"
                      >
                        {project.name} · {formatRoleLabel(project.role)}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            title="Thêm vào project"
            eyebrow="Phân quyền"
            description="Chọn project trước, sau đó tìm người dùng chưa có trong project đó."
          >
            <form className="space-y-4" onSubmit={handleAddMember}>
              <AlertBanner
                message={addMessage}
                tone={addMessage === "Thêm thành viên thành công." ? "success" : "error"}
              />

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Project</span>
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
                <span className="text-sm font-semibold text-slate-700">Tìm thành viên</span>
                <input
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  onChange={(event) => setCandidateSearch(event.target.value)}
                  placeholder="Tên, email hoặc user ID"
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
                    {candidateLoading ? "Đang tải người dùng..." : "Chọn người dùng để thêm"}
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
                <span className="text-sm font-semibold text-slate-700">Vai trò trong project</span>
                <select
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  onChange={(event) =>
                    setAddForm((prev) => ({ ...prev, role_in_project: event.target.value }))
                  }
                  value={addForm.role_in_project}
                >
                  <option value="member">Thành viên</option>
                  <option value="admin">Quản trị project</option>
                </select>
              </label>

              <button
                className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={adding || projects.length === 0 || !addForm.user_id}
                type="submit"
              >
                {adding ? "Đang thêm..." : "Thêm thành viên"}
              </button>
            </form>
          </SectionCard>

          <SectionCard title="Quyền thao tác" eyebrow="Gợi ý">
            <div className="space-y-3 text-sm text-slate-600">
              <p>Owner và quản trị project có thể duyệt yêu cầu thay đổi, chỉnh sửa task và quản lý thành viên.</p>
              <p>Member nên cập nhật tiến độ qua checklist, bình luận và gửi yêu cầu thay đổi khi cần chỉnh thông tin task.</p>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
