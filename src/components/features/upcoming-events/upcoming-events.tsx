import { Component, ComponentInterface, h, Prop, State } from '@stencil/core';
import type { UpcomingEvent } from '../../../types/event.types.js';
import { formatDate } from '../../../utils/date.utils.js';

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
    const data = await fetch(this.calendarUrl, { redirect: 'follow' });
    this.upcomingEvents = await data.json();
    this.isLoading = false;
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
          {this.upcomingEvents.map(({ start, summary, location }) => (
            <li>
              {formatDate(new Date(start))}, <strong>{summary}</strong>, {location}
            </li>
          ))}
        </ul>
      );
    }
  }
}
