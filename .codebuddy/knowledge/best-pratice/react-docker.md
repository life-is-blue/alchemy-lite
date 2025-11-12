# React 构建镜像推送到 CNB 制品库，并通过 Docker 部署到 CVM
本示例，演示了如何使用 CNB 构建 React 项目，构建镜像推送到 CNB 制品库，并且通过 Docker 部署到 CVM。

其中还包含如何配置 Pull Request 的代码门禁：eslint、单元测试等。
# 前提条件
使用 云原生构建（CNB） 构建你的项目
环境变量及其用法，环境变量
声明式的构建缓存
使用SSH 插件
插件及其用法，插件市场
# 配置密钥
# react-docker-ssh-secret.yml
REMOTE_HOST: xxx
REMOTE_USERNAME: xxx
REMOTE_PORT: xxx
PRIVATE_KEY: |
    -----BEGIN RSA PRIVATE KEY-----
    xxxxxxxx 
    -----END RSA PRIVATE KEY-----

# YAML
```
main:
  push:
    - docker:
        image: node:20
        #volumes缓存：https://docs.cnb.cool/zh/grammar/pipeline.html#volumes
        volumes:
          - /root/.npm:cow
          - ./node_modules
      services:
        - docker
      stages:
        - name: install
          script: npm install && npm run build
        - name: 查看目录
          script: ls -a
        # 构建镜像，推送到制品库
        - name: docker login
          script: docker login -u ${CNB_TOKEN_USER_NAME} -p "${CNB_TOKEN}" ${CNB_DOCKER_REGISTRY}
        - name: docker build
          script: docker build -t ${CNB_DOCKER_REGISTRY}/${CNB_REPO_SLUG_LOWERCASE}:${CNB_COMMIT} .
        - name: docker push
          script: docker push ${CNB_DOCKER_REGISTRY}/${CNB_REPO_SLUG_LOWERCASE}:${CNB_COMMIT}
        # docker image 通过 ssh 部署到 vm
        - name: deploy to vm
          image: tencentcom/ssh
          # 引用密钥仓库配置文件
          imports: https://cnb.cool/group/secret-repo/-/blob/main/react-docker-ssh-secret.yml
          settings:
            host: $REMOTE_HOST
            port: $REMOTE_PORT
            username: $REMOTE_USERNAME
            key: $PRIVATE_KEY
            script:
              - docker pull ${CNB_DOCKER_REGISTRY}/${CNB_REPO_SLUG_LOWERCASE}:${CNB_COMMIT}
              - docker stop my-react-app || true
              - docker rm my-react-app || true
              - docker run -d -p 80:80 --name my-react-app --restart=always ${CNB_DOCKER_REGISTRY}/${CNB_REPO_SLUG_LOWERCASE}:${CNB_COMMIT}
              - docker ps

  pull_request:
    - docker:
        image: node:20
        volumes:
          - /root/.npm:cow
          - ./node_modules
      stages:
        - name: 代码评审
          image: cnbcool/ai-review:latest
          settings:
            type: code-review
        - name: 安装依赖
          script: npm install
        - name: eslint 代码检查
          script: npm run lint
        - name: 单元测试
          script: npm run test

  pull_request.mergeable:
    - stages:
        - name: CR 通过后自动合并
          type: git:auto-merge
          options:
            mergeType: squash
            removeSourceBranch: true


$:
  # vscode 事件：专供页面中启动远程开发用
  vscode:
    - docker:
        build: .ide/Dockerfile
        volumes:
          - /root/.npm:cow
          - ./node_modules
      services:
        - vscode
        - docker
      stages:
        - name: ls
          script: ls -al
```