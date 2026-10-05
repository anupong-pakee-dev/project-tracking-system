-- Runs once, when the volume is first created. Integration tests use (and wipe) this database.
CREATE DATABASE tracker_test OWNER tracker;

-- Prisma's pg adapter assumes UTC sessions (see docker-compose.yml).
ALTER DATABASE tracker SET timezone TO 'UTC';
ALTER DATABASE tracker_test SET timezone TO 'UTC';
