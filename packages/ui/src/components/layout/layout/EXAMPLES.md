## Basic usage

The layout fills the viewport: the header and the footer are rows of their
own, only the content between them scrolls.

```html
<kvlm-layout>
  <div style="background: cyan; padding: 10px" slot="header">Header</div>
  <div style="background: magenta; height: 480px">Main</div>
  <div style="background: silver; padding: 10px" slot="footer">Footer</div>
</kvlm-layout>
```
