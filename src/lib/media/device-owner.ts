export type MediaDeviceOwner = "voice-recorder" | "camera" | "call";

type Listener = (owner: MediaDeviceOwner | null) => void;

const PRIORITY: Record<MediaDeviceOwner, number> = {
  "voice-recorder": 1,
  camera: 1,
  call: 2,
};

export class DeviceOwnerRegistry {
  private owner: MediaDeviceOwner | null = null;
  private listeners = new Set<Listener>();

  current() {
    return this.owner;
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  claim(who: MediaDeviceOwner): { ok: true } | { ok: false; owner: MediaDeviceOwner; message: string } {
    if (!this.owner || this.owner === who) {
      this.owner = who;
      this.emit();
      return { ok: true };
    }
    if (PRIORITY[who] > PRIORITY[this.owner]) {
      this.owner = who;
      this.emit();
      return { ok: true };
    }
    return {
      ok: false,
      owner: this.owner,
      message: this.messageFor(this.owner),
    };
  }

  release(who: MediaDeviceOwner) {
    if (this.owner === who) {
      this.owner = null;
      this.emit();
    }
  }

  private messageFor(owner: MediaDeviceOwner) {
    if (owner === "call") return "Finish the call first.";
    if (owner === "camera") return "The camera is already open.";
    return "A voice message is already recording.";
  }

  private emit() {
    for (const listener of this.listeners) listener(this.owner);
  }
}

export const deviceOwner = new DeviceOwnerRegistry();
