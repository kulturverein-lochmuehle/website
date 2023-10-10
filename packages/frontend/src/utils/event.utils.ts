export type InlineLocationChangedEventDetail = { href: string; scroll: boolean };
export type InlineLocationChangedEvent = CustomEvent<InlineLocationChangedEventDetail>;

export enum RoutingEvent {
  InlineLocationChanged = 'inline-location-changed',
  RouterLocationChanged = 'vaadin-router-location-changed',
}

export const changeLocationInline = (href: string, scroll: boolean) => {
  window.history.pushState({}, '', href);
  window.dispatchEvent(
    new CustomEvent<InlineLocationChangedEventDetail>(RoutingEvent.InlineLocationChanged, {
      detail: { href, scroll }
    })
  );
};
