# Daycare Development

## Prerequisites

- Node.js 22+
- Docker (for PostgreSQL, Redis, and MinIO)

## Local Setup

1. Install dependencies:

```bash
yarn install
```

2. Start local infrastructure:

```bash
yarn infra:up
```

3. Ensure the server env file exists:

`packages/daycare-server/.env.dev` ships with defaults. Update it if needed.

4. Run migrations:

```bash
yarn workspace daycare-server migrate:dev
```

5. Seed local data:

```bash
yarn workspace daycare-server seed:dev
```

6. Start the API server:

```bash
yarn dev
```

7. Start the web client (optional):

```bash
yarn web
```

## Health Endpoints

- `GET /health` — basic liveness check.
- `GET /health/ready` — readiness check with PostgreSQL + Redis probes.

## Tests

Run the standard test suite:

```bash
yarn test
```

Run integration tests (requires running DB + Redis):

```bash
INTEGRATION=1 DATABASE_URL="postgresql://daycare:daycare@localhost:5432/daycare?schema=public" \
REDIS_URL="redis://localhost:6379" yarn test
```

Run tests inside Docker with live API checks:

```bash
yarn test:docker:live
```

This command starts:
- `db`, `redis`, `s3`, `api`, and `test-runner` from `docker-compose.devtest.yml`

The `test-runner` executes migrations, runs the full `daycare-server` test suite (including integration tests), and then runs HTTP smoke checks against the live `api` container.

## Cleanup

```bash
yarn infra:down
```

To stop Dockerized test services:

```bash
yarn test:docker:live:down
```
