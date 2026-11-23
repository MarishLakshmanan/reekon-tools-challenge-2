import { useLocalSearchParams } from "expo-router";

import { ChatScreen } from "@/screens/ChatScreen";

export default function ChatRoute() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  return <ChatScreen projectId={projectId} />;
}
