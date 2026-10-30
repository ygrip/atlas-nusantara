/** Limited inline markup for localized editorial content. Never inject HTML. */
/**
 * Split plain text, **strong**, `code` and [link](href) tokens. Only site-local paths and
 * https URLs become links; anything else stays visible as plain text.
 * @param {string} text
 * @returns {Array<{kind:'text',value:string}|{kind:'code',value:string}|{kind:'strong',value:string}|{kind:'link',value:string,href:string,external:boolean}>}
 */
export function inlineTokens(text) {
  /** @type {Array<any>} */
  const tokens = [];
  const pattern = /`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) tokens.push({ kind: 'text', value: text.slice(cursor, start) });
    if (match[1] !== undefined) tokens.push({ kind: 'code', value: match[1] });
    else if (match[4] !== undefined) tokens.push({ kind: 'strong', value: match[4] });
    else tokens.push(linkToken(match[2], match[3], match[0]));
    cursor = start + match[0].length;
  }
  if (cursor < text.length) tokens.push({ kind: 'text', value: text.slice(cursor) });
  return tokens;
}

/** @param {string} label @param {string} href @param {string} raw */
function linkToken(label, href, raw) {
  const local = href.startsWith('/') && !href.startsWith('//');
  const external = href.startsWith('https://');
  if (!local && !external) return { kind: 'text', value: raw };
  return { kind: 'link', value: label, href, external };
}
