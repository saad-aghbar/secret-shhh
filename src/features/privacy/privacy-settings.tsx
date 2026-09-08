"use client";

import { Lock } from "lucide-react";

import { ShhhButton, ShhhCard } from "@/components/shhh";
import { usePrivacy } from "@/features/privacy/privacy-provider";
import { PrivacySwitch } from "@/features/privacy/privacy-switch";

export function PrivacySettings() {
  const { settings, updateSettings, lockNow } = usePrivacy();

  return (
    <div className="flex flex-col gap-6" data-testid="privacy-page">
      <ShhhCard title="Privacy" description="Keep Shhh quiet on this device.">
        <div className="space-y-3">
          <PrivacySwitch
            label="Enable Discreet Mode"
            description="No previews, no badge, and a cover when you leave."
            checked={settings.discreetMode}
            testId="discreet-mode"
            onCheckedChange={(discreetMode) => void updateSettings({ discreetMode })}
          />
          <PrivacySwitch
            label="Lock when I leave Shhh"
            description="Ask for your password after a short pause away."
            checked={settings.lockOnLeave}
            testId="lock-on-leave"
            onCheckedChange={(lockOnLeave) => void updateSettings({ lockOnLeave })}
          />
          <PrivacySwitch
            label="Blur content when hidden"
            description="Cover the screen the moment Shhh leaves the front."
            checked={settings.blurWhenHidden}
            testId="blur-when-hidden"
            onCheckedChange={(blurWhenHidden) => void updateSettings({ blurWhenHidden })}
          />
          <PrivacySwitch
            label="Show app badge"
            description="Off by default. Shhh never shows an unread count today."
            checked={settings.showAppBadge}
            disabled={settings.discreetMode}
            testId="show-app-badge"
            onCheckedChange={(showAppBadge) => void updateSettings({ showAppBadge })}
          />
        </div>
      </ShhhCard>
      <ShhhCard>
        <ShhhButton
          type="button"
          variant="secondary"
          fullWidth
          size="lg"
          data-testid="quick-lock"
          aria-label="Lock Shhh"
          onClick={() => void lockNow()}
        >
          <Lock className="size-4" aria-hidden />
          Lock Shhh
        </ShhhButton>
      </ShhhCard>
    </div>
  );
}
