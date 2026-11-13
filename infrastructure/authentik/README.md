# Identity integration boundary

Authentik integration is reserved for a later phase. There is deliberately no identity container,
login stub, shared password, or simulated session in Phase 2.1. The current local application only
exposes bootstrap health and display preferences. Do not expose it publicly.

Future integration must define OIDC authorization code + PKCE, server-side session validation,
RBAC, CSRF protection, secure cookies, and audit requirements before privileged routes exist.
