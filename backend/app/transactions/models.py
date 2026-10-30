"""Business records. Every row keeps its source import and file row for traceability."""

import enum
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.core.models_base import IdMixin, OrgMixin


class SourceMixin:
    source_import_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("eos.imports.id", ondelete="SET NULL")
    )
    source_row_number: Mapped[int | None] = mapped_column(Integer)


class CreatedMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class SaleStatus(enum.StrEnum):
    completed = "completed"
    voided = "voided"
    refund = "refund"


sale_status_enum = Enum(
    SaleStatus, name="sale_status", schema="eos", values_callable=lambda e: [m.value for m in e]
)


class Product(IdMixin, OrgMixin, SourceMixin, CreatedMixin, Base):
    __tablename__ = "products"
    sku: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    category: Mapped[str | None] = mapped_column(String(150))
    unit: Mapped[str | None] = mapped_column(String(30))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ProductCost(IdMixin, OrgMixin, SourceMixin, CreatedMixin, Base):
    __tablename__ = "product_costs"
    product_id: Mapped[UUID] = mapped_column(ForeignKey("eos.products.id", ondelete="CASCADE"))
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)


class Supplier(IdMixin, OrgMixin, SourceMixin, CreatedMixin, Base):
    __tablename__ = "suppliers"
    code: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    currency: Mapped[str | None] = mapped_column(String(3))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class FxRate(IdMixin, OrgMixin, SourceMixin, CreatedMixin, Base):
    __tablename__ = "fx_rates"
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    rate_date: Mapped[date] = mapped_column(Date, nullable=False)
    rate_to_base: Mapped[Decimal] = mapped_column(Numeric(18, 8), nullable=False)


class Sale(IdMixin, OrgMixin, SourceMixin, CreatedMixin, Base):
    __tablename__ = "sales"
    branch_id: Mapped[UUID] = mapped_column(ForeignKey("eos.branches.id"), nullable=False)
    receipt_no: Mapped[str] = mapped_column(String(100), nullable=False)
    sold_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    business_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[SaleStatus] = mapped_column(sale_status_enum, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    ref_receipt_no: Mapped[str | None] = mapped_column(String(100))
    customer_ref: Mapped[str | None] = mapped_column(String(200))


class SaleLine(IdMixin, OrgMixin, SourceMixin, Base):
    __tablename__ = "sale_lines"
    sale_id: Mapped[UUID] = mapped_column(ForeignKey("eos.sales.id", ondelete="CASCADE"))
    product_id: Mapped[UUID | None] = mapped_column(ForeignKey("eos.products.id"))
    raw_product_ref: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)
    qty: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    discount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    tax: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)


class Purchase(IdMixin, OrgMixin, SourceMixin, CreatedMixin, Base):
    __tablename__ = "purchases"
    branch_id: Mapped[UUID | None] = mapped_column(ForeignKey("eos.branches.id"))
    supplier_id: Mapped[UUID] = mapped_column(ForeignKey("eos.suppliers.id"), nullable=False)
    doc_no: Mapped[str] = mapped_column(String(100), nullable=False)
    purchased_on: Mapped[date] = mapped_column(Date, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)


class PurchaseLine(IdMixin, OrgMixin, SourceMixin, Base):
    __tablename__ = "purchase_lines"
    purchase_id: Mapped[UUID] = mapped_column(ForeignKey("eos.purchases.id", ondelete="CASCADE"))
    product_id: Mapped[UUID] = mapped_column(ForeignKey("eos.products.id"), nullable=False)
    qty: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    tax: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)


class Expense(IdMixin, OrgMixin, SourceMixin, CreatedMixin, Base):
    __tablename__ = "expenses"
    branch_id: Mapped[UUID | None] = mapped_column(ForeignKey("eos.branches.id"))
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    incurred_on: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    tax: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    row_hash: Mapped[str] = mapped_column(String(64), nullable=False)


class InventoryCount(IdMixin, OrgMixin, SourceMixin, CreatedMixin, Base):
    __tablename__ = "inventory_counts"
    branch_id: Mapped[UUID] = mapped_column(ForeignKey("eos.branches.id"), nullable=False)
    product_id: Mapped[UUID] = mapped_column(ForeignKey("eos.products.id"), nullable=False)
    count_date: Mapped[date] = mapped_column(Date, nullable=False)
    qty: Mapped[Decimal] = mapped_column(Numeric(14, 3), nullable=False)
    unit_cost: Mapped[Decimal | None] = mapped_column(Numeric(18, 6))
