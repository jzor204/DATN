import axiosClient from "./axiosClient";

export async function login(payload) {
  const response = await axiosClient.post("/auth/login", payload);
  return response.data;
}

export async function register(payload) {
  const response = await axiosClient.post("/auth/register", payload);
  return response.data;
}

export async function getMe() {
  const response = await axiosClient.get("/auth/me");
  return response.data;
}
