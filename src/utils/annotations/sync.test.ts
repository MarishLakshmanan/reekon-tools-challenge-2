import { planSync } from "./sync";
import { doc } from "./testFixtures";
import type { AnnotationDoc } from "./types";

function local(id: string, serverVersion: number | null, unsaved: boolean): AnnotationDoc {
  return { ...doc([]), id, serverVersion, updatedAt: 10, savedAt: unsaved ? 5 : 10 };
}

describe("planSync", () => {
  it("downloads documents that are only on the server", () => {
    expect(planSync([], [{ id: "a", version: 1 }])).toEqual([{ type: "download", id: "a" }]);
  });

  it("pulls when the server is ahead and there are no local edits", () => {
    expect(planSync([local("a", 1, false)], [{ id: "a", version: 2 }])).toEqual([{ type: "pull", id: "a" }]);
  });

  it("flags a conflict when the server is ahead and there are local edits", () => {
    expect(planSync([local("a", 1, true)], [{ id: "a", version: 2 }])).toEqual([{ type: "conflict", id: "a" }]);
  });

  it("does nothing when versions match, with or without local edits", () => {
    const remote = [{ id: "a", version: 2 }, { id: "b", version: 3 }];
    expect(planSync([local("a", 2, false), local("b", 3, true)], remote)).toEqual([]);
  });

  it("deletes locally when a synced document is gone from the server", () => {
    expect(planSync([local("a", 1, false)], [])).toEqual([{ type: "deleteLocal", id: "a" }]);
  });

  it("keeps a synced document gone from the server if it has local edits", () => {
    expect(planSync([local("a", 1, true)], [])).toEqual([]);
  });

  it("keeps documents that were never uploaded", () => {
    expect(planSync([local("a", null, true)], [])).toEqual([]);
  });

  it("leaves a lost first upload for the next Save to finish", () => {
    expect(planSync([local("a", null, true)], [{ id: "a", version: 1 }])).toEqual([]);
  });
});
