#!/bin/bash

echo "Initializing database..."

# Check if PostgreSQL container is running
if ! docker ps | grep -q student-tracker-postgres; then
    echo "PostgreSQL container is not running. Please run ./start-services.sh first"
    exit 1
fi

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if docker exec student-tracker-postgres pg_isready -U postgres > /dev/null 2>&1; then
        echo "PostgreSQL is ready!"
        break
    fi
    echo -n "."
    sleep 1
done

# Run SQL files
echo "Creating extensions..."
docker exec -i student-tracker-postgres psql -U postgres -d student_tracker < database/init/01-extensions.sql

echo "Creating schema..."
docker exec -i student-tracker-postgres psql -U postgres -d student_tracker < database/init/02-schema.sql

echo "Seeding data..."
docker exec -i student-tracker-postgres psql -U postgres -d student_tracker < database/init/03-seed.sql

echo "Database initialized successfully!"