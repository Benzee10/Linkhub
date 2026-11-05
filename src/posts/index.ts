import { BlogPost } from './types';
import { howToMakeAGirlMissYou } from './how-to-make-a-girl-miss-you';
import { romanticWaysToAskHerToBeYourGirlfriend } from './romantic-ways-to-ask-her-to-be-your-girlfriend';
import { howToFindAndJoinActiveWhatsappGroupsSafely } from './how-to-find-and-join-active-whatsapp-groups-safely';

export * from './types';
export * from './how-to-make-a-girl-miss-you';
export * from './romantic-ways-to-ask-her-to-be-your-girlfriend';
export * from './how-to-find-and-join-active-whatsapp-groups-safely';

/**
 * Registry of all standalone posts
 */
export const ALL_BLOG_POSTS: BlogPost[] = [
  howToMakeAGirlMissYou,
  romanticWaysToAskHerToBeYourGirlfriend,
  howToFindAndJoinActiveWhatsappGroupsSafely
];

export function getBlogPostById(id: string): BlogPost | undefined {
  return ALL_BLOG_POSTS.find((p) => p.id === id);
}
