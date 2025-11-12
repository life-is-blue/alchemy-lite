![logo](https://cnb.cool/images/favicon.png)

[](https://cnb.cool/)

[examples/](https://cnb.cool/examples)
[ecosystem/](https://cnb.cool/examples/ecosystem)
[use-cache](https://cnb.cool/examples/ecosystem/use-cache)

Public

 Type  to search

[](https://cnb.cool/explore)

4

6

Login

[Code](https://cnb.cool/examples/ecosystem/use-cache)
[Issues\
\
1](https://cnb.cool/examples/ecosystem/use-cache/-/issues)
[Pull requests](https://cnb.cool/examples/ecosystem/use-cache/-/pulls)
[Events](https://cnb.cool/examples/ecosystem/use-cache/-/build/logs)
[Packages](https://cnb.cool/examples/ecosystem/use-cache/-/packages)
[Insights](https://cnb.cool/examples/ecosystem/use-cache/-/insights/contributors)

main

[Branch\
\
2](https://cnb.cool/examples/ecosystem/use-cache/-/branches)
[Tag\
\
0](https://cnb.cool/examples/ecosystem/use-cache/-/tags)

Fork

[段超](https://cnb.cool/u/sixther)

[docs: add README.en.md](https://cnb.cool/examples/ecosystem/use-cache/-/commit/373abfb6ab8d33162b5a369022da7195b4d61941)

2025-04-23

[373abfb6](https://cnb.cool/examples/ecosystem/use-cache/-/commit/373abfb6ab8d33162b5a369022da7195b4d61941)

[7 commits](https://cnb.cool/examples/ecosystem/use-cache/-/commits/main)

|     |     |     |
| --- | --- | --- |
| [.ide](https://cnb.cool/examples/ecosystem/use-cache/-/tree/main/.ide ".ide") | [feat: 添加云原生开发环境](https://cnb.cool/examples/ecosystem/use-cache/-/commit/a78b2d38cf7abd5a325b3559b656ca7e9eb25bdb "feat: 添加云原生开发环境<br>") | 2024-11-19 |
| [assets](https://cnb.cool/examples/ecosystem/use-cache/-/tree/main/assets "assets") | [docs: 教程文档](https://cnb.cool/examples/ecosystem/use-cache/-/commit/a5259281435d706aa72ec709fe8ff6498a3d5efe "docs: 教程文档<br>") | 2024-11-19 |
| [.cnb.yml](https://cnb.cool/examples/ecosystem/use-cache/-/blob/main/.cnb.yml ".cnb.yml") | [docs: 教程文档](https://cnb.cool/examples/ecosystem/use-cache/-/commit/a5259281435d706aa72ec709fe8ff6498a3d5efe "docs: 教程文档<br>") | 2024-11-19 |
| [.gitignore](https://cnb.cool/examples/ecosystem/use-cache/-/blob/main/.gitignore ".gitignore") | [feat: 添加无cache流水线验证](https://cnb.cool/examples/ecosystem/use-cache/-/commit/5088b78053f968a410e2faf0fa2bfa9d492eac24 "feat: 添加无cache流水线验证<br>") | 2024-11-19 |
| [README.en.md](https://cnb.cool/examples/ecosystem/use-cache/-/blob/main/README.en.md "README.en.md") | [docs: add README.en.md](https://cnb.cool/examples/ecosystem/use-cache/-/commit/373abfb6ab8d33162b5a369022da7195b4d61941 "docs: add README.en.md<br><br>PR-URL: #1<br>") | 2025-04-23 |
| [README.md](https://cnb.cool/examples/ecosystem/use-cache/-/blob/main/README.md "README.md") | [docs: 教程文档](https://cnb.cool/examples/ecosystem/use-cache/-/commit/a5259281435d706aa72ec709fe8ff6498a3d5efe "docs: 教程文档<br>") | 2024-11-19 |
| [cache.dockerfile](https://cnb.cool/examples/ecosystem/use-cache/-/blob/main/cache.dockerfile "cache.dockerfile") | [feat: 添加docker cache流水线配置示例](https://cnb.cool/examples/ecosystem/use-cache/-/commit/91132ea71ad47c2b23e4f46dd39c710a5b15d24e "feat: 添加docker cache流水线配置示例<br>") | 2024-11-19 |
| [package-lock.json](https://cnb.cool/examples/ecosystem/use-cache/-/blob/main/package-lock.json "package-lock.json") | [feat: 添加无cache流水线验证](https://cnb.cool/examples/ecosystem/use-cache/-/commit/5088b78053f968a410e2faf0fa2bfa9d492eac24 "feat: 添加无cache流水线验证<br>") | 2024-11-19 |
| [package.json](https://cnb.cool/examples/ecosystem/use-cache/-/blob/main/package.json "package.json") | [feat: 添加无cache流水线验证](https://cnb.cool/examples/ecosystem/use-cache/-/commit/5088b78053f968a410e2faf0fa2bfa9d492eac24 "feat: 添加无cache流水线验证<br>") | 2024-11-19 | 

README Events 

# Improving Build Speed with Cache

[](https://cnb.cool/examples/ecosystem/use-cache#improving-build-speed-with-cache)

## Introduction

[](https://cnb.cool/examples/ecosystem/use-cache#introduction)

As we all know, caching is an important technique for performance optimization. In CI/CD, proper use of cache can significantly improve pipeline build speed!

Below we use a frontend NodeJS project as an example to demonstrate two effective caching methods.

## No Cache

[](https://cnb.cool/examples/ecosystem/use-cache#no-cache)

First, let's prepare a `package.json` with these modules:

`{   "dependencies": {     "angular": "^1.8.3",     "eslint": "^9.15.0",     "jest": "^29.7.0",     "koa": "^2.15.3",     "next": "^15.0.3",     "nuxt": "^3.14.159",     "react": "^18.3.1",     "vue": "^3.5.13",     "webpack": "^5.96.1"   } } `

Run `npm install` in pipeline with this configuration:

`main:   push:     "no-cache":       docker:         image: node:22-alpine       stages:         - name: npm install           script: npm install `

Execution result:

![no-cache](https://cnb.cool/examples/ecosystem/use-cache/-/git/raw/main/assets/install_no_cache.png)

Without cache, it downloads resources from network, taking about 23s.

## Volume Cache

[](https://cnb.cool/examples/ecosystem/use-cache#volume-cache)

Cloud Native Build leverages Docker's [volumes](https://cnb.cool/110?url=https%3A%2F%2Fdocs.docker.com%2Fget-started%2F05_persisting_data%2F%23container-volumes)
 feature. You can declare [pipeline.docker.volumes](https://docs.cnb.cool/zh/grammar/pipeline.html#volumes)
 to mount host directories into containers. Build tasks can store dependencies in host cache for future pipelines.

Node pipeline configuration:

`main:   push:     "volume-cache":       docker:         image: node:22-alpine         volumes:           - node_modules:copy-on-write       stages:         - name: npm install           script: npm install `

After several executions with cache hit:

![fit volume cache](https://cnb.cool/examples/ecosystem/use-cache/-/git/raw/main/assets/fit_volume_cache.png)

The message "added 1973 packages from 1072 contributors" disappears, replaced by "up to date". No network download needed, time reduced to 13s.

The drawback of `volumes` is that cache only works on current build machine. Cloud Native Build dynamically allocates build machines based on project concurrency. If subsequent pipelines get assigned to different machines without cache, it will download from network again.

Maven pipeline configuration:

`main:   push:     - docker:         # Find your required maven and jdk version at https://hub.docker.com/_/maven         image: maven:3.8.6-openjdk-8         volumes:           - /root/.m2:cow       stages:         - name: build           script: mvn clean package `

Gradle pipeline configuration:

`master:   push:     - docker:         # Find your required gradle and jdk version at https://hub.docker.com/_/gradle         image: gradle:6.8-jdk8         volumes:           - /root/.gradle:copy-on-write       stages:         - name: build           script: ./gradlew bootJar `

## Docker Cache

[](https://cnb.cool/examples/ecosystem/use-cache#docker-cache)

Cloud Native Build provides another cache method: run `npm install` in a container, cache the image locally, and push to remote registry.

For subsequent pipelines, if the build machine has cached image, it will be used directly. Otherwise, it will be pulled from remote registry.

Example of built-in `docker:cache` task:

`master:   push:     - stages:         - name: build cache image           type: docker:cache           options:             dockerfile: cache.dockerfile             by:               - package.json               - package-lock.json             versionBy:               - package-lock.json           exports:             name: DOCKER_CACHE_IMAGE_NAME         - name: use cache           image: $DOCKER_CACHE_IMAGE_NAME           commands:             - cp -r "$NODE_PATH" ./node_modules `

Example cache.dockerfile:

`# Choose a base image FROM node:16  # Set working directory WORKDIR /space  # Copy files listed in 'by' COPY . .  # Install dependencies RUN npm ci  # Set required environment variables ENV NODE_PATH=/space/node_modules `

First execution without cached image (needs to build and push):

![build cache](https://cnb.cool/examples/ecosystem/use-cache/-/git/raw/main/assets/build_image_cache.png)

Takes about 31.5s, similar to direct `npm install`.

_**Effect when pulling cached image on new build machine - to be added**_

Subsequent execution with locally cached image:

![local cache](https://cnb.cool/examples/ecosystem/use-cache/-/git/raw/main/assets/docker_cache_fit_local.png)

Time reduced to 2.7s - significant improvement!

## Comparison

[](https://cnb.cool/examples/ecosystem/use-cache#comparison)

### Cache Scope

[](https://cnb.cool/examples/ecosystem/use-cache#cache-scope)

*   `volumes`: Cache on build machine, good effect
*   `docker:cache`: Cache on build machine and remote registry, good effect

### Complexity

[](https://cnb.cool/examples/ecosystem/use-cache#complexity)

*   `volumes`: Simple configuration, easy to understand
*   `docker:cache`: Complex configuration involving multiple files, higher learning curve

### Cross-Pipeline

[](https://cnb.cool/examples/ecosystem/use-cache#cross-pipeline)

*   `volumes`: Shared within same build machine, not across machines
*   `docker:cache`: Exclusive during pipeline execution. After pushing to remote, can be shared across pipelines and machines

### Cache Update

[](https://cnb.cool/examples/ecosystem/use-cache#cache-update)

*   `volumes`: Flexible read/write control, suits more scenarios
*   `docker:cache`: Need to rebuild and push new image, other machines need to pull again

## Complete Example

[](https://cnb.cool/examples/ecosystem/use-cache#complete-example)

See [.cnb.yml](https://cnb.cool/examples/ecosystem/use-cache/-/blob/main/.cnb.yml)

For actual comparison, check pipeline results in this repository's Cloud Native Build page, or fork to try yourself.

### 利用缓存提升构建速度
main:
  push:
    "no-cache":
      docker:
        image: node:22-alpine
      stages:
        - name: npm install
          script: npm install
    "volume-cache":
      docker:
        image: node:22-alpine
        volumes:
          - node_modules:copy-on-write
      stages:
        - name: npm install
          script: npm install

    "docker-cache":
      stages:
        - name: build cache image
          type: docker:cache
          options:
            dockerfile: cache.dockerfile
            by:
              - package.json
              - package-lock.json
            versionBy:
              - package-lock.json
          exports:
            name: DOCKER_CACHE_IMAGE_NAME
        - name: use cache
          image: $DOCKER_CACHE_IMAGE_NAME
          commands:
            - cp -r "$NODE_PATH" ./node_modules