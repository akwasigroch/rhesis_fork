# Soft Deletion Architecture

**Date:** October 2025  
**Status:** Production-ready  
**Branch:** `feature/soft-deletion-for-entities`

## Overview

This document describes the soft deletion implementation in the Rhesis backend. Soft deletion allows records to be marked as deleted without physically removing them from the database, enabling data recovery, maintaining referential integrity, and preserving historical data.

## Design Goals

The soft deletion implementation was designed to achieve the following objectives:

### 1. Seamless Implementation Across All Entities
Leverage the `Base` model to provide soft deletion capabilities to all 31+ database entities automatically, without requiring changes to individual model definitions. This ensures consistency and reduces maintenance overhead.

### 2. Automatic Filtering at the Fundamental Level
Implement filtering that works automatically for **ALL** queries throughout the codebase without requiring manual modifications. This was critical because changing every existing query would be impractical and error-prone in a large codebase.

### 3. Preserve Referential Integrity and Historical Data
In a multi-entity database with complex foreign key relationships, cascade deletion would destroy valuable historical data. For example, tests should be deletable without losing test run history and results. Soft deletion preserves all relationships while hiding the deleted entity from normal operations.

### 4. Support Correct Pagination
Ensure soft delete filters are applied **BEFORE** `LIMIT`/`OFFSET` in SQL queries, so pagination counts and results are accurate. This required special handling of SQLAlchemy's query compilation order.

### 5. Provide Flexible Control Mechanisms
Offer multiple layers of control: global context manager for admin operations, query-level methods for specific cases, and automatic filtering for normal operations. This balance supports different use cases without compromising security.

## Architecture

The implementation uses a layered approach with four complementary mechanisms:

### 1. Base Model Enhancement

All models inherit from `Base` which now includes:

```python
# Soft delete support
deleted_at = Column(DateTime, nullable=True, index=True)

@hybrid_property
def is_deleted(self):
    """Check if this record is soft-deleted"""
    return self.deleted_at is not None

@is_deleted.expression
def is_deleted(cls):
    """SQL expression for is_deleted filter"""
    return cls.deleted_at.isnot(None)

def soft_delete(self):
    """Mark this record as deleted"""
    from datetime import datetime, timezone
    self.deleted_at = datetime.now(timezone.utc)

def restore(self):
    """Restore a soft-deleted record"""
    self.deleted_at = None
```

**Location:** `apps/backend/src/rhesis/backend/app/models/base.py`

### 2. SQLAlchemy Event Listener (Automatic Filtering)

A `before_compile` event listener automatically adds `deleted_at IS NULL` filter to **ALL** queries. This is the core mechanism that enables automatic filtering without code changes.

**Key features:**
- Intercepts queries at compilation time
- Catches `InvalidRequestError` for queries with `LIMIT`/`OFFSET`
- Modifies `_where_criteria` tuple directly when `.filter()` fails
- Respects `_include_soft_deleted` flag for explicit control

**Location:** `apps/backend/src/rhesis/backend/app/models/soft_delete_events.py`

### 3. QueryBuilder Enhancements

New methods for explicit control over soft delete behavior:

```python
# Include both active and deleted records
QueryBuilder(db, User).with_deleted().all()

# Retrieve only deleted records (recycle bin)
QueryBuilder(db, User).only_deleted().all()
```

**Location:** `apps/backend/src/rhesis/backend/app/utils/model_utils.py`

### 4. Context Manager (Global Control)

Use the `without_soft_delete_filter()` context manager to temporarily disable filtering:

```python
from rhesis.backend.app.database import without_soft_delete_filter

# Normal query (excludes deleted)
active_users = db.query(User).all()

# With context manager (includes deleted)
with without_soft_delete_filter():
    all_users = db.query(User).all()
```

**Location:** `apps/backend.src/rhesis/backend/app/database.py`

## CRUD Operations

The CRUD utilities have been enhanced to support soft deletion:

```python
from rhesis.backend.app.utils import crud_utils

# Soft delete (default behavior)
deleted_item = crud_utils.delete_item(db, Model, item_id, organization_id=org_id)

# Restore a soft-deleted item
restored_item = crud_utils.restore_item(db, Model, item_id, organization_id=org_id)

# Get only soft-deleted items
deleted_items = crud_utils.get_deleted_items(db, Model, organization_id=org_id)

# Permanent deletion (WARNING: Cannot be undone)
success = crud_utils.hard_delete_item(db, Model, item_id, organization_id=org_id)

# Get item including deleted records
item = crud_utils.get_item(db, Model, item_id, include_deleted=True)
```

**Location:** `apps/backend/src/rhesis/backend/app/utils/crud_utils.py`

## Recycle Bin API (Superuser Only)

A complete REST API for managing deleted records is available at `/recycle`:

### List Available Models
```
GET /recycle/models
```

### Get Deleted Records
```
GET /recycle/{model_name}?skip=0&limit=100&organization_id={org_id}
```

### Restore a Record
```
POST /recycle/{model_name}/{item_id}/restore
```

### Permanently Delete a Record
```
DELETE /recycle/{model_name}/{item_id}?confirm=true
```

### Get Recycle Bin Statistics
```
GET /recycle/stats/counts
```

### Bulk Restore
```
POST /recycle/bulk-restore/{model_name}
Body: { "item_ids": ["uuid1", "uuid2", ...] }
```

### Empty Recycle Bin for a Model
```
DELETE /recycle/empty/{model_name}?confirm=true
```

**Location:** `apps/backend/src/rhesis/backend/app/routers/recycle.py`

## How Pagination Works with Soft Deletion

This is a **critical** aspect of the implementation:

The event listener ensures soft delete filters are applied **BEFORE** `LIMIT`/`OFFSET` in the SQL query. Here's how:

1. When `.first()` or `.limit()` are called, SQLAlchemy adds `LIMIT` before query compilation
2. The event listener attempts to use `.filter()` to add the soft delete condition
3. If `InvalidRequestError` is raised (because `LIMIT`/`OFFSET` already applied), the listener catches it
4. It then modifies the `_where_criteria` tuple directly, ensuring the filter becomes part of the `WHERE` clause

**Result:** Both count queries and paginated results correctly exclude deleted records, providing accurate pagination metadata.

### Example Query Behavior

```python
# This query correctly filters soft-deleted records BEFORE pagination
users = db.query(User).limit(10).all()
# SQL: SELECT * FROM user WHERE deleted_at IS NULL LIMIT 10

# Count queries also work correctly
count = db.query(User).count()
# SQL: SELECT COUNT(*) FROM user WHERE deleted_at IS NULL
```

## Database Migration

The migration adds `deleted_at` column and index to all tables:

```bash
# Run migration
cd apps/backend
alembic upgrade head
```

**Migration file:** `apps/backend/src/rhesis/backend/alembic/versions/e364aaec703f_add_soft_delete_support.py`

## Testing

Comprehensive test suite with 35 passing tests covering:

- ✅ CRUD operations (soft delete, restore, hard delete)
- ✅ QueryBuilder methods (`with_deleted`, `only_deleted`)
- ✅ Event listener automatic filtering
- ✅ Context manager behavior
- ✅ Edge cases and pagination scenarios
- ✅ Recycle bin API endpoints
- ✅ Multi-organization filtering
- ✅ Raw query filtering (including `.first()`)

**Test files:**
- `tests/backend/utils/test_soft_delete_crud.py`
- `tests/backend/utils/test_soft_delete_querybuilder.py`
- `tests/backend/routes/test_recycle.py`

## Usage Examples

### Basic Soft Delete and Restore

```python
from rhesis.backend.app.utils import crud_utils
from rhesis.backend.app import models

# Soft delete a test
deleted_test = crud_utils.delete_item(
    db, models.Test, test_id, 
    organization_id=org_id
)

# The test is now hidden from normal queries
test = crud_utils.get_item(db, models.Test, test_id)  # Returns None

# But can be retrieved with include_deleted=True
test = crud_utils.get_item(
    db, models.Test, test_id, 
    include_deleted=True
)  # Returns the deleted test

# Restore the test
restored_test = crud_utils.restore_item(
    db, models.Test, test_id,
    organization_id=org_id
)
```

### Using QueryBuilder

```python
from rhesis.backend.app.utils.model_utils import QueryBuilder

# Default: excludes deleted records
active_tests = QueryBuilder(db, models.Test)\
    .with_organization_filter(org_id)\
    .all()

# Include deleted records
all_tests = QueryBuilder(db, models.Test)\
    .with_deleted()\
    .with_organization_filter(org_id)\
    .all()

# Only deleted records (recycle bin view)
deleted_tests = QueryBuilder(db, models.Test)\
    .only_deleted()\
    .with_organization_filter(org_id)\
    .with_sorting('deleted_at', 'desc')\
    .all()
```

### Using Context Manager

```python
from rhesis.backend.app.database import without_soft_delete_filter

# For admin operations that need to see everything
with without_soft_delete_filter():
    all_users = db.query(models.User).all()
    deleted_count = db.query(models.User)\
        .filter(models.User.deleted_at.isnot(None))\
        .count()
```

## Key Implementation Files

| File | Purpose |
|------|---------|
| `app/models/base.py` | Base model with soft deletion columns and methods |
| `app/models/soft_delete_events.py` | SQLAlchemy event listener for automatic filtering |
| `app/database.py` | Context manager for global control |
| `app/utils/crud_utils.py` | Enhanced CRUD operations |
| `app/utils/model_utils.py` | QueryBuilder with soft delete methods |
| `app/routers/recycle.py` | REST API for recycle bin management |
| `alembic/versions/e364aaec703f_add_soft_delete_support.py` | Database migration |

## Summary

This soft deletion implementation provides a robust, production-ready solution that:

✅ Automatically filters ALL queries (including raw `db.query().first()` calls)  
✅ Works correctly with pagination and `LIMIT`/`OFFSET` queries  
✅ Preserves referential integrity and historical data  
✅ Provides flexible control at multiple levels (context, query, method)  
✅ Includes superuser recycle bin for data recovery  
✅ Zero breaking changes to existing code  

## Related Documentation

- [Database Models](./database-models.md)
- [Multi-tenancy](./multi-tenancy.md)
- [Security](./security.md)

## Support

For questions or issues related to soft deletion, please contact the backend team or file an issue on GitHub.

