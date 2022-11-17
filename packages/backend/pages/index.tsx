import { Page } from '@alinea/content';
import { GetStaticPropsContext } from 'next';
import Head from 'next/head';

import { createApi } from '../lib/api';
import Container from '../components/container';
import HeroPost from '../components/hero-post';
import Intro from '../components/intro';
import Layout from '../components/layout';
import MoreStories from '../components/more-stories';

export type Params = {
  slug: string;
};

type Props = {
  home: Page.HomePage;
  allPosts: Page.BlogPost[];
};

export default function Index({ home, allPosts }: Props) {
  const heroPost = allPosts[0];
  const morePosts = allPosts.slice(1);
  return (
    <>
      <Layout>
        <Head>
          <title>{home.title}</title>
        </Head>
        <Container>
          <Intro title={home.intro.title} byline={home.intro.byline} />
          {heroPost && (
            <HeroPost
              title={heroPost.title}
              coverImage={heroPost.coverImage?.src}
              date={heroPost.date}
              // Todo: pass picture
              author={heroPost.author as any}
              slug={heroPost.path}
              excerpt={heroPost.excerpt}
            />
          )}
          {morePosts.length > 0 && <MoreStories posts={morePosts} />}
        </Container>
      </Layout>
    </>
  );
}

export const getStaticProps = async (context: GetStaticPropsContext<Params>) => {
  const api = createApi(context.previewData);
  const home = await api.getHomePage();
  const allPosts = await api.getAllPosts();
  return {
    props: { home, allPosts }
  };
};
