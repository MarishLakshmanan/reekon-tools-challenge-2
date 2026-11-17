import { File, Paths } from "expo-file-system";
import { createContext, use, useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { DEFAULT_SETTINGS, parseSettings } from "@/utils/settings";
import type { Settings } from "@/utils/settings";
import { isWeb } from "@/utils/platform";

type SettingsValue = {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
};


// Outside `docs/`, so signing out (which clears `docs/`) keeps it.
const settingsFile = () => new File(Paths.document, "settings.json");

const SettingsContext = createContext<SettingsValue | null>(null);

function readSettings(): Settings {
  if (isWeb) return DEFAULT_SETTINGS;
  try {
    const file = settingsFile();
    return parseSettings(file.exists ? file.textSync() : null);
  } catch {
    return DEFAULT_SETTINGS; // unreadable: use defaults
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(readSettings);

  const update = useCallback(
    (patch: Partial<Settings>) => {
      const next = { ...settings, ...patch };
      setSettings(next);
      if (isWeb) return;
      try {
        const file = settingsFile();
        if (!file.exists) file.create();
        file.write(JSON.stringify(next));
      } catch {
        // the change still applies for this session
      }
    },
    [settings],
  );

  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return <SettingsContext value={value}>{children}</SettingsContext>;
}

export function useSettings(): SettingsValue {
  const value = use(SettingsContext);
  if (!value) throw new Error("useSettings must be used inside SettingsProvider");
  return value;
}
