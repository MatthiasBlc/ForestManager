import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { extractSessionCookie } from '../setup/testHelpers';

describe('Users API', () => {
  // =====================================
  // PATCH /api/users/me
  // =====================================
  describe('PATCH /api/users/me', () => {
    let cookie: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          username: 'profileuser',
          email: 'profileuser@example.com',
          password: 'Test123!Password',
        });
      cookie = extractSessionCookie(res)!;
    });

    it('should return 400 when username is not a string', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set('Cookie', cookie)
        .send({ username: 123 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('VALIDATION_001');
    });

    it('should return 400 when email is not a string', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set('Cookie', cookie)
        .send({ email: ['array'] });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('VALIDATION_001');
    });

    it('should return 400 when newPassword is not a string', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set('Cookie', cookie)
        .send({ currentPassword: 'Test123!Password', newPassword: 42 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('VALIDATION_001');
    });

    it('should return 401 when not authenticated', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .send({ username: 'newname' });

      expect(res.status).toBe(401);
    });
  });
});
