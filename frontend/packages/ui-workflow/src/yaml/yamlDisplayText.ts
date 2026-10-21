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

/** Mask quoted scalar interiors so structural ``\\n`` probes ignore escape-like content inside quotes. */
function maskQuotedScalars(text: string): string {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"' || ch === "'") {
      const quote = ch;
      out.push(quote);
      i++;
      while (i < text.length) {
        if (text[i] === '\\' && i + 1 < text.length) {
          out.push(' ', ' ');
          i += 2;
          continue;
        }
        if (text[i] === quote) {
          out.push(quote);
          i++;
          break;
        }
        out.push(' ');
        i++;
      }
      continue;
    }
    out.push(ch);
    i++;
  }
  return out.join('');
}

/** True when YAML arrived as one line with transport ``\\n`` tokens (portal-next shape). */
export function isTransportFlattenedYaml(text: string): boolean {
  const n = normalizeLineEndings(text);
  if (!n.trim() || n.includes('\n')) return false;
  if (!n.includes('\\n')) return false;
  if (/^--- \\n/.test(n) || /^---\\n/.test(n)) return true;
  const unquoted = maskQuotedScalars(n);
  if (/\\n\s+(- name:|ansible\.|debug:|vars:|loop:|register:)/.test(unquoted)) return true;
  const decoded = decodeEscapedProposalText(n);
  if (!decoded.includes('\n')) return false;
  const decodedUnquoted = maskQuotedScalars(decoded);
  return (
    /\n\s+- name:/.test(decodedUnquoted) || /^\s*---\s*$/m.test(decodedUnquoted)
  );
}

/** Decode transport-flattened YAML for display; leave other shapes unchanged. */
export function normalizeTransportFlattenedYaml(text: string): string {
  if (!isTransportFlattenedYaml(text)) return text;
  return decodeEscapedProposalText(normalizeLineEndings(text));
}
