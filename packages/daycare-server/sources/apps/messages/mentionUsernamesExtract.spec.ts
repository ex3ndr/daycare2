import { describe, expect, it } from "vitest";
import { mentionUsernamesExtract } from "./mentionUsernamesExtract.js";

describe("mentionUsernamesExtract", () => {
  it("extracts unique usernames", () => {
    const result = mentionUsernamesExtract("hello @alice @bob @alice");
    expect(result.sort()).toEqual(["alice", "bob"]);
  });

  it("ignores invalid mentions", () => {
    const result = mentionUsernamesExtract("no mentions here @@ @");
    expect(result).toEqual([]);
  });

  it("accepts underscore dot and dash", () => {
    const result = mentionUsernamesExtract("@alice_dev @user.name @user-name");
    expect(result.sort()).toEqual(["alice_dev", "user-name", "user.name"]);
  });
});
