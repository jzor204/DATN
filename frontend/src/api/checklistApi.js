import axiosClient from "./axiosClient";

export async function listChecklistsByTask(taskId) {
  const response = await axiosClient.get(`/checklists/tasks/${taskId}`);
  return response.data;
}

export async function createChecklist(taskId, payload) {
  const response = await axiosClient.post(`/checklists/tasks/${taskId}`, payload);
  return response.data;
}

export async function deleteChecklist(checklistId) {
  const response = await axiosClient.delete(`/checklists/${checklistId}`);
  return response.data;
}

export async function createChecklistItem(checklistId, payload) {
  const response = await axiosClient.post(`/checklists/${checklistId}/items`, payload);
  return response.data;
}

export async function updateChecklistItem(itemId, payload) {
  const response = await axiosClient.put(`/checklist-items/${itemId}`, payload);
  return response.data;
}

export async function deleteChecklistItem(itemId) {
  const response = await axiosClient.delete(`/checklist-items/${itemId}`);
  return response.data;
}
