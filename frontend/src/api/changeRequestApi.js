import axiosClient from "./axiosClient";

export async function createTaskChangeRequest(taskId, payload) {
  const response = await axiosClient.post(`/tasks/${taskId}/change-requests`, payload);
  return response.data;
}

export async function approveChangeRequest(requestId) {
  const response = await axiosClient.post(`/change-requests/${requestId}/approve`);
  return response.data;
}

export async function rejectChangeRequest(requestId) {
  const response = await axiosClient.post(`/change-requests/${requestId}/reject`);
  return response.data;
}
