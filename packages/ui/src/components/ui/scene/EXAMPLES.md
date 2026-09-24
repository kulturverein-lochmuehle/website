## Basic usage

A view of the Lochmühle baked beforehand by `@kvlm/visualization` (`npm run
data:views`), loaded from wherever the page serves it:

```html
<kvlm-scene src="/views/20260926-street-still.view.bin"></kvlm-scene>
```

Without a height from the page it keeps to 16:9. It keeps the width it sees
whatever shape it is given: a narrow one sees as far to either side, and more
above and below.

## How fast it is

Nothing is modelled in the browser. The file carries the triangles as they are
drawn - only those the eye can see, facing it, merged into a handful of draw
calls, their light baked into their colours - gzipped, and unpacked as it
comes in. It is drawn with WebGL 2 alone, one shader of two lines, once, and
again only when its size changes. The street view is about 22,000 triangles,
6 draw calls and 220 KiB, and on a production build it is on screen some 60ms
after the page was asked for.

## Path views

A view baked along a path flies it by itself with `autoplay`, the seconds a
round trip takes: there and back, easing out of each end and into the other,
over and over. It only flies while it is on screen, and not at all for a
visitor who asked for less motion.

```html
<kvlm-scene src="/views/20260926-road-path.view.bin" autoplay="40"></kvlm-scene>
```

Without it the camera stays where `progress` puts it, from the path's start
at 0 to its end at 1 - for whatever moves it, the page's scroll say:

```js
const scene = document.querySelector('kvlm-scene');
addEventListener('scroll', () => {
  scene.progress = scrollY / (document.documentElement.scrollHeight - innerHeight);
});
```

The road path is about 39,000 triangles in 5 draw calls, 408 KiB.

## Free views

A view baked free - the whole model, uncut - can be turned round the point it
looks at with a drag and brought nearer or farther with the wheel. It is drawn
again once a frame while it moves, and not at all otherwise. A still view does
not move.

```html
<kvlm-scene src="/views/20260926-whole-free.view.bin"></kvlm-scene>
```

The whole model is about 94,000 triangles in 5 draw calls, 779 KiB.

## Poster and lazy loading

A `poster` is an image of the view's first frame - baked with `npm run
data:stills` in `packages/ui`, beside the view as `<name>.still.webp`. It shows
at once, and the canvas fades in over it when the view has been drawn. With
`loading="lazy"` the view is fetched only once the element is within a screen's
height of the viewport.

```html
<kvlm-scene
  src="/views/20260926-street-still.view.bin"
  poster="/views/20260926-street-still.still.webp"
  loading="lazy"
></kvlm-scene>
```

Where a fire burns in the view its light on the ground flickers while the
element is on screen, unless less motion is asked for.

## Events

It fires `kvlm-scene-rendered` once drawn, with how long that took, and
`kvlm-scene-failed` without WebGL 2.
