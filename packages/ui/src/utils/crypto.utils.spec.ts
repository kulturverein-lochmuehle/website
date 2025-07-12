import { expect } from '@open-wc/testing';

import { hashFrom } from './crypto.utils.js';

describe('crypto.utils', () => {
  describe('hashFrom', () => {
    it('should create a valid hash', async () => {
      const encrypted = await hashFrom('Hello, world!');
      expect(encrypted).to.equal(
        '315f5bdb76d078c43b8ac0064e4a0164612b1fce77c869345bfc94c75894edd3',
      );
    });
  });
});
