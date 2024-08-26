
# 前言

语言学习插件 language-learner 在0.2.5版本中开发者已经实现了查词、阅读模式、添加笔记等功能，基础操作可参见[B站视频](https://www.bilibili.com/video/BV1N24y1k7SL/?vd_source=595ecb634d520a0458c323613451f9a6)和[原项目地址](https://github.com/guopenghui/obsidian-language-learner)。通过二次开发，本项目将继续为爱发电，一起用obsidian高效地学习语言吧。

0.2.5版本主要面板：


![主要面板](https://image.asa-world.cn/pic/20240807090419.png)

# 新增功能

## Markdown渲染

相比于0.2.5版本，现阅读模式文本已支持 md 渲染（如多级标题、粗斜体、本地图片或网络图片等的渲染）




![0.3.1版本阅读模式](https://image.asa-world.cn/pic/20240807092051.png)

## 变形单词识别

在学习面板中填写单词的变形形式，每个变形单词用","隔开，可以添加名词复数、动词时态语态变化形式等（小提示：可以直接复制词典中的变形单词到变形栏中，不用一个一个打）

![记录单词](https://image.asa-world.cn/pic/20240807094251.png)

提交后可以看到have的各种形式都识别到了，学习状态与have相同：

![变形单词识别](https://image.asa-world.cn/pic/20240807094440.png)

## 单词文件库

想要更直观的看到自己的单词数据？想要自由操作自己的单词数据？想要使用dataview展示单词信息？

可以在设置里开启单词文件库，选择一个存放单词文件的文件夹后，每当退出阅读模式，将自动生成单词的md文件。如果你已经使用 0.2.5 版本一段时间了，indexDB中有了一些单词数据，你可以点击“更新单词文件库”，它会自动把indexDB中的非无视状态（新学、眼熟等状态）的单词写入单词文件库路径文件夹


![新增设置项](https://image.asa-world.cn/pic/20240807093029.png)

生成的单词文件如下：


![单词文件](https://image.asa-world.cn/pic/image-20240826192616819.png)

单词信息存放在每个md文件的frontmatter中，你可以自由修改单词信息，修改后点击“更新indexDB数据库”，indexDB数据库的数据就会更新同步，更新过程中无视状态的单词不会受到影响。（你也可以删除某个单词文件，indexDB数据库中的该单词数据也会删除）

“更新indexDB数据库”的另一种用法是多设备的同步，你可以Obsidian文件同步方法来同步单词文件，这样每当一个设备的单词文件变化时，文件同步后在另一个设备点击“更新indexDB数据库”即可实现多设备中indexDB的同步

如果你觉得同时使用indexDB数据库和单词文件库太繁琐了，你可以打开“仅使用单词文件库”，这样插件的运行将只与单词文件库交互（无视状态的单词还是会写入indexDB），多端的同步也更方便。需要注意的是，开启此功能会删除indexDB中的非无视单词的信息，而打开后会自动根据最新的单词文件库把非无视单词的信息写入indexDB

得益于obsidian的双链，打开关系图谱会发现单词和所在的文件连在了一起。

![关系图谱](https://image.asa-world.cn/pic/20240807093544.png)

关系图谱配色推荐：

["status":新学]：#ff9800

["status":眼熟]：#ffeb3c

["status":了解]：#9eda58

["status":掌握]：#4cb051

path:文章路径 ：#9c9c9c

## 安装

视频教程：[0.3.1版本教程]( https://www.bilibili.com/video/BV1rkWSefEYQ/?share_source=copy_web&vd_source=9be45cda2ce3f5c9a05bf519a7555757)

- 从realease下载最新插件压缩包
- 解压到obsidian库的`.obsidian/plugins/`文件夹下
- 重启obsidian，在插件中启用本插件`Language Learner`.
- 配置见[使用指南](https://github.com/asa-world/obsidian-language-learner/tree/0.3.2#使用指南)

## 自行构建

下载源码到本地

```
git clone https://github.com/guopenghui/obsidian-language-learner.git
```

进入文件夹，运行

```
cd obsidian-language-learner
# 安装依赖
npm install 
# 构建 会自动压缩代码体积
npm run build 
```

## 问题或建议

欢迎大家提交issue：

- bug反馈
- 对新功能的想法
- 对已有功能的优化

可能有时作者暂时比较忙，或是对于提出的功能需求暂时没想到好的实现方法而没有一一回复。

但是只要提了issue都会看的，所以大家有想法或反馈直接发到issue就行。