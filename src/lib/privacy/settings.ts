export type PrivacySettings = {
  discreetMode: boolean;
  lockOnLeave: boolean;
  blurWhenHidden: boolean;
  showAppBadge: boolean;
};

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  discreetMode: true,
  lockOnLeave: true,
  blurWhenHidden: true,
  showAppBadge: false,
};

export function normalizePrivacySettings(
  input: Partial<PrivacySettings> | null | undefined,
): PrivacySettings {
  return {
    discreetMode: input?.discreetMode ?? DEFAULT_PRIVACY_SETTINGS.discreetMode,
    lockOnLeave: input?.lockOnLeave ?? DEFAULT_PRIVACY_SETTINGS.lockOnLeave,
    blurWhenHidden: input?.blurWhenHidden ?? DEFAULT_PRIVACY_SETTINGS.blurWhenHidden,
    showAppBadge: input?.showAppBadge ?? DEFAULT_PRIVACY_SETTINGS.showAppBadge,
  };
}
