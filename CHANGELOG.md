# Changelog

## [0.18.0](https://github.com/hatayama/UnityHubCli/compare/unity-hub-cli-v0.17.0...unity-hub-cli-v0.18.0) (2025-12-07)


### Features

* add OSV-Scanner and @lavamoat/allow-scripts for enhanced security ([#65](https://github.com/hatayama/UnityHubCli/issues/65)) ([68ddd03](https://github.com/hatayama/UnityHubCli/commit/68ddd03845a4dd1594896dfab60f024eafbfc5eb))
* add shell integration for automatic cd after launching Unity ([#63](https://github.com/hatayama/UnityHubCli/issues/63)) ([dbfd6dd](https://github.com/hatayama/UnityHubCli/commit/dbfd6dd8d67ddb9e8d7e8f684fbccf8e4d19b6e3))
* improve shell integration with auto-install and robust path handling ([#66](https://github.com/hatayama/UnityHubCli/issues/66)) ([ab9f681](https://github.com/hatayama/UnityHubCli/commit/ab9f681a134f43c6ddc7c01d74e074236859e2c7))


### Bug Fixes

* migrate ESLint to v9 flat config format ([#67](https://github.com/hatayama/UnityHubCli/issues/67)) ([044eeb9](https://github.com/hatayama/UnityHubCli/commit/044eeb9dc1c037637fe687582029e5c92f344b9e))

## [0.17.0](https://github.com/hatayama/UnityHubCli/compare/unity-hub-cli-v0.16.0...unity-hub-cli-v0.17.0) (2025-12-02)


### Features

* add supply chain security measures ([#57](https://github.com/hatayama/UnityHubCli/issues/57)) ([b46bd96](https://github.com/hatayama/UnityHubCli/commit/b46bd9653f0cfab6624555cc32e7901b5be2fd22))

## [0.16.0](https://github.com/hatayama/UnityHubCli/compare/unity-hub-cli-v0.15.0...unity-hub-cli-v0.16.0) (2025-11-28)


### Features

* added support for opening IDE files on Windows. It now also works in the GitBash environment. ([#54](https://github.com/hatayama/UnityHubCli/issues/54)) ([9230b11](https://github.com/hatayama/UnityHubCli/commit/9230b1152d33de0697bb16aa71076ee1d39e8b40))

## [0.15.0](https://github.com/hatayama/UnityHubCli/compare/unity-hub-cli-v0.14.0...unity-hub-cli-v0.15.0) (2025-11-27)


### Features

* Add editor-only launch and .sln file direct specification ([#52](https://github.com/hatayama/UnityHubCli/issues/52)) ([0ac26d7](https://github.com/hatayama/UnityHubCli/commit/0ac26d7a66437298033c9826c1e0552b1e7dfa9b))

## [0.14.0](https://github.com/hatayama/UnityHubCli/compare/unity-hub-cli-v0.13.2...unity-hub-cli-v0.14.0) (2025-11-26)


### Features

* auto-detect terminal background color and apply dynamic theme ([#49](https://github.com/hatayama/UnityHubCli/issues/49)) ([4496d0c](https://github.com/hatayama/UnityHubCli/commit/4496d0c16ece90b0c362d5059459b6843719f3f3))

## [0.13.2](https://github.com/hatayama/UnityHubCli/compare/unity-hub-cli-v0.13.1...unity-hub-cli-v0.13.2) (2025-11-13)


### Bug Fixes

* ignore Unity worker processes when focusing existing editor ([#47](https://github.com/hatayama/UnityHubCli/issues/47)) ([e1d414f](https://github.com/hatayama/UnityHubCli/commit/e1d414f2215918c352329cb5a7944435e3d144cc))

## [0.13.1](https://github.com/hatayama/UnityHubCli/compare/unity-hub-cli-v0.13.0...unity-hub-cli-v0.13.1) (2025-11-04)


### Bug Fixes

* height calculation when status bar wraps and improve UI ([#45](https://github.com/hatayama/UnityHubCli/issues/45)) ([4ad04f4](https://github.com/hatayama/UnityHubCli/commit/4ad04f4e923f8c2db16fac22f078c8c7f83c0a7f))

## [0.13.0](https://github.com/hatayama/UnityHubCli/compare/unity-hub-cli-v0.12.0...unity-hub-cli-v0.13.0) (2025-11-01)


### Features

* add Windows support ([#43](https://github.com/hatayama/UnityHubCli/issues/43)) ([cb28b68](https://github.com/hatayama/UnityHubCli/commit/cb28b68ccdcef0e826368a56c4f61de317e35c23))

## [0.12.0](https://github.com/hatayama/UnityHubCli/compare/unity-hub-cli-v0.11.0...unity-hub-cli-v0.12.0) (2025-10-31)


### Features

* add clearScreen function to enhance terminal UI experience ([#41](https://github.com/hatayama/UnityHubCli/issues/41)) ([0181eb0](https://github.com/hatayama/UnityHubCli/commit/0181eb00b3bc8298500696ae2555e87bfd876e1e))

## [0.11.0](https://github.com/hatayama/UnityHubCli/compare/unity-hub-cli-v0.10.1...unity-hub-cli-v0.11.0) (2025-10-30)


### Features

* Visibility modal to toggle branch/path display and persist settings ([#39](https://github.com/hatayama/UnityHubCli/issues/39)) ([8e3388d](https://github.com/hatayama/UnityHubCli/commit/8e3388d0543d8c1e6679b489a756ac416b24b8c3))

## [0.10.1](https://github.com/hatayama/UnityHubCli/compare/unity-hub-cli-v0.10.0...unity-hub-cli-v0.10.1) (2025-10-30)


### Bug Fixes

* stabilize ProjectRow width using stdout columns; remove selection-based margin shift ([#37](https://github.com/hatayama/UnityHubCli/issues/37)) ([a79804f](https://github.com/hatayama/UnityHubCli/commit/a79804ffbf41344209a9de71bb8df661b4f6f75c))

## [0.10.0](https://github.com/hatayama/UnityHubCli/compare/unity-hub-cli-v0.9.0...unity-hub-cli-v0.10.0) (2025-10-30)


### Features

* Refactor presentation layer and replace overlay modal with screen-based Sort ([#35](https://github.com/hatayama/UnityHubCli/issues/35)) ([f9fac54](https://github.com/hatayama/UnityHubCli/commit/f9fac5418c517dd3c1788adca58847a445da17b2))

## [0.9.0](https://github.com/hatayama/UnityHubCli/compare/unity-hub-cli-v0.8.0...unity-hub-cli-v0.9.0) (2025-10-29)


### Features

* **ui:** Add in-app sort menu modal with persistent preferences and git-root path copy ([#34](https://github.com/hatayama/UnityHubCli/issues/34)) ([44c7d00](https://github.com/hatayama/UnityHubCli/commit/44c7d00f3d8bdded429ff813e6ca4bed115bbf4d))


### Bug Fixes

* enhance project selection display in TUI ([#33](https://github.com/hatayama/UnityHubCli/issues/33)) ([e3dd5fd](https://github.com/hatayama/UnityHubCli/commit/e3dd5fd7558a46b3124c6ecba13d8114b22c41f1))
* Prevent TUI overflow on narrow terminals; truncate lines; simplify hint ([#31](https://github.com/hatayama/UnityHubCli/issues/31)) ([10e9376](https://github.com/hatayama/UnityHubCli/commit/10e9376137aadac33148617528dbb64f3d0671f1))

## [0.8.0](https://github.com/hatayama/UnityHubCli/compare/unity-hub-cli-v0.7.0...unity-hub-cli-v0.8.0) (2025-10-29)


### Features

* 3-stage Unity termination and conditional Temp cleanup (3s graceful) ([#29](https://github.com/hatayama/UnityHubCli/issues/29)) ([dba44ee](https://github.com/hatayama/UnityHubCli/commit/dba44ee26e2bd1b7e9062ac9f15a170ff092db82))

## [0.7.0](https://github.com/hatayama/UnityHubCli/compare/unity-hub-cli-v0.6.1...unity-hub-cli-v0.7.0) (2025-10-27)


### Features

* update version ([ed1556f](https://github.com/hatayama/UnityHubCli/commit/ed1556f7672c0a1bb2e0e3d4d55e6e5ade216186))

## [0.6.1](https://github.com/hatayama/UnityHubCli/compare/unity-hub-cli-v0.6.0...unity-hub-cli-v0.6.1) (2025-10-27)


### Bug Fixes

* remove extra hint margin ([#25](https://github.com/hatayama/UnityHubCli/issues/25)) ([3929385](https://github.com/hatayama/UnityHubCli/commit/39293857cef9fa1269ce47a661cf5a6280dca929))

## [0.6.0](https://github.com/hatayama/UnityHubCli/compare/unity-hub-cli-v0.5.0...unity-hub-cli-v0.6.0) (2025-10-27)


### Features

* focus running Unity session per project ([#23](https://github.com/hatayama/UnityHubCli/issues/23)) ([9faa7db](https://github.com/hatayama/UnityHubCli/commit/9faa7db7347903c472f17828bffc0194b5f4e30d))

## [0.5.0](https://github.com/hatayama/UnityHubCli/compare/unity-hub-cli-v0.4.0...unity-hub-cli-v0.5.0) (2025-10-27)


### Features

* add Unity termination support and running label ([#21](https://github.com/hatayama/UnityHubCli/issues/21)) ([2d68e46](https://github.com/hatayama/UnityHubCli/commit/2d68e46bc0175cdea0f354b938aaca3c08201b97))

## [0.4.0](https://github.com/hatayama/UnityHubCli/compare/unity-hub-cli-v0.3.0...unity-hub-cli-v0.4.0) (2025-10-27)


### Features

* update version ([256cbc6](https://github.com/hatayama/UnityHubCli/commit/256cbc669bd81e864ac2901cb92681e6cad0fe21))

## [0.3.0](https://github.com/hatayama/UnityHubCli/compare/unity-hub-cli-v0.2.0...unity-hub-cli-v0.3.0) (2025-10-24)


### Features

* update version ([2c52b42](https://github.com/hatayama/UnityHubCli/commit/2c52b425e69a42856e42159fa85187e28b6b4f67))

## [0.2.0](https://github.com/hatayama/UnityHubCli/compare/unity-hub-cli-v0.1.0...unity-hub-cli-v0.2.0) (2025-10-16)


### Features

* update App UI ([#8](https://github.com/hatayama/UnityHubCli/issues/8)) ([daea51b](https://github.com/hatayama/UnityHubCli/commit/daea51b808c1f5c4e14092710898c40f6087823b))
* update App UI ([#9](https://github.com/hatayama/UnityHubCli/issues/9)) ([03953ff](https://github.com/hatayama/UnityHubCli/commit/03953ffe4b5b15efcf9e8ce565694339adc40f29))
* update minor version ([3048f60](https://github.com/hatayama/UnityHubCli/commit/3048f6052b26ea2f7ca05acc2344e899704211ce))

## 0.1.0 (2025-10-14)


### Features

* trigger release 0.1.0 ([a848c1b](https://github.com/hatayama/UnityHubCli/commit/a848c1beee761965b8d4389bd15063b6f89d4861))


### Miscellaneous Chores

* release 0.1.0 ([0df8674](https://github.com/hatayama/UnityHubCli/commit/0df867444cad2356f5777c7efd5aaf1a16da21e3))
