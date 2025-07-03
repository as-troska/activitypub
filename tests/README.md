# Test Suite for Sneaas.no ActivityPub Implementation

This directory contains comprehensive unit and integration tests for the ActivityPub implementation.

## Test Structure

### Unit Tests
- **`middleware.test.js`** - Tests for authentication, content-type validation, activity type validation, actor verification, and signature checking
- **`inbox.test.js`** - Tests for inbox functionality including Follow, Like, Create, Delete, Undo activities
- **`outbox.test.js`** - Tests for outbox functionality and activity publishing
- **`wellKnown.test.js`** - Tests for webfinger and nodeinfo endpoints
- **`followers.test.js`** - Tests for followers collection and follower refresh functionality

### Integration Tests
- **`app.integration.test.js`** - End-to-end API testing for all endpoints

### Test Infrastructure
- **`setup.js`** - Test environment configuration with in-memory MongoDB
- **`jest.config.js`** - Jest configuration
- **`README.md`** - This file

## Running Tests

### Prerequisites
Make sure you have the necessary dependencies installed:

```bash
npm install
```

### Running All Tests
```bash
npm test
```

### Running Tests in Watch Mode
```bash
npm run test:watch
```

### Running Tests with Coverage
```bash
npm run test:coverage
```

### Running Specific Test Files
```bash
# Run only middleware tests
npx jest middleware.test.js

# Run only integration tests
npx jest app.integration.test.js

# Run tests matching a pattern
npx jest --testNamePattern="webfinger"
```

## Test Environment

The tests use:
- **Jest** as the testing framework
- **Supertest** for HTTP endpoint testing
- **MongoDB Memory Server** for in-memory database testing
- **Comprehensive mocking** for external dependencies (fetch, file system, etc.)

### Environment Variables
The test setup automatically configures these environment variables:
- `MONGOURI` - Points to the in-memory MongoDB instance
- `PASSWORD` - Set to 'test-password' for authentication tests
- `NODE_ENV` - Set to 'test'

## Test Coverage

The test suite covers:

### ✅ Covered Functionality
- **Middleware functions** - Content validation, authentication, signature verification
- **ActivityPub inbox** - All major activity types (Follow, Like, Create, Delete, Undo, etc.)
- **ActivityPub outbox** - Activity publishing and federation delivery
- **Webfinger endpoints** - User discovery and nodeinfo
- **Collections** - Followers, following, inbox, outbox endpoints
- **Error handling** - Database errors, network failures, validation errors
- **Edge cases** - Missing data, invalid formats, authentication failures

### 🔧 Test Features
- **Isolated testing** - Each test is independent with fresh database state
- **Mocked dependencies** - External HTTP calls, database connections, file system
- **Comprehensive assertions** - Verifies both success and failure cases
- **Activity validation** - Ensures ActivityPub protocol compliance
- **Federation testing** - Verifies proper activity delivery to remote servers

## Writing New Tests

When adding new functionality, please include tests that cover:

1. **Happy path scenarios** - Normal operation with valid inputs
2. **Error scenarios** - Invalid inputs, network failures, database errors
3. **Edge cases** - Missing fields, unexpected data types, boundary conditions
4. **Security aspects** - Authentication, authorization, input validation

### Test File Naming Convention
- Unit tests: `[module-name].test.js`
- Integration tests: `[feature-name].integration.test.js`

### Mock Usage
Most external dependencies are mocked in the `setup.js` file. For module-specific mocks, use Jest's `jest.mock()` at the top of test files.

## Debugging Tests

### Running with Debug Output
```bash
# Enable verbose output
npx jest --verbose

# Run specific test with debug logs
npx jest --testNamePattern="specific test name" --verbose
```

### Common Issues
1. **Async test timeouts** - Increase timeout in Jest config if needed
2. **Mock state** - Ensure mocks are cleared between tests with `jest.clearAllMocks()`
3. **Database state** - Database is automatically cleaned between tests
4. **Network mocks** - Verify fetch mocks are properly configured for your test scenarios

## Test Data

Tests use realistic ActivityPub data structures to ensure protocol compliance. Mock data includes:
- Valid ActivityPub actors with proper @context
- Properly formatted activities (Create, Follow, Like, etc.)
- ActivityStreams collections
- Webfinger responses

This ensures tests accurately reflect real-world ActivityPub federation scenarios.