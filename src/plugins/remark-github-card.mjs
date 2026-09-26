import { visit } from 'unist-util-visit'

const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/

export function remarkGithubCard() {
  return (tree) => {
    visit(tree, ['containerDirective', 'leafDirective', 'textDirective'], (node) => {
      if (node.name !== 'github') return

      const repository = String(node.attributes?.repo || '').trim()
      if (!REPOSITORY_PATTERN.test(repository)) return

      const [owner, name] = repository.split('/')
      const repositoryUrl = `https://github.com/${owner}/${name}`
      const data = node.data || (node.data = {})

      data.hName = 'article'
      data.hProperties = {
        className: ['githubRepoEmbed'],
        'data-github-repo': repository,
        'data-state': 'loading',
        'aria-busy': 'true',
      }
      data.hChildren = [createCard(repositoryUrl, owner, name)]
    })
  }
}

function createCard(repositoryUrl, owner, name) {
  return element('a', 'githubRepoEmbedLink', [
    element('div', 'githubRepoEmbedHeader', [
      element('div', 'githubRepoEmbedIdentity', [
        element('span', 'githubRepoEmbedAvatar', [
          element('img', '', [], {
            src: `https://github.com/${encodeURIComponent(owner)}.png?size=64`,
            alt: '',
            width: 32,
            height: 32,
            loading: 'lazy',
            decoding: 'async',
          }),
        ]),
        element('span', 'githubRepoEmbedName', [
          element('span', 'githubRepoEmbedOwner', [text(owner)]),
          element('span', 'githubRepoEmbedDivider', [text('/')]),
          element('strong', 'githubRepoEmbedRepository', [text(name)]),
        ]),
      ]),
      element('span', 'githubRepoEmbedStatus', [text('GitHub')], {
        'data-github-field': 'status',
      }),
      icon('githubRepoEmbedExternal', 'M7 17 17 7M7 7h10v10'),
    ]),
    element('p', 'githubRepoEmbedDescription', [text('正在获取仓库信息...')], {
      'data-github-field': 'description',
      'aria-live': 'polite',
    }),
    element('div', 'githubRepoEmbedMeta', [
      element('span', 'githubRepoEmbedMetaItem githubRepoEmbedLanguage', [
        element('i', 'githubRepoEmbedLanguageDot', [], { 'aria-hidden': 'true' }),
        element('span', '', [text('---')], { 'data-github-field': 'language' }),
      ], { title: '主要语言' }),
      stat('star', 'stars', 'Star'),
      stat('fork', 'forks', 'Fork'),
      stat('license', 'license', 'License'),
    ]),
  ], {
    href: repositoryUrl,
    target: '_blank',
    rel: 'noopener noreferrer',
    'aria-label': `在 GitHub 查看 ${owner}/${name}`,
  })
}

function stat(type, field, title) {
  const paths = {
    star: 'M12 2.8l2.8 5.67 6.26.91-4.53 4.42 1.07 6.24L12 17.1l-5.6 2.94 1.07-6.24-4.53-4.42 6.26-.91L12 2.8Z',
    fork: 'M7 5a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm14 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM14 19a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM5 7v3a4 4 0 0 0 4 4h2v3m8-10v3a4 4 0 0 1-4 4h-4',
    license: 'M6 3h9l3 3v15H6V3Zm8 0v4h4M9 11h6M9 15h6',
  }

  return element('span', `githubRepoEmbedMetaItem githubRepoEmbed${capitalize(type)}`, [
    icon('githubRepoEmbedMetaIcon', paths[type]),
    element('span', '', [text('--')], { 'data-github-field': field }),
  ], { title })
}

function icon(className, path) {
  return element('svg', className, [
    element('path', '', [], { d: path }),
  ], { viewBox: '0 0 24 24', 'aria-hidden': 'true' })
}

function element(tagName, className, children = [], properties = {}) {
  return {
    type: 'element',
    tagName,
    properties: {
      ...(className ? { className: className.split(' ') } : {}),
      ...properties,
    },
    children,
  }
}

function text(value) {
  return { type: 'text', value }
}

function capitalize(value) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
}
