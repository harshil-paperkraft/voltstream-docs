import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

const paths = [
  {
    title: 'Quickstart',
    body: 'Publish an event and receive it on a local endpoint. About five minutes, no billing details.',
    to: '/docs/getting-started/quickstart',
  },
  {
    title: 'Guides',
    body: 'How delivery, retries, filtering, idempotency and limits actually behave.',
    to: '/docs/guides/webhook-delivery',
  },
  {
    title: 'Tutorials',
    body: 'Build a production consumer, migrate a partner off polling, fan out to hundreds of subscribers.',
    to: '/docs/tutorials/build-a-consumer',
  },
  {
    title: 'API reference',
    body: 'Every endpoint, parameter and error code.',
    to: '/docs/api/overview',
  },
];

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title="Documentation"
      description="Voltstream delivers your events to endpoints you do not control, and keeps retrying until they arrive.">
      <header className={styles.hero}>
        <div className="container">
          <Heading as="h1" className={styles.heroTitle}>
            {siteConfig.title} docs
          </Heading>
          <p className={styles.heroSubtitle}>
            Publish an event. We deliver it to every subscriber, retry until it
            lands, sign it so they can trust it, and keep it replayable.
          </p>
          <div className={styles.heroActions}>
            <Link
              className="button button--primary button--lg"
              to="/docs/getting-started/quickstart">
              Start the quickstart
            </Link>
            <Link className="button button--secondary button--lg" to="/docs/api/overview">
              API reference
            </Link>
          </div>
        </div>
      </header>

      <main className="container margin-vert--xl">
        <div className="row">
          {paths.map((p) => (
            <div key={p.title} className={clsx('col col--3')}>
              <Link to={p.to} className={styles.card}>
                <Heading as="h3" className={styles.cardTitle}>
                  {p.title}
                </Heading>
                <p className={styles.cardBody}>{p.body}</p>
              </Link>
            </div>
          ))}
        </div>
      </main>
    </Layout>
  );
}
