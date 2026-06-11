import axiosClient from "./axiosClient";

export async function listActivitiesByTask(taskId, page = 1, pageSize = 30) {
  const response = await axiosClient.get(`/tasks/${taskId}/activities`, {
    params: {
      page,
      page_size: pageSize
    }
  });

  return response.data;
}
