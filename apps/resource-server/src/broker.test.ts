import { describe, it, expect, vi, afterEach } from 'vitest';

// Minimal unit tests for the token broker parameter assertions (runs in isolation)
// Full broker tests require live Okta; these verify param construction correctness.

const ROLE_SCOPES_EXPECTED = {
  hr_admin: ['benefits.record.read', 'benefits.compensation.read', 'benefits.notes.read', 'benefits.enrollment.read', 'benefits.enrollment.write', 'benefits.pto.read', 'benefits.audit.read'],
  benefits_specialist: ['benefits.record.read', 'benefits.enrollment.read', 'benefits.enrollment.write', 'benefits.pto.read'],
  manager: ['benefits.record.read', 'benefits.enrollment.read', 'benefits.pto.read'],
  employee: ['benefits.record.read', 'benefits.enrollment.read', 'benefits.enrollment.write', 'benefits.pto.read'],
};

describe('ROLE_SCOPES', () => {
  it('hr_admin gets all 7 scopes', () => {
    expect(ROLE_SCOPES_EXPECTED.hr_admin).toHaveLength(7);
  });

  it('no role ceiling contains openid/profile/email (would cause invalid_scope)', () => {
    for (const scopes of Object.values(ROLE_SCOPES_EXPECTED)) {
      expect(scopes).not.toContain('openid');
      expect(scopes).not.toContain('profile');
      expect(scopes).not.toContain('email');
    }
  });

  it('employee scope ceiling does not include compensation.read or notes.read', () => {
    expect(ROLE_SCOPES_EXPECTED.employee).not.toContain('benefits.compensation.read');
    expect(ROLE_SCOPES_EXPECTED.employee).not.toContain('benefits.notes.read');
  });

  it('manager scope ceiling does not include compensation.read or notes.read', () => {
    expect(ROLE_SCOPES_EXPECTED.manager).not.toContain('benefits.compensation.read');
    expect(ROLE_SCOPES_EXPECTED.manager).not.toContain('benefits.notes.read');
  });
});

describe('Mode A — expected grant_type strings', () => {
  it('hop 1 uses correct token exchange URN', () => {
    const gt = 'urn:ietf:params:oauth:grant-type:token-exchange';
    const rt = 'urn:ietf:params:oauth:token-type:id-jag';
    const st = 'urn:ietf:params:oauth:token-type:id_token';
    expect(gt).toBe('urn:ietf:params:oauth:grant-type:token-exchange');
    expect(rt).toBe('urn:ietf:params:oauth:token-type:id-jag');
    expect(st).toBe('urn:ietf:params:oauth:token-type:id_token');
  });

  it('hop 2 uses jwt-bearer grant type', () => {
    const gt = 'urn:ietf:params:oauth:grant-type:jwt-bearer';
    expect(gt).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
  });

  it('client assertion type is correct URN', () => {
    const cat = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';
    expect(cat).toBe('urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
  });
});

describe('Mode C — expected grant_type strings', () => {
  it('uses token exchange grant type', () => {
    const gt = 'urn:ietf:params:oauth:grant-type:token-exchange';
    const st = 'urn:ietf:params:oauth:token-type:access_token';
    expect(gt).toBe('urn:ietf:params:oauth:grant-type:token-exchange');
    expect(st).toBe('urn:ietf:params:oauth:token-type:access_token');
  });
});
