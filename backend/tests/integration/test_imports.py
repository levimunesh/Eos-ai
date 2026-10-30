"""Phase 2 acceptance: the demo company's files and a deliberately messy file import with
every row accounted for, and the loaded data matches independently computed answers."""

import csv
import io
import json
from decimal import Decimal

import pytest

from tests.importing import ORDER, generate_demo, run_import, upload


@pytest.fixture(scope="session")
def demo_dir(tmp_path_factory):
    return generate_demo(tmp_path_factory.mktemp("demo_import"))


@pytest.fixture(scope="session")
async def demo_org(client, demo_dir):
    from tests.conftest import Actor

    owner = Actor("owner-demo@eos.example")
    r = await client.post(
        "/api/v1/orgs",
        json={
            "name": "Eos Trading Co.",
            "base_currency": "OMR",
            "timezone": "Asia/Muscat",
            "tax_rate": "0.05",
        },
        headers=owner.h(),
    )
    org = r.json()
    results = {}
    for entity, fname in ORDER:
        results[entity] = await run_import(
            client, owner, org["id"], entity, fname, (demo_dir / fname).read_bytes()
        )
    return owner, org, results


async def test_all_demo_files_import_cleanly(demo_org, demo_dir):
    _, _, results = demo_org
    manifest = json.loads((demo_dir / "MANIFEST.json").read_text())
    for entity, fname in ORDER:
        validated, done = results[entity]
        assert done["rows_total"] == manifest["rows"][fname], entity
        assert done["rows_rejected"] == 0, (entity, done["quality_report"]["errors_sample"])
        assert done["rows_duplicate"] == 0, entity
        assert done["rows_imported"] == done["rows_total"], entity
        # The dry run predicted exactly what the commit did.
        assert validated["rows_imported"] == done["rows_imported"], entity


async def test_loaded_sales_match_independent_answers(demo_org, demo_dir, app_conn):
    _, org, _ = demo_org
    answers = json.loads((demo_dir / "expected" / "answers.json").read_text())
    await app_conn.execute("select set_config('app.org_id', $1, false)", org["id"])
    row = await app_conn.fetchrow(
        """
        select sum(l.qty * l.unit_price - l.discount) as net,
               count(distinct s.id) as receipts
          from eos.sales s join eos.sale_lines l on l.sale_id = s.id
         where s.status <> 'voided'
        """
    )
    assert abs(row["net"] - Decimal(answers["year"]["net_sales"])) <= Decimal("0.01")
    assert row["receipts"] == answers["year"]["transactions"]
    march = await app_conn.fetchval(
        """
        select sum(l.qty * l.unit_price - l.discount)
          from eos.sales s join eos.sale_lines l on l.sale_id = s.id
         where s.status <> 'voided' and s.business_date between '2025-03-01' and '2025-03-31'
        """
    )
    assert abs(march - Decimal(answers["by_month"]["2025-03"]["net_sales"])) <= Decimal("0.01")


async def test_every_record_traces_to_its_file_row(demo_org, app_conn):
    _, org, results = demo_org
    await app_conn.execute("select set_config('app.org_id', $1, false)", org["id"])
    untraced = await app_conn.fetchval(
        "select count(*) from eos.sale_lines where source_import_id is null "
        "or source_row_number is null"
    )
    assert untraced == 0
    sales_import = results["sales"][1]["id"]
    first = await app_conn.fetchrow(
        "select l.source_row_number, s.receipt_no from eos.sale_lines l "
        "join eos.sales s on s.id = l.sale_id where l.source_import_id = $1 "
        "order by l.source_row_number limit 1",
        sales_import,
    )
    assert first["source_row_number"] == 2  # first data row under the header


async def test_messy_file_every_row_accounted(demo_org, demo_dir, client):
    owner, org, _ = demo_org
    content = (demo_dir / "messy" / "sales_messy.csv").read_bytes()
    validated, done = await run_import(client, owner, org["id"], "sales", "messy.csv", content)
    # 51 rows = 40 copies of lines already imported + 2 exact repeats of them (all 42 are
    # duplicates of receipts already in EOS) + 8 defective rows + 1 prompt-injection line.
    report = done["quality_report"]
    assert done["rows_total"] == 51
    assert done["rows_rejected"] == 8, report["errors_by_code"]
    assert report["errors_by_code"] == {
        "invalid_date": 1,
        "not_a_number": 1,
        "unknown_product": 1,
        "unknown_branch": 1,
        "negative_qty_on_sale": 1,
        "receipt_conflict": 1,
        "ambiguous_number": 1,
        "missing_value": 1,
    }
    # Without a line-number column, identical lines can't be proven duplicates, so they are
    # kept and reported; here they belong to receipts already in EOS and are skipped as such.
    assert report["duplicates"] == {"in_file": 0, "already_in_eos": 42}
    assert any("identical" in w for w in report["warnings"])
    # The injection row is a new receipt with a valid SKU: imported as plain data.
    assert done["rows_imported"] == 1
    assert done["rows_duplicate"] == 42  # 2 exact repeats + 40 lines already in EOS

    r = await client.get(f"/api/v1/imports/{done['id']}/errors.csv", headers=owner.h(org["id"]))
    assert r.status_code == 200
    rows = list(csv.reader(io.StringIO(r.text.lstrip("﻿"))))
    assert rows[0][:4] == ["Row", "Column", "Error", "Message"]
    assert len(rows) == 1 + 8


async def test_injection_text_is_stored_as_data(demo_org, app_conn):
    _, org, _ = demo_org
    await app_conn.execute("select set_config('app.org_id', $1, false)", org["id"])
    desc = await app_conn.fetchval(
        "select l.description from eos.sale_lines l join eos.sales s on s.id = l.sale_id "
        "where s.receipt_no = 'R999001'"
    )
    assert desc.startswith("IGNORE ALL PREVIOUS INSTRUCTIONS")


async def test_same_file_twice_is_flagged_and_skipped(demo_org, demo_dir, client):
    owner, org, _ = demo_org
    content = (demo_dir / "expenses.csv").read_bytes()
    r = await upload(client, owner, org["id"], "expenses", "expenses.csv", content)
    assert r.json()["preview"]["same_file_imported_before"], "re-upload must be flagged"
    assert r.json()["preview"]["mapping_source"] == "saved"
    _, done = await run_import(client, owner, org["id"], "expenses", "expenses.csv", content)
    assert done["rows_imported"] == 0
    assert done["rows_duplicate"] == done["rows_total"] == 180


async def test_replace_mode_overwrites_receipts(demo_org, demo_dir, client, app_conn):
    owner, org, _ = demo_org
    lines = (demo_dir / "sales.csv").read_text().splitlines()
    header, first = lines[0], lines[1]
    cols = first.split(",")
    receipt = cols[0]
    # Same receipt, corrected price.
    cols[6] = str(Decimal(cols[6]) + Decimal("1"))
    body = "\n".join([header, ",".join(cols)]).encode()
    _, done = await run_import(client, owner, org["id"], "sales", "fix.csv", body, "replace")
    assert done["rows_imported"] == 1
    assert done["quality_report"]["replaced_records"] == 1
    await app_conn.execute("select set_config('app.org_id', $1, false)", org["id"])
    n_lines = await app_conn.fetchval(
        "select count(*) from eos.sale_lines l join eos.sales s on s.id = l.sale_id "
        "where s.receipt_no = $1",
        receipt,
    )
    assert n_lines == 1


# ---- access control ---------------------------------------------------------------------


async def test_other_org_cannot_see_import(demo_org, client, actor, new_org):
    _, org, results = demo_org
    stranger = actor("stranger")
    other = await new_org(stranger)
    imp_id = results["sales"][1]["id"]
    r = await client.get(f"/api/v1/imports/{imp_id}", headers=stranger.h(other["id"]))
    assert r.status_code == 404
    r = await client.get(f"/api/v1/imports/{imp_id}", headers=stranger.h(org["id"]))
    assert r.status_code == 404


async def test_viewer_cannot_import_and_manager_cannot_import_branches(demo_org, client, actor):
    owner, org, _ = demo_org
    for role in ("viewer", "manager"):
        person = actor(role)
        r = await client.post(
            "/api/v1/invitations",
            json={"email": person.email, "role": role},
            headers=owner.h(org["id"]),
        )
        await client.post(
            "/api/v1/invitations/accept", json={"token": r.json()["token"]}, headers=person.h()
        )
        body = b"Branch Code,Branch Name\nX1,Test\n"
        r = await upload(client, person, org["id"], "branches", "b.csv", body)
        assert r.status_code == 403, (role, r.text)
        if role == "viewer":
            r = await upload(client, person, org["id"], "expenses", "e.csv", b"Date,Type,Amount\n")
            assert r.status_code == 403


async def test_branch_scoped_manager_rejected_for_other_branches(demo_org, demo_dir, client, actor):
    owner, org, _ = demo_org
    branches = (await client.get("/api/v1/branches", headers=owner.h(org["id"]))).json()
    eos01 = next(b["id"] for b in branches if b["code"] == "EOS-01")
    mgr = actor("scoped")
    r = await client.post(
        "/api/v1/invitations",
        json={"email": mgr.email, "role": "manager", "all_branches": False, "branch_ids": [eos01]},
        headers=owner.h(org["id"]),
    )
    await client.post(
        "/api/v1/invitations/accept", json={"token": r.json()["token"]}, headers=mgr.h()
    )
    body = (
        b"Date,Cost Centre,Expense Type,Amount\n"
        b"01/12/2025,EOS-01,Training,10\n"
        b"01/12/2025,EOS-02,Training,10\n"
        b"01/12/2025,,Training,10\n"
    )
    _, done = await run_import(client, mgr, org["id"], "expenses", "scoped.csv", body)
    assert done["rows_imported"] == 1
    assert done["quality_report"]["errors_by_code"] == {"branch_not_permitted": 2}


async def test_commit_requires_validation(demo_org, client):
    owner, org, _ = demo_org
    r = await upload(
        client,
        owner,
        org["id"],
        "suppliers",
        "s.csv",
        b"Vendor Code,Vendor Name\nSUP-900,New Supplier\n",
    )
    imp = r.json()
    r = await client.post(
        f"/api/v1/imports/{imp['id']}/commit",
        json={"conflict_mode": "skip"},
        headers=owner.h(org["id"]),
    )
    assert r.status_code == 409


async def test_mapping_requires_required_fields(demo_org, client):
    owner, org, _ = demo_org
    r = await upload(
        client,
        owner,
        org["id"],
        "suppliers",
        "s2.csv",
        b"Vendor Code,Vendor Name\nSUP-901,Another\n",
    )
    imp = r.json()
    r = await client.put(
        f"/api/v1/imports/{imp['id']}/mapping",
        json={"column_map": {"code": "Vendor Code"}, "options": {}},
        headers=owner.h(org["id"]),
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "missing_required"


async def test_unreadable_upload_rejected(demo_org, client):
    owner, org, _ = demo_org
    r = await upload(client, owner, org["id"], "products", "x.pdf", b"%PDF-1.4")
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "unsupported_type"
