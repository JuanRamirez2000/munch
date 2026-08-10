// Anonymous identity lives entirely in localStorage — a host_token proves session ownership,
// a participant_token proves roster membership. Losing localStorage (new device/browser) means
// losing that identity; there's no account to recover it from, by design (v1 has no auth).
const hostTokenKey = (shortCode: string) => `munch:${shortCode}:hostToken`;
const participantTokenKey = (shortCode: string) => `munch:${shortCode}:participantToken`;

export function getHostToken(shortCode: string): string | null {
  return localStorage.getItem(hostTokenKey(shortCode));
}

export function setHostToken(shortCode: string, token: string): void {
  localStorage.setItem(hostTokenKey(shortCode), token);
}

export function getParticipantToken(shortCode: string): string | null {
  return localStorage.getItem(participantTokenKey(shortCode));
}

export function setParticipantToken(shortCode: string, token: string): void {
  localStorage.setItem(participantTokenKey(shortCode), token);
}

export function clearParticipantToken(shortCode: string): void {
  localStorage.removeItem(participantTokenKey(shortCode));
}
