package realtime

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/gofiber/contrib/websocket"
)

type Event struct {
	Type        string    `json:"type"`
	Scope       string    `json:"scope"`
	ProjectID   uint      `json:"project_id,omitempty"`
	TaskID      uint      `json:"task_id,omitempty"`
	TriggeredBy uint      `json:"triggered_by"`
	Timestamp   time.Time `json:"timestamp"`
}

type client struct {
	conn *websocket.Conn
	mu   sync.Mutex
}

type Hub struct {
	mu      sync.RWMutex
	rooms   map[string]map[*client]struct{}
	clients map[*websocket.Conn]*client
}

func NewHub() *Hub {
	return &Hub{
		rooms:   make(map[string]map[*client]struct{}),
		clients: make(map[*websocket.Conn]*client),
	}
}

func ProjectsListRoom() string {
	return "projects:list"
}

func ProjectRoom(projectID uint) string {
	return fmt.Sprintf("project:%d", projectID)
}

func TaskRoom(taskID uint) string {
	return fmt.Sprintf("task:%d", taskID)
}

func UserRoom(userID uint) string {
	return fmt.Sprintf("user:%d", userID)
}

func NewEvent(eventType string, scope string, projectID uint, taskID uint, triggeredBy uint) Event {
	return Event{
		Type:        eventType,
		Scope:       scope,
		ProjectID:   projectID,
		TaskID:      taskID,
		TriggeredBy: triggeredBy,
		Timestamp:   time.Now().UTC(),
	}
}

func (h *Hub) Subscribe(room string, conn *websocket.Conn) {
	if room == "" || conn == nil {
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	existingClient, ok := h.clients[conn]
	if !ok {
		existingClient = &client{conn: conn}
		h.clients[conn] = existingClient
	}

	if _, ok := h.rooms[room]; !ok {
		h.rooms[room] = make(map[*client]struct{})
	}

	h.rooms[room][existingClient] = struct{}{}
}

func (h *Hub) UnsubscribeAll(conn *websocket.Conn) {
	if conn == nil {
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	existingClient, ok := h.clients[conn]
	if !ok {
		return
	}

	for room, clients := range h.rooms {
		delete(clients, existingClient)
		if len(clients) == 0 {
			delete(h.rooms, room)
		}
	}

	delete(h.clients, conn)
}

func (h *Hub) Broadcast(event Event, rooms ...string) {
	if len(rooms) == 0 {
		return
	}

	payload, err := json.Marshal(event)
	if err != nil {
		return
	}

	uniqueClients := make(map[*client]struct{})

	h.mu.RLock()
	for _, room := range rooms {
		for currentClient := range h.rooms[room] {
			uniqueClients[currentClient] = struct{}{}
		}
	}
	h.mu.RUnlock()

	for currentClient := range uniqueClients {
		currentClient.mu.Lock()
		writeErr := currentClient.conn.WriteMessage(websocket.TextMessage, payload)
		currentClient.mu.Unlock()

		if writeErr != nil {
			_ = currentClient.conn.Close()
			h.removeClient(currentClient)
		}
	}
}

func (h *Hub) removeClient(target *client) {
	if target == nil || target.conn == nil {
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	for room, clients := range h.rooms {
		delete(clients, target)
		if len(clients) == 0 {
			delete(h.rooms, room)
		}
	}

	delete(h.clients, target.conn)
}
