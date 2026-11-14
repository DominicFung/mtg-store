import { randomBytes } from 'node:crypto';
import type { AppSyncResolverEvent } from 'aws-lambda';
import { assertAdmin } from '../../orders/auth';
import { printSettingsItemFromProfile } from '../../orders/logic';
import { putPrintSettings, putProfile, scanProfiles } from '../../orders/store';
import {
  assertCanDeactivate,
  parseProfileInput,
  profileView,
  publicProfiles,
  toNozzleProfile,
} from '../../nozzleProfiles/logic';

type Args = { input?: unknown; id?: string };

function newId(): string {
  return `nozzle-${randomBytes(4).toString('hex')}`;
}

export const handler = async (event: AppSyncResolverEvent<Args>) => {
  const field = event.info?.fieldName;
  if (field === 'listActiveNozzleProfiles') return publicProfiles(await scanProfiles());

  assertAdmin(event.identity);
  const profiles = await scanProfiles();
  if (field === 'listNozzleProfiles') return profiles.map(profileView);
  if (field === 'deactivateNozzleProfile') {
    const profile = profiles.find((entry) => entry.id === event.arguments?.id);
    if (!profile) throw new Error('Profile not found');
    assertCanDeactivate(profile);
    const next = { ...profile, active: false, isDefault: false };
    await putProfile(next);
    return profileView(next);
  }
  if (field === 'upsertNozzleProfile') {
    const input = parseProfileInput(event.arguments?.input);
    const id = input.id ?? newId();
    const profile = toNozzleProfile(input, id);
    if (profile.isDefault) {
      await Promise.all(profiles.filter((entry) => entry.id !== id && entry.isDefault).map((entry) => (
        putProfile({ ...entry, isDefault: false })
      )));
    }
    await putProfile(profile);
    if (profile.isDefault) await putPrintSettings(printSettingsItemFromProfile(profile));
    return profileView(profile);
  }
  throw new Error(`Unsupported profile field ${field ?? ''}`);
};
