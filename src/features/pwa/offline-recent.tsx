"use client";

import { useEffect, useState } from "react";

import { ShhhSurface } from "@/components/shhh";
import { readLocalLockFlag, readOfflineConversation } from "@/lib/privacy/local-lock";
import { hydrateLocalThread } from "@/lib/sync/engine";

type OfflineRow = {
  id: string;
  text: string;
};

export function OfflineRecent() {
  const [locked] = useState(() => typeof window !== "undefined" && readLocalLockFlag());
  const [rows, setRows] = useState<OfflineRow[] | null>(null);

  useEffect(() => {
    if (locked) return;
    const conversationId = readOfflineConversation();
    if (!conversationId) {
      /* eslint-disable react-hooks/set-state-in-effect -- Dexie miss is empty, not a render loop */
      setRows([]);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    void hydrateLocalThread(conversationId)
      .then((thread) => {
        const next = thread.messages
          .filter((message) => !message.deletedAt && message.textContent.trim())
          .slice(-12)
          .map((message) => ({
            id: message.id,
            text: message.textContent.trim().slice(0, 140),
          }));
        setRows(next);
      })
      .catch(() => setRows([]));
  }, [locked]);

  if (locked) {
    return (
      <p className="mt-6 text-center text-sm text-secondary-text">
        Shhh is locked. Connect to unlock.
      </p>
    );
  }

  if (!rows || rows.length === 0) {
    return null;
  }

  return (
    <ShhhSurface
      tone="raised"
      round="lg"
      elevation="soft"
      padding="md"
      className="mt-8 w-full text-left"
      data-testid="offline-recent"
    >
      <p className="text-sm font-semibold text-primary-text">Recent on this device</p>
      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li
            key={row.id}
            className="truncate text-sm text-secondary-text"
            dir="auto"
          >
            {row.text}
          </li>
        ))}
      </ul>
    </ShhhSurface>
  );
}
