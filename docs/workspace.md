# Workspace Layout

This is the folder layout for the app. Follow it when creating new files or folders.

```
my-app/
  assets/          images, fonts
  scripts/         helper scripts
  src/
    app/           ONLY routes and layouts (each file = a screen URL)
    components/    reusable UI (buttons, cards)
    screens/       big page UIs (optional, routes just import them)
    hooks/         reusable hooks
    utils/         small helpers (date formatting, etc.)
    server/        backend logic if you use API routes
  app.json
  eas.json
  package.json
```
