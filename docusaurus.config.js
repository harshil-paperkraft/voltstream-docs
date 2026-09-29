// @ts-check
import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Voltstream',
  tagline: 'Events in. Delivered. Every time.',
  favicon: 'img/favicon.ico',

  url: 'https://docs.voltstream.io',
  baseUrl: '/',

  organizationName: 'harshil-paperkraft',
  projectName: 'voltstream-docs',

  onBrokenLinks: 'throw',

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          editUrl:
            'https://github.com/harshil-paperkraft/voltstream-docs/tree/main/',
          showLastUpdateTime: true,
        },
        blog: {
          showReadingTime: true,
          blogTitle: 'Changelog',
          blogDescription: 'Every release, and what it changes for you.',
          blogSidebarTitle: 'Recent releases',
          editUrl:
            'https://github.com/harshil-paperkraft/voltstream-docs/tree/main/',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: 'img/voltstream-social-card.jpg',
      colorMode: {
        defaultMode: 'light',
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: 'Voltstream',
        logo: {
          alt: 'Voltstream',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'docsSidebar',
            position: 'left',
            label: 'Docs',
          },
          {to: '/docs/api/overview', label: 'API', position: 'left'},
          {to: '/blog', label: 'Changelog', position: 'left'},
          {to: '/docs/faq', label: 'FAQ', position: 'left'},
          {
            href: 'https://github.com/harshil-paperkraft/voltstream-docs',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {label: 'Quickstart', to: '/docs/getting-started/quickstart'},
              {label: 'Guides', to: '/docs/guides/webhook-delivery'},
              {label: 'API reference', to: '/docs/api/overview'},
            ],
          },
          {
            title: 'Support',
            items: [
              {label: 'FAQ', to: '/docs/faq'},
              {label: 'Status', href: 'https://status.voltstream.io'},
              {label: 'Support', href: 'mailto:support@voltstream.io'},
            ],
          },
          {
            title: 'More',
            items: [
              {label: 'Changelog', to: '/blog'},
              {
                label: 'GitHub',
                href: 'https://github.com/harshil-paperkraft/voltstream-docs',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Voltstream, Inc. Sample documentation.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['bash', 'json', 'python', 'go'],
      },
    }),
};

export default config;
