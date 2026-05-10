export function parseUserPayload(raw) {
  const user = JSON.parse(raw);
  return user.profile.name.toUpperCase();
}

export function buildRedirect(next) {
  return "https://example.com/login?next=" + next;
}

export function delay(ms) {
  const start = Date.now();
  while (Date.now() - start < ms) {}
}
