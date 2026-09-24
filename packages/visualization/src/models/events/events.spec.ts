import { expect } from '@open-wc/testing';

import { PLACES } from '../places/places.js';
import {
  EVENT_TYPE_KEYS,
  EVENT_TYPES,
  eventSetting,
  eventTypeOf,
  seasonOf,
  startIn,
} from './events.js';

/** The chronicle's entries as written, by their file. */
const CHRONICLE = import.meta.glob<string>('../../../../website/src/content/chronicle/*.mdoc', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('the events', () => {
  it('should read the chronicle', () => {
    expect(Object.keys(CHRONICLE)).to.not.be.empty;
  });

  // every entry is of a kind, and starts when it says or its kind usually does
  Object.entries(CHRONICLE).forEach(([file, entry]) =>
    it(`should know ${file.split('/').pop()} and its start`, () => {
      const title = /^title:\s*(.+)$/m.exec(entry)?.[1] ?? '';
      const type = eventTypeOf(title);
      expect(type, title).to.not.equal(undefined);
      const { hour } = eventSetting(type ?? 'feierabend', 1, startIn(entry));
      expect(hour, title).to.be.within(10, 22);
    })
  );

  it('should hold every kind at places that are drawn', () =>
    EVENT_TYPE_KEYS.forEach(key =>
      EVENT_TYPES[key].places.forEach(
        place => expect(PLACES[place].outline, `${key}: ${place}`).to.not.be.empty
      )
    ));

  it('should take a season by the months, where a kind has none of its own', () => {
    expect([12, 1, 2, 3, 5, 6, 8, 9, 11].map(seasonOf)).to.deep.equal([
      'winter',
      'winter',
      'winter',
      'spring',
      'spring',
      'summer',
      'summer',
      'autumn',
      'autumn',
    ]);
    expect(eventSetting('feierabend', 10).season).to.equal('autumn');
    expect(eventSetting('feierabend', 1).season).to.equal('winter');
    expect(eventSetting('adventskalender', 11).season).to.equal('winter');
  });

  it('should know the names in the calendar, and not its meetings', () => {
    expect(eventTypeOf('SOMERFESTival')).to.equal('sommerfestival');
    expect(eventTypeOf('Mühle, Markt & Musik')).to.equal('sommerfestival');
    expect(eventTypeOf('Feierabend an der Lochmühle')).to.equal('feierabend');
    expect(eventTypeOf('Adventskalender Orga')).to.equal(undefined);
    expect(eventTypeOf('KulturStammtisch - Deko vorbereiten')).to.equal(undefined);
  });

  it('should read the first time of the clock in a text', () => {
    expect(startIn('Das Fenster öffnet sich 16:30 Uhr.')).to.equal(16.5);
    expect(startIn('Ab 18.00 Uhr, der Eintritt ist frei!')).to.equal(18);
    expect(startIn('Eintritt frei!')).to.equal(undefined);
    expect(eventSetting('feierabend', 10).hour).to.equal(18);
  });
});
