/** Display-time YAML text helpers (mirrors apme_engine.remediation.proposal_yaml). */

function escapedTokenEnd(text: string, start: number): number | undefined {
  let cursor = start;
  while (text[cursor] === '\\') cursor++;
  if (cursor === start) return undefined;
  if (text[cursor] === 'n' || text[cursor] === 't') return cursor + 1;
  if (text[cursor] !== 'r') return undefined;

  cursor++;
  const newlineSlashStart = cursor;
  while (text[cursor] === '\\') cursor++;
  return cursor > newlineSlashStart && text[cursor] === 'n' ? cursor + 1 : undefined;
}

/** Decode transport-style ``\\n`` / ``\\t`` / ``\\r\\n`` runs in proposal YAML. */
export function decodeEscapedProposalText(text: string): string {
  let out = '';
  for (let cursor = 0; cursor < text.length; ) {
    const end = text[cursor] === '\\' ? escapedTokenEnd(text, cursor) : undefined;
    if (end === undefined) {
      if (text[cursor] === '\\') {
        let runEnd = cursor + 1;
        while (text[runEnd] === '\\') runEnd++;
        out += text.slice(cursor, runEnd);
        cursor = runEnd;
      } else {
        out += text[cursor]!;
        cursor++;
      }
      continue;
    }
    out += text[end - 1] === 't' ? '\t' : '\n';
    cursor = end;
  }
  return out;
}

export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

/** True when YAML arrived as one line with transport ``\\n`` tokens (portal-next shape). */
export function isTransportFlattenedYaml(text: string): boolean {
  const n = normalizeLineEndings(text);
  if (!n.trim() || n.includes('\n')) return false;
  if (!n.includes('\\n')) return false;
  if (/^--- \\n/.test(n) || /^---\\n/.test(n)) return true;
  if (/\\n\s+(- name:|ansible\.|debug:|vars:|loop:|register:)/.test(n)) return true;
  const decoded = decodeEscapedProposalText(n);
  if (!decoded.includes('\n')) return false;
  return /\n\s+- name:/.test(decoded) || /^\s*---\s*$/m.test(decoded);
}

/** Decode transport-flattened YAML for display; leave other shapes unchanged. */
export function normalizeTransportFlattenedYaml(text: string): string {
  if (!isTransportFlattenedYaml(text)) return text;
  return decodeEscapedProposalText(normalizeLineEndings(text));
}
