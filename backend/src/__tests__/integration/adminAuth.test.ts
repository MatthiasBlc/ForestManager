import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import {
  createTestAdmin,
  createTestAdminWithoutTotp,
  extractSessionCookie,
  generateTotpCode,
} from '../setup/testHelpers';

describe('Admin Auth API', () => {
  // =====================================
  // POST /api/admin/auth/login (Step 1)
  // =====================================
  describe('POST /api/admin/auth/login', () => {
    it('should return TOTP required for admin with TOTP already configured', async () => {
      const admin = await createTestAdmin({
        email: 'admin@example.com',
        password: 'AdminTest123!',
      });

      const res = await request(app)
        .post('/api/admin/auth/login')
        .send({
          email: admin.email,
          password: admin.password,
        });

      expect(res.status).toBe(200);
      expect(res.body.requiresTotpSetup).toBe(false);
      expect(res.body.qrCode).toBeUndefined();
      expect(res.body.message).toContain('TOTP');

      // Verifier que le cookie admin.sid est defini
      const cookie = extractSessionCookie(res, 'admin.sid');
      expect(cookie).not.toBeNull();
    });

    it('should return QR code for admin without TOTP configured', async () => {
      const admin = await createTestAdminWithoutTotp({
        email: 'newadmin@example.com',
        password: 'AdminTest123!',
      });

      const res = await request(app)
        .post('/api/admin/auth/login')
        .send({
          email: admin.email,
          password: admin.password,
        });

      expect(res.status).toBe(200);
      expect(res.body.requiresTotpSetup).toBe(true);
      expect(res.body.qrCode).toBeDefined();
      expect(res.body.qrCode).toMatch(/^data:image\/png;base64,/);
    });

    it('should return 401 with invalid email', async () => {
      const res = await request(app)
        .post('/api/admin/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'AdminTest123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('ADMIN_004');
    });

    it('should return 401 with invalid password', async () => {
      const admin = await createTestAdmin();

      const res = await request(app)
        .post('/api/admin/auth/login')
        .send({
          email: admin.email,
          password: 'wrongpassword',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('ADMIN_004');
    });

    it('should return 400 when email or password missing', async () => {
      const res = await request(app)
        .post('/api/admin/auth/login')
        .send({
          email: 'admin@example.com',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('ADMIN_003');
    });
  });

  // =====================================
  // POST /api/admin/auth/totp/verify
  // =====================================
  describe('POST /api/admin/auth/totp/verify', () => {
    let admin: Awaited<ReturnType<typeof createTestAdmin>>;
    let sessionCookie: string | null;

    beforeEach(async () => {
      admin = await createTestAdmin({
        email: 'totpadmin@example.com',
        password: 'AdminTest123!',
      });

      // Login step 1 pour obtenir la session
      const loginRes = await request(app)
        .post('/api/admin/auth/login')
        .send({
          email: admin.email,
          password: admin.password,
        });

      sessionCookie = extractSessionCookie(loginRes, 'admin.sid');
    });

    it('should verify valid TOTP code and complete authentication', async () => {
      const validCode = generateTotpCode(admin.totpSecret);

      const res = await request(app)
        .post('/api/admin/auth/totp/verify')
        .set('Cookie', sessionCookie!)
        .send({
          code: validCode,
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('successful');
      expect(res.body.admin).toBeDefined();
      expect(res.body.admin.email).toBe(admin.email);
    });

    it('should return 401 with invalid TOTP code', async () => {
      const res = await request(app)
        .post('/api/admin/auth/totp/verify')
        .set('Cookie', sessionCookie!)
        .send({
          code: '000000',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('ADMIN_007');
    });

    it('should return 401 without session (not authenticated)', async () => {
      const validCode = generateTotpCode(admin.totpSecret);

      const res = await request(app)
        .post('/api/admin/auth/totp/verify')
        .send({
          code: validCode,
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('ADMIN_001');
    });

    it('should block after 3 failed TOTP attempts', async () => {
      // 3 tentatives echouees
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/admin/auth/totp/verify')
          .set('Cookie', sessionCookie!)
          .send({
            code: '000000',
          });
      }

      // 4eme tentative devrait etre bloquee
      const res = await request(app)
        .post('/api/admin/auth/totp/verify')
        .set('Cookie', sessionCookie!)
        .send({
          code: '000000',
        });

      expect(res.status).toBe(429);
      expect(res.body.error).toContain('ADMIN_006');
    });

    it('should return 400 when TOTP code is missing', async () => {
      const res = await request(app)
        .post('/api/admin/auth/totp/verify')
        .set('Cookie', sessionCookie!)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('ADMIN_005');
    });
  });

  // =====================================
  // GET /api/admin/auth/me
  // =====================================
  describe('GET /api/admin/auth/me', () => {
    it('should return admin info when fully authenticated', async () => {
      const admin = await createTestAdmin();

      // Login complet (step 1 + step 2)
      const loginRes = await request(app)
        .post('/api/admin/auth/login')
        .send({
          email: admin.email,
          password: admin.password,
        });

      const sessionCookie = extractSessionCookie(loginRes, 'admin.sid');

      const validCode = generateTotpCode(admin.totpSecret);
      await request(app)
        .post('/api/admin/auth/totp/verify')
        .set('Cookie', sessionCookie!)
        .send({
          code: validCode,
        });

      // Verifier /me
      const res = await request(app)
        .get('/api/admin/auth/me')
        .set('Cookie', sessionCookie!);

      expect(res.status).toBe(200);
      expect(res.body.admin).toBeDefined();
      expect(res.body.admin.email).toBe(admin.email);
      expect(res.body.admin.password).toBeUndefined();
    });

    it('should return 401 when not authenticated', async () => {
      const res = await request(app)
        .get('/api/admin/auth/me');

      expect(res.status).toBe(401);
    });
  });

  // =====================================
  // POST /api/admin/auth/logout
  // =====================================
  describe('POST /api/admin/auth/logout', () => {
    it('should logout and destroy admin session', async () => {
      const admin = await createTestAdmin();

      // Login complet
      const loginRes = await request(app)
        .post('/api/admin/auth/login')
        .send({
          email: admin.email,
          password: admin.password,
        });

      const sessionCookie = extractSessionCookie(loginRes, 'admin.sid');

      const validCode = generateTotpCode(admin.totpSecret);
      await request(app)
        .post('/api/admin/auth/totp/verify')
        .set('Cookie', sessionCookie!)
        .send({
          code: validCode,
        });

      // Logout
      const logoutRes = await request(app)
        .post('/api/admin/auth/logout')
        .set('Cookie', sessionCookie!);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.message).toContain('Logged out');

      // Verifier que la session est detruite
      const meRes = await request(app)
        .get('/api/admin/auth/me')
        .set('Cookie', sessionCookie!);

      expect(meRes.status).toBe(401);
    });
  });
});
