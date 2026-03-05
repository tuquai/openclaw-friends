function slugifyAscii(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "") || "character"
  );
}

export function buildDiscordAccountId(name: string, id: string) {
  const base = slugifyAscii(name);
  const suffix = id.slice(0, 8).toLowerCase();
  return `${base}-${suffix}`.slice(0, 48);
}

export function normalizeDiscordBotToken(raw: string) {
  return raw.trim().replace(/^Bot\s+/i, "");
}

export function decodeDiscordBotIdFromToken(raw: string) {
  const token = normalizeDiscordBotToken(raw);
  const firstSegment = token.split(".")[0];
  if (!firstSegment) {
    return "";
  }

  try {
    return Buffer.from(firstSegment, "base64url").toString("utf8").trim();
  } catch {
    return "";
  }
}
