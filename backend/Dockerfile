FROM golang:1.25-alpine

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN go build -o main ./cmd/api
RUN go build -o migrate ./cmd/migrate
RUN go build -o seed ./cmd/seed

EXPOSE 8080

CMD ["sh", "-c", "if [ \"${RUN_MIGRATIONS_ON_START:-false}\" = \"true\" ]; then ./migrate -path ${MIGRATIONS_PATH:-migrations} || exit 1; fi; exec ./main"]
