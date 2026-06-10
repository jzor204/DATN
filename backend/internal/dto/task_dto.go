package dto

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

type OptionalTime struct {
	Set   bool
	Value *time.Time
}

func (input *OptionalTime) UnmarshalJSON(data []byte) error {
	input.Set = true

	trimmed := bytes.TrimSpace(data)
	if bytes.Equal(trimmed, []byte("null")) {
		input.Value = nil
		return nil
	}

	var raw string
	if err := json.Unmarshal(trimmed, &raw); err != nil {
		return err
	}

	raw = strings.TrimSpace(raw)
	if raw == "" {
		input.Value = nil
		return nil
	}

	deadline, err := parseDeadline(raw)
	if err != nil {
		return err
	}

	input.Value = &deadline
	return nil
}

func parseDeadline(value string) (time.Time, error) {
	rfc3339Layouts := []string{
		time.RFC3339Nano,
		time.RFC3339,
	}

	for _, layout := range rfc3339Layouts {
		parsed, err := time.Parse(layout, value)
		if err == nil {
			return parsed, nil
		}
	}

	localLayouts := []string{
		"2006-01-02T15:04",
		"2006-01-02 15:04",
		"2006-01-02",
	}

	for _, layout := range localLayouts {
		parsed, err := time.ParseInLocation(layout, value, time.Local)
		if err == nil {
			return parsed, nil
		}
	}

	return time.Time{}, fmt.Errorf("deadline must be a valid datetime")
}

type OptionalUintSlice struct {
	Set    bool
	Values []uint
}

func (input *OptionalUintSlice) UnmarshalJSON(data []byte) error {
	input.Set = true

	trimmed := bytes.TrimSpace(data)
	if bytes.Equal(trimmed, []byte("null")) {
		input.Values = []uint{}
		return nil
	}

	var values []uint
	if err := json.Unmarshal(trimmed, &values); err != nil {
		return err
	}

	input.Values = values
	return nil
}

type CreateTaskRequest struct {
	Title       string       `json:"title"`
	Description string       `json:"description"`
	AssigneeID  *uint        `json:"assignee_id"`
	AssigneeIDs []uint       `json:"assignee_ids"`
	Deadline    OptionalTime `json:"deadline"`
}

type UpdateTaskRequest struct {
	Title       *string           `json:"title"`
	Description *string           `json:"description"`
	Status      *string           `json:"status"`
	AssigneeID  *uint             `json:"assignee_id"`
	AssigneeIDs OptionalUintSlice `json:"assignee_ids"`
	Deadline    OptionalTime      `json:"deadline"`
}
