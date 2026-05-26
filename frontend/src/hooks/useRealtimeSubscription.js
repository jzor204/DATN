import { useEffect, useRef } from "react";
import { getAccessToken } from "../utils/auth";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8080/api/v1";
const RECONNECT_DELAY_MS = 2000;
const MAX_RETRY_ATTEMPTS = 5;

function buildRealtimeUrl({ scope, projectId, taskId }) {
  const token = getAccessToken();
  if (!token) {
    return "";
  }

  const normalizedBaseUrl = API_BASE_URL.replace(/\/+$/, "");
  const url = new URL(normalizedBaseUrl, window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/ws`;
  url.search = "";

  url.searchParams.set("token", token);
  url.searchParams.set("scope", scope);

  if (projectId) {
    url.searchParams.set("project_id", String(projectId));
  }

  if (taskId) {
    url.searchParams.set("task_id", String(taskId));
  }

  return url.toString();
}

export function useRealtimeSubscription({
  enabled = true,
  scope,
  projectId,
  taskId,
  currentUserId,
  onEvent
}) {
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled || !scope) {
      return undefined;
    }

    let socket = null;
    let reconnectTimer = null;
    let retryCount = 0;
    let disposed = false;

    function connect() {
      if (disposed) {
        return;
      }

      const url = buildRealtimeUrl({ scope, projectId, taskId });
      if (!url) {
        return;
      }

      socket = new window.WebSocket(url);

      socket.onopen = () => {
        retryCount = 0;
      };

      socket.onmessage = (messageEvent) => {
        try {
          const payload = JSON.parse(messageEvent.data);

          if (!payload || !payload.type) {
            return;
          }

          if (currentUserId && Number(payload.triggered_by) === Number(currentUserId)) {
            return;
          }

          if (typeof onEventRef.current === "function") {
            onEventRef.current(payload);
          }
        } catch (error) {
          // Ignore malformed realtime payloads.
        }
      };

      socket.onerror = () => {
        if (socket && socket.readyState !== window.WebSocket.CLOSED) {
          socket.close();
        }
      };

      socket.onclose = () => {
        if (disposed) {
          return;
        }

        if (retryCount >= MAX_RETRY_ATTEMPTS) {
          return;
        }

        retryCount += 1;
        reconnectTimer = window.setTimeout(connect, RECONNECT_DELAY_MS);
      };
    }

    connect();

    return () => {
      disposed = true;

      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }

      if (
        socket &&
        (socket.readyState === window.WebSocket.OPEN ||
          socket.readyState === window.WebSocket.CONNECTING)
      ) {
        socket.close();
      }
    };
  }, [enabled, scope, projectId, taskId, currentUserId]);
}
