## 用Obsidian来学习语言！

公告：已经开放discussion区，一般的问题可以先在这里进行讨论。

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


## 新鼠标
在鼠标寿命到头，左键时灵时不灵的艰难的环境下完成了0.0.1版的发布。😭

觉得这款插件好用的朋友，或是想鼓励一下作者，可以赞助孩子买个新鼠标!!🖱

![微信](https://github.com/guopenghui/obsidian-language-learner/blob/master/public/wechat.jpg)
![支付宝](https://github.com/guopenghui/obsidian-language-learner/blob/master/public/alipay.jpg)