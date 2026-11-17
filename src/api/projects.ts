import { jsonInit, request } from "@/api/client";
import type { User } from "@/api/auth";
import { makeId } from "@/utils/annotations/makeId";

export type Project = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: number;
  memberCount: number;
  documentCount: number;
};
export type ProjectDetail = Omit<Project, "memberCount" | "documentCount"> & { members: User[] };

export async function listProjects(): Promise<Project[]> {
  return (await request("/projects")).json();
}

export async function createProject(name: string): Promise<void> {
  // The app makes the id, so a retried request can't create a second project.
  await request("/projects", jsonInit("POST", { id: makeId(), name }));
}

export async function getProject(id: string): Promise<ProjectDetail> {
  return (await request(`/projects/${id}`)).json();
}

export async function listOrgUsers(): Promise<User[]> {
  return (await request("/org/users")).json();
}

export async function addMember(projectId: string, userId: string): Promise<void> {
  await request(`/projects/${projectId}/members`, jsonInit("POST", { userId }));
}

/** Owner only. Deletes the project and all its photos for every member. */
export async function deleteProject(id: string): Promise<void> {
  await request(`/projects/${id}`, { method: "DELETE" });
}

/** Owner only. */
export async function removeMember(projectId: string, userId: string): Promise<void> {
  await request(`/projects/${projectId}/members/${userId}`, { method: "DELETE" });
}
