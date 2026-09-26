# StockSense

StockSense is a prototype inventory management system (IMS) for bringing products, warehouses, stock movements, and inventory operations into one simple workspace.

It is designed for inventory managers and warehouse staff who currently rely on manual registers, spreadsheets, or disconnected tracking methods.

## Contents

- [Problem](#problem)
- [Prototype goals](#prototype-goals)
- [Users and roles](#users-and-roles)
- [Core workflows](#core-workflows)
- [Application areas](#application-areas)
- [Stock rules](#stock-rules)
- [Suggested data model](#suggested-data-model)
- [Document statuses](#document-statuses)
- [Getting started](#getting-started)
- [Prototype acceptance criteria](#prototype-acceptance-criteria)
- [Project structure](#project-structure)
- [Roadmap](#roadmap)
- [Scope](#scope)

## Problem

Businesses need a clear view of what stock they have, where it is located, what is arriving, and what is leaving. StockSense will provide a centralized prototype for managing these operations and maintaining a basic stock ledger.

## Prototype goals

- Manage products, SKUs, categories, units of measure, and reorder levels.
- Track available stock by warehouse and internal location.
- Record incoming goods through receipts.
- Record outgoing goods through delivery orders.
- Move stock between warehouses, racks, and other locations.
- Correct differences between recorded stock and physical counts.
- Display key inventory metrics on a dashboard.
- Keep a readable history of every validated stock movement.

## Users and roles

### Inventory manager

- Maintains products and reorder rules.
- Reviews stock levels and alerts.
- Creates and validates receipts, deliveries, transfers, and adjustments.
- Reviews the stock ledger.

### Warehouse staff

- Finds products and quantities by location.
- Performs receiving, picking, shelving, counting, and transfers.
- Updates the operational status of stock documents.

For the first prototype, these roles may share the same permissions. Role-specific permissions can be added later.

## Core workflows

### 1. Sign in

1. A user signs up or logs in.
2. A user can request an OTP-based password reset.
3. After authentication, the user is redirected to the inventory dashboard.

### 2. Receive incoming stock

1. Create a receipt.
2. Select a supplier and add products.
3. Enter the received quantities and destination location.
4. Validate the receipt.
5. Increase stock and create an `IN` ledger entry for each product line.

Example: receiving 50 steel rods increases the available steel rod quantity by 50.

### 3. Deliver outgoing stock

1. Create a delivery order.
2. Add the products and requested quantities.
3. Pick and pack the items.
4. Validate the delivery.
5. Decrease stock and create an `OUT` ledger entry for each product line.

The prototype should prevent validation when the source location does not have enough stock.

### 4. Transfer stock internally

1. Select a source warehouse/location.
2. Select a destination warehouse/location.
3. Add products and quantities.
4. Validate the transfer.
5. Decrease stock at the source, increase stock at the destination, and create a transfer history entry.

The total company stock remains unchanged during a transfer.

### 5. Adjust stock

1. Select a product and location.
2. Enter the physically counted quantity and an adjustment reason.
3. Compare the counted quantity with the recorded quantity.
4. Validate the adjustment.
5. Update stock by the difference and record the change in the ledger.

Typical reasons include damaged items, loss, found stock, or a counting correction.

## Application areas

### Dashboard

The dashboard should show:

- Total products in stock.
- Low-stock and out-of-stock items.
- Pending receipts.
- Pending deliveries.
- Scheduled internal transfers.
- Recent stock movements.

Operations should be filterable by document type, status, warehouse/location, and product category.

### Products

Each product should support:

- Name.
- SKU or product code.
- Category.
- Unit of measure.
- Optional initial stock.
- Reorder level.
- Active/inactive state.
- Stock availability by location.

SKUs should be unique within the system.

### Operations

- **Receipts:** incoming stock from vendors.
- **Delivery orders:** outgoing stock for customer shipments.
- **Internal transfers:** movement within the company.
- **Inventory adjustments:** corrections based on physical counts.
- **Move history:** searchable record of validated movements.

### Settings and profile

The prototype navigation can include warehouse setup, profile details, and logout. A warehouse can contain one or more internal locations such as racks, stores, or production areas.

## Stock rules

- Draft documents do not change stock.
- Only validated documents change stock.
- Canceled documents do not change stock.
- A validated document should not be edited directly; create a correction or reversal flow later if needed.
- Delivery and transfer quantities cannot exceed available stock at the source location.
- Every stock change must have a source document, timestamp, product, quantity, and location.
- Low-stock status is reached when available quantity is at or below the product reorder level.
- A transfer changes location quantities but not total company quantity.

## Suggested data model

The implementation can start with the following entities:

| Entity | Purpose | Important fields |
| --- | --- | --- |
| User | Authenticated application user | id, name, email, role |
| Product | Item tracked by StockSense | id, name, sku, category, unit, reorder_level |
| Category | Product grouping | id, name |
| Warehouse | Physical storage site | id, name, address |
| Location | Storage area within a warehouse | id, warehouse_id, name |
| Stock balance | Current quantity by product/location | product_id, location_id, quantity |
| Stock document | Receipt, delivery, transfer, or adjustment | id, type, status, source, destination, created_by |
| Document line | Product quantity on a document | document_id, product_id, quantity |
| Stock ledger entry | Immutable movement history | id, product_id, location_id, quantity, movement_type, document_id, created_at |

The exact database and API design can be chosen during implementation.

## Document statuses

The initial status flow can use:

`Draft` -> `Waiting` -> `Ready` -> `Done`

Any document that has not been validated may be marked `Canceled`. For the prototype, the UI should make the current status and next available action obvious.

## Getting started

The repository currently contains the project brief and prototype documentation. The application implementation and final technology stack are still being built.

Once the stack is selected, this section should be updated with the exact commands for:

1. Installing dependencies.
2. Configuring environment variables.
3. Creating or seeding the database.
4. Starting the development server.
5. Running tests and linting.

Until then, contributors can use the workflows and acceptance criteria in this README as the implementation contract for the first prototype.

## Prototype acceptance criteria

The first usable version should allow a user to:

1. Log in and reach the dashboard.
2. Create a product and see it in the product list.
3. Create and validate a receipt, then see stock increase.
4. Create and validate a delivery, then see stock decrease.
5. Transfer stock between two locations and see both balances update.
6. Make an adjustment and see the difference reflected in stock.
7. View the resulting operations in move history.
8. Find low-stock and out-of-stock items from the dashboard.

## Project structure

The structure will evolve with the selected framework. A possible starting structure is:

```text
StockSense/
├── README.md
├── frontend/       # Dashboard and operational screens
├── backend/        # API, business rules, and authentication
├── database/       # Schema, migrations, and seed data
└── docs/           # Design notes and decisions
```

## Roadmap

### Phase 1 - Prototype foundation

- Authentication screens.
- Dashboard shell and navigation.
- Product and category management.
- One warehouse with basic locations.

### Phase 2 - Inventory operations

- Receipts and deliveries.
- Internal transfers.
- Stock adjustments.
- Stock ledger and dashboard alerts.

### Phase 3 - Usability improvements

- Search, sorting, and smart filters.
- Multi-warehouse support.
- Better role-based permissions.
- Responsive warehouse workflows.

### Later

- Supplier and customer integrations.
- Barcode scanning.
- Notifications and reporting.
- Audit-ready history and production hardening.

## Scope

This is an early working prototype. The priority is demonstrating the core inventory flows with a clear interface and understandable data. Production deployment, enterprise security, integrations, advanced permissions, compliance, and high-scale performance are outside the initial scope.

## Reference

The initial requirements and inventory flow are based on the StockSense project brief and its accompanying [Excalidraw mockup](https://link.excalidraw.com/l/65VNwvy7c4X/3ENvQFu9o8R).

