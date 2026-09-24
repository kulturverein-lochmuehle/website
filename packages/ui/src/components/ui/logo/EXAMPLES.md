## Basic usage

```html
<kvlm-logo></kvlm-logo>
```

## Custom colors

```html
<kvlm-logo style="--kvlm-logo-brook-color: #f00; --kvlm-logo-typo-color: #0f0"></kvlm-logo>
```

## Loading progress

`loaded` fills the brook in the colour of the typography, from its source to its
mouth, as far as the percentage says. Removing it lets the fill fade out.

```html
<kvlm-logo loaded="30"></kvlm-logo>
```

## Loaded only

`loaded-only` leaves the typography out and draws the brook alone - with
`loaded`, a loader of its own.

```html
<kvlm-logo
  loaded-only
  loaded="30"
  style="--kvlm-logo-brook-color: #fff; --kvlm-logo-typo-color: #222"
></kvlm-logo>
```
