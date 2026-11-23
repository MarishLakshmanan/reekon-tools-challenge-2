# Reekon Tools Challenge 2

My submission for **Reekon Tools Challenge 2**: a photo measurement app built with Expo and React Native. Take a photo, draw on it, attach measurements and labels, and save it to a shared project. Your team can open it on another phone or in the browser, and chat inside the project.

The app runs in **Expo Go**, so you don't need a development build. A small Express + SQLite server in [server/](server/) stores the data.

## Requirements

- **Node.js 22.18 or newer.** The server runs TypeScript directly with Node.
- **Expo Go** on your phone ([iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent)), or an Android emulator / iOS simulator.

## Quick start

### 1. Install dependencies

```bash
npm install                 # app
npm run server:install      # API server
```

### 2. Set the API URL

Copy the example env file:

```bash
cp .env.example .env
```

Then set `EXPO_PUBLIC_API_URL` to an address where the app can reach the server:

| Where the app runs | `EXPO_PUBLIC_API_URL` |
| --- | --- |
| Web browser on the same computer | `http://localhost:3000` |
| Phone on the same Wi-Fi | `http://<your-computer's-LAN-IP>:3000` |
| Phone on a guest network or different network | The public URL of a tunnel to port 3000 (see [Tunneling](#tunneling)) |

Restart `npx expo start` after you change `.env`.

### 3. Seed the database

```bash
npm run seed
```

This creates the organization **Reekon Interiors** and four users. It can be run more than once.

### 4. Start the API server

```bash
npm run server
```

The server listens on `http://localhost:3000`.

### 5. Start the app

In a second terminal:

```bash
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS). You can also press `a` to open the app on an Android emulator or `i` to open it on an iOS simulator.

## AI agent

The editor has an AI button that draws pen paths and text labels from a typed request. The agent runs on the API server and needs an OpenRouter API key.

1. Copy the server's example env file:

   ```bash
   cp server/.env.example server/.env
   ```

2. Set `OPENROUTER_API_KEY` in `server/.env` to your OpenRouter key. `AGENT_MODEL` is optional and defaults to `google/gemini-4-argon`.
3. Restart the API server (`npm run server`).

Without the key, the server still runs, but the AI route is off and the app shows "AI isn't set up on the server."

In the app, open a photo and tap the sparkles button in the header. The button turns on after the photo's first Save, because the agent draws on the server's copy of the photo.

To try the agent without the app, run:

```bash
npm run agent              # uses scripts/ai-agent/mock/input.json and its image
npm run agent -- photo.jpg # same request, on another image
```

It reads the key from `server/.env` and writes its output to `scripts/ai-agent/out/`.

## Test users

All users are in the **Reekon Interiors** organization.

| Name | Email | Password |
| --- | --- | --- |
| Dana | `dana@reekon.test` | `dana-pass` |
| Marcus | `marcus@reekon.test` | `marcus-pass` |
| Chen | `chen@reekon.test` | `chen-pass` |
| Dara | `dara@reekon.test` | `dara-pass` |

There is no sign-up. To try sharing, sign in as two different users on two devices.

## Web app

Start the web app:

```bash
npx expo start --web
```

Or press `w` in the terminal while `npx expo start` is running.

On the web, you can sign in, open projects, view photos and their measurements, zoom and pan, and edit measurement values and text labels. Taking photos is only available in the phone app.

## Tunneling

If your phone can't reach your computer (for example, on a guest network), start Expo with `npx expo start --tunnel`. Then tunnel the API server's port `3000` with any tunneling tool, put its public URL in `EXPO_PUBLIC_API_URL` in `.env`, and restart Expo.

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Start the Expo dev server |
| `npm run web` | Start the app in the browser |
| `npm run android` / `npm run ios` | Start the app on an emulator or simulator |
| `npm run server:install` | Install the API server's dependencies |
| `npm run server` | Start the API server in watch mode |
| `npm run seed` | Seed the organization and test users |
| `npm run agent` | Try the AI agent on a mock request |
| `npm test` | Run the app tests |
| `npm test --prefix server` | Run the server tests |
| `npm run lint` | Lint the app |

## Project layout

```
src/app/        routes and layouts (Expo Router)
src/screens/    screen UIs
src/components/ reusable UI
src/api/        code that calls the server
server/         Express + SQLite API, with its own package.json
server/src/ai/  the AI agent, its prompt, and its output validator
shared/         annotation Zod schemas used by both the app and the server
scripts/        helper scripts, including the AI agent test script
docs/           phase-by-phase design docs
```

See [docs/workspace.md](docs/workspace.md) for the full layout.

## Decisions and design docs

- **[NOTES.md](NOTES.md)** has a short summary of the main decisions and why I made them.
- **[docs/](docs/)** has the design of each phase:
  1. [Phase 1: Skia canvas annotation](docs/phase-one/phase-one.md)
  2. [Phase 2: API and database](docs/phase-two/phase-two.md) ([sync logic](docs/phase-two/sync-logic.md))
  3. [Phase 3: Users, organization, and projects](docs/phase-three/phase-three.md)
  4. [Phase 4: Canvas screen](docs/phase-four/phase-four.md)
  5. [Phase 5: Web build](docs/phase-five/phase-five.md)
  6. [Bonus: AI agent](docs/bonus-ai/bonus-ai.md)

## Troubleshooting

- **`EXPO_PUBLIC_API_URL is not set`**: create `.env` (step 2), then restart Expo.
- **Sign-in fails or requests time out on the phone**: `localhost` on a phone points to the phone itself. Use your computer's LAN IP or a tunnel URL.
- **Invalid email or password**: run `npm run seed`.
- **AI isn't set up on the server**: set `OPENROUTER_API_KEY` in `server/.env`, then restart the server.
- **The AI button is greyed out**: save the photo once first.
- **Stale env value or other odd cache issues**: run `npx expo start --clear`.
