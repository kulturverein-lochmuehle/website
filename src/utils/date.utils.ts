export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

export const exceedsOneDay = (start: Date, end: Date): boolean => {
  const diff = end.getTime() - start.getTime();
  return diff > 1000 * 60 * 60 * 24;
};
