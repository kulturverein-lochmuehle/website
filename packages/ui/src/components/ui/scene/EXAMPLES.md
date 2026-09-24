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

## Free views

A view baked free - the whole model, uncut - can be turned round the point it
looks at with a drag and brought nearer or farther with the wheel. It is drawn
again once a frame while it moves, and not at all otherwise. A still view does
not move.

```html
<kvlm-scene src="/views/20260926-whole-free.view.bin"></kvlm-scene>
```

The whole model is about 105,000 triangles in 5 draw calls, 812 KiB.

## Events

It fires `kvlm-scene-rendered` once drawn, with how long that took, and
`kvlm-scene-failed` without WebGL 2.
