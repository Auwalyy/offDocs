# offDocs (FolioSync)

Offline-first folder and document manager: an Expo app (`apps/mobile`) that stores everything in SQLite and syncs it to an Express + MongoDB API (`apps/backend`) when the device is online.

## Running locally

### Backend

```bash
cd apps/backend
cp .env.example .env   # then fill in real values
npm install
npm run dev
```

- `MONGODB_URI` and the `JWT_*` secrets are required.
- Document uploads need real Cloudflare R2 / S3 credentials in the `STORAGE_*` variables. Until then, folders still sync, but every upload fails with `STORAGE_NOT_CONFIGURED`.

### Mobile

```bash
cd apps/mobile
npm install
npx expo start
```

Create `apps/mobile/.env.local` pointing at your computer's **LAN IP**, not `localhost`, because a phone or emulator can't reach `localhost` on your computer:

```
EXPO_PUBLIC_API_URL=http://192.168.x.x:3000/api/v1
```

Restart Expo after changing it.

## Troubleshooting sync

Open **Sync Activity** (tap the sync badge). Each failed change shows the server's error message, and the server URL the app is using appears at the top.

| Message | Fix |
| --- | --- |
| Cannot reach the server at … | Backend not running, wrong IP in `.env.local`, phone on a different network, or a firewall blocking port 3000. |
| File storage is not configured on the server | Set the `STORAGE_*` variables in `apps/backend/.env` and restart the backend. |
| Waiting for … to sync first | This change depends on a folder that hasn't synced yet. It goes through on its own once that folder syncs. |

After fixing the cause, tap **Retry failed**.

## Checks

```bash
cd apps/backend && npm run typecheck && npm run lint && npm test
cd apps/mobile  && npm run typecheck && npm run lint && npm test
```
