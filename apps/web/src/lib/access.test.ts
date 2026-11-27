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

describe('safeNextPath', () => {
  it('accepts same-site paths only', () => {
    expect(safeNextPath('/fr/clinician')).toBe('/fr/clinician');
    expect(safeNextPath('//evil.example')).toBeNull();
    expect(safeNextPath('https://evil.example')).toBeNull();
    expect(safeNextPath('/\\evil.example')).toBeNull();
    expect(safeNextPath(null)).toBeNull();
  });
});
