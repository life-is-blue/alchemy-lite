# springboot+maven+ssh
在当前的这个示例中，通过云原生构建实现，打包 springboot+maven 项目并通过 SSH 上传到服务器

# 前提条件
使用 云原生构建（CNB） 构建项目
环境变量及其用法，环境变量
声明式的 构建缓存
插件及其用法，插件市场
使用 Rsync 插件
使用 SSH 插件
配置 .ide/Dockerfile，使用 云原生开发

# YML构建流程
main:
  push:
    - docker:
        # 可以去dockerhub上 https://hub.docker.com/_/maven 找到您需要maven和jdk版本
        # image: maven:3.8.6-openjdk-8
        image: maven:3.8.5-openjdk-17
        volumes:
          # 声明构建缓存 https://docs.cnb.cool/grammar/pipeline.html#volumes
          - /root/.m2:copy-on-write
      
      # 导入环境变量，https://docs.cnb.cool/build/grammar.html#pipeline-imports
      imports: https://cnb.cool/examples/secrets/-/blob/main/springboot-maven-ssh-config.yml
      stages:
        - name: mvn package
          script: |
            # 合并./settings.xml和/root/.m2/settings.xml
            mvn clean package -s ./settings.xml
        
          # https://docs.cnb.cool/plugin/#public/tencentcom/rsync
        - name: 使用 rsync 复制文件
          image: tencentcom/rsync
          settings:
            hosts:
              - ${REMOTE_HOST}
            user: ${REMOTE_USERNAME}
            key: ${PRIVATE_KEY}
            port: ${REMOTE_PORT}
            target: /root/
            source: ./target/maven-deploy-0.1-SNAPSHOT.jar

          # https://docs.cnb.cool/plugin/#public/cnbcool/ssh
        - name: 通过 ssh 执行命令
          image: cnbcool/ssh
          settings:
            host:
              - ${REMOTE_HOST}
            username: ${REMOTE_USERNAME}
            key: ${PRIVATE_KEY}
            port: ${REMOTE_PORT}
            command_timeout: 2m
            script: |
              cd /root/
              nohup java -jar ./maven-deploy-0.1-SNAPSHOT.jar > output.log 2>&1 &
              echo done
