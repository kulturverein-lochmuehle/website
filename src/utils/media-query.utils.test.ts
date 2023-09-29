import { matchQuery, matchQueryFromCustomProp, queryLists } from './media-query.utils';

// mock match media for current test case
Object.defineProperty(window, 'matchMedia', {
  value: jest.fn(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe('media-query.utils', () => {
  describe('matchQuery', () => {
    it('calls listener initially', () => {
      const listener = jest.fn();
      matchQuery('min-width: 0', listener);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('calls already registered listeners as well', () => {
      const listener = jest.fn();
      matchQuery('min-width: 0', listener);
      matchQuery('min-width: 0', listener);
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('reuses already registered queries', () => {
      const listenerA = jest.fn();
      const listenerB = jest.fn();
      matchQuery('min-width: 0', listenerA);
      matchQuery('min-width: 0', listenerB);
      expect(queryLists.size).toBe(1);
    });
  });

  describe('matchQueryFromCustomProp', () => {
    it('uses known queries from custom properties', () => {
      window.getComputedStyle = jest.fn(() => ({ getPropertyValue: jest.fn(() => 'orientation: landscape') })) as any;
      const listener = jest.fn();
      matchQueryFromCustomProp('--known-query', listener);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('ignores custom properties without queries', () => {
      const listener = jest.fn();
      matchQueryFromCustomProp('--unknown-query', listener);
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
