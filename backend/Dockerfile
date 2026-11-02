FROM golang:1.25-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download
COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -o deskflow ./cmd/api

FROM alpine:3.22

WORKDIR /app
RUN apk add --no-cache ca-certificates && addgroup -S deskflow && adduser -S deskflow -G deskflow

COPY --from=builder /app/deskflow .

EXPOSE 8081
USER deskflow

CMD ["./deskflow"]