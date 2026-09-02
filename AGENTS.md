# AGENTS.md

## 프로젝트

이 저장소는 AstroPaper를 기반으로 한 개인 기술 블로그다.

주요 목적은 Python, Backend, AI Agent 등을 공부하며 작성한 기술 글을 Markdown 기반으로 게시하는 것이다.

AstroPaper를 사이트의 기반 구조로 유지한다. 기존 구조를 새로 설계하기보다 AstroPaper가 제공하는 구조와 기능을 설정하거나 확장하는 방식을 우선한다.

## 작업 원칙

요청된 작업에 필요한 범위만 작게 수정한다.

새로운 구조나 추상화를 만들기 전에 기존 AstroPaper의 component, utility, configuration, convention을 우선 확인하고 재사용한다.

현재 작업과 관계없는 refactoring은 하지 않는다.

설정 변경이나 작은 수정으로 해결할 수 있는 문제라면 프로젝트 구조를 변경하는 것보다 이를 우선한다.

블로그의 콘텐츠 작성 방식은 Markdown 중심으로 유지한다. 사이트 기능을 추가하기 위해 일반적인 Markdown 작성 및 게시 과정이 불필요하게 복잡해져서는 안 된다.

## 작업 시작

작업을 시작하기 전에 PROJECT.md를 읽고 현재 프로젝트의 구조, 주요 설정, 기존 기능과 각 영역의 책임을 파악한다.

PROJECT.md를 프로젝트 탐색의 기준으로 사용하고, 현재 작업과 관련된 영역과 파일을 우선 확인한다. 이미 PROJECT.md에 정리된 내용을 파악하기 위해 프로젝트 전체를 반복해서 조사하지 않는다.

구현에 필요한 세부 동작은 관련 source를 직접 확인한다. 필요한 정보가 PROJECT.md에 없거나 불충분한 경우에만 탐색 범위를 확장한다.

PROJECT.md와 실제 source가 다르다면 실제 source를 기준으로 판단한다.

작업으로 인해 프로젝트의 구조, 주요 설정, 기존 기능 또는 책임이 변경되었다면 PROJECT.md도 함께 갱신한다.


## GitHub Pages

이 사이트는 GitHub Pages의 Project Site 형태로 배포된다.

Repository:

```text id="jzt9pj"
Astro
```

Deployment base path:

```text id="9x5j9m"
/Astro
```

`astro.config.ts`의 배포 설정은 이 base path와 호환되어야 한다.

사이트가 `/`에서 서비스된다고 가정하지 않는다.

내부 링크, asset, navigation, route 등을 추가할 때는 AstroPaper의 기존 base-path 처리 방식을 유지한다.

다음과 같은 root-relative path를 직접 hardcoding하기보다 AstroPaper에 이미 존재하는 utility 또는 Astro가 제공하는 base URL 처리 방식을 우선 사용한다.

```text id="o58yn7"
/about
/posts
/_astro/...
```

프로젝트에 이미 적절한 base-path 처리 방식이 존재한다면 같은 기능을 다시 구현하지 않는다.

## AstroPaper

AstroPaper를 교체해야 할 boilerplate가 아니라 현재 프로젝트의 기반 구조로 취급한다.

기능을 구현하기 전에 다음 순서를 따른다.

1. 관련된 AstroPaper의 기존 구현을 먼저 확인한다.
2. 사용할 수 있는 기존 component와 utility가 있다면 재사용한다.
3. 요청을 만족하는 가장 작은 범위의 변경을 선택한다.
4. 명시적으로 변경이 요구되지 않은 기존 동작은 유지한다.

관련 없는 작업을 수행하면서 navigation, layout, routing, content collection, styling system 또는 configuration 구조를 함께 재설계하지 않는다.

## 콘텐츠

기술 글은 기본적으로 Markdown으로 작성한다.

사이트 변경 이후에도 다음과 같은 단순한 작성 흐름을 유지하는 것을 우선한다.

```text id="ocfltp"
Markdown 작성
→ 글 추가
→ Preview
→ Build
→ Publish
```

Astro의 Content Collections와 기존 AstroPaper의 post 구조에서 자연스럽게 동작하는 방식을 우선한다.

일반적인 블로그 글을 작성하기 위해 불필요한 custom markup이나 component 사용을 요구하지 않는다.


## 검증

Code 또는 configuration을 변경한 뒤에는 다음 명령을 실행한다.

```bash id="kh0u6u"
npm run build
```

변경으로 인해 build가 실패한다면 작업이 완료된 것으로 간주하지 않는다.

UI 또는 동작을 변경한 경우 필요하면 development server를 사용해 로컬에서 실제 동작을 확인한다.

작업을 완료하기 전에 diff를 확인하고 변경 범위가 요청된 작업에 한정되어 있는지 확인한다.

`dist/`와 같은 생성된 build output을 source code처럼 직접 수정하지 않는다.

## 공식 문서

Astro 공식 문서:

https://docs.astro.build

Astro의 동작에 의존하는 작업을 수행하거나 기존 구현만으로 의도를 명확히 판단하기 어려운 경우 관련 공식 문서를 확인한다.

관련 문서:

* Routing: https://docs.astro.build/en/guides/routing/
* Astro Components: https://docs.astro.build/en/basics/astro-components/
* Framework Components: https://docs.astro.build/en/guides/framework-components/
* Content Collections: https://docs.astro.build/en/guides/content-collections/
* Styling / Tailwind: https://docs.astro.build/en/guides/styling/
* Internationalization: https://docs.astro.build/en/guides/internationalization/

Astro의 동작을 추측하기보다 프로젝트의 기존 구현과 현재 Astro 공식 문서를 우선한다.
