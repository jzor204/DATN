import axiosClient from "./axiosClient";

export async function listCommentsByTask(taskId, page = 1, pageSize = 10) {
  const response = await axiosClient.get(`/tasks/${taskId}/comments`, {
    params: {
      page,
      page_size: pageSize
    }
  });

  return response.data;
}

export async function createComment(taskId, payload) {
  const response = await axiosClient.post(`/tasks/${taskId}/comments`, payload);
  return response.data;
}

export async function updateComment(commentId, payload) {
  const response = await axiosClient.put(`/comments/${commentId}`, payload);
  return response.data;
}

export async function deleteComment(commentId) {
  const response = await axiosClient.delete(`/comments/${commentId}`);
  return response.data;
}
