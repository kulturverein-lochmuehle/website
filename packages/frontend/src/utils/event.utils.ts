export type InlineLocationChangedEventDetail = { href: string; scroll: boolean };
export type InlineLocationChangedEvent = CustomEvent<InlineLocationChangedEventDetail>;

export enum RoutingEvent {
  InlineLocationChanged = 'inline-location-changed',
  RouterLocationChanged = 'vaadin-router-location-changed'
}

export const changeLocationInline = (href: string, scroll: boolean) => {
  window.history.pushState({}, '', href);
  window.dispatchEvent(
    new CustomEvent<InlineLocationChangedEventDetail>(RoutingEvent.InlineLocationChanged, {
      detail: { href, scroll }
    })
  );
};

export type NavigationTheme = {
  backgroundColorFrom: string;
  backgroundColorTo: string;
  brookColor: string;
  fontColor: string;
};

export const setNavigationTheme = (theme: NavigationTheme) => {
  const navigationThemeAttr = 'navigation-theme';
  document.head.querySelector(`style[${navigationThemeAttr}]`)?.remove();
  const navigationTheme = document.createElement('style');
  navigationTheme.setAttribute(navigationThemeAttr, '');
  navigationTheme.innerText = `
:root {
  --kvlm-navigation-background-from: ${theme.backgroundColorFrom};
  --kvlm-navigation-background-to: ${theme.backgroundColorTo};
  --kvlm-navigation-color-brook: ${theme.brookColor};
  --kvlm-navigation-color-typo: ${theme.fontColor};
}
  `;
  document.head.appendChild(navigationTheme);
};
