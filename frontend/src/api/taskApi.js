import axiosClient from "./axiosClient";

export async function listTasksByProject(projectId, page = 1, pageSize = 10) {
  const response = await axiosClient.get(`/projects/${projectId}/tasks`, {
    params: {
      page,
      page_size: pageSize
    }
  });

  return response.data;
}

export async function createTask(projectId, payload) {
  const response = await axiosClient.post(`/projects/${projectId}/tasks`, payload);
  return response.data;
}

export async function getTask(taskId) {
  const response = await axiosClient.get(`/tasks/${taskId}`);
  return response.data;
}

export async function updateTask(taskId, payload) {
  const response = await axiosClient.put(`/tasks/${taskId}`, payload);
  return response.data;
}

export async function deleteTask(taskId) {
  const response = await axiosClient.delete(`/tasks/${taskId}`);
  return response.data;
}
