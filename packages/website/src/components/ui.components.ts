import { Main as MainNative } from '@kvlm/ui/components/layout/main/main.component.js';
import { Section as SectionNative } from '@kvlm/ui/components/layout/section/section.component.js';

import { Navigation as NavigationNative } from '@kvlm/ui/components/features/navigation/navigation/navigation.component.js';
import { NavigationItem as NavigationItemNative } from '@kvlm/ui/components/features/navigation/navigation-item/navigation-item.component.js';

import { withAstro } from '@utils/astro.utils.js';

export const Main = withAstro(MainNative);
export const Navigation = withAstro(NavigationNative);
export const NavigationItem = withAstro(NavigationItemNative);
export const Section = withAstro(SectionNative);
