<!-- Auto Generated Below -->

# kvlm-layout

A component to introduce the application layout.

## Properties

| Property                | Attribute                 | Modifiers | Type                  |
|-------------------------|---------------------------|-----------|-----------------------|
| `scrollObserveSelector` | `scroll-observe-selector` | readonly  | `string \| undefined` |

## Methods

| Method                        | Type                                             |
|-------------------------------|--------------------------------------------------|
| `handleInlineLocationChanged` | `({ detail }: InlineLocationChangedEvent): void` |
| `handleIntersections`         | `(entries: object): void`                        |
| `scrollToContent`             | `(id: string, animate: boolean): void`           |

## Slots

| Name     | Description      |
|----------|------------------|
|          | The default slot |
| `header` | The header slot  |

## CSS Custom Properties

| Property                              | Default           | Description                                      |
|---------------------------------------|-------------------|--------------------------------------------------|
| `--kvlm-layout-color-typo`            |                   | The color of the typography                      |
| `--kvlm-layout-header-offset`         |                   | Sets the offset of the header for **all devices**. |
| `--kvlm-layout-header-offset-desktop` | "utils.rem(16)"   | The offset of the header on desktop devices      |
| `--kvlm-layout-header-offset-mobile`  | "utils.rem(12.6)" | The offset of the header on mobile devices       |
| `--kvlm-layout-min-height`            | "100svh"          | The minimum height of the layout                 |
