# Database Field Encryption for Sensitive Tokens

## Status
Accepted

## Context

The Rhesis backend currently stores sensitive credentials as plaintext in the PostgreSQL database, including:
- API keys and authentication tokens in the `endpoint` table
- Model provider API keys in the `model` table  
- OAuth tokens and client secrets

This creates security risks:
- Database dumps or backups could expose sensitive credentials
- Log files or error messages might inadvertently include plaintext secrets
- Unauthorized database access (via SQL injection or compromised credentials) could reveal all tokens
- Compliance and security best practices require encryption at rest for sensitive data

We need a transparent encryption solution that protects data at rest while remaining straightforward to implement and maintain.

## Decision

We will implement field-level encryption for sensitive database columns using **`cryptography.fernet`** for symmetric encryption with the following approach:

### 1. Encryption Library: `cryptography.fernet`

**Chosen library:** `cryptography.fernet`

**Rationale:**
- Part of the widely-used `cryptography` package in the Python ecosystem
- Implements AES-128 in CBC mode with HMAC authentication
- Provides authenticated encryption (prevents tampering and ensures integrity)
- Simple, secure API: `Fernet(key).encrypt()` / `decrypt()`
- Returns URL-safe base64-encoded ciphertext suitable for database storage
- Well-documented and actively maintained
- Battle-tested in production environments

**Installation:**
```bash
cd apps/backend
uv add cryptography
```

**Basic Usage:**
```python
from cryptography.fernet import Fernet

# Generate encryption key (one-time setup)
key = Fernet.generate_key()  # Returns: b'32-byte-url-safe-base64-encoded-key'

# Initialize cipher
cipher = Fernet(key)

# Encrypt
plaintext = "my-api-key-12345"
encrypted = cipher.encrypt(plaintext.encode())  # Returns: b'encrypted-base64-string'

# Decrypt
decrypted = cipher.decrypt(encrypted).decode()  # Returns: "my-api-key-12345"
```

### 2. Key Management Strategy

**Environment Variable:** `DB_ENCRYPTION_KEY`

**Key Format:**
- 32 URL-safe base64-encoded bytes (Fernet standard format)
- Example: `ZmDfcTF7_60GrrY167zsiPd67pEvs0aGOv2oasOM92s=`

**Key Generation:**
Developers can generate keys locally using:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

**Key Storage by Environment:**

**Phase 1 (Initial Implementation) - Environment Secrets:**
- **Local Development:** `.env` file (gitignored, never committed)
- **CI/CD:** GitHub Secrets for automated testing
- **Staging/Production:**
  - **Kubernetes:** Environment variables populated from Kubernetes secrets
  - **Docker:** Environment variable injection at runtime
  - **Google Cloud Run:** Environment variables with GCP Secret Manager reference

**Phase 2 (Future Enhancement) - Cloud Secret Manager:**
- Direct GCP Secret Manager integration
- Automatic key rotation support
- Centralized audit logging of key access
- Per-environment key isolation with access controls
- Versioned secrets with rollback capability

**Security Considerations:**
- Keys must never be committed to version control (enforce with `.gitignore`)
- The same key must be used across all application instances within a single environment
- **Critical:** Losing the encryption key means permanent loss of access to encrypted data
  - Document key backup procedures in deployment documentation
  - Store production keys in multiple secure locations
  - Consider key escrow for disaster recovery
- Each environment (dev, staging, production) uses a separate encryption key
- Key rotation strategy will be implemented in Phase 2

### 3. Migration Strategy: In-Place Updates

**Approach:** Update existing database columns in-place without schema changes

**Rationale:**
- ✅ Maintains column name consistency across the codebase
- ✅ Eliminates need to update queries, models, and API code
- ✅ Simpler migration process with fewer moving parts
- ✅ Supports backward compatibility during migration window
- ✅ Avoids temporary dual-column management

**Migration Flow:**
```
1. Deploy application code with EncryptedString TypeDecorator
   - Includes backward compatibility (reads both encrypted and plaintext)
2. Run data migration script to encrypt all existing plaintext values
   - Processes each row: plaintext → encrypted in same column
3. Monitor application logs for any remaining plaintext values
   - Log warnings when plaintext is encountered
4. After validation period (e.g., 1 week), remove backward compatibility fallback
```

**Backward Compatibility Implementation:**

The `EncryptedString` SQLAlchemy TypeDecorator will gracefully handle both encrypted and plaintext values during the migration window:

```python
def process_result_value(self, value, dialect):
    """Decrypt when reading from database"""
    if value is None:
        return value
    
    try:
        # Attempt decryption
        decrypted = self.cipher.decrypt(value.encode()).decode()
        return decrypted
    except InvalidToken:
        # Value is not encrypted yet (plaintext)
        # Log warning for monitoring
        logger.warning(
            "Encountered unencrypted value in encrypted column",
            extra={"column": self.column_name}
        )
        return value  # Return plaintext during migration window
```

### 4. Database Schema: No Changes Required

**Existing columns remain as-is:**
- `endpoint.auth_token` (Text) → stores encrypted base64 string
- `endpoint.client_secret` (Text) → stores encrypted base64 string  
- `endpoint.last_token` (Text) → stores encrypted base64 string
- `model.key` (String) → stores encrypted base64 string

**Size Considerations:**
Fernet encryption adds overhead to the stored data:
- **Overhead:** ~40-60 bytes plus the original length
- **Example:** 
  - Original: `"my-api-key"` (10 characters)
  - Encrypted: `"gAAAAABmV8x..."` (~120 characters base64-encoded)
- **Impact:** Most token columns are already `Text` type (effectively unlimited), so no schema changes needed

### 5. Implementation Architecture

**SQLAlchemy TypeDecorator:**
Encryption/decryption will be transparent to application code using SQLAlchemy's `TypeDecorator`:

```python
from sqlalchemy import TypeDecorator, Text
from cryptography.fernet import Fernet
import os

class EncryptedString(TypeDecorator):
    """SQLAlchemy type for transparent field encryption"""
    
    impl = Text
    cache_ok = True
    
    def __init__(self):
        self.cipher = Fernet(os.getenv("DB_ENCRYPTION_KEY").encode())
        super().__init__()
    
    def process_bind_param(self, value, dialect):
        """Encrypt when writing to database"""
        if value is None:
            return value
        return self.cipher.encrypt(value.encode()).decode()
    
    def process_result_value(self, value, dialect):
        """Decrypt when reading from database"""
        if value is None:
            return value
        return self.cipher.decrypt(value.encode()).decode()
```

**Usage in Models:**
```python
from sqlalchemy import Column, Integer, String
from rhesis.backend.app.models.base import Base
from rhesis.backend.app.utils.encryption import EncryptedString

class Endpoint(Base):
    __tablename__ = "endpoint"
    
    id = Column(Integer, primary_key=True)
    name = Column(String)
    auth_token = Column(EncryptedString)  # Transparently encrypted
    client_secret = Column(EncryptedString)  # Transparently encrypted
```

### 6. Security Model

**Threat Model:**

| Threat | Current Risk | After Encryption | Mitigation |
|--------|--------------|------------------|------------|
| Database dump leak | 🔴 High | ✅ Protected | Encrypted at rest |
| Stolen backup files | 🔴 High | ✅ Protected | Useless without key |
| SQL injection | 🔴 High | ✅ Protected | Data is encrypted |
| Unauthorized DB access | 🔴 High | ✅ Protected | Credentials encrypted |
| Application breach | 🟡 Medium | 🟡 Medium | Defense in depth |
| Encryption key exposure | 🔴 Critical | 🔴 Critical | Key protection critical |

**Security Boundaries:**

**Phase 1 Scope (Current Implementation):**
- ✅ Encryption at rest using Fernet (AES-128-CBC with HMAC)
- ✅ Symmetric key stored in environment variables
- ✅ In-place migration with backward compatibility
- ✅ Per-environment encryption keys (dev, staging, production)
- ✅ Transparent encryption/decryption via SQLAlchemy

**Out of Scope (Phase 2 - Future Enhancements):**
- ⏳ Key rotation mechanism (planned)
- ⏳ GCP Secret Manager integration (planned)
- ⏳ Per-tenant encryption keys (under consideration)
- ⏳ Hardware Security Module (HSM) integration (under consideration)
- ⏳ External key management systems (AWS KMS, Azure Key Vault)
- ⏳ Audit logging of encryption/decryption operations

**Defense in Depth:**
While encryption at rest significantly improves security, it's important to note:
- If an attacker gains access to both the database and the encryption key, they can decrypt the data
- This solution is one layer in a comprehensive security strategy
- Continue to follow best practices: least privilege access, network security, monitoring, etc.

## Consequences

### Positive
- ✅ **Data Protection:** Sensitive tokens encrypted at rest in the database
- ✅ **Transparent Operation:** Encryption/decryption handled automatically by SQLAlchemy
- ✅ **No Schema Changes:** Existing columns and queries remain unchanged
- ✅ **Backward Compatible:** Graceful migration path with dual-mode support
- ✅ **Industry Standard:** Uses well-vetted cryptography library and algorithm
- ✅ **Compliance:** Helps meet security and compliance requirements (SOC 2, GDPR, etc.)

### Negative
- ⚠️ **Operational Burden:** Must securely manage encryption keys across environments
- ⚠️ **Key Loss Risk:** Losing the encryption key means permanent data loss
- ⚠️ **Performance Overhead:** Minimal but measurable (~1-2ms per encrypt/decrypt operation)
- ⚠️ **Backup Procedures:** Must ensure encryption keys are backed up securely
- ⚠️ **Migration Complexity:** Requires careful coordination during rollout

### Neutral
- ℹ️ **Environment Setup:** All environments must configure `DB_ENCRYPTION_KEY`
- ℹ️ **Migration Window:** Application will support both encrypted and plaintext during migration
- ℹ️ **Key Distribution:** Need process for securely distributing keys to new environments
- ℹ️ **Documentation:** Must document key generation, backup, and recovery procedures

## Implementation Plan

This ADR is part of a larger implementation plan broken into subtasks:

1. **✅ Subtask 1 (Issue #496):** Design & Documentation (this ADR)
2. **Subtask 2 (Issue #497):** Core Encryption Infrastructure
   - Create `EncryptedString` TypeDecorator
   - Add encryption utilities module
   - Write unit tests for encryption/decryption
3. **Subtask 3 (Issue #498):** Endpoint Model Encryption
   - Update `Endpoint` model to use `EncryptedString`
   - Update relevant CRUD operations
   - Write integration tests
4. **Subtask 4 (Issue #499):** Model Table Encryption
   - Update `Model` table to use `EncryptedString`
   - Update relevant CRUD operations
   - Write integration tests
5. **Subtask 5 (Issue #500):** Data Migration Script
   - Create migration script to encrypt existing data
   - Add rollback capability
   - Document migration procedure
6. **Subtask 6 (Issue #501):** Integration Testing & Documentation
   - End-to-end integration tests
   - Update developer documentation
   - Update deployment documentation

## Security Considerations

### Key Protection Best Practices

**Development Environment:**
- Store key in `.env` file (must be gitignored)
- Generate unique key per developer (not shared)
- Document key generation procedure in developer onboarding

**CI/CD Environment:**
- Store key in GitHub Secrets
- Limit access to repository secrets
- Rotate keys periodically

**Staging/Production Environment:**
- Use GCP Secret Manager or Kubernetes secrets
- Implement strict access controls (principle of least privilege)
- Enable audit logging for key access
- Document key backup and recovery procedures
- Test key recovery procedures periodically

### Key Backup and Recovery

**Critical Requirements:**
- Production encryption keys must be backed up to at least 2 secure locations
- Key backup procedure must be documented and tested quarterly
- Designated personnel must have access to key recovery procedures
- Include encryption keys in disaster recovery planning

**Recommended Approach:**
1. Store primary key in GCP Secret Manager (production)
2. Store backup key in separate secure location (e.g., encrypted vault)
3. Document key recovery procedure with step-by-step instructions
4. Include encryption key IDs in runbooks

### Monitoring and Alerting

**Key Metrics to Monitor:**
- Number of decryption failures (potential key mismatch)
- Presence of plaintext values in encrypted columns (during/after migration)
- Encryption key access patterns (after Secret Manager integration)
- Application errors related to encryption/decryption

**Recommended Alerts:**
- Alert on decryption failures exceeding threshold
- Alert on missing `DB_ENCRYPTION_KEY` environment variable
- Alert on plaintext values found post-migration

## Future Work

### Phase 2 Enhancements

**1. Key Rotation:**
Implement support for dual-key encryption to enable zero-downtime key rotation:
```python
# Support both current and previous key
OLD_KEY = os.getenv("DB_ENCRYPTION_KEY_OLD")
NEW_KEY = os.getenv("DB_ENCRYPTION_KEY")

def decrypt_with_fallback(value):
    try:
        return Fernet(NEW_KEY).decrypt(value)
    except InvalidToken:
        return Fernet(OLD_KEY).decrypt(value)  # Fall back to old key
```

**2. GCP Secret Manager Integration:**
Migrate from environment variables to GCP Secret Manager:
- Centralized secret management
- Automatic secret rotation
- Audit logging of secret access
- Version control for secrets
- Fine-grained IAM permissions

**3. Per-Tenant Encryption Keys:**
For enhanced security isolation:
- Each organization has its own encryption key
- Compromised key only affects single tenant
- Supports data residency requirements
- More complex key management

**4. Field-Level Encryption Extension:**
Apply encryption to additional sensitive fields:
- User PII (email addresses, phone numbers)
- Payment information
- Custom credentials
- Webhook URLs with embedded secrets

**5. Audit Logging:**
Track encryption operations:
- Log all decryption events
- Track key usage patterns
- Detect anomalous access patterns
- Support compliance auditing requirements

## References

- [Cryptography Library Documentation](https://cryptography.io/)
- [Fernet Specification](https://github.com/fernet/spec/)
- [SQLAlchemy TypeDecorator](https://docs.sqlalchemy.org/en/20/core/custom_types.html#sqlalchemy.types.TypeDecorator)
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [GCP Secret Manager Best Practices](https://cloud.google.com/secret-manager/docs/best-practices)

## Related Issues

- **Parent:** #495 Support for Encrypted Auth Tokens in DB
- **Blocks:** 
  - #497 Implement Core Encryption Infrastructure
  - #498 Add Encryption to Endpoint Model
  - #499 Add Encryption to Model Table
  - #500 Data Migration Script
  - #501 Integration Testing & Documentation

