import axiosClient from "./axiosClient";

export async function createTaskChangeRequest(taskId, payload) {
  const response = await axiosClient.post(`/tasks/${taskId}/change-requests`, payload);
  return response.data;
}

export async function listTaskChangeRequests(taskId, page = 1, pageSize = 20) {
  const response = await axiosClient.get(`/tasks/${taskId}/change-requests`, {
    params: {
      page,
      page_size: pageSize
    }
  });

  return response.data;
}

export async function getChangeRequest(requestId) {
  const response = await axiosClient.get(`/change-requests/${requestId}`);
  return response.data;
}

export async function approveChangeRequest(requestId, payload = {}) {
  const response = await axiosClient.post(`/change-requests/${requestId}/approve`, payload);
  return response.data;
}

export async function rejectChangeRequest(requestId, payload = {}) {
  const response = await axiosClient.post(`/change-requests/${requestId}/reject`, payload);
  return response.data;
}

export async function cancelChangeRequest(requestId) {
  const response = await axiosClient.post(`/change-requests/${requestId}/cancel`);
  return response.data;
}
