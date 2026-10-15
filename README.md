# Word Wheel Duel — Public Hosting Setup

This folder is prepared for deployment to Render. You do **not** need to run the game on your PC after deployment.

## Deploy it (one-time setup)

1. Sign in to [GitHub](https://github.com/) and create a **new repository** named `word-wheel-duel`. If asked, make it **Public** and do not initialize it with a README or other files.
2. Open the new repository, choose **Add file → Upload files**, and upload **the contents of this folder** (not the ZIP itself). Make sure `render.yaml`, `package.json`, `server.js`, and `public/` are at the repository's top level. Click **Commit changes**.
3. Sign in to [Render](https://render.com/) and choose **New + → Blueprint**.
4. Connect GitHub if prompted, select your `word-wheel-duel` repository, and continue.
5. Render reads `render.yaml`. Review the proposed `word-wheel-duel` web service and click **Apply** / **Create Blueprint**.
6. Wait for the deployment to finish. Open the `https://...onrender.com` URL Render shows. Keep that URL and share it with your opponent.
7. Both players open that same URL. One clicks **Create private room** and sends the room code to the other, who enters it and joins.

If Render asks for permissions, grant access to this repository. Do not share your Render password or any account secrets in chat.

**Note:** This creates a hosted service in your Render account; I cannot create it on your behalf. Free services may sleep when idle, and the first visit after sleeping may take a minute or so. Rooms reset if the service restarts. This package has not yet been live-tested on Render, so if the deploy fails, copy the first red error from Render's deployment log and send it to me.

---

## What is included

- `server.js` — Express + Socket.IO server
- `public/` — browser game files
- `package.json` — runtime dependencies and start command
- `render.yaml` — Render Blueprint configuration
- `.gitignore` — excludes local dependencies

## Technical notes

- Requires Node.js 18+ for local development.
- Render uses `npm install` and `npm start` as configured in `render.yaml`.
- Socket.IO uses HTTP polling for compatibility with proxies and hosting providers.
- Room codes and game state are stored in server memory. Rooms reset if the service restarts; this is a casual game prototype, not production-hardened.
