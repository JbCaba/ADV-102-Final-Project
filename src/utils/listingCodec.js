const PREFIX = 'SP:v1:';

/**
 * Pack listing into the Firestore `text` field (single string).
 * `pieces` = how many copies the seller has for sale.
 */
export function serializeListing(title, price, description, imageUri = '', pieces = 1) {
  const payload = {
    t: title.trim(),
    p: String(price).trim(),
    d: description.trim(),
    q: Math.max(1, Number(pieces) || 1),
  };
  const uri = String(imageUri ?? '').trim();
  if (uri) payload.u = uri;
  return PREFIX + JSON.stringify(payload);
}

/**
 * @returns {{ legacy: true, raw: string } | { legacy: false, title, price, description, imageUri, pieces }}
 */
export function parseListing(text) {
  if (typeof text !== 'string') return { legacy: true, raw: '' };
  if (!text.startsWith(PREFIX)) return { legacy: true, raw: text };
  try {
    const data = JSON.parse(text.slice(PREFIX.length));
    return {
      legacy: false,
      title: String(data.t ?? ''),
      price: String(data.p ?? ''),
      description: String(data.d ?? ''),
      imageUri: String(data.u ?? ''),
      pieces: Math.max(1, Number(data.q) || 1),
    };
  } catch {
    return { legacy: true, raw: text };
  }
}
