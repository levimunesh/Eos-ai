"""Tenant isolation: org A's data must be invisible to org B through every path."""

import asyncpg
import pytest

from tests.conftest import Actor


@pytest.fixture
async def two_orgs(client, actor, new_org):
    a, b = actor("alice"), actor("bob")
    org_a = await new_org(a, name="Org A")
    org_b = await new_org(b, name="Org B")
    r = await client.post(
        "/api/v1/branches", json={"code": "A1", "name": "A main"}, headers=a.h(org_a["id"])
    )
    assert r.status_code == 201
    return {"a": a, "b": b, "org_a": org_a, "org_b": org_b, "branch_a": r.json()}


# ---- through the API --------------------------------------------------------


@pytest.mark.parametrize("path", ["/api/v1/org", "/api/v1/members", "/api/v1/branches"])
async def test_non_member_gets_404_for_other_org(client, two_orgs, path):
    b, org_a = two_orgs["b"], two_orgs["org_a"]
    r = await client.get(path, headers=b.h(org_a["id"]))
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"


async def test_me_lists_only_own_orgs(client, two_orgs):
    r = await client.get("/api/v1/me", headers=two_orgs["b"].h())
    names = [m["org_name"] for m in r.json()["memberships"]]
    assert names == ["Org B"]


async def test_cannot_update_other_orgs_branch_via_own_org(client, two_orgs):
    b, org_b, branch_a = two_orgs["b"], two_orgs["org_b"], two_orgs["branch_a"]
    r = await client.patch(
        f"/api/v1/branches/{branch_a['id']}", json={"name": "hacked"}, headers=b.h(org_b["id"])
    )
    assert r.status_code == 404


async def test_cannot_invite_into_other_org(client, two_orgs):
    b, org_a = two_orgs["b"], two_orgs["org_a"]
    r = await client.post(
        "/api/v1/invitations",
        json={"email": "x@example.com", "role": "owner"},
        headers=b.h(org_a["id"]),
    )
    assert r.status_code == 404


async def test_cannot_assign_other_orgs_branch_to_member(client, two_orgs, actor):
    b, org_b, branch_a = two_orgs["b"], two_orgs["org_b"], two_orgs["branch_a"]
    r = await client.post(
        "/api/v1/invitations",
        json={
            "email": "y@example.com",
            "role": "viewer",
            "all_branches": False,
            "branch_ids": [branch_a["id"]],
        },
        headers=b.h(org_b["id"]),
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "unknown_branch"


# ---- directly against Postgres as eos_app (RLS is the second wall) ------------


async def _set(conn: asyncpg.Connection, *, user=None, org=None) -> None:
    await conn.execute(
        "select set_config('app.user_id', $1, false), set_config('app.org_id', $2, false)",
        str(user or ""),
        str(org or ""),
    )


@pytest.mark.parametrize(
    "table", ["organisations", "branches", "memberships", "invitations", "audit_logs", "users"]
)
async def test_no_context_sees_nothing(app_conn, two_orgs, table):
    await _set(app_conn)
    assert await app_conn.fetchval(f"select count(*) from eos.{table}") == 0  # noqa: S608


async def test_rls_hides_other_org_even_without_where_clause(app_conn, two_orgs):
    await _set(app_conn, user=two_orgs["b"].id, org=two_orgs["org_b"]["id"])
    codes = await app_conn.fetch("select code from eos.branches")
    assert [r["code"] for r in codes] == []
    orgs = await app_conn.fetch("select name from eos.organisations")
    assert [r["name"] for r in orgs] == ["Org B"]


async def test_rls_blocks_cross_tenant_insert(app_conn, two_orgs):
    await _set(app_conn, user=two_orgs["b"].id, org=two_orgs["org_b"]["id"])
    with pytest.raises(asyncpg.InsufficientPrivilegeError):
        await app_conn.execute(
            "insert into eos.branches (org_id, code, name) values ($1, 'X', 'X')",
            two_orgs["org_a"]["id"],
        )


async def test_rls_blocks_cross_tenant_update(app_conn, two_orgs):
    await _set(app_conn, user=two_orgs["b"].id, org=two_orgs["org_b"]["id"])
    status = await app_conn.execute(
        "update eos.branches set name = 'hacked' where id = $1", two_orgs["branch_a"]["id"]
    )
    assert status == "UPDATE 0"


async def test_cannot_self_insert_membership_into_other_org(app_conn, two_orgs):
    b = two_orgs["b"]
    await _set(app_conn, user=b.id, org=two_orgs["org_b"]["id"])
    with pytest.raises(asyncpg.InsufficientPrivilegeError):
        await app_conn.execute(
            "insert into eos.memberships (org_id, user_id, role) values ($1, $2, 'owner')",
            two_orgs["org_a"]["id"],
            b.id,
        )


async def test_audit_log_is_append_only(app_conn, two_orgs):
    await _set(app_conn, user=two_orgs["a"].id, org=two_orgs["org_a"]["id"])
    assert await app_conn.fetchval("select count(*) from eos.audit_logs") >= 2
    with pytest.raises(asyncpg.InsufficientPrivilegeError):
        await app_conn.execute("update eos.audit_logs set action = 'x'")
    with pytest.raises(asyncpg.InsufficientPrivilegeError):
        await app_conn.execute("delete from eos.audit_logs")


async def test_app_role_cannot_bypass_rls(app_conn):
    row = await app_conn.fetchrow(
        "select rolbypassrls, rolsuper from pg_roles where rolname = current_user"
    )
    assert row["rolbypassrls"] is False and row["rolsuper"] is False


def test_actor_ids_are_unique():
    assert Actor("a@x.com").id != Actor("a@x.com").id
