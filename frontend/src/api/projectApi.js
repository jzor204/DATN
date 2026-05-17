import axiosClient from "./axiosClient";

export async function listProjects(page = 1, pageSize = 10) {
  const response = await axiosClient.get("/projects", {
    params: {
      page,
      page_size: pageSize
    }
  });

  return response.data;
}

export async function createProject(payload) {
  const response = await axiosClient.post("/projects/", payload);
  return response.data;
}

export async function getProject(projectId) {
  const response = await axiosClient.get(`/projects/${projectId}`);
  return response.data;
}

export async function updateProject(projectId, payload) {
  const response = await axiosClient.put(`/projects/${projectId}`, payload);
  return response.data;
}

export async function deleteProject(projectId) {
  const response = await axiosClient.delete(`/projects/${projectId}`);
  return response.data;
}

export async function listProjectMembers(projectId, page = 1, pageSize = 100) {
  const response = await axiosClient.get(`/projects/${projectId}/members`, {
    params: {
      page,
      page_size: pageSize
    }
  });

  return response.data;
}

export async function listProjectMemberCandidates(
  projectId,
  { q = "", page = 1, pageSize = 20 } = {}
) {
  const response = await axiosClient.get("/tasks/me", {
    params: {
      project_id: projectId,
      status: "candidates",
      q,
      page,
      page_size: pageSize
    }
  });

  return response.data;
}

export async function addProjectMember(projectId, payload) {
  const response = await axiosClient.post(`/projects/${projectId}/members`, payload);
  return response.data;
}

export async function removeProjectMember(projectId, userId) {
  const response = await axiosClient.delete(`/projects/${projectId}/members/${userId}`);
  return response.data;
}
