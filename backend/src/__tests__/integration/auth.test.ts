import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { createTestUser, extractSessionCookie } from '../setup/testHelpers';

describe('Auth API', () => {
  // =====================================
  // POST /api/auth/signup
  // =====================================
  describe('POST /api/auth/signup', () => {
    it('should create a new user with valid data', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'newuser',
          email: 'newuser@example.com',
          password: 'Test123!Password',
        });

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.username).toBe('newuser');
      expect(res.body.user.email).toBe('newuser@example.com');
      expect(res.body.user.password).toBeUndefined();

      // Verifier que le cookie de session est defini
      const cookie = extractSessionCookie(res);
      expect(cookie).not.toBeNull();
    });

    it('should return 400 when username is missing', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'test@example.com',
          password: 'Test123!Password',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('AUTH_002');
    });

    it('should return 400 when email is missing', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'testuser',
          password: 'Test123!Password',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('AUTH_002');
    });

    it('should return 400 when password is missing', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'testuser',
          email: 'test@example.com',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('AUTH_002');
    });

    it('should return 400 when email format is invalid', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'testuser',
          email: 'invalid-email',
          password: 'Test123!Password',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('AUTH_003');
    });

    it('should return 400 when username is too short', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'ab',
          email: 'test@example.com',
          password: 'Test123!Password',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('AUTH_004');
    });

    it('should return 400 when password is too short', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'short',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('AUTH_005');
    });

    it('should return 409 when username already exists', async () => {
      // Creer un utilisateur existant
      await createTestUser({ username: 'existinguser' });

      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'existinguser',
          email: 'new@example.com',
          password: 'Test123!Password',
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('AUTH_006');
    });

    it('should return 409 when email already exists', async () => {
      // Creer un utilisateur existant
      await createTestUser({ email: 'existing@example.com' });

      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'newuser',
          email: 'existing@example.com',
          password: 'Test123!Password',
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('AUTH_007');
    });
  });

  // =====================================
  // POST /api/auth/login
  // =====================================
  describe('POST /api/auth/login', () => {
    let testUser: Awaited<ReturnType<typeof createTestUser>>;

    beforeEach(async () => {
      testUser = await createTestUser({
        username: 'loginuser',
        email: 'login@example.com',
        password: 'Test123!Password',
      });
    });

    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.username).toBe(testUser.username);
      expect(res.body.user.password).toBeUndefined();

      // Verifier que le cookie de session est defini
      const cookie = extractSessionCookie(res);
      expect(cookie).not.toBeNull();
    });

    it('should return 401 with invalid password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: 'wrongpassword',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('AUTH_008');
    });

    it('should return 401 with non-existent username', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent',
          password: 'Test123!Password',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('AUTH_008');
    });

    it('should return 400 when credentials are missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('AUTH_002');
    });
  });

  // =====================================
  // GET /api/auth/me
  // =====================================
  describe('GET /api/auth/me', () => {
    it('should return user info when authenticated', async () => {
      // Creer un utilisateur et obtenir le cookie de session
      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'meuser',
          email: 'me@example.com',
          password: 'Test123!Password',
        });

      const cookie = extractSessionCookie(signupRes);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookie!);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.username).toBe('meuser');
    });

    it('should return 401 when not authenticated', async () => {
      const res = await request(app)
        .get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('AUTH_001');
    });
  });

  // =====================================
  // POST /api/auth/logout
  // =====================================
  describe('POST /api/auth/logout', () => {
    it('should logout and destroy session', async () => {
      // Creer un utilisateur et obtenir le cookie de session
      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'logoutuser',
          email: 'logout@example.com',
          password: 'Test123!Password',
        });

      const cookie = extractSessionCookie(signupRes);

      // Logout
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookie!);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.message).toBe('Logged out successfully');

      // Verifier que la session est detruite
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookie!);

      expect(meRes.status).toBe(401);
    });
  });
});
