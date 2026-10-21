"""Normalize proposal YAML text emitted to clients (before_text / after_text)."""

from __future__ import annotations

import re


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


def _mask_quoted_scalars(text: str) -> str:
    out: list[str] = []
    index = 0
    while index < len(text):
        char = text[index]
        if char not in ('"', "'"):
            out.append(char)
            index += 1
            continue
        quote = char
        out.append(quote)
        index += 1
        while index < len(text):
            if text[index] == "\\" and index + 1 < len(text):
                out.extend((" ", " "))
                index += 2
                continue
            if text[index] == quote:
                out.append(quote)
                index += 1
                break
            out.append(" ")
            index += 1
    return "".join(out)


def _is_transport_flattened_yaml(text: str) -> bool:
    candidate = text.rstrip("\n")
    if not candidate.strip() or "\n" in candidate or "\\n" not in candidate:
        return False
    if re.match(r"^--- \\n", candidate) or re.match(r"^---\\n", candidate):
        return True
    unquoted = _mask_quoted_scalars(candidate)
    if re.search(r"\\n\s+(- name:|ansible\.|debug:|vars:|loop:|register:)", unquoted):
        return True
    decoded = decode_escaped_proposal_text(candidate)
    if "\n" not in decoded:
        return False
    decoded_unquoted = _mask_quoted_scalars(decoded)
    return bool(
        re.search(r"\n\s+- name:", decoded_unquoted) or re.search(r"^\s*---\s*$", decoded_unquoted, re.MULTILINE)
    )


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
    if not _is_transport_flattened_yaml(normalized):
        return normalized
    return decode_escaped_proposal_text(normalized)
