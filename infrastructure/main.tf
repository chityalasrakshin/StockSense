terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# VPC Configuration
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "stocksense-${var.environment}-vpc"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# PostgreSQL Database (RDS)
resource "aws_db_instance" "postgres" {
  identifier          = "stocksense-${var.environment}-db"
  allocated_storage   = 20
  engine              = "postgres"
  engine_version      = "16"
  instance_class      = var.db_instance_class
  db_name             = "stocksense"
  username            = var.db_username
  password            = var.db_password
  skip_final_snapshot = var.environment != "prod"

  tags = {
    Name        = "stocksense-${var.environment}-postgres"
    Environment = var.environment
  }
}

# Redis Cluster (ElastiCache)
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "stocksense-${var.environment}-redis"
  engine               = "redis"
  node_type            = var.redis_node_type
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379

  tags = {
    Name        = "stocksense-${var.environment}-redis"
    Environment = var.environment
  }
}

# S3 Bucket for Media & Document Exports
resource "aws_s3_bucket" "storage" {
  bucket = "stocksense-${var.environment}-assets"

  tags = {
    Name        = "stocksense-${var.environment}-storage"
    Environment = var.environment
  }
}
