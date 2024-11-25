## Usage with typography

```html
<kvlm-section
  style="
    --kvlm-section-background-from: #525252;
    --kvlm-section-background-to: #101010;
    --kvlm-section-color: var(--kvlm-color-grey-light);
  "
>
  <kvlm-typo>
    <h1 class="title">Section title</h1>
    <p class="lead">Section informational headline</p>
    <p class="body">Section content</p>
  </kvlm-typo>
</kvlm-section>

<kvlm-section
  style="
    --kvlm-section-background-from: #f07575;
    --kvlm-section-background-to: #b55757;
    --kvlm-section-color: var(--kvlm-color-grey-dark);
  "
>
  <kvlm-typo>
    <h1 class="title">Section title with many contents causing huge section</h1>
    <div style="display: flex; flex-flow: column nowrap; gap: 50px; padding: 50px 0; width:200px">
      <p class="body">
        Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor
        invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua.
      </p>
      <p class="body">
        At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea
        takimata sanctus est Lorem ipsum dolor sit amet.
      </p>
      <p class="body">
        Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor
        invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua.
      </p>
      <p class="body">
        At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea
        takimata sanctus est Lorem ipsum dolor sit amet.
      </p>
      <p class="body">
        Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor
        invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua.
      </p>
      <p class="body">
        At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea
        takimata sanctus est Lorem ipsum dolor sit amet.
      </p>
      <p class="body">
        Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor
        invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua.
      </p>
      <p class="body">
        At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea
        takimata sanctus est Lorem ipsum dolor sit amet.
      </p>
    </div>
  </kvlm-typo>
</kvlm-section>

<kvlm-section
  style="
    --kvlm-section-background-from: #75f0de;
    --kvlm-section-background-to: #6fbad9;
    --kvlm-brook-color: var(--kvlm-color-grey-light);
    --kvlm-section-color: var(--kvlm-color-grey-dark);
  "
>
  <kvlm-typo>
    <h1 class="title">Section title</h1>
    <p class="lead">Section informational headline</p>
    <p class="body">Section content</p>
  </kvlm-typo>
</kvlm-section>
```
