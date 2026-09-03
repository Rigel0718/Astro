# 프로젝트 개요

이 저장소는 AstroPaper 6.1.0을 기반으로 한 정적 기술 블로그다. Python, Backend, AI Agent 학습 내용을 Markdown/MDX로 작성해 게시하는 용도이며, AstroPaper의 페이지·컴포넌트·유틸리티 구조를 유지한 채 `astro-paper.config.ts`를 중심으로 동작을 설정한다.

현재 런타임 기반은 Astro 7, TypeScript strict 설정, Tailwind CSS 4다. 사이트는 한국어(`ko`)를 기본 locale로 삼고 GitHub Pages의 프로젝트 사이트 `https://Rigel0718.github.io/Astro`에 정적 배포되도록 구성되어 있다. UI 번역 리소스는 현재 영어 파일만 있어, 한국어 locale에서도 `useTranslations()`의 영어 fallback을 사용한다.

## 핵심 디렉터리와 책임

- `src/content/`: 게시물과 독립 페이지의 원본 콘텐츠. 일반 게시 흐름은 이곳에 Markdown 또는 MDX 파일을 추가하는 방식이다.
- `src/pages/`: Astro 파일 기반 route. 목록, 상세 글, tag, archive, search, RSS, sitemap 연계용 endpoint와 OG 이미지 endpoint를 구성한다.
- `src/layouts/`: 공통 HTML/SEO/theme shell인 `Layout.astro`와 글 전용 메타데이터를 더하는 `PostLayout.astro`가 있다.
- `src/components/`: Header, Footer, Card, Pagination, Tag, Breadcrumb 등 AstroPaper의 재사용 UI 단위다. 페이지는 이 컴포넌트들을 조합하는 얇은 계층으로 유지된다.
- `src/utils/`: 게시물 정렬·필터링·slug/URL 생성, base path 처리, OG 이미지 해석 등 여러 route와 component가 공유하는 로직이다.
- `src/i18n/`: UI 문자열 타입, interpolation, locale별 문자열 로딩을 담당한다.
- `src/styles/`: Tailwind 진입점과 theme token, typography 규칙. `global.css`가 나머지 스타일과 callout theme를 불러온다.
- `src/assets/`: Astro가 처리하는 이미지와 SVG 아이콘. 글에서 빌드 파이프라인을 거쳐 사용할 자산을 둔다.
- `public/`: favicon, 기본 OG 이미지와 같은 원본 그대로 배포할 정적 파일. `public/pagefind/`는 build 후 복사된 검색 bundle/index다.
- `.github/workflows/deploy.yml`: `main` push 또는 수동 실행 시 GitHub Pages를 build하고 deploy하는 workflow다.

## 설정 구조

`astro-paper.config.ts`가 사이트 수준의 주 설정 파일이다. 사이트 URL·제목·설명·작성자·언어·시간대, 페이지당 글 수, 예약 게시 여유 시간, theme/search/archive/동적 OG/edit-link 기능, 소셜 및 공유 링크를 선언한다. `src/types/config.ts`가 이 공개 설정의 타입을 정의하고, `src/config.ts`가 기본값과 `PUBLIC_GOOGLE_SITE_VERIFICATION` 환경값을 합쳐 내부에서 사용하는 완전한 설정을 만든다. AstroPaper 관련 설정은 가능한 한 이 흐름을 통해 변경한다. 게시물 주제 허브의 표시 메타데이터는 `src/config/postTopics.ts`에서 관리하며, 상위 `/posts` 목록과 각 주제 허브가 같은 값을 사용한다.

현재 주요 값은 다음과 같다.

- 글 목록과 홈의 글 수는 각각 4개다.
- light/dark mode, archive, back button, Pagefind search, 동적 OG 이미지가 활성화되어 있다.
- edit-post 링크는 비활성화되어 있고 social profile 목록은 비어 있다.
- 공유 대상은 WhatsApp, Facebook, X, Telegram, Pinterest, email이다.
- 기본 OG 파일은 `public/default-og.jpg`다.

`astro.config.ts`는 Astro 자체 구성을 담당한다. `site`는 AstroPaper 설정의 `https://Rigel0718.github.io`, `base`는 `/Astro`이며, 기본 locale `ko`에는 URL prefix를 붙이지 않는다. MDX와 sitemap integration, Tailwind Vite plugin, Google Sans Code font, Astro SVG optimizer가 설정되어 있다. Markdown은 TOC/collapse와 callout plugin을 거치며, Shiki light/dark theme와 filename·highlight·diff transformer를 사용한다.

`tsconfig.json`은 Astro strict preset을 사용하며 `@/*`를 `src/*`에, `@/astro-paper.config`를 root 설정 파일에 연결한다. ESLint는 Astro 권장 규칙과 TypeScript parser를 사용하고 `console` 호출을 오류로 취급한다.

## 콘텐츠와 게시물 구조

`src/content.config.ts`가 두 Content Collection을 정의한다.

- `posts`: `src/content/posts/**/*.{md,mdx}` 중 파일명이 `_`로 시작하지 않는 파일을 읽는다. 필수 frontmatter는 `pubDatetime`, `title`, `description`이며 author와 tags에는 기본값이 있다. 수정일, featured/draft, OG 이미지, canonical URL, edit-link 숨김, 개별 timezone도 지원한다.
- `pages`: `src/content/pages/`의 Markdown/MDX를 읽으며 title을 필수로 하고 description, OG 이미지, canonical URL을 선택적으로 받는다. 현재 `/about` 페이지가 `about.md`를 렌더링한다.

게시물 디렉터리의 하위 폴더는 URL 경로가 될 수 있지만, 이름이 `_`로 시작하는 폴더 segment는 URL에서 제외된다. 예를 들어 `_releases/astro-paper-6.md`는 `/posts/astro-paper-6` 형태가 된다. `getPostPaths.ts`가 이 규칙과 locale/base 적용을 한곳에서 처리한다.

`postFilter()`는 draft를 항상 제외하고, production에서는 예약 시간이 지나지 않은 글도 제외한다. development에서는 작성 편의를 위해 draft가 아닌 예약 글을 표시한다. `getSortedPosts()`는 이 필터를 적용한 뒤 `modDatetime` 우선, 없으면 `pubDatetime` 기준 최신순으로 정렬한다. tag 목록과 archive도 같은 필터 계열을 사용한다. Python 주제와 그 아래 `파이썬 객체에 대한 이해`, `파이썬 실행에 대한 이해` 시리즈의 제목, 설명, slug, 전체 에피소드 수는 `src/config/postTopics.ts`에서 함께 관리한다.

AstroPaper에 포함되어 있던 예제 게시물은 제거된 상태다. 새 글은 `src/content/posts/`에 Markdown 또는 MDX 파일로 추가하며, About 콘텐츠는 `src/content/pages/about.md`에서 관리한다.

## Routing과 layout

주요 정적 route는 다음 책임으로 나뉜다.

- `/`: featured 글과 최근 글을 보여 주는 홈.
- `/posts`: 주제별 게시물 허브 목록. 현재는 Python 허브 진입 항목만 표시하며, Python 하위 게시물은 이 페이지에 직접 표시하지 않는다.
- `/posts/<slug>`: Markdown/MDX 본문, 날짜, tag, 공유 링크, 인접 글 navigation, 읽기 진행률, heading anchor, code copy, 이미지 lightbox를 제공하는 상세 페이지.
- `/posts/python`: Python 주제별 시리즈를 소개하는 허브. Header의 `Posts` 하위 `Python` 항목에서 진입한다.
- `/posts/python/understanding-python-objects`: `파이썬 객체에 대한 이해` 시리즈의 8개 에피소드 목차와 게시 진행률을 보여 준다. `src/content/posts/python/understanding-python-objects/`의 게시물을 파일명 순서로 자동 수집한다.
- `/posts/python/understanding-python-execution`: `파이썬 실행에 대한 이해` 시리즈의 11개 에피소드 목차와 게시 진행률을 보여 준다. `src/content/posts/python/understanding-python-execution/`의 게시물을 파일명 순서로 자동 수집한다.
- `/tags`와 `/tags/<tag>`: tag 색인 및 tag별 pagination.
- `/archives`: 연도·월별 archive. feature가 꺼지면 404로 rewrite된다.
- `/search`: Pagefind UI. search feature가 꺼지면 404로 rewrite된다.
- `/about`, `/404`: 독립 페이지와 오류 페이지.
- `/rss.xml`, `/robots.txt`: build-time endpoint.
- `/og.png`, `/posts/<slug>/index.png`: Satori와 Sharp로 만드는 기본/게시물별 OG 이미지 endpoint.

대부분의 페이지는 `Layout.astro` 안에 Header, Breadcrumb/Main, Footer를 조합한다. `Layout.astro`는 canonical/SEO/Open Graph/RSS/sitemap metadata, Google font, 전역 CSS, theme 초기화, Astro ClientRouter를 소유한다. 글 상세는 `PostLayout.astro`를 한 겹 더 사용해 article meta와 BlogPosting JSON-LD를 추가한다.

## Base path와 URL 처리

사이트가 domain root가 아닌 `/Astro` 아래 배포되므로 내부 URL을 직접 root-relative 문자열로 만들지 않는다.

- page/navigation URL과 게시물 URL은 주로 Astro의 `getRelativeLocaleUrl()`을 사용한다. 이 함수가 locale routing과 설정된 base를 반영한다.
- `src/utils/withBase.ts`의 `getAssetPath()`는 favicon, sitemap, Pagefind bundle, 기본 OG 이미지 같은 public asset 경로에 `import.meta.env.BASE_URL`을 붙인다.
- 같은 파일의 `stripBase()`와 `stripLocale()`는 현재 URL에서 deploy base와 locale을 제거해 Header active state와 Breadcrumb가 논리 route를 기준으로 동작하게 한다.
- pagination URL은 Astro의 `paginate()`가 생성한 `page.url`을 그대로 사용한다.
- canonical과 절대 social URL은 `Astro.site`, `Astro.url`, Content frontmatter의 `canonicalURL`을 조합한다.

새 링크나 asset 경로도 이 기존 utility 또는 Astro URL API를 재사용해야 한다.

### Python 시리즈 작성 위치

`파이썬 객체에 대한 이해`의 에피소드는 `src/content/posts/python/understanding-python-objects/`에 `01-주제.md`, `02-주제.md`처럼 두 자리 번호로 시작하는 Markdown 파일을 추가한다. 이 파일명 순서가 시리즈 목차 순서가 되며, 실제 글 URL은 `/posts/python/understanding-python-objects/<파일명-slug>` 형태다. `_episode-template.md`는 Content Collection에서 제외되는 작성용 템플릿이므로 복사한 뒤 `_`로 시작하지 않는 파일명으로 바꾸어 사용한다.

`파이썬 실행에 대한 이해`도 같은 방식으로 `src/content/posts/python/understanding-python-execution/`에 에피소드를 추가한다. 이 디렉터리의 `_episode-template.md`를 복사해 두 자리 번호로 시작하는 파일명으로 바꾸면 시리즈 상세 페이지에 자동으로 표시된다.

## Build와 deployment

필수 Node 버전은 22.12.0 이상이다. 주요 명령은 다음과 같다.

- `npm run dev`: Astro development server.
- `npm run build`: 오래된 Content Layer cache를 제거하는 `astro sync --force` → `astro check` → `astro build` → `pagefind --site dist` → 생성된 `dist/pagefind`를 `public/pagefind/`에 복사.
- `npm run preview`: production build preview.
- `npm run lint`, `npm run format:check`: 정적 검사와 formatting 검사.

Astro build 산출물은 `dist/`이며 source로 수정하지 않는다. Pagefind는 완성된 HTML을 색인하므로 production build 뒤에 실행된다. 검색 UI는 `getAssetPath("pagefind/")`를 bundle path로 받아 `/Astro` 배포에서도 동작하고, development에서는 기존에 생성된 `public/pagefind` 결과를 사용한다.

GitHub Actions는 `main` branch push 시 `withastro/action`으로 install/build/upload한 뒤 `actions/deploy-pages`로 GitHub Pages에 배포한다. Sitemap integration은 archive 기능 설정을 반영하고, RSS·robots·OG endpoint도 정적 build 결과에 포함된다.

## 현재 재사용해야 할 주요 기능과 utility

- Content 조회와 표시: `getSortedPosts`, `postFilter`, `getUniqueTags`.
- 게시물 route와 링크: `getPostSlug`, `getPostUrl`, `slugifyStr`, `slugifyAll`.
- 프로젝트 사이트 경로 처리: `getAssetPath`, `stripBase`, `stripLocale`, Astro `getRelativeLocaleUrl`.
- SEO/OG: `Layout`, `PostLayout`, `resolveDefaultOgImagePath`, 동적 OG endpoint.
- 공통 UI: `Header`, `Footer`, `Main`, `Card`, `Tag`, `Pagination`, `Breadcrumb`, `Datetime`, `LinkButton`.
- 테마: 초기 paint 전에 theme를 적용하는 `Layout.astro` inline script와 navigation 이후 상태를 동기화하는 `src/scripts/theme.ts`.
- 검색: 글 상세의 `data-pagefind-body`, build script의 Pagefind index 생성, `/search`의 Pagefind UI.
- 스타일: Tailwind 4 theme token과 `app-layout`, `app-prose`, `active-nav` 같은 기존 utility class.
