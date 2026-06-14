import { useEffect, useMemo, useState } from "react";
import { getMe } from "../api/authApi";
import AlertBanner from "../components/AlertBanner";
import SectionCard from "../components/SectionCard";
import { getAccessToken } from "../utils/auth";
import { formatRoleLabel } from "../utils/format";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8080/api/v1";
const FRONTEND_URL = window.location.origin || "http://127.0.0.1:5173";

const TABS = [
  { id: "account", label: "Tài khoản" },
  { id: "access", label: "Quyền & phiên" },
  { id: "system", label: "Hệ thống" },
  { id: "data", label: "Dữ liệu" }
];

function decodeJwtPayload(token) {
  if (!token) {
    return null;
  }

  const payload = token.split(".")[1];
  if (!payload) {
    return null;
  }

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    return JSON.parse(window.atob(padded));
  } catch (error) {
    return null;
  }
}

function formatJwtTime(value) {
  if (!value) {
    return "--";
  }

  const date = new Date(Number(value) * 1000);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function getInitials(name = "") {
  return String(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function getSessionStatus(claims) {
  if (!claims?.exp) {
    return {
      label: "Không rõ",
      tone: "muted",
      description: "Không đọc được thời hạn token."
    };
  }

  if (Date.now() >= Number(claims.exp) * 1000) {
    return {
      label: "Hết hạn",
      tone: "danger",
      description: "Phiên đăng nhập đã hết hạn."
    };
  }

  return {
    label: "Đang hoạt động",
    tone: "success",
    description: "JWT hiện tại vẫn hợp lệ."
  };
}

function StatusChip({ tone = "success", children }) {
  const tones = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    info: "border-blue-200 bg-blue-50 text-blue-700",
    muted: "border-slate-200 bg-slate-100 text-slate-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-red-200 bg-red-50 text-red-700"
  };

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

function InfoTile({ label, value, chipTone }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 min-h-6 text-sm font-semibold text-ink">
        {chipTone ? <StatusChip tone={chipTone}>{value}</StatusChip> : value}
      </div>
    </div>
  );
}

function ActionButton({ children, tone = "default", className = "", ...props }) {
  const tones = {
    default:
      "border-slate-300 bg-white text-slate-700 hover:border-slate-500 disabled:border-slate-200 disabled:text-slate-400",
    primary: "border-blue-600 bg-blue-600 text-white hover:bg-blue-700 disabled:border-blue-200 disabled:bg-blue-200",
    danger: "border-red-300 bg-white text-red-700 hover:bg-red-50 disabled:border-red-200 disabled:text-red-300"
  };

  return (
    <button
      className={`rounded-md border px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed ${tones[tone]} ${className}`}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}

function SettingRow({ title, description, status, tone = "success" }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-sm font-semibold text-ink">{title}</div>
        <div className="mt-1 text-xs text-slate-500">{description}</div>
      </div>
      <StatusChip tone={tone}>{status}</StatusChip>
    </div>
  );
}

export default function SettingsPage({ currentUser, onLogout }) {
  const [activeTab, setActiveTab] = useState("account");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState("info");
  const [profile, setProfile] = useState(currentUser);
  const [isReloadingProfile, setIsReloadingProfile] = useState(false);

  const token = getAccessToken();
  const claims = useMemo(() => decodeJwtPayload(token), [token]);
  const sessionStatus = useMemo(() => getSessionStatus(claims), [claims]);

  useEffect(() => {
    setProfile(currentUser);
  }, [currentUser]);

  function showMessage(nextMessage, tone = "info") {
    setMessage(nextMessage);
    setMessageTone(tone);
  }

  async function handleReloadProfile() {
    setIsReloadingProfile(true);
    try {
      const nextProfile = await getMe();
      setProfile(nextProfile);
      showMessage("Đã cập nhật thông tin tài khoản.", "success");
    } catch (err) {
      showMessage(err.message || "Không thể tải lại thông tin tài khoản.", "danger");
    } finally {
      setIsReloadingProfile(false);
    }
  }

  function renderAccountTab() {
    return (
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <SectionCard
          title="Hồ sơ đăng nhập"
          eyebrow="Tài khoản"
          description="Thông tin này dùng để hiển thị avatar, phân quyền và ghi nhận hoạt động trong project."
          action={
            <ActionButton disabled={isReloadingProfile} onClick={handleReloadProfile} tone="primary">
              {isReloadingProfile ? "Đang tải..." : "Làm mới"}
            </ActionButton>
          }
        >
          <div className="flex flex-col gap-5 md:flex-row md:items-center">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xl font-semibold text-white">
              {getInitials(profile?.name) || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-2xl font-semibold text-ink">{profile?.name || "--"}</h2>
                <StatusChip tone={profile?.role === "admin" ? "info" : "muted"}>
                  {formatRoleLabel(profile?.role)}
                </StatusChip>
              </div>
              <p className="mt-1 truncate text-sm text-slate-600">{profile?.email || "--"}</p>
              <p className="mt-2 text-sm text-slate-500">User ID #{profile?.id || "--"}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <InfoTile label="Vai trò hệ thống" value={formatRoleLabel(profile?.role)} />
            <InfoTile label="Quyền project" value="Theo từng project" />
            <InfoTile chipTone={sessionStatus.tone} label="Phiên đăng nhập" value={sessionStatus.label} />
          </div>
        </SectionCard>

        <SectionCard title="Tác vụ nhanh" eyebrow="Tài khoản">
          <div className="space-y-3">
            <ActionButton className="w-full" disabled={isReloadingProfile} onClick={handleReloadProfile} tone="primary">
              Tải lại hồ sơ
            </ActionButton>
            <ActionButton className="w-full" onClick={onLogout}>
              Đăng xuất
            </ActionButton>
          </div>
        </SectionCard>
      </div>
    );
  }

  function renderAccessTab() {
    return (
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <SectionCard
          title="Phiên và phân quyền"
          eyebrow="Bảo mật"
          description="Project hiện dùng JWT, global role và role trong từng project để quyết định quyền thao tác."
        >
          <div className="grid gap-4 md:grid-cols-3">
            <InfoTile chipTone={sessionStatus.tone} label="Trạng thái phiên" value={sessionStatus.label} />
            <InfoTile label="Token hết hạn" value={formatJwtTime(claims?.exp)} />
            <InfoTile label="Lưu token" value="Browser localStorage" />
          </div>

          <div className="mt-5 space-y-3">
            <SettingRow
              description="Các trang project, task, thành viên và cài đặt đều yêu cầu đăng nhập."
              status="Đã bật"
              title="Protected routes"
            />
            <SettingRow
              description="Owner/quản trị project duyệt yêu cầu thay đổi từ member."
              status="Đã có"
              title="Luồng yêu cầu thay đổi"
              tone="info"
            />
            <SettingRow
              description="Member nên thao tác qua checklist, bình luận hoặc gửi yêu cầu thay đổi."
              status="Đang áp dụng"
              title="Quyền member"
              tone="muted"
            />
          </div>
        </SectionCard>

        <SectionCard title="Đăng xuất" eyebrow="Phiên hiện tại">
          <p className="mb-4 text-sm text-slate-600">
            Đăng xuất sẽ xóa JWT khỏi trình duyệt và đưa bạn về màn hình đăng nhập.
          </p>
          <ActionButton className="w-full" onClick={onLogout} tone="danger">
            Đăng xuất khỏi phiên này
          </ActionButton>
        </SectionCard>
      </div>
    );
  }

  function renderSystemTab() {
    return (
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <SectionCard
          title="Kết nối ứng dụng"
          eyebrow="Hệ thống"
          description="Các endpoint chính đang được frontend sử dụng trong môi trường hiện tại."
        >
          <div className="grid gap-4 md:grid-cols-3">
            <InfoTile label="Frontend" value={FRONTEND_URL} />
            <InfoTile label="Backend API" value={API_BASE_URL} />
            <InfoTile label="Realtime" value="WebSocket theo scope" />
          </div>

          <div className="mt-5 space-y-3">
            <SettingRow
              description="Project, task, comment, checklist và thông báo đều có event realtime."
              status="Đã bật"
              title="Realtime updates"
            />
            <SettingRow
              description="Nút Sáng/Tối trên thanh trên cùng lưu lựa chọn vào trình duyệt."
              status="Đã bật"
              title="Giao diện tối"
              tone="info"
            />
            <SettingRow
              description="Header search tìm project, task và thành viên trong workspace."
              status="Đang dùng"
              title="Tìm kiếm nhanh"
            />
          </div>
        </SectionCard>

        <SectionCard title="Trạng thái demo" eyebrow="Môi trường">
          <div className="space-y-3">
            <SettingRow description="REST API bằng Golang Fiber." status="Đang chạy" title="API service" />
            <SettingRow description="Cơ sở dữ liệu chính của ứng dụng." status="Đang dùng" title="MySQL" />
            <SettingRow description="Cache profile và dữ liệu task/project." status="Đang dùng" title="Redis" />
          </div>
        </SectionCard>
      </div>
    );
  }

  function renderDataTab() {
    return (
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <SectionCard
          title="Dữ liệu công việc"
          eyebrow="Task data"
          description="Các cơ chế dữ liệu đã thêm để project gần hơn với luồng quản lý công việc thật."
        >
          <div className="grid gap-4 md:grid-cols-3">
            <InfoTile label="Checklist" value="Tính tiến độ tự động" />
            <InfoTile label="Nhãn/đính kèm" value="Metadata của task" />
            <InfoTile label="Lưu trữ/xóa mềm" value="Ẩn khỏi luồng chính" />
          </div>

          <div className="mt-5 space-y-3">
            <SettingRow
              description="Task đã lưu trữ được ẩn khỏi board mặc định và có thể lọc lại khi cần."
              status="Đã có"
              title="Archive"
              tone="info"
            />
            <SettingRow
              description="Xóa mềm giữ dữ liệu trong database để tránh mất dữ liệu đột ngột."
              status="Đã có"
              title="Soft delete"
            />
            <SettingRow
              description="Redis cache được xóa theo project/task sau các thao tác thay đổi."
              status="Đang áp dụng"
              title="Cache invalidation"
            />
          </div>
        </SectionCard>

        <SectionCard title="Gợi ý vận hành" eyebrow="Quy ước">
          <div className="space-y-3 text-sm text-slate-600">
            <p>Lưu trữ dùng cho task không còn xuất hiện trên board nhưng vẫn cần giữ lại lịch sử.</p>
            <p>Xóa mềm dùng khi task sai hoặc không còn cần quản lý trong giao diện.</p>
            <p>Checklist là nguồn chính để tính phần trăm tiến độ, thay vì nhập tay.</p>
          </div>
        </SectionCard>
      </div>
    );
  }

  function renderActiveTab() {
    if (activeTab === "access") {
      return renderAccessTab();
    }

    if (activeTab === "system") {
      return renderSystemTab();
    }

    if (activeTab === "data") {
      return renderDataTab();
    }

    return renderAccountTab();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Cài đặt</h1>
        <p className="mt-1 text-sm text-slate-600">
          Kiểm tra tài khoản, phiên đăng nhập và các cơ chế chính đang dùng trong project.
        </p>
      </div>

      <AlertBanner message={message} tone={messageTone} />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Settings sections">
        {TABS.map((tab) => {
          const active = tab.id === activeTab;

          return (
            <button
              aria-selected={active}
              className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                active
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900"
              }`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {renderActiveTab()}
    </div>
  );
}
