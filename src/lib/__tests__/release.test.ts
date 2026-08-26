import { RELEASE_LABEL, RELEASE_NAME, RELEASE_VERSION } from '../release';

describe('release', () => {
  it('marks Donna v1 as Personal Assistant', () => {
    expect(RELEASE_VERSION).toBe('1.0.0');
    expect(RELEASE_NAME).toBe('Personal Assistant');
    expect(RELEASE_LABEL).toBe('v1 · Personal Assistant');
  });
});
