#!/bin/bash

echo "Starting PostgreSQL on port 5435..."
docker run -d --name student-tracker-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=student_tracker \
  -p 5435:5432 \
  postgres:16-alpine

echo "Starting Redis on port 6381..."
docker run -d --name student-tracker-redis \
  -p 6381:6379 \
  redis:7-alpine

echo "Services started!"
echo "PostgreSQL: localhost:5435"
echo "Redis: localhost:6381"