"""Shared helpers: generate the demo company and push files through the import API."""

import importlib.util
import sys
from pathlib import Path

from app.ingest import jobs

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "generate_demo_data.py"
ORDER = [
    ("branches", "branches.csv"),
    ("products", "products.csv"),
    ("suppliers", "suppliers.csv"),
    ("fx_rates", "fx_rates.csv"),
    ("product_costs", "product_costs.csv"),
    ("sales", "sales.csv"),
    ("purchases", "purchases.csv"),
    ("expenses", "expenses.csv"),
    ("inventory_counts", "inventory_counts.csv"),
]


def generate_demo(out: Path) -> Path:
    spec = importlib.util.spec_from_file_location("gen_imp", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    sys.modules["gen_imp"] = mod
    spec.loader.exec_module(mod)
    mod.run(out, seed=20251)
    return out


async def upload(client, actor, org_id, entity, name, content: bytes):
    r = await client.post(
        "/api/v1/imports",
        data={"entity_type": entity},
        files={"file": (name, content, "text/csv")},
        headers=actor.h(org_id),
    )
    return r


async def run_import(client, actor, org_id, entity, name, content, conflict_mode="skip"):
    """Upload -> accept suggested mapping -> validate -> commit. Returns final import JSON."""
    r = await upload(client, actor, org_id, entity, name, content)
    assert r.status_code == 201, r.text
    imp = r.json()
    r = await client.put(
        f"/api/v1/imports/{imp['id']}/mapping",
        json={"column_map": imp["column_map"], "options": {}},
        headers=actor.h(org_id),
    )
    assert r.status_code == 200, r.text
    r = await client.post(f"/api/v1/imports/{imp['id']}/validate", headers=actor.h(org_id))
    assert r.status_code == 202, r.text
    await jobs.run_pending()
    v = (await client.get(f"/api/v1/imports/{imp['id']}", headers=actor.h(org_id))).json()
    assert v["status"] == "validated", v
    r = await client.post(
        f"/api/v1/imports/{imp['id']}/commit",
        json={"conflict_mode": conflict_mode},
        headers=actor.h(org_id),
    )
    assert r.status_code == 202, r.text
    await jobs.run_pending()
    done = (await client.get(f"/api/v1/imports/{imp['id']}", headers=actor.h(org_id))).json()
    assert done["status"] == "done", done
    total = done["rows_imported"] + done["rows_rejected"] + done["rows_duplicate"]
    assert total == done["rows_total"], "every row must be accounted for"
    return v, done
