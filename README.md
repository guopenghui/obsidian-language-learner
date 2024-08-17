## 用Obsidian来学习语言！



原仓库：https://github.com/guopenghui/obsidian-language-learner



新版教程：https://asa-world.cn/c040f849/

### 更新功能



- 阅读模式文本支持 md 渲染（如多级标题、粗斜体、本地图片或网络图片等的渲染）
- 支持单词变形形式的识别（在最新的单词提交面板中增加“变形”栏，用 “,” 分割各单词变形形式即可）
- 新增单词文件库功能，可自动生成各单词的md文件，单词信息在frontmatter中
- 单词文件库和 IndexDB 数据库可相互更新，为多端的同步提供了更方便的方法
- 可以“仅使用单词文件库”，删除 IndexDB 数据库的非无视单词的信息，释放储存空间



### 功能图片



设置选项



![设置选项](https://image.asa-world.cn/pic/image-20240713195337707.png)



MD渲染



![MD渲染](https://image.asa-world.cn/pic/image-20240714205132229.png)



添加单词变形



![添加单词变形](https://image.asa-world.cn/pic/image-20240714205300740.png)



单词文件



![单词文件](https://image.asa-world.cn/pic/image-20240714205427907.png)



关系图谱



![关系图谱](https://image.asa-world.cn/pic/image-20240714205610094.png)



### 关系图谱配色推荐



["status":新学]：\#ff9800

["status":眼熟]：\#ffeb3c

["status":了解]：\#9eda58

["status":掌握]：\#4cb051

path:文章路径 ：#9c9c9c



---



以下是原仓库README



### 早期阶段
当前插件还处在早期开发阶段，因此有以下事情需要注意：
+ **目前仅支持中文母语者学习英文**。
+ 因为还在不断的扩充新功能和重构旧功能，所以可能某次更新会带来与之前**不兼容的改变**（比如笔记的格式，数据库的结构等）。所以在更新新版本前请仔细查看release的说明。


### 使用指南
+ [文字教程](https://github.com/guopenghui/obsidian-language-learner/blob/master/public/tutorial.pdf)
+ [视频教程](https://www.bilibili.com/video/BV1914y1Y7mT)
+ [一些做好的文本](https://github.com/guopenghui/language-learner-texts)
+ @emisjerry 制作的使用教程: [Youtube](https://www.youtube.com/watch?v=lK3oFpUg7-o), [Bilibili](https://www.bilibili.com/video/BV1N24y1k7SL/)



### 本插件功能

+ **查词功能**。直接在笔记中划词查词，词典为有道词典，支持柯林斯例句、近义词辨析。
+ **添加笔记**。数据被保存在obsidain的indexDB数据库中。每个单词/短语支持多条笔记、多条例句（包括文本、翻译和出处）
+ **解析页面**。将每个单词变成一个按钮，通过点击就可以边读边查边记笔记。如果有音频链接的话可以边听边读。
+ **统计页面**。目前支持显示7天内每天自己记的单词数和总的单词数。

联动其他插件功能：
+ 联动various complements插件，将数据库中的单词保存在本地的一个note中。这样就可以在写作时得到自己之前记过的单词/短语的**自动提示和补全**
+ 联动spaced repetition插件，将数据库中的单词保存在本地的note中。这样就可以制作成卡片，进行**间隔复习**。

### 外观展示
阅读：

![阅读界面](https://github.com/guopenghui/obsidian-language-learner/blob/master/public/reading.png)

单词列表：
![单词列表](https://github.com/guopenghui/obsidian-language-learner/blob/master/public/table.png)

自动补全/提示：

![自动补全-英中](https://github.com/guopenghui/obsidian-language-learner/blob/master/public/complement1.png)
![自动补全-中英](https://github.com/guopenghui/obsidian-language-learner/blob/master/public/complement2.png)

间隔复习：

![间隔复习](https://github.com/guopenghui/obsidian-language-learner/blob/master/public/review.png)




## 安装

+ 从realease下载压缩包`obsidian-language-leaner.zip`
+ 解压到obsidian库的`.obsidian/plugins/`文件夹下，即保证`main.js`的路径为`.obsidian/plugins/obsidian-language-learner/main.js`
+ 打开obsidian，在插件中启用本插件`Language Learner`.
+ 配置见[使用指南](#使用指南)
## 自行构建

下载源码到本地
```shell
git clone https://github.com/guopenghui/obsidian-language-learner.git
```

进入文件夹，运行
```shell
cd obsidian-language-learner
# 安装依赖
npm install 
# 构建 会自动压缩代码体积
npm run build 
```

## 问题或建议
欢迎大家提交issue：
+ bug反馈
+ 对新功能的想法
+ 对已有功能的优化

可能有时作者暂时比较忙，或是对于提出的功能需求暂时没想到好的实现方法而没有一一回复。

但是只要提了issue都会看的，所以大家有想法或反馈直接发到issue就行。
