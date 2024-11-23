## Basic usage

```html
<section style="max-height: 400px">
  <kvlm-layout>
    <div
      style="background: cyan; padding: 10px; height: var(---kvlm-layout-header-offset); box-sizing: border-box"
      slot="header"
    >
      Header
    </div>
    <div
      style="background: magenta; padding: calc(var(---kvlm-layout-header-offset) + 10px) 10px 10px; height: 480px"
    >
      Main
    </div>
  </kvlm-layout>
</section>
```
