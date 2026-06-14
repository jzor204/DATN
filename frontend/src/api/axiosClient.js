import axios from "axios";
import { clearAccessToken, getAccessToken } from "../utils/auth";

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8080/api/v1",
  timeout: 15000,
  headers: {
    "Content-Type": "application/json"
  }
});

axiosClient.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

axiosClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status;
    const fallbackMessage =
      status === 404
        ? "Không tìm thấy dữ liệu hoặc API chưa sẵn sàng."
        : status >= 500
          ? "Máy chủ đang gặp lỗi. Vui lòng thử lại sau."
          : "Có lỗi xảy ra.";
    const apiMessage =
      error.response?.data?.error ||
      error.response?.data?.message ||
      fallbackMessage ||
      error.message;

    if (status === 401) {
      clearAccessToken();
    }

    return Promise.reject({
      status,
      message: Array.isArray(apiMessage) ? apiMessage.join(", ") : String(apiMessage)
    });
  }
);

export default axiosClient;
