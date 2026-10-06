import { useEffect } from 'react';

const SUFFIX = 'Easy ITP';

// Titlul tabului / din rezultatele Google pentru pagina curenta; null = titlul implicit din index.html
export function pageTitle(title: string | null): string {
  return title ? `${title} | ${SUFFIX}` : 'Easy ITP – remindere SMS și programări online pentru stații ITP';
}

export function usePageTitle(title: string | null) {
  useEffect(() => {
    document.title = pageTitle(title);
  }, [title]);
}
