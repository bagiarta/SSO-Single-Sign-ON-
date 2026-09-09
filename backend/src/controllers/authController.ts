import { Request, Response } from 'express';
import { query } from '../database/connection';
import { logger } from '../utils/logger';
import { parseDeviceInfo } from '../utils/deviceParser';
import { createAuditLog } from './providerController';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { triggerBackchannelLogout } from './sessionController';

const JWT_SECRET: string = (process.env['JWT_SECRET'] || 'your-super-secret-jwt-key-change-in-production') as string;
const JWT_EXPIRES_IN = '1h'; // Access token validity
const AUTH_CODE_EXPIRES_IN_MINUTES = 5;

/**
 * Helper to generate random string
 */
function generateRandomCode(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * 1. Login endpoint (For End-User UI)
 * Authenticates user credentials against the local database and returns a short-lived session token
 * or an authorization code if client_id and redirect_uri were provided.
 */
export async function login(req: Request, res: Response) {
  try {
    const { nip, password, client_id, redirect_uri } = req.body;

    if (!nip || !password) {
      return res.status(400).json({ error: 'NIP and password are required' });
    }

    // Find user
    const userResult = await query(
      'SELECT id, nip, email, username, password_hash, status, locked_until, failed_login_attempts, allow_dashboard_access FROM users WHERE nip = $1',
      [nip]
    );

    if (userResult.rows.length === 0) {
      // Return generic error for security
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // Check status
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is disabled or suspended' });
    }

    // Check SSO Dashboard access restriction
    // If client_id is not provided, this is a login to the SSO Dashboard itself
    if (!client_id && user.allow_dashboard_access === false) {
      return res.status(403).json({ error: 'Anda tidak memiliki izin untuk masuk ke SSO Admin Dashboard.' });
    }

    // Check lockout
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(403).json({ error: 'Account is temporarily locked due to too many failed attempts' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      // Increment failed attempts
      const failedAttempts = (user.failed_login_attempts || 0) + 1;
      let lockedUntil = null;
      if (failedAttempts >= 5) {
        // Lock for 15 minutes
        const lockDate = new Date();
        lockDate.setMinutes(lockDate.getMinutes() + 15);
        lockedUntil = lockDate;
      }

      await query(
        'UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3',
        [failedAttempts, lockedUntil, user.id]
      );

      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Success login. Reset failed attempts
    await query(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = GETDATE() WHERE id = $1',
      [user.id]
    );

    // 1. Create a global session
    const sessionToken = jwt.sign(
      { sub: user.id, nip: user.nip, email: user.email, username: user.username },
      JWT_SECRET as string,
      { expiresIn: '24h' }
    );

    // Set HttpOnly cookie for auto-login / SSO
    res.cookie('sso_session', sessionToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    const userAgent = req.headers['user-agent'] || '';
    const deviceInfo = parseDeviceInfo(userAgent);
    const clientIp = req.ip || req.socket?.remoteAddress || '';
    const sessionId = uuidv4();

    try {
      // Keep one active SSO session per user and client application.
      // A new login replaces the previous session in the same application,
      // while the same user may remain logged in to other applications.
      const previousSessions = await query(
        `SELECT id FROM active_sessions
         WHERE user_id = $1 AND is_revoked = 0 AND expires_at > GETDATE()
           AND ISNULL(client_id, '') = ISNULL($2, '')`,
        [user.id, client_id || null]
      );

      // Notify the client before revoking the old sessions so it can clear
      // its own local cookie/session immediately.
      for (const previousSession of previousSessions.rows) {
        await triggerBackchannelLogout(previousSession.id);
        await createAuditLog(
          'SESSION_REVOKE',
          user.id,
          'active_sessions',
          'force_close_session',
          'success',
          {
            session_id: previousSession.id,
            reason: 'new_login_same_client',
            client_id: client_id || null,
          },
          clientIp,
          userAgent,
          deviceInfo
        );
      }

      await query(
        `UPDATE active_sessions
         SET is_revoked = 1
         WHERE user_id = $1
           AND is_revoked = 0
           AND expires_at > GETDATE()
           AND ISNULL(client_id, '') = ISNULL($2, '')`,
        [user.id, client_id || null]
      );

      await query(
        `INSERT INTO active_sessions (id, user_id, token_hash, ip_address, user_agent, device_info, expires_at, client_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [sessionId, user.id, tokenHash, clientIp, userAgent, deviceInfo, expiresAt, client_id || null]
      );
    } catch (sessionErr: any) {
      logger.error('Failed to save session', { error: sessionErr.message });
      // Non-blocking: login still succeeds
    }

    // 2. Audit log for login
    await createAuditLog(
      'USER_LOGIN',
      user.id,
      'auth',
      'login',
      'success',
      { message: `User ${user.nip} logged in` },
      clientIp,
      userAgent,
      deviceInfo
    );

    // 3. If OIDC parameters are provided, return an auth code immediately to skip /authorize
    if (client_id && redirect_uri) {
      // Validate client
      const clientResult = await query(
        'SELECT id, redirect_uris, access_type FROM client_applications WHERE client_id = $1 AND status = \'active\'',
        [client_id]
      );

      if (clientResult.rows.length > 0) {
        const clientApp = clientResult.rows[0];
        const clientAppId = clientApp.id;
        
        // Verify user is allowed to access this application
        let isAllowed = false;
        
        if (clientApp.access_type === 'public') {
          isAllowed = true;
        } else {
          const allowedCheck = await query(`
            SELECT 1 
            FROM group_allowed_applications gaa
            JOIN user_groups ug ON gaa.group_id = ug.group_id
            WHERE ug.user_id = $1 AND gaa.client_app_id = $2
          `, [user.id, clientAppId]);
          
          isAllowed = allowedCheck.rows.length > 0;
        }

        if (!isAllowed) {
          // Log auditing entry of unauthorized attempt
          await createAuditLog(
            'USER_LOGIN_UNAUTHORIZED_APP',
            user.id,
            'auth',
            'login',
            'failure',
            { error: 'User is not allowed to access this application', client_id },
            clientIp,
            userAgent,
            deviceInfo
          );
          return res.status(403).json({ error: 'Access Denied: You do not have permission to access this application. Please contact your administrator.' });
        }
        let allowedUris: string[] = [];
        try {
          allowedUris = JSON.parse(clientResult.rows[0].redirect_uris);
        } catch {
          allowedUris = [clientResult.rows[0].redirect_uris];
        }

        if (allowedUris.includes(redirect_uri)) {
          // Issue Auth Code linked to the active session ID
          const authCode = generateRandomCode();
          const authCodeExpires = new Date();
          authCodeExpires.setMinutes(authCodeExpires.getMinutes() + AUTH_CODE_EXPIRES_IN_MINUTES);

          await query(
            `INSERT INTO authorization_codes (code, client_id, user_id, redirect_uri, expires_at, session_id)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [authCode, client_id, user.id, redirect_uri, authCodeExpires, sessionId]
          );

          return res.json({ 
            success: true, 
            redirect_to: `${redirect_uri}?code=${authCode}` 
          });
        }
      }
    }


    // Default: Return dashboard login response
    return res.json({ success: true, token: sessionToken, user: { id: user.id, nip: user.nip, email: user.email, username: user.username } });

  } catch (error: any) {
    logger.error('Login error', { error: error.message });
    return res.status(500).json({ error: 'Internal server error during login' });
  }
}

/**
 * 1b. Logout endpoint
 * Clears the sso_session HttpOnly cookie so the user is no longer auto-logged-in
 * across SSO-connected applications on this device.
 */
export async function logout(req: Request, res: Response) {
  try {
    const sessionCookie = req.cookies ? req.cookies['sso_session'] : undefined;

    if (sessionCookie) {
      try {
        const decoded = jwt.verify(sessionCookie, JWT_SECRET as string) as any;
        // Revoke all active DB sessions for this user so the token cannot be reused
        await query(
          `UPDATE active_sessions SET is_revoked = 1 WHERE user_id = $1 AND is_revoked = 0`,
          [decoded.sub]
        );
      } catch {
        // Cookie may be expired/invalid – still clear it
      }
    }

    // Clear the SSO session cookie from the browser
    res.clearCookie('sso_session', {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return res.json({ success: true, message: 'Logged out successfully' });
  } catch (error: any) {
    logger.error('Logout error', { error: error.message });
    return res.status(500).json({ error: 'Internal server error during logout' });
  }
}

/**
 * 2. Authorize endpoint (GET)
 * Validates the client request. Normally redirects to login if no session.
 */
export async function authorize(req: Request, res: Response) {
  try {
    console.log('[AUTHORIZE DEBUG] Received Cookies:', req.cookies);
    const client_id = req.query['client_id'] as string;
    const redirect_uri = req.query['redirect_uri'] as string;
    const state = req.query['state'] as string;
    
    if (!client_id || !redirect_uri) {
      return res.status(400).json({ error: 'client_id and redirect_uri are required' });
    }

    const clientResult = await query(
      'SELECT id, redirect_uris, name, access_type FROM client_applications WHERE client_id = $1 AND status = \'active\'',
      [client_id]
    );

    if (clientResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or disabled client_id' });
    }

    let allowedUris: string[] = [];
    try {
      allowedUris = JSON.parse(clientResult.rows[0].redirect_uris);
    } catch {
      allowedUris = [clientResult.rows[0].redirect_uris];
    }

    if (!allowedUris.includes(redirect_uri)) {
      return res.status(400).json({ error: 'redirect_uri does not match registered URIs' });
    }

    // Check for existing SSO session via HttpOnly cookie (auto-login)
    const sessionCookie = req.cookies ? req.cookies['sso_session'] : undefined;
    
    // If we receive prompt=login, force authentication even if there is a session
    const prompt = req.query['prompt'] as string;

    let ssoDebugError = '';

    if (sessionCookie && prompt !== 'login') {
      try {
        const decoded = jwt.verify(sessionCookie, JWT_SECRET as string) as any;
        const userId = decoded.sub;

        // Verify the user still has an active session in the database
        const activeSessionResult = await query(
          `SELECT id FROM active_sessions WHERE user_id = $1 AND is_revoked = 0 AND expires_at > GETDATE() ORDER BY expires_at DESC`,
          [userId]
        );

        if (activeSessionResult.rows.length > 0) {
          const activeSessionId = activeSessionResult.rows[0].id;
          
          // Verify user is allowed to access this application
          let isAllowed = false;
          
          if (clientResult.rows[0].access_type === 'public') {
            isAllowed = true;
          } else {
            const allowedCheck = await query(`
              SELECT 1 
              FROM group_allowed_applications gaa
              JOIN user_groups ug ON gaa.group_id = ug.group_id
              WHERE ug.user_id = $1 AND gaa.client_app_id = $2
            `, [userId, clientResult.rows[0].id]);
            
            isAllowed = allowedCheck.rows.length > 0;
          }

          if (!isAllowed) {
            // Log auditing entry of unauthorized attempt
            await createAuditLog(
              'USER_LOGIN_UNAUTHORIZED_APP',
              userId,
              'auth',
              'authorize',
              'failure',
              { error: 'User is not allowed to access this application via active session auto-login', client_id }
            );

            // User is not allowed, we shouldn't log them in automatically
            // Redirect to login with error, or just show error page.
            // A simple redirect with error param:
            const errorUrl = new URL(redirect_uri);
            errorUrl.searchParams.append('error', 'access_denied');
            errorUrl.searchParams.append('error_description', 'You do not have access to this application');
            if (state) errorUrl.searchParams.append('state', state);
            return res.redirect(errorUrl.toString());
          }

          const authCode = generateRandomCode();
          const authCodeExpires = new Date();
          authCodeExpires.setMinutes(authCodeExpires.getMinutes() + AUTH_CODE_EXPIRES_IN_MINUTES);

          await query(
            `INSERT INTO authorization_codes (code, client_id, user_id, redirect_uri, expires_at, session_id)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [authCode, client_id, userId, redirect_uri, authCodeExpires, activeSessionId]
          );

          const redirectUrl = new URL(redirect_uri);
          redirectUrl.searchParams.append('code', authCode);
          if (state) redirectUrl.searchParams.append('state', state);
          
          return res.redirect(redirectUrl.toString());
        } else {
          ssoDebugError = 'no_active_session_in_db';
        }
      } catch (err: any) {
        // Cookie invalid, expired, or no active DB session. Fall through to login page.
        logger.info('Auto-login failed: Invalid session cookie or no active DB session.');
        logger.error('Auto-login error details:', err);
        ssoDebugError = err.message || 'jwt_verification_failed';
      }
    } else {
      if (!sessionCookie) ssoDebugError = 'no_cookie_received';
      else if (prompt === 'login') ssoDebugError = 'prompt_login_forced';
    }

    // Redirect to the frontend login page, passing the parameters
    const host = req.headers.host || '';
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    let frontendBase = process.env['REACT_APP_FRONTEND_URL'] || 'http://localhost:3000';

    if (!host.includes(':3000') && !host.includes(':3003')) {
      // Accessed through the Pepinet proxy gateway (like port 10130)
      frontendBase = `${protocol}://${host}/sso`;
    }

    const loginUrl = new URL(`${frontendBase}/login`);
    loginUrl.searchParams.append('client_id', client_id);
    loginUrl.searchParams.append('redirect_uri', redirect_uri);
    loginUrl.searchParams.append('app_name', clientResult.rows[0].name);
    if (state) loginUrl.searchParams.append('state', state);
    if (ssoDebugError) loginUrl.searchParams.append('sso_debug_error', ssoDebugError);

    return res.redirect(loginUrl.toString());

  } catch (error: any) {
    logger.error('Authorize error', { error: error.message });
    
    // HACK: Fallback to login if something fails during SSO authorize
    // Should ideally show an error page, but for seamless UX, force re-login
    const host = req.headers.host || '';
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    let frontendBase = process.env['REACT_APP_FRONTEND_URL'] || 'http://localhost:3000';

    if (!host.includes(':3000') && !host.includes(':3003')) {
      frontendBase = `${protocol}://${host}/sso`;
    }

    const loginUrl = new URL(`${frontendBase}/login`);
    const client_id = req.query['client_id'] as string;
    const redirect_uri = req.query['redirect_uri'] as string;
    const state = req.query['state'] as string;
    
    if (client_id) loginUrl.searchParams.append('client_id', client_id);
    if (redirect_uri) loginUrl.searchParams.append('redirect_uri', redirect_uri);
    if (state) loginUrl.searchParams.append('state', state);

    return res.redirect(loginUrl.toString());
  }
}

/**
 * 3. Token endpoint (POST)
 * Exchanges authorization code for an access_token and id_token.
 */
export async function token(req: Request, res: Response) {
  try {
    const { grant_type, code, client_id, client_secret, redirect_uri } = req.body;

    if (grant_type !== 'authorization_code') {
      return res.status(400).json({ error: 'unsupported_grant_type' });
    }

    if (!code || !client_id || !client_secret || !redirect_uri) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'Missing required parameters' });
    }

    // Authenticate Client
    const clientResult = await query(
      'SELECT id FROM client_applications WHERE client_id = $1 AND client_secret = $2 AND status = \'active\'',
      [client_id, client_secret]
    );

    if (clientResult.rows.length === 0) {
      return res.status(401).json({ error: 'invalid_client' });
    }

    // Verify Code
    const codeResult = await query(
      'SELECT id, user_id, expires_at, is_used, redirect_uri, session_id FROM authorization_codes WHERE code = $1 AND client_id = $2',
      [code, client_id]
    );

    if (codeResult.rows.length === 0) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid authorization code' });
    }

    const authCode = codeResult.rows[0];

    if (authCode.is_used) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'Authorization code already used' });
    }

    if (new Date() > new Date(authCode.expires_at)) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'Authorization code expired' });
    }

    if (authCode.redirect_uri !== redirect_uri) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'Redirect URI mismatch' });
    }

    // The user may have logged in again from another device after this code
    // was issued. Do not mint a new token from a revoked SSO session.
    const sessionResult = await query(
      `SELECT id FROM active_sessions
       WHERE id = $1 AND user_id = $2 AND is_revoked = 0 AND expires_at > GETDATE()`,
      [authCode.session_id, authCode.user_id]
    );
    if (sessionResult.rows.length === 0) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'SSO session is no longer active' });
    }

    // Mark code as used
    await query('UPDATE authorization_codes SET is_used = 1 WHERE id = $1', [authCode.id]);

    // Fetch user details for tokens
    const userResult = await query(
      'SELECT id, nip, email, username, first_name, last_name FROM users WHERE id = $1 AND deleted_at IS NULL',
      [authCode.user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'invalid_grant', error_description: 'User not found or deleted' });
    }

    const user = userResult.rows[0];

    // Generate Access Token (JWT)
    const access_token = jwt.sign(
      { sub: user.id, aud: client_id, sid: authCode.session_id, type: 'access' },
      JWT_SECRET as string,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Generate ID Token (JWT OIDC)
    const id_token = jwt.sign(
      { 
        sub: user.id, 
        aud: client_id, 
        sid: authCode.session_id,
        nip: user.nip,
        email: user.email,
        preferred_username: user.username,
        given_name: user.first_name,
        family_name: user.last_name,
        type: 'id'
      },
      JWT_SECRET as string,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.json({
      access_token,
      token_type: 'Bearer',
      expires_in: 3600,
      id_token,
      sid: authCode.session_id
    });

  } catch (error: any) {
    logger.error('Token endpoint error', { error: error.message });
    return res.status(500).json({ error: 'server_error' });
  }
}

/**
 * 4. UserInfo endpoint (GET)
 * Returns claims about the authenticated end-user.
 */
export async function userinfo(req: Request, res: Response) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized', error_description: 'Missing Bearer token' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized', error_description: 'Malformed Bearer token' });
    }

    // Verify token
    let decoded: any;
    try {
      decoded = jwt.verify(token, String(JWT_SECRET));
    } catch (err) {
      return res.status(401).json({ error: 'invalid_token' });
    }

    if (decoded.type !== 'access') {
      return res.status(401).json({ error: 'invalid_token', error_description: 'Provided token is not an access token' });
    }

    // JWT signature validity alone is not enough: the backing SSO session may
    // have been revoked because the user logged in again to the same client.
    const sessionResult = await query(
      `SELECT id FROM active_sessions
       WHERE id = $1 AND user_id = $2 AND is_revoked = 0 AND expires_at > GETDATE()`,
      [decoded.sid, decoded.sub]
    );
    if (sessionResult.rows.length === 0) {
      return res.status(401).json({ error: 'invalid_token', error_description: 'SSO session has been revoked or expired' });
    }

    const userId = decoded.sub;

    const userResult = await query(
      `SELECT u.id, u.nip, u.email, u.username, u.first_name, u.last_name, 
              (SELECT STRING_AGG(r.name, ',') FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = u.id) as roles
       FROM users u WHERE u.id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    return res.json({
      sub: user.id,
      nip: user.nip,
      email: user.email,
      preferred_username: user.username,
      given_name: user.first_name,
      family_name: user.last_name,
      roles: user.roles ? user.roles.split(',') : []
    });

  } catch (error: any) {
    logger.error('UserInfo endpoint error', { error: error.message });
    return res.status(500).json({ error: 'server_error' });
  }
}

/**
 * 5. Forgot Password endpoint
 */
export async function forgotPassword(_req: Request, res: Response) {
  return res.status(403).json({ error: 'Reset password hanya dapat dilakukan oleh Administrator SSO. Silakan hubungi administrator Anda.' });
}

/**
 * 6. Reset Password endpoint
 */
export async function resetPassword(_req: Request, res: Response) {
  return res.status(403).json({ error: 'Reset password hanya dapat dilakukan oleh Administrator SSO.' });
}
