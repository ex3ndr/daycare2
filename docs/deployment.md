# Daycare Deployment (Kubernetes)

This repo includes Kubernetes manifests aligned with the Happy deployment layout.

## Files

- `packages/daycare-server/deploy/daycare.yaml` — API server Deployment, Service, PDB, and ExternalSecret.
- `packages/daycare-server/deploy/daycare-redis.yaml` — Redis StatefulSet + Service.
- `packages/daycare-web/deploy/daycare-web.yaml` — Web app Deployment + Service.

## Required Secrets

The server expects the following environment variables, provided via `daycare-secrets`:

- `DATABASE_URL`
- `REDIS_URL` (optional if you set it directly in the Deployment)
- `TOKEN_SEED`
- `TOKEN_SERVICE` (optional; defaults to `daycare`)
- `ALLOW_OPEN_ORG_JOIN` (optional)
- `RESEND_API_KEY`
- `RESEND_FROM`
- `OTP_TTL_SECONDS` (optional; defaults to `600`)
- `OTP_COOLDOWN_SECONDS` (optional; defaults to `60`)
- `OTP_MAX_ATTEMPTS` (optional; defaults to `5`)
- `OTP_SALT` (optional; defaults to `TOKEN_SEED`)

`daycare.yaml` defines an `ExternalSecret` that extracts from `/daycare-server`. Adjust this to match your secret store structure, or replace it with a standard `Secret`.

## Apply

```bash
kubectl apply -f packages/daycare-server/deploy/daycare-redis.yaml
kubectl apply -f packages/daycare-server/deploy/daycare.yaml
kubectl apply -f packages/daycare-web/deploy/daycare-web.yaml
```

## Notes

- The container expects to listen on port `3005`.
- Liveness probe uses `/health` and readiness probe uses `/health/ready`.
- An `emptyDir` volume is mounted at `/app/.daycare` to store uploads. Swap this for a persistent volume if you need durable file storage.
- `daycare-web` routes `/api/*` to `http://daycare-server:3005` inside the cluster, so web and server can share one public host.
