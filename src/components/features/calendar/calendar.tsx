import { Component, ComponentInterface, h } from '@stencil/core';

@Component({
  tag: 'kvlm-calendar',
  styleUrl: 'calendar.scss',
  shadow: true,
})
export class Calendar implements ComponentInterface {
  render() {
    return (
      <iframe
        src="https://calendar.google.com/calendar/embed?height=600&wkst=2&ctz=Europe%2FBerlin&src=YnQ5am84ZDRlaWg2am5kOTYya2Jsc2NjZXNAZ3JvdXAuY2FsZW5kYXIuZ29vZ2xlLmNvbQ&color=%2331b6cb&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=0&showCalendars=0&showTz=0"
        scrolling="no"
      />
    );
  }
}
