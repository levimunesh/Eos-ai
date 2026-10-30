import pytest

from tests.conftest import make_token


async def test_health(client):
    assert (await client.get("/api/v1/health")).json() == {"status": "ok"}
    assert (await client.get("/api/v1/health/db")).json() == {"status": "ok"}


# ---- auth ---------------------------------------------------------------------


async def test_missing_token_is_401(client):
    r = await client.get("/api/v1/me")
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "unauthorized"


async def test_wrong_signature_is_401(client, actor):
    u = actor()
    bad = make_token(u.id, u.email, secret="another-secret-of-sufficient-length-xx")
    r = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {bad}"})
    assert r.status_code == 401


async def test_expired_token_is_401(client, actor):
    u = actor()
    old = make_token(u.id, u.email, exp_in=-120)
    r = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {old}"})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "token_expired"


async def test_anon_role_token_rejected(client, actor):
    u = actor()
    t = make_token(u.id, u.email, role="anon")
    r = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {t}"})
    assert r.status_code == 401


# ---- organisations ------------------------------------------------------------


async def test_create_org_makes_caller_owner(client, actor, new_org):
    u = actor()
    org = await new_org(u, name="Gulf Trading", base_currency="aed", timezone="Asia/Dubai")
    assert org["base_currency"] == "AED"
    assert org["currency_decimals"] == 2
    members = (await client.get("/api/v1/members", headers=u.h(org["id"]))).json()
    assert [(m["email"], m["role"]) for m in members] == [(u.email, "owner")]


async def test_three_decimal_currency(client, actor, new_org):
    org = await new_org(actor(), base_currency="KWD", timezone="Asia/Kuwait")
    assert org["currency_decimals"] == 3


@pytest.mark.parametrize(
    "override",
    [
        {"base_currency": "XYZ"},
        {"timezone": "Mars/Base"},
        {"tax_rate": "1.5"},
        {"fiscal_year_start_month": 13},
        {"date_format": "YY/MM/DD"},
    ],
)
async def test_org_validation(client, actor, override):
    body = {"name": "X Co", "base_currency": "OMR", "timezone": "Asia/Muscat", **override}
    r = await client.post("/api/v1/orgs", json=body, headers=actor().h())
    assert r.status_code == 422


async def test_owner_updates_settings_but_not_currency(client, actor, new_org):
    u = actor()
    org = await new_org(u)
    r = await client.patch(
        "/api/v1/org/settings",
        json={"tax_rate": "0.05", "prices_include_tax": True, "base_currency": "USD"},
        headers=u.h(org["id"]),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["tax_rate"] == "0.0500" and body["prices_include_tax"] is True
    assert body["base_currency"] == "OMR"


# ---- invitations and roles ----------------------------------------------------


@pytest.fixture
async def org_with_branches(client, actor, new_org):
    owner = actor("owner")
    org = await new_org(owner)
    branches = []
    for code in ("B1", "B2", "B3"):
        r = await client.post(
            "/api/v1/branches",
            json={"code": code, "name": f"Branch {code}"},
            headers=owner.h(org["id"]),
        )
        branches.append(r.json())
    return owner, org, branches


async def _invite_and_accept(client, owner, org, invitee, **body):
    r = await client.post(
        "/api/v1/invitations", json={"email": invitee.email, **body}, headers=owner.h(org["id"])
    )
    assert r.status_code == 201, r.text
    token = r.json()["token"]
    r = await client.post("/api/v1/invitations/accept", json={"token": token}, headers=invitee.h())
    assert r.status_code == 200, r.text
    return token


async def test_branch_scoped_viewer(client, actor, org_with_branches):
    owner, org, branches = org_with_branches
    viewer = actor("viewer")
    await _invite_and_accept(
        client,
        owner,
        org,
        viewer,
        role="viewer",
        all_branches=False,
        branch_ids=[branches[1]["id"]],
    )
    seen = (await client.get("/api/v1/branches", headers=viewer.h(org["id"]))).json()
    assert [b["code"] for b in seen] == ["B2"]

    # Viewers cannot change structure or invite.
    r = await client.post(
        "/api/v1/branches", json={"code": "B9", "name": "x"}, headers=viewer.h(org["id"])
    )
    assert r.status_code == 403
    r = await client.post(
        "/api/v1/invitations",
        json={"email": "z@example.com", "role": "viewer"},
        headers=viewer.h(org["id"]),
    )
    assert r.status_code == 403
    r = await client.patch(
        f"/api/v1/branches/{branches[0]['id']}", json={"name": "x"}, headers=viewer.h(org["id"])
    )
    assert r.status_code == 403


async def test_manager_cannot_manage_members(client, actor, org_with_branches):
    owner, org, _ = org_with_branches
    manager = actor("manager")
    await _invite_and_accept(client, owner, org, manager, role="manager")
    members = (await client.get("/api/v1/members", headers=manager.h(org["id"]))).json()
    owner_mid = next(m["membership_id"] for m in members if m["role"] == "owner")
    r = await client.delete(f"/api/v1/members/{owner_mid}", headers=manager.h(org["id"]))
    assert r.status_code == 403


async def test_invitation_token_single_use_and_email_bound(client, actor, org_with_branches):
    owner, org, _ = org_with_branches
    invitee, stranger = actor("inv"), actor("stranger")
    r = await client.post(
        "/api/v1/invitations",
        json={"email": invitee.email, "role": "viewer"},
        headers=owner.h(org["id"]),
    )
    token = r.json()["token"]

    r = await client.post("/api/v1/invitations/accept", json={"token": token}, headers=stranger.h())
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "email_mismatch"

    r = await client.post("/api/v1/invitations/accept", json={"token": token}, headers=invitee.h())
    assert r.status_code == 200 and r.json()["org_id"] == org["id"]

    r = await client.post("/api/v1/invitations/accept", json={"token": token}, headers=invitee.h())
    assert r.status_code == 404


async def test_revoked_invitation_cannot_be_accepted(client, actor, org_with_branches):
    owner, org, _ = org_with_branches
    invitee = actor()
    r = await client.post(
        "/api/v1/invitations",
        json={"email": invitee.email, "role": "viewer"},
        headers=owner.h(org["id"]),
    )
    inv = r.json()
    assert (
        await client.delete(f"/api/v1/invitations/{inv['id']}", headers=owner.h(org["id"]))
    ).status_code == 204
    r = await client.post(
        "/api/v1/invitations/accept", json={"token": inv["token"]}, headers=invitee.h()
    )
    assert r.status_code == 404


async def test_token_is_not_stored_in_plain_text(client, actor, org_with_branches, app_conn):
    owner, org, _ = org_with_branches
    r = await client.post(
        "/api/v1/invitations",
        json={"email": "plain@example.com", "role": "viewer"},
        headers=owner.h(org["id"]),
    )
    token = r.json()["token"]
    listed = (await client.get("/api/v1/invitations", headers=owner.h(org["id"]))).json()
    assert all("token" not in i for i in listed)
    await app_conn.execute("select set_config('app.org_id', $1, false)", org["id"])
    stored = await app_conn.fetchval(
        "select token_hash from eos.invitations where email = 'plain@example.com'"
    )
    assert stored != token and len(stored) == 64


async def test_last_owner_is_protected(client, actor, new_org):
    owner = actor()
    org = await new_org(owner)
    mid = (await client.get("/api/v1/members", headers=owner.h(org["id"]))).json()[0][
        "membership_id"
    ]
    r = await client.patch(
        f"/api/v1/members/{mid}", json={"role": "viewer"}, headers=owner.h(org["id"])
    )
    assert r.status_code == 409 and r.json()["error"]["code"] == "last_owner"
    r = await client.delete(f"/api/v1/members/{mid}", headers=owner.h(org["id"]))
    assert r.status_code == 409


async def test_owner_rescopes_member_branches(client, actor, org_with_branches):
    owner, org, branches = org_with_branches
    mgr = actor("mgr")
    await _invite_and_accept(client, owner, org, mgr, role="manager")
    mid = next(
        m["membership_id"]
        for m in (await client.get("/api/v1/members", headers=owner.h(org["id"]))).json()
        if m["email"] == mgr.email
    )
    r = await client.patch(
        f"/api/v1/members/{mid}",
        json={"all_branches": False, "branch_ids": [branches[0]["id"], branches[2]["id"]]},
        headers=owner.h(org["id"]),
    )
    assert r.status_code == 200
    seen = (await client.get("/api/v1/branches", headers=mgr.h(org["id"]))).json()
    assert sorted(b["code"] for b in seen) == ["B1", "B3"]


async def test_duplicate_branch_code_conflict(client, org_with_branches):
    owner, org, _ = org_with_branches
    r = await client.post(
        "/api/v1/branches", json={"code": "B1", "name": "dup"}, headers=owner.h(org["id"])
    )
    assert r.status_code == 409


async def test_viewer_cannot_list_members(client, actor, org_with_branches):
    owner, org, _ = org_with_branches
    viewer = actor("viewer")
    await _invite_and_accept(client, owner, org, viewer, role="viewer")
    r = await client.get("/api/v1/members", headers=viewer.h(org["id"]))
    assert r.status_code == 403


async def test_full_name_taken_from_signup_metadata(client, actor, new_org):
    from tests.conftest import make_token

    u = actor()
    u.token = make_token(u.id, u.email, user_metadata={"full_name": "  Mariam Al Hinai "})
    org = await new_org(u)
    me = (await client.get("/api/v1/me", headers=u.h())).json()
    assert me["full_name"] == "Mariam Al Hinai"
    members = (await client.get("/api/v1/members", headers=u.h(org["id"]))).json()
    assert members[0]["full_name"] == "Mariam Al Hinai"

    # A later token without a name must not wipe the stored one.
    u.token = make_token(u.id, u.email)
    assert (await client.get("/api/v1/me", headers=u.h())).json()["full_name"] == "Mariam Al Hinai"


@pytest.mark.parametrize("method", ["GET", "POST", "PUT", "PATCH", "DELETE"])
async def test_cors_allows_every_method_the_frontend_uses(client, method):
    r = await client.options(
        "/api/v1/imports/00000000-0000-0000-0000-000000000000/mapping",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": method,
            "Access-Control-Request-Headers": "authorization,content-type,x-org-id",
        },
    )
    assert r.status_code == 200, (method, r.text)
    assert method in r.headers["access-control-allow-methods"]
