import { useLocalSearchParams } from "expo-router";

import { ProjectScreen } from "@/screens/ProjectScreen";

export default function ProjectRoute() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  return <ProjectScreen projectId={projectId} />;
}
