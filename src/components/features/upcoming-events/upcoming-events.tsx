import { Component, ComponentInterface, h, Prop, State } from '@stencil/core';
import type { UpcomingEvent } from '../../../types/event.types.js';
import { exceedsOneDay, formatDate } from '../../../utils/date.utils.js';

@Component({
  tag: 'kvlm-upcoming-events',
  styleUrl: 'upcoming-events.scss',
  shadow: true,
})
export class UpcomingEvents implements ComponentInterface {
  @State()
  private isLoading = true;

  @State()
  private upcomingEvents: UpcomingEvent[] = [];

  @Prop()
  calendarUrl!: string;

  @Prop()
  loading?: string;

  async componentDidLoad() {
    this.isLoading = true;
    const response = await fetch(this.calendarUrl, { redirect: 'follow' });
    if (response.ok) this.upcomingEvents = await response.json();
    this.isLoading = false;
  }

  renderDates(start: Date, end: Date): string {
    if (exceedsOneDay(start, end)) {
      return `${formatDate(start)} - ${formatDate(new Date(end.getTime() - 1))}`;
    } else {
      return formatDate(start);
    }
  }

  render() {
    if (this.isLoading) {
      return this.loading;
    }
    if (this.upcomingEvents.length < 1) {
      return <slot />;
    } else {
      return (
        <ul>
          {this.upcomingEvents.map(({ start, end, summary, location }) => (
            <li>
              {this.renderDates(new Date(start), new Date(end))}, <strong>{summary}</strong>,<br />
              {location}
            </li>
          ))}
        </ul>
      );
    }
  }
}
