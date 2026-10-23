"""Helpers for selecting and normalizing SCM credentials."""

from __future__ import annotations


def usable_scm_token(token: str | None) -> str | None:
    """Treat whitespace-only SCM credentials as absent.

    Args:
        token: SCM token provided by a project or caller.

    Returns:
        The original token when it contains a non-whitespace character,
        otherwise ``None``.
    """
    return token if token is not None and token.strip() else None


def select_usable_scm_token(*tokens: str | None) -> str | None:
    """Return the first nonblank SCM token from prioritized candidates.

    Args:
        *tokens: SCM tokens in precedence order.

    Returns:
        The first token containing a non-whitespace character, or ``None``.
    """
    return next((usable for token in tokens if (usable := usable_scm_token(token))), None)
