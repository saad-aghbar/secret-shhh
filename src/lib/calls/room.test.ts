import { describe, expect, it } from "vitest";

import { callRoomName, isCallRoomName } from "@/lib/calls/room";

describe("call rooms", () => {
  it("names rooms from the server call id", () => {
    const room = callRoomName("2f1c0b3a-1111-2222-3333-444444444444");
    expect(room).toBe("shhh-call-2f1c0b3a-1111-2222-3333-444444444444");
    expect(isCallRoomName(room)).toBe(true);
    expect(isCallRoomName("arbitrary-room")).toBe(false);
  });
});
