# kvlm-main

## Properties

| Property                | Attribute                 | Type                  |
|-------------------------|---------------------------|-----------------------|
| `scrollObserveSelector` | `scroll-observe-selector` | `string \| undefined` |

## Methods

| Method                        | Type                                           |
|-------------------------------|------------------------------------------------|
| `changeNavigationTheme`       | `(id: string): void`                           |
| `getActiveElement`            | `(id: string): HTMLElement \| undefined`       |
| `handleInlineLocationChanged` | `({ detail }: any): void`                      |
| `handleIntersections`         | `(entries: IntersectionObserverEntry[]): void` |
| `handleSlotChange`            | `(): void`                                     |
| `observeContents`             | `(): void`                                     |
| `scrollToContent`             | `(id: string, animate: boolean): void`         |
