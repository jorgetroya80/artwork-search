# Changelog

## [0.3.0](https://github.com/jorgetroya80/artwork-search/compare/v0.2.0...v0.3.0) (2026-10-02)


### Features

* deploy to Render ([#13](https://github.com/jorgetroya80/artwork-search/issues/13)) ([9c72596](https://github.com/jorgetroya80/artwork-search/commit/9c7259669605ecf086461fd5e8d540b9ef6234be))

## [0.2.0](https://github.com/jorgetroya80/artwork-search/compare/v0.1.0...v0.2.0) (2026-10-02)


### Features

* publish Docker image to GHCR ([#10](https://github.com/jorgetroya80/artwork-search/issues/10)) ([358e507](https://github.com/jorgetroya80/artwork-search/commit/358e507497d0121e380c1e891d0ed43cf1f736f7))

## [0.1.0](https://github.com/jorgetroya80/artwork-search/commits/v0.1.0) (2026-10-01)


### Features

* **api:** add constants, public types and search input normalization ([c151a71](https://github.com/jorgetroya80/artwork-search/commit/c151a71d1249ef18431a5fdf6aa6aaca3f8ad43c))
* **api:** add defensive JSON-LD parsing with preferred-term names ([8402bde](https://github.com/jorgetroya80/artwork-search/commit/8402bde6e4dba0e51b156238866701647937d20a))
* **api:** add fetchArtwork with notation artists, image chain and partial failure ([a1b84a8](https://github.com/jorgetroya80/artwork-search/commit/a1b84a8aa77a80fd934b5eddfa28962fccfe74e0))
* **api:** add loadMore over cursor pages with loadMoreError and reset on new search ([0dc2413](https://github.com/jorgetroya80/artwork-search/commit/0dc24137d76534466a4e71ee4dabe74419fb1091))
* **api:** add pagination helpers for load-more batches over cursor pages ([74fc344](https://github.com/jorgetroya80/artwork-search/commit/74fc344082ab26aa933899c37a44adaf20f431bb))
* **api:** add public index, document test scripts and mark spec implemented ([b112a51](https://github.com/jorgetroya80/artwork-search/commit/b112a517de039069dbd5c303b97372a590d1847b))
* **api:** add QueryClient with retry policy, entity cache and useArtwork ([1796cbc](https://github.com/jorgetroya80/artwork-search/commit/1796cbc7d962b3a97b4db0fc87f111817df17a93))
* **api:** add RijksApiError and fetchJson with timeout, abort and URL allowlist ([431d9cb](https://github.com/jorgetroya80/artwork-search/commit/431d9cb80340ba6872c010c75c33b16708aced3d))
* **api:** add searchCollection with imageAvailable filter and cursor token ([3928752](https://github.com/jorgetroya80/artwork-search/commit/392875258fee877831fa67615e14e58731fc8723))
* **api:** add useArtworkSearch first batch with idle, empty and error states ([4ad8c45](https://github.com/jorgetroya80/artwork-search/commit/4ad8c4598ac430d23d44aeb20822c5c63a09eb84))
* **search:** add empty state and search error with retry ([206bc98](https://github.com/jorgetroya80/artwork-search/commit/206bc98717bd15d4178a6c703041680698941ba2))
* **search:** add error message and date range helpers ([d3354ce](https://github.com/jorgetroya80/artwork-search/commit/d3354ce9685d5a71e2daaa29350910faf8fddabf))
* **search:** add Load more with pending state and inline error ([2a0cce8](https://github.com/jorgetroya80/artwork-search/commit/2a0cce8fbe4acf901ecbc584b5746e9932af6268))
* **search:** add responsive artwork grid with skeletons, image fallback and item retry ([d0cf8ed](https://github.com/jorgetroya80/artwork-search/commit/d0cf8ed0c11432078cbc7489727046ea44585c79))
* **search:** add search form with pending state and results status line ([65dabb1](https://github.com/jorgetroya80/artwork-search/commit/65dabb1780b2ebe1bf65f4cd77724d58b96293a5))
* **ui:** add Base UI, semantic theme tokens and UI library import guard ([88847a8](https://github.com/jorgetroya80/artwork-search/commit/88847a874ba7ba83560650bf307c50b723d974ae))
* **ui:** add Button wrapper with primary, secondary and pending states ([4776c20](https://github.com/jorgetroya80/artwork-search/commit/4776c207cfbd442749d28426e41daaa13f40d15b))
* **ui:** add TextField wrapper with linked label and description ([86f9bf1](https://github.com/jorgetroya80/artwork-search/commit/86f9bf150eb798d4f166061a193ec2a8b9283eeb))


### Bug Fixes

* **api:** accept only https image URLs from the API ([41649bc](https://github.com/jorgetroya80/artwork-search/commit/41649bc9d1c7e8c8dcab5e39919cd821ab254e0f))
* **api:** base hasMore on loaded pages and keep results on refetch errors ([125c616](https://github.com/jorgetroya80/artwork-search/commit/125c61666467f5c03f5226a96dbb07ba1cb6bcd2))
* **search:** keep keyboard focus on a stable element after Try again and Retry ([c77bf08](https://github.com/jorgetroya80/artwork-search/commit/c77bf085281908e085a272bf1cc1251dc8879572))
* **search:** set page title, wrap long card text and test landmarks ([e8609e2](https://github.com/jorgetroya80/artwork-search/commit/e8609e2788c2207fb9ea1dbd67f0833d3e814dc2))
