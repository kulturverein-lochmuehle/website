import { eventSetting, eventTypeOf, startIn, type EventSetting } from '@kvlm/visualization';
import type { CollectionEntry } from 'astro:content';

// the mill's clock, whatever the build machine's is
const local = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Berlin',
  month: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
});

/** The month, one to twelve, and the hour with its minutes, at the mill. */
export function atMill(date: Date): { month: number; hour: number } {
  const parts = Object.fromEntries(
    local.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  return {
    month: Number(parts['month']),
    hour: Number(parts['hour']) + Number(parts['minute']) / 60,
  };
}

/**
 * How a chronicle entry's scene is set up: its kind by its title, its start
 * as its teaser or its text says - or its kind's usual one - and nothing for
 * an entry of no kind known.
 */
export function getChronicleSetting(entry: CollectionEntry<'chronicle'>): EventSetting | undefined {
  const type = eventTypeOf(entry.data.title);
  if (type === undefined) {
    return undefined;
  }
  const { month } = atMill(entry.data.date);
  return eventSetting(type, month, startIn(entry.data.teaser) ?? startIn(entry.body ?? ''));
}

/** And a calendar event's: its kind by its summary, at the start it is set to. */
export function getEventSetting(event: CollectionEntry<'events'>): EventSetting | undefined {
  const type = eventTypeOf(event.data.summary);
  if (type === undefined) {
    return undefined;
  }
  // an event of the whole day starts at midnight, which is no start at all
  const { month, hour } = atMill(event.data.start);
  return eventSetting(type, month, hour === 0 ? undefined : hour);
}
