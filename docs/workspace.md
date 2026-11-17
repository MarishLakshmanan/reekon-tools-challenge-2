# Workspace Layout

This is the folder layout for the app. Follow it when creating new files or folders.

```
my-app/
  assets/          images, fonts
  scripts/         helper scripts
  server/          Express + SQLite server, its own package.json and tsconfig
  src/
    app/           ONLY routes and layouts (each file = a screen URL)
    components/    reusable UI (buttons, cards)
    screens/       big page UIs (optional, routes just import them)
    hooks/         reusable hooks
    utils/         small helpers (date formatting, etc.)
    api/           app-side code that calls the server (fetch helpers)
  app.json
  eas.json
  package.json
```
