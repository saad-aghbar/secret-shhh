"use client";

import { useSyncExternalStore } from "react";

import { connectionManager, type ConnectionState } from "@/lib/connection/manager";

function subscribe(onStoreChange: () => void) {
  return connectionManager.subscribe(() => onStoreChange());
}

function getSnapshot(): ConnectionState {
  return connectionManager.getState();
}

function getServerSnapshot(): ConnectionState {
  return "online";
}

export function useConnectionState() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
