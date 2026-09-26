# StockSense Infrastructure

Terraform definitions for StockSense staging and production cloud infrastructure.

## Resources

- **VPC**: Multi-AZ virtual private cloud with private and public subnets.
- **RDS PostgreSQL 16**: High-availability database cluster with automated backups.
- **ElastiCache Redis 7**: Managed Redis for BullMQ queues, rate limiting, and session caching.
- **S3 Bucket**: S3-compatible object storage for exports and asset files.
