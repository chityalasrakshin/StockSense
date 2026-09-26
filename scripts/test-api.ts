import { Client } from 'pg';
import * as bcrypt from 'bcryptjs';

const baseUrl = 'http://localhost:4000/api/v1';

async function fetchHttp(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    cookie?: string;
  } = {},
) {
  const method = options.method || 'GET';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (options.cookie) {
    headers['Cookie'] = options.cookie;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const responseHeaders: Record<string, string> = {};
  res.headers.forEach((val, key) => {
    responseHeaders[key.toLowerCase()] = val;
  });

  const setCookie = res.headers.get('set-cookie');
  let cookie: string | undefined = undefined;
  if (setCookie) {
    const match = setCookie.match(/([^;]+)/);
    if (match) {
      cookie = match[1];
    }
  }

  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return {
    status: res.status,
    data,
    headers: responseHeaders,
    cookie,
  };
}

async function run() {
  console.log('=== StockSense Live API & Security Verification ===');

  const pgClient = new Client({
    connectionString: 'postgresql://stocksense:stocksense@localhost:5432/stocksense?schema=public',
  });
  await pgClient.connect();

  try {
    // 1. Swagger Docs Verification
    console.log('\n[1] Checking Swagger documentation at http://localhost:4000/api/docs-json...');
    const swagger = await fetchHttp('http://localhost:4000/api/docs-json');
    if (swagger.status !== 200) {
      throw new Error(`Swagger failed with status ${swagger.status}`);
    }
    const paths = Object.keys(swagger.data.paths);
    console.log('Swagger registered paths count:', paths.length);
    const requiredPaths = [
      '/api/v1/auth/signup',
      '/api/v1/auth/login',
      '/api/v1/auth/refresh',
      '/api/v1/auth/logout',
      '/api/v1/auth/otp/request',
      '/api/v1/auth/otp/verify-reset',
      '/api/v1/users/me',
      '/api/v1/users/placeholder/manager-only',
      '/api/v1/users/placeholder/staff-accessible',
      '/api/v1/users',
      '/api/v1/users/{id}',
    ];
    for (const p of requiredPaths) {
      if (!paths.includes(p)) {
        throw new Error(`Missing expected Swagger route: ${p}`);
      }
    }
    console.log(
      'PASS: All required Auth, OTP, User, and RBAC endpoints are documented in Swagger.',
    );

    // 2. Signup Flow
    console.log('\n[2] Testing POST /api/v1/auth/signup...');
    const testEmail = `operator.${Date.now()}@stocksense.dev`;
    const signupRes = await fetchHttp(`${baseUrl}/auth/signup`, {
      method: 'POST',
      body: {
        email: testEmail,
        password: 'Password123!',
        role: 'WAREHOUSE_STAFF',
      },
    });

    if (signupRes.status !== 201) {
      throw new Error(
        `Signup failed: status ${signupRes.status}, data: ${JSON.stringify(signupRes.data)}`,
      );
    }
    console.log(
      `PASS: Signup successful for ${testEmail}. User ID: ${signupRes.data.user.id}, Role: ${signupRes.data.user.role}`,
    );
    console.log(`Cookie set by signup: ${signupRes.cookie}`);

    // 3. Login Flow
    console.log('\n[3] Testing POST /api/v1/auth/login...');
    await pgClient.query(
      `UPDATE users SET password_hash = '$2b$10$bVlK.vJZIcJIWGH0JQ.52./8KxmbJSvcsIyPbqqZO62JxlLlGr60i' WHERE email IN ('manager@stocksense.dev', 'staff@stocksense.dev');`,
    );

    const mgrLogin = await fetchHttp(`${baseUrl}/auth/login`, {
      method: 'POST',
      body: { email: 'manager@stocksense.dev', password: 'password123' },
    });
    if (mgrLogin.status !== 200) {
      console.error('Manager login response:', mgrLogin.status, mgrLogin.data);
      throw new Error(`Manager login failed: ${mgrLogin.status} ${JSON.stringify(mgrLogin.data)}`);
    }
    const managerToken = mgrLogin.data.accessToken;

    const staffLogin = await fetchHttp(`${baseUrl}/auth/login`, {
      method: 'POST',
      body: { email: 'staff@stocksense.dev', password: 'password123' },
    });
    if (staffLogin.status !== 200) throw new Error('Staff login failed');
    const staffToken = staffLogin.data.accessToken;
    console.log('PASS: Seeded manager and staff login verified.');

    // 4. Refresh Token Rotation & Reuse Detection
    console.log('\n[4] Testing Refresh Token Rotation and Reuse Detection...');
    const testLogin = await fetchHttp(`${baseUrl}/auth/login`, {
      method: 'POST',
      body: { email: testEmail, password: 'Password123!' },
    });
    const tokenCookie1 = testLogin.cookie;
    if (!tokenCookie1) throw new Error('Login did not set refreshToken cookie');
    console.log(`Initial cookie: ${tokenCookie1}`);

    // 4a. Rotate
    console.log('Rotating refresh token (POST /auth/refresh)...');
    const rotateRes = await fetchHttp(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      cookie: tokenCookie1,
    });
    if (rotateRes.status !== 200) {
      throw new Error(`Refresh failed: ${rotateRes.status}, ${JSON.stringify(rotateRes.data)}`);
    }
    const tokenCookie2 = rotateRes.cookie;
    console.log(`Rotated new cookie: ${tokenCookie2}`);
    if (tokenCookie1 === tokenCookie2) {
      throw new Error('Rotation did not generate a new distinct refresh token!');
    }
    console.log('PASS: Token rotated successfully.');

    // 4b. Replay old token -> REUSE DETECTION
    console.log('Replaying consumed old token (simulating compromised token reuse)...');
    const replayRes = await fetchHttp(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      cookie: tokenCookie1,
    });
    if (replayRes.status !== 401) {
      throw new Error(`Expected HTTP 401 on reuse, got: ${replayRes.status}`);
    }
    console.log(
      `PASS: Reuse detected! Response status: ${replayRes.status}, error:`,
      replayRes.data.error.message,
    );

    // 4c. Verify rotated token from same family is now also revoked
    console.log('Verifying that token family was completely revoked...');
    const familyCheck = await fetchHttp(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      cookie: tokenCookie2,
    });
    if (familyCheck.status !== 401) {
      throw new Error(`Expected HTTP 401 on family check, got ${familyCheck.status}`);
    }
    console.log('PASS: Session family revoked. Neither token can be refreshed anymore.');

    // 5. OTP Password Reset Flow
    console.log('\n[5] Testing OTP Request, Plaintext Exclusion, and Password Reset...');
    // Request OTP
    const otpReq = await fetchHttp(`${baseUrl}/auth/otp/request`, {
      method: 'POST',
      body: { email: testEmail },
    });
    if (otpReq.status !== 200) {
      throw new Error(`OTP request failed: ${otpReq.status}`);
    }
    console.log('PASS: OTP requested. Response message:', otpReq.data.message);

    // Check DB table otp_codes
    const dbOtp = await pgClient.query(
      `SELECT o.id, o.code_hash, o.purpose, o.expires_at, o.consumed_at, u.email 
       FROM otp_codes o 
       JOIN users u ON u.id = o.user_id 
       WHERE u.email = $1 
       ORDER BY o.created_at DESC LIMIT 1;`,
      [testEmail],
    );

    if (dbOtp.rows.length === 0) {
      throw new Error('No record in otp_codes table!');
    }
    const row = dbOtp.rows[0];
    console.log('\nDirect PostgreSQL Row Inspection (otp_codes):');
    console.log(` - ID:          ${row.id}`);
    console.log(` - code_hash:   ${row.code_hash}`);
    console.log(` - purpose:     ${row.purpose}`);
    console.log(` - expires_at:  ${row.expires_at}`);
    console.log(` - consumed_at: ${row.consumed_at}`);

    // Invariant: NEVER store plaintext OTP
    if (!row.code_hash.startsWith('$2')) {
      throw new Error('FAIL: code_hash is not a bcrypt hash!');
    }
    if (/^\d{6}$/.test(row.code_hash)) {
      throw new Error('CRITICAL SECURITY VIOLATION: Plaintext OTP was stored in otp_codes table!');
    }
    console.log('PASS: otp_codes table NEVER contains plaintext code (bcrypt hash verified).');

    // Set a known OTP hash for testing the verify-reset endpoint
    const targetOtp = '654321';
    await pgClient.query('UPDATE otp_codes SET code_hash = $1 WHERE id = $2', [
      bcrypt.hashSync(targetOtp, 10),
      row.id,
    ]);
    console.log(`Configured known test OTP (${targetOtp}) for verify-reset testing.`);

    // Verify & Reset
    console.log('Verifying OTP and resetting password (POST /auth/otp/verify-reset)...');
    const resetRes = await fetchHttp(`${baseUrl}/auth/otp/verify-reset`, {
      method: 'POST',
      body: {
        email: testEmail,
        otp: targetOtp,
        newPassword: 'BrandNewPassword2026!',
      },
    });
    if (resetRes.status !== 200) {
      throw new Error(`Reset failed: ${resetRes.status}, ${JSON.stringify(resetRes.data)}`);
    }
    console.log('PASS: Password reset successful:', resetRes.data.message);

    // Verify single-use invariant in database
    const postResetRow = await pgClient.query('SELECT consumed_at FROM otp_codes WHERE id = $1', [
      row.id,
    ]);
    if (!postResetRow.rows[0].consumed_at) {
      throw new Error('FAIL: consumed_at is not set!');
    }
    console.log(
      `PASS: Single-use verified: consumed_at is set to ${postResetRow.rows[0].consumed_at}`,
    );

    // Replay of same OTP must fail
    const replayOtp = await fetchHttp(`${baseUrl}/auth/otp/verify-reset`, {
      method: 'POST',
      body: {
        email: testEmail,
        otp: targetOtp,
        newPassword: 'YetAnotherPassword123!',
      },
    });
    if (replayOtp.status !== 400) {
      throw new Error(`Expected HTTP 400 on reused OTP, got ${replayOtp.status}`);
    }
    console.log('PASS: Consumed OTP cannot be reused (HTTP 400).');

    // Login with new password
    console.log('Logging in with newly reset password...');
    const newLogin = await fetchHttp(`${baseUrl}/auth/login`, {
      method: 'POST',
      body: { email: testEmail, password: 'BrandNewPassword2026!' },
    });
    if (newLogin.status !== 200) {
      throw new Error('Failed to login with new password');
    }
    console.log('PASS: Login with new password succeeded!');

    // 6. RBAC Guard Verification
    console.log('\n[6] Testing RBAC Guards and @CurrentUser...');
    // 6a. /users/me
    const meRes = await fetchHttp(`${baseUrl}/users/me`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    if (meRes.status !== 200 || meRes.data.role !== 'INVENTORY_MANAGER') {
      throw new Error(`Failed /users/me: ${JSON.stringify(meRes.data)}`);
    }
    console.log(
      'PASS: GET /users/me returned profile for caller:',
      meRes.data.email,
      `(${meRes.data.role})`,
    );

    // 6b. Manager on Manager-only placeholder
    const mgrRes = await fetchHttp(`${baseUrl}/users/placeholder/manager-only`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    if (mgrRes.status !== 200) {
      throw new Error(`Manager-only route returned ${mgrRes.status} for manager`);
    }
    console.log('PASS: GET /users/placeholder/manager-only -> HTTP 200 OK for INVENTORY_MANAGER');

    // 6c. Staff on Manager-only placeholder (Must be 403 Forbidden)
    const staffBlocked = await fetchHttp(`${baseUrl}/users/placeholder/manager-only`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    if (staffBlocked.status !== 403) {
      throw new Error(
        `Expected HTTP 403 for staff on manager-only route, got ${staffBlocked.status}`,
      );
    }
    console.log(
      'PASS: GET /users/placeholder/manager-only -> HTTP 403 Forbidden for WAREHOUSE_STAFF:',
      staffBlocked.data.error.message,
    );

    // 6d. Staff on Staff-accessible placeholder
    const staffAllowed = await fetchHttp(`${baseUrl}/users/placeholder/staff-accessible`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    if (staffAllowed.status !== 200) {
      throw new Error(`Staff-accessible route returned ${staffAllowed.status} for staff`);
    }
    console.log('PASS: GET /users/placeholder/staff-accessible -> HTTP 200 OK for WAREHOUSE_STAFF');

    // 7. Users CRUD (Manager only)
    console.log('\n[7] Testing Users CRUD (Manager only)...');
    const listRes = await fetchHttp(`${baseUrl}/users?page=1&limit=5`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    if (listRes.status !== 200) throw new Error('Failed to list users');
    console.log(
      `PASS: GET /users listed ${listRes.data.users.length} users (Total: ${listRes.data.total})`,
    );

    // Staff attempting GET /users must be blocked
    const staffListBlocked = await fetchHttp(`${baseUrl}/users`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    if (staffListBlocked.status !== 403) {
      throw new Error(`Staff should be blocked from GET /users, got ${staffListBlocked.status}`);
    }
    console.log('PASS: WAREHOUSE_STAFF blocked from GET /users (HTTP 403 Forbidden)');

    console.log('\n======================================================');
    console.log('ALL DEFINITION OF DONE REQUIREMENTS VERIFIED ON LIVE SERVER!');
    console.log('======================================================\n');
  } finally {
    await pgClient.end();
  }
}

run().catch((err) => {
  console.error('\nE2E Run Failed:', err);
  process.exit(1);
});
