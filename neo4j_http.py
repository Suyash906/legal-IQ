"""
Lightweight Neo4j HTTP Query API v2 client.

Used as a drop-in alternative to the neo4j Bolt driver when port 7687 is
firewalled.  Talks to the HTTPS endpoint on port 443 that Neo4j Aura exposes.

Usage:
    from neo4j_http import HttpSession

    with HttpSession(uri, user, password) as session:
        records = session.run("MATCH (n) RETURN n.name AS name LIMIT 5")
        for r in records:
            print(r["name"])
"""

import json
import ssl
import urllib.request
import urllib.error
from typing import Any


class HttpSession:
    """
    Wraps the Neo4j HTTP Query API v2 in a session-like interface.

    Each call to .run() is a single auto-committed transaction (equivalent to
    session.run() in the Bolt driver).  For this ingestion use-case that is
    sufficient because every statement is a MERGE (idempotent).
    """

    def __init__(self, uri: str, user: str, password: str, database: str = "neo4j"):
        # Accept both bolt+s:// and https:// style URIs; normalise to https://
        host = uri.replace("neo4j+s://", "").replace("bolt+s://", "").replace("https://", "").rstrip("/")
        self._url = f"https://{host}/db/{database}/query/v2"
        self._headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": "Basic " + _b64(f"{user}:{password}"),
        }
        self._ctx = ssl.create_default_context()
        self._ctx.check_hostname = False
        self._ctx.verify_mode = ssl.CERT_NONE

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #

    def run(self, statement: str, parameters: dict | None = None, **kwargs) -> list[dict]:
        """Execute a Cypher statement and return a list of record dicts.

        Parameters can be passed as a dict or as keyword arguments (matching
        the neo4j Bolt driver's session.run() interface).
        """
        params = {}
        if parameters:
            params.update(parameters)
        if kwargs:
            params.update(kwargs)

        payload = json.dumps({
            "statement": statement,
            "parameters": params,
        }).encode()

        req = urllib.request.Request(
            self._url,
            data=payload,
            headers=self._headers,
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, context=self._ctx, timeout=30) as resp:
                body = json.loads(resp.read())
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode(errors="replace")[:500]
            raise RuntimeError(f"Neo4j HTTP {exc.code}: {detail}") from exc

        return _to_records(body)

    # ------------------------------------------------------------------ #
    # Context manager support
    # ------------------------------------------------------------------ #

    def __enter__(self):
        return self

    def __exit__(self, *_):
        pass  # no persistent connection to close


# ------------------------------------------------------------------ #
# Helpers
# ------------------------------------------------------------------ #

def _b64(s: str) -> str:
    import base64
    return base64.b64encode(s.encode()).decode()


def _to_records(body: dict) -> list[dict]:
    """Convert the HTTP API response into a list of {field: value} dicts."""
    data = body.get("data", {})
    fields = data.get("fields", [])
    values = data.get("values", [])
    return [dict(zip(fields, row)) for row in values]


def get_session(uri: str, user: str, password: str) -> "HttpSession":
    """Convenience factory — mirrors GraphDatabase.driver().session() pattern."""
    return HttpSession(uri, user, password)
