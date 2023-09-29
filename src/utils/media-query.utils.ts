export type QueryListener = (matches: boolean) => void;
export const queryLists = new Map<string, MediaQueryList>();
export const queryListeners = new Map<string, Set<QueryListener>>();

export const matchQuery = (query: string, listener: QueryListener): void => {
  // do we know this query?
  if (!queryLists.has(query)) {
    // prepare query with single listener
    const queryMatch = window.matchMedia(`(${query})`);
    queryMatch.addEventListener('change', ({ matches }) => {
      // notify all registered listeners
      queryListeners.get(query).forEach(listener => listener(matches));
    });
    queryLists.set(query, queryMatch);
  }
  if (!queryListeners.has(query)) {
    queryListeners.set(query, new Set());
  }
  // do we know this listener?
  if (!queryListeners.get(query).has(listener)) {
    queryListeners.get(query).add(listener);
  }
  // execute listener once and on each registration
  listener(queryLists.get(query).matches);
};

export const matchQueryFromCustomProp = (prop: string, listener: QueryListener): void => {
  // gather the value of the custom prop
  const query = window.getComputedStyle(document.body).getPropertyValue(prop);
  // ignore properties without a value
  if (query !== '') {
    matchQuery(query, listener);
  }
};
