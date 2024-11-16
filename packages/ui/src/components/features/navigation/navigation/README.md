<!-- Auto Generated Below -->

# kvlm-navigation

## Properties

| Property             | Attribute              | Modifiers | Type      | Default | Description                                      |
|----------------------|------------------------|-----------|-----------|---------|--------------------------------------------------|
| `href`               | `href`                 | readonly  | `"/"`     | "/"     | The href of the logo link.                       |
| `hrefInline`         | `href-inline`          | readonly  | `false`   | false   | Whether the logo link should be handled as inline.<br />That means that the page will be scrolled to the related content. |
| `opened`             | `opened`               |           | `boolean` | false   |                                                  |
| `scrollFadeDistance` | `scroll-fade-distance` | readonly  | `100`     | 100     | The amount of pixels the user has to scroll to fully fade the navigation bar shadow.<br />This maybe is the most detailed option you'll configure today. |

## Methods

| Method            | Type                   |
|-------------------|------------------------|
| `handleClick`     | `(event: Event): void` |
| `handleLogoClick` | `(event: Event): void` |
| `handleScroll`    | `(): void`             |

## Slots

| Name | Description                    |
|------|--------------------------------|
|      | Receives the navigation items. |

## CSS Custom Properties

| Property                            | Description                                      |
|-------------------------------------|--------------------------------------------------|
| `--kvlm-navigation-background-from` | Background gradient start color of the navigation bar. |
| `--kvlm-navigation-background-to`   | Background gradient end color of the navigation bar. |
| `--kvlm-navigation-color-typo`      | Color of the navigation bar text.                |
| `--kvlm-navigation-height`          | Height of the navigation bar. Will be computed based on layout. |
| `--kvlm-navigation-scroll-distance` | Distance scrolled in pixels. Internally set by the component. |
| `--kvlm-navigation-shadow-opacity`  | Opacity of the navigation bar shadow. Computed from the scroll distance. |
| `--kvlm-navigation-shadow-spread`   | Spread of the navigation bar shadow. Computed from the scroll distance. |
| `--kvlm-navigation-stroke-color`    | Color of the navigation bar stroke.              |
| `--kvlm-navigation-stroke-width`    | Width of the navigation bar stroke.              |
