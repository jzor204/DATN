import axiosClient from "./axiosClient";

export async function listTasksByProject(projectId, page = 1, pageSize = 10, options = {}) {
  const params = {
    page,
    page_size: pageSize
  };

  if (options.archive && options.archive !== "active") {
    params.archive = options.archive;
  }

  const response = await axiosClient.get(`/projects/${projectId}/tasks`, {
    params
  });

  return response.data;
}

export async function listMyTasks({ page = 1, pageSize = 10, projectId, status } = {}) {
  const params = {
    page,
    page_size: pageSize
  };

  if (projectId && projectId !== "all") {
    params.project_id = projectId;
  }

  if (status && status !== "all") {
    params.status = status;
  }

  const response = await axiosClient.get("/tasks/me", {
    params
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

export async function getTaskAssignees(taskId) {
  const response = await axiosClient.get(`/task-assignees/tasks/${taskId}`);
  return response.data;
}

export async function updateTask(taskId, payload) {
  const response = await axiosClient.put(`/tasks/${taskId}`, payload);
  return response.data;
}

export async function archiveTask(taskId) {
  let response;
  try {
    response = await axiosClient.put(`/tasks/${taskId}/archive`);
  } catch (err) {
    if (err.status !== 404) {
      throw err;
    }
    response = await axiosClient.post(`/tasks/${taskId}/archive`);
  }
  return response.data;
}

export async function restoreTask(taskId) {
  let response;
  try {
    response = await axiosClient.put(`/tasks/${taskId}/restore`);
  } catch (err) {
    if (err.status !== 404) {
      throw err;
    }
    response = await axiosClient.post(`/tasks/${taskId}/restore`);
  }
  return response.data;
}

export async function deleteTask(taskId) {
  const response = await axiosClient.delete(`/tasks/${taskId}`);
  return response.data;
}

export async function listTaskLabels(taskId) {
  let response;
  try {
    response = await axiosClient.get(`/tasks/${taskId}/labels`);
  } catch (err) {
    if (err.status !== 404) {
      throw err;
    }
    response = await axiosClient.get(`/tasks/${taskId}/task-labels`);
  }
  return response.data;
}

export async function createTaskLabel(taskId, payload) {
  let response;
  try {
    response = await axiosClient.post(`/tasks/${taskId}/labels`, payload);
  } catch (err) {
    if (err.status !== 404) {
      throw err;
    }
    response = await axiosClient.post(`/tasks/${taskId}/task-labels`, payload);
  }
  return response.data;
}

export async function updateTaskLabel(labelId, payload) {
  const response = await axiosClient.put(`/task-labels/${labelId}`, payload);
  return response.data;
}

export async function deleteTaskLabel(labelId) {
  const response = await axiosClient.delete(`/task-labels/${labelId}`);
  return response.data;
}

export async function listTaskAttachments(taskId) {
  let response;
  try {
    response = await axiosClient.get(`/tasks/${taskId}/attachments`);
  } catch (err) {
    if (err.status !== 404) {
      throw err;
    }
    response = await axiosClient.get(`/tasks/${taskId}/task-attachments`);
  }
  return response.data;
}

export async function createTaskAttachment(taskId, payload) {
  let response;
  try {
    response = await axiosClient.post(`/tasks/${taskId}/attachments`, payload);
  } catch (err) {
    if (err.status !== 404) {
      throw err;
    }
    response = await axiosClient.post(`/tasks/${taskId}/task-attachments`, payload);
  }
  return response.data;
}

export async function updateTaskAttachment(attachmentId, payload) {
  const response = await axiosClient.put(`/task-attachments/${attachmentId}`, payload);
  return response.data;
}

export async function deleteTaskAttachment(attachmentId) {
  const response = await axiosClient.delete(`/task-attachments/${attachmentId}`);
  return response.data;
}
