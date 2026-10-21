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


def _quote_starts_scalar(text: str, index: int) -> bool:
    line_start = text.rfind("\n", 0, index) + 1
    escaped_line_break = text.rfind("\\n", 0, index)
    if escaped_line_break >= 0 and escaped_line_break + 2 > line_start:
        line_start = escaped_line_break + 2
    prefix = text[line_start:index]
    trimmed = prefix.rstrip(" \t")
    if not trimmed or trimmed in ("---", "-"):
        return True
    if trimmed.endswith(("[", "{", ",")):
        return True
    colon = prefix.find(":")
    return colon >= 0 and not prefix[colon + 1 :].strip()


def _mask_quoted_scalars(text: str) -> str:
    out: list[str] = []
    index = 0
    while index < len(text):
        char = text[index]
        if char not in ('"', "'") or not _quote_starts_scalar(text, index):
            out.append(char)
            index += 1
            continue
        quote = char
        out.append(quote)
        index += 1
        while index < len(text):
            if char == "'" and text[index : index + 2] == "''":
                out.extend((" ", " "))
                index += 2
                continue
            if quote == '"' and text[index] == "\\" and index + 1 < len(text):
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


def _decode_flattened_yaml(text: str) -> str:
    out: list[str] = []
    quote: str | None = None
    index = 0
    while index < len(text):
        char = text[index]
        if quote is not None:
            if quote == "'" and text[index : index + 2] == "''":
                out.extend(("'", "'"))
                index += 2
                continue
            if quote == '"' and char == "\\" and index + 1 < len(text):
                out.extend((char, text[index + 1]))
                index += 2
                continue
            if char == quote:
                quote = None
            out.append(char)
            index += 1
            continue
        if char in ('"', "'") and _quote_starts_scalar(text, index):
            quote = char
            out.append(char)
            index += 1
            continue
        if char == "\\":
            end = _escaped_token_end(text, index)
            if end is not None:
                out.append("\t" if text[end - 1] == "t" else "\n")
                index = end
                continue
            run_end = index + 1
            while run_end < len(text) and text[run_end] == "\\":
                run_end += 1
            out.append(text[index:run_end])
            index = run_end
            continue
        out.append(char)
        index += 1
    return "".join(out)


def _is_transport_flattened_yaml(text: str) -> bool:
    candidate = text.rstrip("\n")
    if not candidate.strip() or "\n" in candidate or "\\n" not in candidate:
        return False
    if re.match(r"^--- \\n", candidate) or re.match(r"^---\\n", candidate):
        return True
    unquoted = _mask_quoted_scalars(candidate)
    if re.search(
        r"\\n\s+(?:-\s+)?(?:name:|ansible\.|debug:|vars:|loop:|register:)",
        unquoted,
    ):
        return True
    decoded = _decode_flattened_yaml(candidate)
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
    return _decode_flattened_yaml(normalized)
