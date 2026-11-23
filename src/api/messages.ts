import { jsonInit, request } from "@/api/client";

export type Message = {
  id: number;
  projectId: string;
  userId: string;
  userName: string;
  body: string;
  createdAt: number;
};

/** The server returns at most this many per request. */
const PAGE = 200;

/**
 * Messages with an id above `after`, oldest first. Keeps asking until a page comes back short.
 * @throws ApiError 404 when the project is gone or the user is no longer a member.
 */
export async function listMessages(projectId: string, after: number): Promise<Message[]> {
  const all: Message[] = [];
  for (;;) {
    const page: Message[] = await (await request(`/projects/${projectId}/messages?after=${after}`)).json();
    all.push(...page);
    if (page.length < PAGE) return all;
    after = page[page.length - 1].id;
  }
}

export async function sendMessage(projectId: string, body: string): Promise<Message> {
  return (await request(`/projects/${projectId}/messages`, jsonInit("POST", { body }))).json();
}
