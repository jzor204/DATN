import axiosClient from "./axiosClient";

export async function listNotifications(page = 1, pageSize = 20) {
  const response = await axiosClient.get("/notifications", {
    params: {
      page,
      page_size: pageSize
    }
  });

  return response.data;
}

export async function markNotificationRead(notificationId) {
  const response = await axiosClient.put(`/notifications/${notificationId}/read`);
  return response.data;
}

export async function markAllNotificationsRead() {
  const response = await axiosClient.put("/notifications/read-all");
  return response.data;
}
