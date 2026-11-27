import { describe, expect, it } from 'vitest';

import { decideAccess, rolesFromClaims, safeNextPath } from './access';

describe('decideAccess', () => {
  it('sends anyone signed out to sign-in', () => {
    expect(decideAccess({ signedIn: false, roles: [], aal: null, area: 'patient' })).toBe(
      'sign-in',
    );
    expect(decideAccess({ signedIn: false, roles: [], aal: null, area: 'clinician' })).toBe(
      'sign-in',
    );
  });

  it('lets any signed-in person into the patient area without MFA', () => {
    expect(decideAccess({ signedIn: true, roles: [], aal: 'aal1', area: 'patient' })).toBe('allow');
  });

  it('refuses a clinician without MFA (Step 2.1 acceptance test) and sends them to MFA', () => {
    expect(
      decideAccess({ signedIn: true, roles: ['clinician'], aal: 'aal1', area: 'clinician' }),
    ).toBe('mfa');
  });

  it('lets a clinician with MFA into the clinician area', () => {
    expect(
      decideAccess({ signedIn: true, roles: ['clinician'], aal: 'aal2', area: 'clinician' }),
    ).toBe('allow');
  });

  it('forbids a staff area to people without the role, even with MFA', () => {
    expect(decideAccess({ signedIn: true, roles: ['patient'], aal: 'aal2', area: 'admin' })).toBe(
      'forbidden',
    );
    expect(
      decideAccess({ signedIn: true, roles: ['clinician'], aal: 'aal2', area: 'facility' }),
    ).toBe('forbidden');
  });
});

describe('rolesFromClaims', () => {
  it('keeps known roles only', () => {
    expect(rolesFromClaims({ app_roles: ['clinician', 'root', 42] })).toEqual(['clinician']);
    expect(rolesFromClaims({})).toEqual([]);
    expect(rolesFromClaims(null)).toEqual([]);
  });
});

describe('safeNextPath against open redirects (security review)', () => {
  it('refuses control characters the URL parser would strip', () => {
    for (const evil of ['/\t/evil.com', '/\n/evil.com', '/\r/evil.com', '/\u0000/evil.com']) {
      expect(safeNextPath(evil), JSON.stringify(evil)).toBeNull();
    }
  });

  it('keeps encoded slashes on this site and requires a locale path', () => {
    expect(safeNextPath('/%09/evil.com')).toBeNull(); // not under a locale
    expect(safeNextPath('/%2F/evil.com')).toBeNull();
    expect(safeNextPath('/fr/%2F%2Fevil.com')).toBe('/fr/%2F%2Fevil.com');
    expect(safeNextPath('/de/clinician')).toBeNull();
    expect(safeNextPath('/fr')).toBe('/fr');
    expect(safeNextPath('/en/account?x=1')).toBe('/en/account?x=1');
  });
});

describe('safeNextPath', () => {
  it('accepts same-site paths only', () => {
    expect(safeNextPath('/fr/clinician')).toBe('/fr/clinician');
    expect(safeNextPath('//evil.example')).toBeNull();
    expect(safeNextPath('https://evil.example')).toBeNull();
    expect(safeNextPath('/\\evil.example')).toBeNull();
    expect(safeNextPath(null)).toBeNull();
  });
});
