const ROOM_PREFIX = "shhh-call-";

export function callRoomName(callId: string): string {
  return `${ROOM_PREFIX}${callId}`;
}

export function isCallRoomName(roomName: string): boolean {
  return roomName.startsWith(ROOM_PREFIX) && roomName.length > ROOM_PREFIX.length + 8;
}
