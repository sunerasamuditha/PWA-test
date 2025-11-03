# WeCare Server Testing Suite

Comprehensive testing suite for WeCare PWA server API.

## Overview

This test suite provides comprehensive coverage for the WeCare PWA server, including:
- Unit tests for individual functions and utilities
- Integration tests for API endpoints
- End-to-end workflow tests
- Security and RBAC validation
- Performance and load testing
- Database integrity validation

## Test Structure

```
tests/
├── setup.js                    # Global test setup and utilities
├── seed-data.js                # Test data generation
├── package.json                # Test dependencies
├── api/                        # API endpoint tests
│   ├── auth.test.js
│   ├── patients.test.js
│   └── ...
├── workflows/                  # End-to-end workflow tests
│   ├── qr-referral.test.js
│   ├── document-management.test.js
│   └── invoice-payment.test.js
├── security/                   # Security tests
│   ├── rbac.test.js
│   ├── encryption.test.js
│   └── rate-limiting.test.js
└── audit/                      # Audit logging tests
    └── audit-coverage.test.js
```

## Setup

### Prerequisites

1. **Test Database**: Create a separate test database
   ```sql
   CREATE DATABASE wecare_test_db;
   ```

2. **Environment Variables**: Create `.env.test` file
   ```env
   # Test Database Configuration
   TEST_DB_HOST=localhost
   TEST_DB_USER=your_user
   TEST_DB_PASSWORD=your_password
   TEST_DB_NAME=wecare_test_db
   TEST_DB_PORT=3306
   
   # Security Keys (defaults provided for tests if not set)
   JWT_SECRET=test_secret_key_min_32_characters
   JWT_REFRESH_SECRET=test_refresh_secret_key_min_32_characters
   ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
   
   # Optional: Test Behavior Flags
   RUN_MIGRATIONS=true      # Auto-run migrations (auto-detected by default)
   SEED_TEST_DATA=false     # Disable global seeding (tests create own fixtures)
   ```

3. **Auto-Migration**: Migrations run automatically when:
   - Core tables don't exist (fresh DB detected)
   - `RUN_MIGRATIONS=true` is explicitly set
   - For CI/CD, always set `RUN_MIGRATIONS=true`

4. **Install Dependencies**
   ```bash
   cd server/tests
   npm install
   ```

## Test Database Isolation

**CRITICAL**: Tests automatically bind to a separate test database to prevent data loss:

- Environment variables `TEST_DB_*` are set BEFORE requiring the database module
- Fallback to `wecare_test_db` if no explicit test DB name provided
- All queries use the test database pool
- Truncation only affects the test database

**Never run tests against production database!**

## Running Tests

### All Tests
```bash
npm test
```

### Specific Test Categories
```bash
# API Integration Tests
npm run test:integration

# Workflow Tests
npm run test:workflows

# Security Tests
npm run test:security

# Audit Tests
npm run test:audit
```

### Watch Mode (Development)
```bash
npm run test:watch
```

### CI/CD Mode
```bash
npm run test:ci
```

### Individual Test Files
```bash
npx jest tests/api/auth.test.js
npx jest tests/workflows/qr-referral.test.js
```

## Test Database

The test suite uses a separate database (`wecare_test_db`) to ensure:
- Test isolation from development/production data
- Safe data manipulation during tests
- Consistent test environment

### Database Lifecycle

1. **Before All Tests**: 
   - Connect to test database
   - Run migrations (if needed)
   - Seed test data

2. **Before Each Test Suite**:
   - Truncate relevant tables
   - Create fresh test data

3. **After All Tests**:
   - Clean up uploaded files
   - Truncate all tables
   - Close database connections

## Test Utilities

The `setup.js` file provides helpful test utilities:

### User Creation
```javascript
const { createTestUser } = require('./setup');

// Create test user
const user = await createTestUser('patient', {
  email: 'test@example.com',
  full_name: 'Test User'
});
```

### Patient/Partner/Staff Creation
```javascript
const { createTestPatient, createTestPartner, createTestStaff } = require('./setup');

const patient = await createTestPatient();
const partner = await createTestPartner();
const staff = await createTestStaff();
```

### Authentication
```javascript
const { getAuthToken, getAdminToken } = require('./setup');

const token = await getAuthToken(userId);
const adminToken = await getAdminToken();
```

### Data Creation
```javascript
const { createTestAppointment, createTestInvoice, createTestDocument } = require('./setup');

const appointment = await createTestAppointment(patientUserId);
const invoice = await createTestInvoice(patientUserId, items);
const document = await createTestDocument(patientUserId);
```

### Cleanup
```javascript
const { truncateTable, resetDatabase } = require('./setup');

await truncateTable('Users');
await resetDatabase();
```

## Writing Tests

### Test Structure
```javascript
describe('Feature Name', () => {
  
  beforeEach(async () => {
    // Setup for each test
    await truncateTable('Users');
  });
  
  test('should do something', async () => {
    // Arrange
    const user = await createTestUser('patient');
    
    // Act
    const response = await request(app)
      .get('/api/endpoint')
      .set('Authorization', `Bearer ${user.accessToken}`);
    
    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
  });
  
});
```

### Best Practices

1. **Test Isolation**: Each test should be independent
   ```javascript
   beforeEach(async () => {
     await truncateTable('Users');
     await truncateTable('Patients');
   });
   ```

2. **Descriptive Names**: Use clear, descriptive test names
   ```javascript
   test('should return 401 when user is not authenticated', async () => {
     // ...
   });
   ```

3. **AAA Pattern**: Arrange, Act, Assert
   ```javascript
   test('should create user', async () => {
     // Arrange
     const userData = { email: 'test@test.com', password: 'Test@123' };
     
     // Act
     const response = await request(app).post('/api/auth/register').send(userData);
     
     // Assert
     expect(response.status).toBe(201);
   });
   ```

4. **Edge Cases**: Test edge cases and error conditions
   ```javascript
   test('should fail with invalid email format', async () => {
     // ...
   });
   
   test('should fail with missing required fields', async () => {
     // ...
   });
   ```

5. **Security**: Test for SQL injection, XSS, etc.
   ```javascript
   test('should sanitize against SQL injection', async () => {
     // ...
   });
   ```

## Coverage Reports

Coverage reports are generated in `./coverage` directory.

### View Coverage
```bash
npm test
# Open coverage/lcov-report/index.html in browser
```

### Coverage Thresholds
- Branches: 75%
- Functions: 75%
- Lines: 75%
- Statements: 75%

## Database Validation

Run database validation queries:
```bash
mysql -u root -p wecare_test_db < database-validation.sql
```

This will check:
- Foreign key integrity
- Data consistency
- JSON field validation
- Enum value validation
- Date constraints
- Duplicate detection
- Performance issues
- PWA-POS compatibility

## Troubleshooting

### Tests Timing Out
Increase timeout in jest config:
```javascript
testTimeout: 60000 // 60 seconds
```

### Database Connection Issues
1. Check `.env.test` configuration
2. Verify test database exists
3. Ensure migrations are run

### Test Data Issues
Reset database and reseed:
```bash
npm run migrate:test
npm test
```

### Port Conflicts
If server port is in use, change in test setup:
```javascript
const PORT = process.env.TEST_PORT || 3001;
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: test
          MYSQL_DATABASE: wecare_test_db
        ports:
          - 3306:3306
    
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run migrate:test
      - run: npm run test:ci
```

## Contributing

When adding new features:
1. Write tests first (TDD)
2. Ensure all tests pass
3. Maintain coverage thresholds
4. Update test documentation

---

## Related Documentation

### QA Testing Guides
- **[../TESTING_STRATEGY.md](../TESTING_STRATEGY.md)**: Overall testing strategy and framework
- **[../PWA_TESTING_GUIDE.md](../PWA_TESTING_GUIDE.md)**: Comprehensive PWA testing procedures (Lighthouse, service workers, offline mode, push notifications)
- **[../TEST_EXECUTION_REPORT.md](../TEST_EXECUTION_REPORT.md)**: Test execution report template for documenting test results

### Technical Validation Guides
- **[../DATABASE_VALIDATION.md](../DATABASE_VALIDATION.md)**: Database schema validation and SQL integrity checks
- **[../API_TEST_COLLECTION.md](../API_TEST_COLLECTION.md)**: API endpoint documentation and test cases
- **[../COMMISSION_VALIDATION.md](../COMMISSION_VALIDATION.md)**: Partner referral system validation
- **[../SECURITY_TESTING_STRATEGY.md](../SECURITY_TESTING_STRATEGY.md)**: Security testing procedures and RBAC validation

---

**Last Updated**: November 3, 2025
## Contact

For issues or questions about the test suite, contact the development team.
