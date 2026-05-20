import EmptyState from "../components/EmptyState";
import { navigateTo } from "../utils/router";

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-3xl py-16">
      <EmptyState
        action={
          <button
            className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
            onClick={() => navigateTo("/projects")}
            type="button"
          >
            Về workspace
          </button>
        }
        description="Đường dẫn này không tồn tại trong frontend MVP hiện tại."
        title="Không tìm thấy trang"
      />
    </div>
  );
}
