# Nginx 自动化构建与发布项目（基于 Cloud Native Build）
本项目使用 Cloud Native Build (CNB) 实现自动化拉取 GitHub 仓库代码、编译并打包 Nginx，最终生成可发布的 Release 版本。整个流程无需手动配置环境依赖，支持定时构建与发布，适用于 DevOps 自动化部署场景。

# 项目目标
✅ 定时拉取 GitHub 上最新的 Nginx 源码
✅ 利用 CNB 自动构建编译环境
✅ 编译并打包 Nginx
✅ 自动生成 Release 包
✅ 无需手动配置环境依赖
✅ 支持定时任务自动运行
# 技术栈
Linux 操作系统：运行构建脚本和编译任务 Cloud Native Build (CNB)：自动检测和配置构建环境 CNB Cron：定时触发构建流程 Shell / Python 脚本：用于拉取代码、执行构建、打包和发布 Git：拉取源码仓库 Docker（可选）：如果使用容器化构建
# 构建流程说明
定时任务触发：使用 CNB cron 定时拉取最新代码。 代码拉取：脚本自动从指定的 GitHub 仓库拉取 Nginx 最新源码。 CNB 构建：利用 CNB云原生构建 自动构建 Nginx。 编译打包：构建完成后，将编译产物打包为可发布的版本（如 .tar.gz）。 发布 Release

# YAML
```
master:
  vscode:
  - docker:
      image: docker.cnb.cool/dadong.cnb/cloud/os/kylin:v10-sp3-2403
    env:
      # 配置环境变量，指定首次打开终端时自动执行的命令
      CNB_WELCOME_CMD: |
        echo "欢迎使用Dadong"
    services:
      - vscode
      - docker

  "crontab: 0 0 * * *":
    - docker:
        image: docker.cnb.cool/dadong.cnb/cloud/os/kylin:v10-sp3-2403
      stages:
        - name: 获取最新版本 nginx
          script: bash start.sh
        - name: 生成相应版本 tag
          script: cat latest_version.json | jq -r .version
          exports:
            info: TAG_NAME
        - name: 生成相应的描述
          script: echo -e "- 当前离线构建时间：`date "+%Y-%m-%d %H:%M:%S"` \n - 版本号：Nginx-${TAG_NAME}"
          exports:
            info: TAG_DESCRIPTION
        - name: 创建 release
          type: git:release
          options:
            overlying: true
            tag: ${TAG_NAME}
            description: ${TAG_DESCRIPTION}
        - name: release 上传附件
          image: cnbcool/attachments:latest
          settings:
              tag: ${TAG_NAME}
              attachments:
                - nginx-*.tar.gz
        - name: 清理 downloads 目录
          script: rm -rf downloads && ls
        - name: 提交 latest_version.json 文件
          script: git add latest_version.json && git commit -m "update latest_version.json" && git push
```