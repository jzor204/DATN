import { useEffect, useMemo, useState } from "react";
import { getMe } from "../api/authApi";
import AlertBanner from "../components/AlertBanner";
import SectionCard from "../components/SectionCard";
import { formatRoleLabel } from "../utils/format";
import { getAccessToken } from "../utils/auth";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8080/api/v1";
const FRONTEND_URL = window.location.origin || "http://127.0.0.1:5173";

const TABS = [
  { id: "account", label: "Tài khoản" },
  { id: "security", label: "Bảo mật" },
  { id: "system", label: "Hệ thống" },
  { id: "cache", label: "Cache" }
];

function getBackendRoot() {
  return API_BASE_URL.replace(/\/api\/v1\/?$/i, "");
}

function getSwaggerUrl() {
  return `${getBackendRoot()}/swagger/index.html`;
}

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
    description: "Phiên đăng nhập đang hoạt động."
  };
}

function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
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

  function handleOpen(url) {
    window.open(url, "_blank", "noopener,noreferrer");
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
          title="Tài khoản"
          eyebrow="Profile"
          description="Thông tin đăng nhập hiện tại và vai trò của người dùng trong hệ thống."
          action={
            <ActionButton disabled={isReloadingProfile} onClick={handleReloadProfile} tone="primary">
              {isReloadingProfile ? "Đang tải..." : "Làm mới"}
            </ActionButton>
          }
        >
          <div className="flex flex-col gap-5 md:flex-row md:items-center">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xl font-semibold text-white">
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
            <InfoTile label="Loại tài khoản" value={profile?.role === "admin" ? "Quản trị hệ thống" : "Thành viên"} />
            <InfoTile label="Quyền project" value="Theo role trong project" />
            <InfoTile chipTone={sessionStatus.tone} label="Session" value={sessionStatus.label} />
          </div>
        </SectionCard>

        <SectionCard title="Tac vu nhanh" eyebrow="Account">
          <div className="space-y-3">
            <ActionButton className="w-full" disabled={isReloadingProfile} onClick={handleReloadProfile} tone="primary">
              Tải lại thông tin
            </ActionButton>
            <ActionButton className="w-full" onClick={onLogout}>
              Đăng xuất
            </ActionButton>
          </div>
        </SectionCard>
      </div>
    );
  }

  function renderSecurityTab() {
    return (
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <SectionCard
            title="Bảo mật"
            eyebrow="Session"
            description="Trạng thái phiên đăng nhập và các cơ chế bảo vệ đang được áp dụng."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <InfoTile chipTone={sessionStatus.tone} label="Trạng thái phiên" value={sessionStatus.label} />
              <InfoTile label="Token hết hạn" value={formatJwtTime(claims?.exp)} />
              <InfoTile label="Lưu trữ" value="Browser localStorage" />
            </div>

            <div className="mt-5 space-y-3">
              <SettingRow
                description="Frontend tự gắn Authorization header cho các request cần đăng nhập."
                status="Đã bật"
                title="JWT authentication"
              />
              <SettingRow
                description="Các trang chính yêu cầu user phải đăng nhập trước khi truy cập."
                status="Đã bật"
                title="Protected routes"
              />
              <SettingRow
                description="Chưa nằm trong phạm vi hiện tại của project."
                status="Chưa thêm"
                title="Refresh token"
                tone="muted"
              />
            </div>
          </SectionCard>

          <SectionCard title="Phân quyền" eyebrow="Authorization">
            <div className="grid gap-4 md:grid-cols-3">
              <InfoTile label="Global roles" value="admin, member" />
              <InfoTile label="Project roles" value="owner, admin, member" />
              <InfoTile label="Task member" value="Cập nhật status được assign" />
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Công cụ phiên đăng nhập" eyebrow="Account">
          <p className="mb-4 text-sm text-slate-600">
            Đăng xuất sẽ xóa JWT khỏi trình duyệt và đưa user về màn hình login.
          </p>
          <ActionButton className="w-full" onClick={onLogout} tone="danger">
            Đăng xuất khỏi phiên hiện tại
          </ActionButton>
        </SectionCard>
      </div>
    );
  }

  function renderSystemTab() {
    return (
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <SectionCard
            title="Hệ thống"
            eyebrow="Environment"
            description="Thông tin kết nối chính dùng cho demo frontend, backend API và Swagger."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <InfoTile label="Frontend" value={FRONTEND_URL} />
              <InfoTile label="Backend API" value={API_BASE_URL} />
              <InfoTile label="Swagger" value="/swagger/index.html" />
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <ActionButton onClick={() => handleOpen(getSwaggerUrl())} tone="primary">
                Mở Swagger
              </ActionButton>
              <ActionButton onClick={() => handleOpen(API_BASE_URL.replace(/\/api\/v1\/?$/i, "/swagger/index.html"))}>
                Tài liệu API
              </ActionButton>
            </div>
          </SectionCard>

          <SectionCard title="Realtime" eyebrow="WebSocket">
            <div className="space-y-3">
              <SettingRow
                description="Frontend đang nhận event và tải lại dữ liệu khi project, task hoặc comment thay đổi."
                status="Đã kết nối"
                title="Cập nhật realtime"
              />
              <SettingRow
                description="Hỗ trợ các scope projects, project và task cho demo nhiều tab."
                status="Đã bật"
                title="WebSocket scopes"
              />
              <SettingRow
                description="Realtime hub hiện tại phù hợp demo với một backend instance."
                status="MVP"
                title="Chế độ realtime"
                tone="info"
              />
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Backend stack" eyebrow="Docker">
          <div className="space-y-3">
            <SettingRow description="Cơ sở dữ liệu ứng dụng." status="Đang chạy" title="MySQL" />
            <SettingRow description="Cache cho profile user." status="Đang chạy" title="Redis" />
            <SettingRow description="REST API bằng Golang Fiber." status="Đang chạy" title="API service" />
          </div>
        </SectionCard>
      </div>
    );
  }

  function renderCacheTab() {
    return (
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <SectionCard
          title="Redis Cache"
          eyebrow="Cache"
          description="Thông tin cache được rút gọn để phục vụ demo. Chi tiết flow nên đưa vào báo cáo."
          action={
            <ActionButton disabled={isReloadingProfile} onClick={handleReloadProfile} tone="primary">
              {isReloadingProfile ? "Đang test..." : "Test /auth/me"}
            </ActionButton>
          }
        >
          <div className="grid gap-4 md:grid-cols-4">
            <InfoTile chipTone="success" label="Trạng thái" value="Đã bật" />
            <InfoTile label="Được dùng bởi" value="/auth/me" />
            <InfoTile label="TTL" value="5 phút" />
            <InfoTile label="Đối tượng cache" value="User profile" />
          </div>

          <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Khi frontend gọi /auth/me, backend ưu tiên lấy profile từ Redis. Nếu cache miss, backend đọc MySQL
            và ghi lại Redis với TTL 5 phút.
          </p>
        </SectionCard>

        <SectionCard title="Demo cache" eyebrow="Redis">
          <p className="mb-4 text-sm text-slate-600">
            Nút này gọi lại /auth/me để kiểm tra luồng lấy profile. UI không hiện Redis key chi tiết để tránh làm
            màn hình quá kỹ thuật.
          </p>
          <ActionButton className="w-full" disabled={isReloadingProfile} onClick={handleReloadProfile} tone="primary">
            {isReloadingProfile ? "Đang gọi API..." : "Gọi /auth/me"}
          </ActionButton>
        </SectionCard>
      </div>
    );
  }

  function renderActiveTab() {
    if (activeTab === "security") {
      return renderSecurityTab();
    }

    if (activeTab === "system") {
      return renderSystemTab();
    }

    if (activeTab === "cache") {
      return renderCacheTab();
    }

    return renderAccountTab();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Cài đặt</h1>
        <p className="mt-1 text-sm text-slate-600">
          Quản lý tài khoản, bảo mật phiên đăng nhập và thông tin hệ thống phục vụ demo.
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
