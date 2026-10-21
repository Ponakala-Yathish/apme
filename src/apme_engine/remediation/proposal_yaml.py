"""Normalize proposal YAML text emitted to clients (before_text / after_text)."""

from __future__ import annotations


def _escaped_token_end(text: str, start: int) -> int | None:
    cursor = start
    while cursor < len(text) and text[cursor] == "\\":
        cursor += 1
    if cursor == start:
        return None
    if cursor >= len(text):
        return None
    if text[cursor] in ("n", "t"):
        return cursor + 1
    if text[cursor] != "r":
        return None
    cursor += 1
    newline_slash_start = cursor
    while cursor < len(text) and text[cursor] == "\\":
        cursor += 1
    if cursor > newline_slash_start and cursor < len(text) and text[cursor] == "n":
        return cursor + 1
    return None


def decode_escaped_proposal_text(text: str) -> str:
    r"""Decode transport-style ``\n`` / ``\t`` / ``\r\n`` runs in proposal YAML.

    Mirrors ``decodeEscapedProposalText`` in ``@apme/ui-workflow`` DiffView so
    engine output matches what the UI would recover for ``before_text``.

    Args:
        text: Proposal YAML that may contain transport-style escapes.

    Returns:
        Text with recognized escape runs replaced by real characters.
    """
    if not text:
        return text
    out: list[str] = []
    cursor = 0
    length = len(text)
    while cursor < length:
        if text[cursor] != "\\":
            out.append(text[cursor])
            cursor += 1
            continue
        end = _escaped_token_end(text, cursor)
        if end is None:
            run_end = cursor + 1
            while run_end < length and text[run_end] == "\\":
                run_end += 1
            out.append(text[cursor:run_end])
            cursor = run_end
            continue
        if text[end - 1] == "t":
            out.append("\t")
        else:
            out.append("\n")
        cursor = end
    return "".join(out)


def normalize_proposal_yaml(text: str) -> str:
    """Return proposal YAML with real line breaks instead of literal escape sequences.

    Args:
        text: Proposal YAML text, possibly CRLF or transport-escaped.

    Returns:
        Text with LF line endings and decoded escape sequences when flattened.
    """
    if not text:
        return text
    normalized = text.replace("\r\n", "\n")
    if "\n" in normalized.rstrip("\n") or "\\n" not in normalized:
        return normalized
    return decode_escaped_proposal_text(normalized)
