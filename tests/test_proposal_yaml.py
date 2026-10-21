"""Tests for proposal YAML normalization."""

from apme_engine.remediation.abbenay_provider import _parse_node_response
from apme_engine.remediation.proposal_yaml import (
    decode_escaped_proposal_text,
    normalize_proposal_yaml,
)


def test_decode_literal_backslash_n_to_newline() -> None:
    """Decode literal backslash-n runs into real newlines."""
    flat = "--- \\n- name: task\\n  ansible.builtin.debug:\\n    msg: hi\\n"
    decoded = decode_escaped_proposal_text(flat)
    assert "\\n" not in decoded
    assert decoded.startswith("--- \n- name:")


def test_normalize_proposal_yaml_portal_next_shape() -> None:
    r"""Fixture matching portal-next DOM (single line with ``\n`` tokens)."""
    escaped = "--- \\n- name: Find all roles\\n  ansible.builtin.find:\\n    paths: /etc\\n"
    out = normalize_proposal_yaml(escaped)
    lines = out.split("\n")
    assert lines[0] == "--- "
    assert "- name: Find all roles" in lines[1]
    assert "ansible.builtin.find:" in out


def test_normalize_preserves_real_multiline() -> None:
    """Leave already-multiline YAML unchanged."""
    source = "---\n- name: ok\n  debug:\n    msg: x\n"
    assert normalize_proposal_yaml(source) == source


def test_normalize_preserves_quoted_escape_and_structure_markers() -> None:
    """Preserve escape-like structural text inside quoted YAML scalars."""
    for source in ('msg: "a\\nb"', 'msg: "a\\n  - name: b"'):
        assert normalize_proposal_yaml(source) == source


def test_normalize_crlf() -> None:
    """Normalize CRLF line endings to LF."""
    assert normalize_proposal_yaml("a\r\nb") == "a\nb"


def test_decode_tab_escape() -> None:
    """Decode transport tab escapes."""
    assert decode_escaped_proposal_text("key:\\tvalue") == "key:\tvalue"


def test_backslash_without_escape_letter_preserved() -> None:
    """Preserve backslash runs that are not recognized escapes."""
    assert decode_escaped_proposal_text("win\\\\share") == "win\\\\share"


def test_parse_node_response_parses_fixed_snippet() -> None:
    """Parse fixed_snippet from an AI node response."""
    original = "- name: old\n  debug:\n    msg: x\n"
    response = (
        '{"fixed_snippet": "- name: new\\n  debug:\\n    msg: y\\n", '
        '"changes": [{"rule_id": "L013", "explanation": "fix"}]}'
    )
    fix = _parse_node_response(response, original)
    assert fix is not None
    assert fix.fixed_snippet == "- name: new\n  debug:\n    msg: y\n"
