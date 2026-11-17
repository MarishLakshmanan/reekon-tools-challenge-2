import { Image } from "expo-image";
import type { ImageStyle } from "expo-image";
import { useEffect, useState } from "react";
import type { StyleProp } from "react-native";

import { request } from "@/api/client";

/**
 * A server image on the web. A browser `<img>` can't send the auth header, so the image
 * is fetched with it and shown from a blob URL, which is released on unmount.
 */
export function ServerImage({ path, style }: { path: string; style: StyleProp<ImageStyle> }) {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    let current = true;
    request(path)
      .then((res) => res.blob())
      .then((blob) => {
        if (!current) return;
        url = URL.createObjectURL(blob);
        setUri(url);
      })
      .catch(() => {}); // the placeholder background stays
    return () => {
      current = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);

  return <Image source={uri ? { uri } : null} style={style} contentFit="cover" />;
}
