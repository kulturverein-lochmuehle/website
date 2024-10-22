const LIST_CLASS_FRAGMENT = '-CardsGrid ';
const ITEM_CLASS_FRAGMENT = '-ListCard-card ';

export function getDragAfterElement(list: HTMLElement, y: number): HTMLElement {
  const selector = `[class*="${ITEM_CLASS_FRAGMENT}"][draggable]`;
  const items = Array.from(list.querySelectorAll<HTMLElement>(selector));
  return items.reduce(
    (closest, item) => {
      const box = item?.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;

      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: item };
      } else {
        return closest;
      }
    },
    { offset: Number.NEGATIVE_INFINITY, element: items[items.length - 1] } as {
      offset: number;
      element: HTMLElement;
    },
  ).element;
}

export function prepareLists(update: (index: number, after: number) => void): HTMLElement[] {
  const selector = `[class*="${LIST_CLASS_FRAGMENT}"]:not([data-sortable]`;
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).map(list => {
    list.dataset.sortable = 'true';
    list.addEventListener('dragover', event => {
      event.preventDefault();

      const after = getDragAfterElement(list, event.clientY);
      const item = document.querySelector<HTMLElement>('[data-dragging]');

      if (item === null) return;
      update(parseInt(item.dataset.sorting ?? '0'), parseInt(after.dataset.sorting ?? '0'));
    });
    return list;
  });
}

export function prepareItems(): HTMLElement[] {
  const selector = `[class*="${ITEM_CLASS_FRAGMENT}"]:not([draggable])`;
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).map((item, index) => {
    item.draggable = true;
    item.dataset.sorting = `${index}`;
    item.addEventListener('dragstart', () => (item.dataset.dragging = ''));
    item.addEventListener('dragend', () => delete item.dataset.dragging);
    Array.from(item.children).forEach(child => ((child as HTMLElement).draggable = false));
    return item;
  });
}
