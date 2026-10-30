"""What each importable record type needs, and the header names we recognise for it.

Synonyms are compared after normalisation (lowercase, letters and digits only), so
"Receipt No.", "receipt_no" and "RECEIPT NO" all match "receiptno". Arabic headers are
included for common GCC exports; add more as real files arrive.
"""

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Literal

Kind = Literal["text", "code", "decimal", "date", "datetime", "currency", "status"]


@dataclass(frozen=True)
class FieldSpec:
    key: str
    label: str
    kind: Kind
    required: bool = False
    synonyms: tuple[str, ...] = ()
    help: str = ""


@dataclass(frozen=True)
class EntitySpec:
    key: str
    label: str
    description: str
    fields: tuple[FieldSpec, ...]
    owner_only: bool = False
    depends_on: tuple[str, ...] = field(default_factory=tuple)

    def field(self, key: str) -> FieldSpec:
        return next(f for f in self.fields if f.key == key)

    @property
    def required_keys(self) -> list[str]:
        return [f.key for f in self.fields if f.required]


def normalise_header(text: str) -> str:
    text = unicodedata.normalize("NFKC", str(text or "")).lower()
    return re.sub(r"[\W_]+", "", text, flags=re.UNICODE)


BRANCH = FieldSpec(
    "branch_code",
    "Branch code",
    "code",
    True,
    (
        "branch",
        "branchcode",
        "branchid",
        "store",
        "storecode",
        "storeid",
        "outlet",
        "outletcode",
        "location",
        "locationcode",
        "site",
        "shop",
        "costcentre",
        "costcenter",
        "الفرع",
        "رمزالفرع",
    ),
    "Must match a branch code set up in EOS.",
)
SKU = FieldSpec(
    "sku",
    "Product code (SKU)",
    "code",
    True,
    (
        "sku",
        "itemcode",
        "item",
        "itemno",
        "itemnumber",
        "productcode",
        "product",
        "productid",
        "barcode",
        "plu",
        "articlecode",
        "article",
        "materialcode",
        "رمزالصنف",
        "الصنف",
    ),
)
CURRENCY = FieldSpec(
    "currency",
    "Currency",
    "currency",
    False,
    ("currency", "curr", "ccy", "currencycode", "العملة"),
    "Three-letter code. If missing, the organisation's base currency is used.",
)
TAX = FieldSpec(
    "tax",
    "Tax / VAT amount",
    "decimal",
    False,
    ("tax", "vat", "vatamount", "taxamount", "gst", "الضريبة", "ضريبةالقيمةالمضافة"),
)

ENTITIES: dict[str, EntitySpec] = {
    "branches": EntitySpec(
        "branches",
        "Branches",
        "Stores, outlets or locations.",
        (
            FieldSpec(
                "code",
                "Branch code",
                "code",
                True,
                (
                    "branchcode",
                    "code",
                    "branch",
                    "storecode",
                    "outletcode",
                    "locationcode",
                    "رمزالفرع",
                ),
            ),
            FieldSpec(
                "name",
                "Branch name",
                "text",
                True,
                (
                    "branchname",
                    "name",
                    "storename",
                    "outletname",
                    "locationname",
                    "description",
                    "اسمالفرع",
                ),
            ),
            FieldSpec("city", "City", "text", False, ("city", "town", "area", "region", "المدينة")),
        ),
        owner_only=True,
    ),
    "products": EntitySpec(
        "products",
        "Products",
        "Items you sell or buy.",
        (
            SKU,
            FieldSpec(
                "name",
                "Product name",
                "text",
                True,
                (
                    "name",
                    "itemdescription",
                    "description",
                    "productname",
                    "itemname",
                    "desc",
                    "اسمالصنف",
                    "الوصف",
                ),
            ),
            FieldSpec(
                "category",
                "Category",
                "text",
                False,
                (
                    "category",
                    "group",
                    "itemgroup",
                    "department",
                    "family",
                    "class",
                    "الفئة",
                    "المجموعة",
                ),
            ),
            FieldSpec("unit", "Unit", "text", False, ("unit", "uom", "unitofmeasure", "الوحدة")),
        ),
    ),
    "product_costs": EntitySpec(
        "product_costs",
        "Product costs",
        "Unit cost per product, effective from a date.",
        (
            SKU,
            FieldSpec(
                "effective_from",
                "Effective from",
                "date",
                True,
                ("effectivefrom", "effectivedate", "fromdate", "validfrom", "date", "startdate"),
            ),
            FieldSpec(
                "unit_cost",
                "Unit cost",
                "decimal",
                True,
                (
                    "unitcost",
                    "cost",
                    "costprice",
                    "purchaseprice",
                    "avgcost",
                    "averagecost",
                    "التكلفة",
                ),
            ),
            CURRENCY,
        ),
        depends_on=("products",),
    ),
    "suppliers": EntitySpec(
        "suppliers",
        "Suppliers",
        "Vendors you buy from.",
        (
            FieldSpec(
                "code",
                "Supplier code",
                "code",
                True,
                (
                    "vendorcode",
                    "suppliercode",
                    "code",
                    "vendorid",
                    "supplierid",
                    "vendor",
                    "supplier",
                    "رمزالمورد",
                ),
            ),
            FieldSpec(
                "name",
                "Supplier name",
                "text",
                True,
                ("vendorname", "suppliername", "name", "اسمالمورد"),
            ),
            CURRENCY,
        ),
    ),
    "fx_rates": EntitySpec(
        "fx_rates",
        "Exchange rates",
        "How many base-currency units one foreign unit buys.",
        (
            FieldSpec(
                "rate_date",
                "Rate date",
                "date",
                True,
                ("ratedate", "date", "effectivedate", "asof", "valuedate"),
            ),
            FieldSpec(
                "currency",
                "Currency",
                "currency",
                True,
                ("currency", "curr", "ccy", "currencycode", "fromcurrency"),
            ),
            FieldSpec(
                "rate_to_base",
                "Rate to base",
                "decimal",
                True,
                ("ratetoomr", "ratetobase", "rate", "exchangerate", "fxrate", "multiplier"),
            ),
        ),
    ),
    "sales": EntitySpec(
        "sales",
        "Sales",
        "One row per sold line (receipt + item). Refunds and voids included.",
        (
            FieldSpec(
                "receipt_no",
                "Receipt / invoice no.",
                "code",
                True,
                (
                    "receiptno",
                    "receipt",
                    "receiptnumber",
                    "invoiceno",
                    "invoice",
                    "invoicenumber",
                    "billno",
                    "bill",
                    "billnumber",
                    "transactionno",
                    "transactionid",
                    "orderno",
                    "ordernumber",
                    "ticketno",
                    "docno",
                    "رقمالفاتورة",
                    "رقمالإيصال",
                ),
            ),
            BRANCH,
            FieldSpec(
                "sold_at",
                "Date / time",
                "datetime",
                True,
                (
                    "date",
                    "datetime",
                    "saledate",
                    "transactiondate",
                    "invoicedate",
                    "billdate",
                    "orderdate",
                    "timestamp",
                    "createdat",
                    "التاريخ",
                ),
            ),
            SKU,
            FieldSpec(
                "description",
                "Item description",
                "text",
                False,
                ("itemdescription", "description", "itemname", "productname", "desc"),
            ),
            FieldSpec(
                "qty",
                "Quantity",
                "decimal",
                True,
                ("qty", "quantity", "qtysold", "units", "pcs", "الكمية"),
            ),
            FieldSpec(
                "unit_price",
                "Unit price (before tax)",
                "decimal",
                True,
                ("unitprice", "price", "sellingprice", "rate", "unitrate", "السعر"),
            ),
            FieldSpec(
                "discount",
                "Discount amount",
                "decimal",
                False,
                ("discount", "discountamount", "disc", "الخصم"),
            ),
            TAX,
            CURRENCY,
            FieldSpec(
                "status",
                "Status",
                "status",
                False,
                ("status", "type", "transactiontype", "saletype", "الحالة"),
                "Completed, refund/return, or void. Negative quantities count as refunds.",
            ),
            FieldSpec(
                "ref_receipt_no",
                "Original receipt (for refunds)",
                "code",
                False,
                (
                    "refreceipt",
                    "originalreceipt",
                    "refinvoice",
                    "originalinvoice",
                    "reference",
                    "refno",
                ),
            ),
            FieldSpec(
                "customer_ref",
                "Customer",
                "text",
                False,
                ("customer", "customerid", "customercode", "customername", "العميل"),
            ),
            FieldSpec(
                "line_no",
                "Line number",
                "code",
                False,
                ("lineno", "linenumber", "linenum", "lineseq", "seqno", "lineid", "itemline"),
                "If your export numbers the lines of each receipt, map it so repeated rows "
                "can be told apart from genuine repeat purchases.",
            ),
        ),
        depends_on=("branches", "products"),
    ),
    "purchases": EntitySpec(
        "purchases",
        "Purchases",
        "One row per purchased line (supplier invoice + item).",
        (
            FieldSpec(
                "doc_no",
                "Supplier invoice no.",
                "code",
                True,
                (
                    "invoiceno",
                    "invoice",
                    "docno",
                    "documentno",
                    "pono",
                    "billno",
                    "grnno",
                    "reference",
                ),
            ),
            FieldSpec(
                "supplier_code",
                "Supplier code",
                "code",
                True,
                ("vendorcode", "suppliercode", "vendor", "supplier", "vendorid"),
            ),
            FieldSpec("branch_code", "Branch code", "code", False, BRANCH.synonyms),
            FieldSpec(
                "purchased_on",
                "Invoice date",
                "date",
                True,
                ("invoicedate", "date", "purchasedate", "docdate", "grndate"),
            ),
            SKU,
            FieldSpec("qty", "Quantity", "decimal", True, ("qty", "quantity", "units")),
            FieldSpec(
                "unit_cost",
                "Unit cost (before tax)",
                "decimal",
                True,
                ("unitcost", "cost", "price", "unitprice", "rate"),
            ),
            CURRENCY,
            TAX,
        ),
        depends_on=("branches", "products", "suppliers"),
    ),
    "expenses": EntitySpec(
        "expenses",
        "Expenses",
        "Operating costs such as rent, salaries and utilities.",
        (
            FieldSpec(
                "incurred_on",
                "Date",
                "date",
                True,
                ("date", "expensedate", "postingdate", "transactiondate", "التاريخ"),
            ),
            FieldSpec(
                "category",
                "Category",
                "text",
                True,
                (
                    "expensetype",
                    "category",
                    "account",
                    "accountname",
                    "glaccount",
                    "type",
                    "nature",
                    "البند",
                ),
            ),
            FieldSpec(
                "amount",
                "Amount (before tax)",
                "decimal",
                True,
                ("amount", "value", "total", "net", "المبلغ"),
            ),
            FieldSpec(
                "branch_code",
                "Branch / cost centre",
                "code",
                False,
                BRANCH.synonyms,
                "Leave empty for head-office costs.",
            ),
            FieldSpec(
                "description",
                "Description",
                "text",
                False,
                ("narration", "description", "memo", "details", "remarks", "البيان"),
            ),
            TAX,
            CURRENCY,
        ),
        depends_on=("branches",),
    ),
    "inventory_counts": EntitySpec(
        "inventory_counts",
        "Stock counts",
        "Quantity on hand per branch and product on a date.",
        (
            FieldSpec(
                "count_date",
                "Count date",
                "date",
                True,
                ("countdate", "date", "stockdate", "asof", "snapshotdate"),
            ),
            BRANCH,
            SKU,
            FieldSpec(
                "qty",
                "Quantity on hand",
                "decimal",
                True,
                ("qtyonhand", "onhand", "qty", "quantity", "stock", "balance", "soh"),
            ),
            FieldSpec(
                "unit_cost",
                "Unit cost",
                "decimal",
                False,
                ("unitcost", "unitcostomr", "cost", "avgcost", "averagecost"),
            ),
        ),
        depends_on=("branches", "products"),
    ),
}

STATUS_WORDS = {
    "completed": (
        "completed",
        "complete",
        "paid",
        "sale",
        "sold",
        "closed",
        "ok",
        "invoice",
        "مكتمل",
    ),
    "refund": ("refund", "refunded", "return", "returned", "creditnote", "credit", "مرتجع"),
    "voided": ("void", "voided", "cancelled", "canceled", "deleted", "ملغي"),
}
