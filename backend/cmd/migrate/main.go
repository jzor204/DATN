package main

import (
	"context"
	"database/sql"
	"flag"
	"fmt"
	"log"
	"time"

	_ "github.com/go-sql-driver/mysql"

	"task-management/pkg/config"
	"task-management/pkg/migrator"
)

func main() {
	path := flag.String("path", "migrations", "path to migration files")
	baseline := flag.Bool("baseline", false, "record existing migrations without executing SQL")
	status := flag.Bool("status", false, "print migration status")
	flag.Parse()

	cfg := config.Load()
	db, err := sql.Open("mysql", dsn(cfg))
	if err != nil {
		log.Fatalf("open mysql: %v", err)
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		log.Fatalf("ping mysql: %v", err)
	}

	runner := migrator.NewRunner(db)

	switch {
	case *status:
		rows, err := runner.Status(ctx, *path)
		if err != nil {
			log.Fatalf("migration status failed: %v", err)
		}
		for _, row := range rows {
			applied := "pending"
			if row.AppliedAt != nil {
				applied = row.AppliedAt.Format(time.RFC3339)
			}
			fmt.Printf("%s %s %s\n", row.Version, row.Name, applied)
		}

	case *baseline:
		recorded, err := runner.Baseline(ctx, *path)
		if err != nil {
			log.Fatalf("migration baseline failed: %v", err)
		}
		fmt.Printf("baseline recorded %d migration(s)\n", len(recorded))

	default:
		executed, err := runner.Up(ctx, *path)
		if err != nil {
			log.Fatalf("migration up failed: %v", err)
		}
		fmt.Printf("applied %d migration(s)\n", len(executed))
	}
}

func dsn(cfg *config.Config) string {
	return fmt.Sprintf(
		"%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local&multiStatements=true",
		cfg.MySQLUser,
		cfg.MySQLPassword,
		cfg.MySQLHost,
		cfg.MySQLPort,
		cfg.MySQLDatabase,
	)
}
