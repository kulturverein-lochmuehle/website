import { expect } from '@open-wc/testing';

import { EVENT_TYPE_KEYS, EVENT_TYPES } from '../models/events/events.js';
import type { Season } from '../models/terrain/trees.js';
import type { ViewSpec } from './views.js';
import { eventViewName, VIEWS } from './views.js';

describe('the views of the events', () => {
  // each kind in its own season, or in every one for what is held all year
  it('should have one of each kind of event in each season it is held in', () =>
    EVENT_TYPE_KEYS.forEach(type => {
      const { season } = EVENT_TYPES[type] as { season?: Season };
      const seasons: Season[] =
        season === undefined ? ['spring', 'summer', 'autumn', 'winter'] : [season];
      seasons.forEach(one => {
        const view = (VIEWS as Record<string, ViewSpec>)[eventViewName(type, one)];
        expect(view, `${type} in ${one}`).to.not.equal(undefined);
        expect(view?.season).to.equal(one);
        expect(view?.decorations).to.deep.equal(EVENT_TYPES[type].decorations);
      });
    }));
});
