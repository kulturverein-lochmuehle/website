import type { ClientDirective } from 'astro';

const addIslandSlot: ClientDirective = (_, { value }, island) => {
  island.setAttribute('slot', value);
};

export default addIslandSlot;
