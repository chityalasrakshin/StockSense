# StockSense Database Architecture

PostgreSQL data layer and ledger schema matching `architecture.md` Section 11.

## Key Design Principles

- **Dual-Model Ledger**: `stock_ledger` is immutable, append-only, and auditable. `stock_balances` is a derived read cache kept in sync inside the exact same transactional boundary.
- **Concurrency Control**: Document validations execute `SELECT ... FOR UPDATE` row locks on `stock_balances` rows before appending to `stock_ledger`.
- **Internal Transfers**: Dual ledger row insertions in one transaction netting zero in total across the system.
