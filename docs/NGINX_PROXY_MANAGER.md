# Nginx Proxy Manager: chat and live notifications

For the supplied Docker Compose deployment, edit the application's **Proxy Host**:

1. Scheme: `http`; Forward Hostname: `frontend`; Forward Port: `3000`.
2. Enable **Websockets Support** on the Details tab and save.
3. Configure the domain's SSL certificate normally. HTTPS pages use `wss://` automatically.
4. NPM and the frontend must share the external Docker network named `proxy`.

No extra Custom Location is needed. The browser opens
`wss://YOUR-DOMAIN/api/Notifications/ws/USER-ID`; Next.js forwards the upgrade
through its `/api/*` rewrite to `http://backend:8000/Notifications/ws/USER-ID`.
The backend does not need a public port or membership of the `proxy` network.
Remove old custom `/api` locations if they bypass this route incorrectly.

Deploy both updated services from `dev`:

```sh
git pull origin dev
docker compose up -d --build backend frontend
```

Keep `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` unset in this Compose setup.
They are frontend **build-time** overrides. If using a separately exposed API,
`NEXT_PUBLIC_WS_URL` must point to its public `wss://` base URL (never localhost,
an internal Docker hostname, or insecure `ws://` from an HTTPS page).

## Verify

Open browser Developer Tools → Network → WS. The notifications connection should
return **101 Switching Protocols**, with `ping`/`pong` frames every 25 seconds.
Send a chat message from another account and keep two tabs open for the receiver:
both should receive it. The sender's other tabs also receive their message.

- **404:** check the `/api/Notifications/ws/` path and frontend build.
- **400/426 or no upgrade:** enable Websockets Support and check any upstream proxy.
- **502:** check `frontend:3000` reachability from NPM and backend container health.
- **1008:** sign in again; the socket session is invalid or expired.

Connections retry with capped backoff and recover missed chat/notification data.
If sockets remain unavailable, visible tabs poll chat every 10 seconds and
notifications every 15 seconds. This fallback is not instantaneous.

The supplied backend runs one Uvicorn worker. Socket delivery is in-memory:
multiple workers/replicas require a shared event broker before scaling.

Reference: [NPM's WebSocket upgrade configuration](https://github.com/NginxProxyManager/nginx-proxy-manager/blob/develop/backend/templates/proxy_host.conf).
