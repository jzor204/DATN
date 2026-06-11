package migrator

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
)

type Migration struct {
	Version  string
	Name     string
	Path     string
	SQL      string
	Checksum string
}

type Runner struct {
	db *sql.DB
}

type StatusRow struct {
	Version   string
	Name      string
	Checksum  string
	AppliedAt *time.Time
}

var migrationFilePattern = regexp.MustCompile(`^(\d+)_(.+)\.up\.sql$`)

func NewRunner(db *sql.DB) *Runner {
	return &Runner{db: db}
}

func (r *Runner) EnsureTable(ctx context.Context) error {
	_, err := r.db.ExecContext(ctx, `
CREATE TABLE IF NOT EXISTS schema_migration_records (
    version VARCHAR(32) NOT NULL,
    name VARCHAR(255) NOT NULL,
    checksum CHAR(64) NOT NULL,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`)
	return err
}

func (r *Runner) Up(ctx context.Context, path string) ([]Migration, error) {
	if err := r.EnsureTable(ctx); err != nil {
		return nil, err
	}

	migrations, err := Load(path)
	if err != nil {
		return nil, err
	}

	applied, err := r.appliedVersions(ctx)
	if err != nil {
		return nil, err
	}

	executed := make([]Migration, 0)
	for _, migration := range migrations {
		if _, ok := applied[migration.Version]; ok {
			continue
		}

		if err := r.apply(ctx, migration); err != nil {
			return executed, err
		}

		executed = append(executed, migration)
	}

	return executed, nil
}

func (r *Runner) Baseline(ctx context.Context, path string) ([]Migration, error) {
	if err := r.EnsureTable(ctx); err != nil {
		return nil, err
	}

	migrations, err := Load(path)
	if err != nil {
		return nil, err
	}

	applied, err := r.appliedVersions(ctx)
	if err != nil {
		return nil, err
	}

	recorded := make([]Migration, 0)
	for _, migration := range migrations {
		if _, ok := applied[migration.Version]; ok {
			continue
		}

		if err := r.record(ctx, migration); err != nil {
			return recorded, err
		}
		recorded = append(recorded, migration)
	}

	return recorded, nil
}

func (r *Runner) Status(ctx context.Context, path string) ([]StatusRow, error) {
	if err := r.EnsureTable(ctx); err != nil {
		return nil, err
	}

	migrations, err := Load(path)
	if err != nil {
		return nil, err
	}

	applied, err := r.appliedRows(ctx)
	if err != nil {
		return nil, err
	}

	rows := make([]StatusRow, 0, len(migrations))
	for _, migration := range migrations {
		row := StatusRow{
			Version:  migration.Version,
			Name:     migration.Name,
			Checksum: migration.Checksum,
		}

		if appliedRow, ok := applied[migration.Version]; ok {
			row.AppliedAt = appliedRow.AppliedAt
		}

		rows = append(rows, row)
	}

	return rows, nil
}

func (r *Runner) apply(ctx context.Context, migration Migration) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	if _, err := tx.ExecContext(ctx, migration.SQL); err != nil {
		_ = tx.Rollback()
		return fmt.Errorf("apply migration %s failed: %w", migration.Version, err)
	}

	if _, err := tx.ExecContext(
		ctx,
		"INSERT INTO schema_migration_records (version, name, checksum) VALUES (?, ?, ?)",
		migration.Version,
		migration.Name,
		migration.Checksum,
	); err != nil {
		_ = tx.Rollback()
		return err
	}

	return tx.Commit()
}

func (r *Runner) record(ctx context.Context, migration Migration) error {
	_, err := r.db.ExecContext(
		ctx,
		"INSERT INTO schema_migration_records (version, name, checksum) VALUES (?, ?, ?)",
		migration.Version,
		migration.Name,
		migration.Checksum,
	)
	return err
}

func (r *Runner) appliedVersions(ctx context.Context) (map[string]struct{}, error) {
	rows, err := r.appliedRows(ctx)
	if err != nil {
		return nil, err
	}

	result := make(map[string]struct{}, len(rows))
	for version := range rows {
		result[version] = struct{}{}
	}

	return result, nil
}

func (r *Runner) appliedRows(ctx context.Context) (map[string]StatusRow, error) {
	rows, err := r.db.QueryContext(ctx, "SELECT version, name, checksum, applied_at FROM schema_migration_records")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := map[string]StatusRow{}
	for rows.Next() {
		var row StatusRow
		var appliedAt time.Time
		if err := rows.Scan(&row.Version, &row.Name, &row.Checksum, &appliedAt); err != nil {
			return nil, err
		}
		row.AppliedAt = &appliedAt
		result[row.Version] = row
	}

	return result, rows.Err()
}

func Load(path string) ([]Migration, error) {
	entries, err := os.ReadDir(path)
	if err != nil {
		return nil, err
	}

	migrations := make([]Migration, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		matches := migrationFilePattern.FindStringSubmatch(entry.Name())
		if len(matches) != 3 {
			continue
		}

		fullPath := filepath.Join(path, entry.Name())
		raw, err := os.ReadFile(fullPath)
		if err != nil {
			return nil, err
		}

		sqlText := strings.TrimSpace(string(raw))
		if sqlText == "" {
			return nil, fmt.Errorf("migration %s is empty", entry.Name())
		}

		sum := sha256.Sum256(raw)
		migrations = append(migrations, Migration{
			Version:  matches[1],
			Name:     matches[2],
			Path:     fullPath,
			SQL:      sqlText,
			Checksum: hex.EncodeToString(sum[:]),
		})
	}

	if len(migrations) == 0 {
		return nil, errors.New("no migration files found")
	}

	sort.Slice(migrations, func(i, j int) bool {
		return migrations[i].Version < migrations[j].Version
	})

	return migrations, nil
}
