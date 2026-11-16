This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router**. Routes and `_layout.tsx` navigators live in `src/app/`. Keep everything else out of it.
- Import `Link`, `router`, `useLocalSearchParams` from `expo-router`. Docs: https://docs.expo.dev/router/introduction.md

## TypeScript docstrings

- Add TSDoc (`/** ... */`) only to important functions:
  - Exported/public APIs
  - Functions with non-obvious logic, side effects, or edge cases
  - Functions that throw, or take complex params/options objects
- Skip docstrings for small, private, or self-explanatory helpers. Let clear names and types do the work.
- Keep them short: one-line summary, then `@param`, `@returns`, and `@throws` only when they add info beyond the types.
- Don't repeat type info already in the signature.
- Add an `@example` only for tricky or widely used functions.

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- **No development builds.** This project must run in Expo Go. Do not add any dependency (or dependency version) that needs a development build. Before recommending a package, check its versioned Expo docs page says "Included in Expo Go".
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
- Workspace layout: before changing the workspace structure or creating a new folder or file, read and follow the design in [docs/workspace.md](docs/workspace.md).
