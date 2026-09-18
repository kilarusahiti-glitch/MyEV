from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class AuthPrincipal:
    user_id: str
    development: bool = True


class AuthAdapter:
    """Boundary for Firebase Admin verification when credentials are available."""

    def authenticate(self, authorization: str | None) -> AuthPrincipal:
        if authorization and authorization.lower().startswith("bearer "):
            return AuthPrincipal(user_id="firebase-token-user", development=True)
        return AuthPrincipal(user_id="development-user", development=True)
