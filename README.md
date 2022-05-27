## 用Obsidian来学习语言！

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


自动补全/提示：

![自动补全-英中](https://github.com/guopenghui/obsidian-language-learner/blob/master/public/complement1.png)
![自动补全-中英](https://github.com/guopenghui/obsidian-language-learner/blob/master/public/complement2.png)

间隔复习：

![间隔复习](https://raw.githubusercontent.com/guopenghui/obsidian-language-learner/master/public/review.png)

## 使用指南
[使用指南](https://raw.githubusercontent.com/guopenghui/obsidian-language-learner/master/public/tutorial.pdf)


## 安装

### 预构建文件

从realease下载压缩包，解压到相应位置
### 自行构建

下载源码到本地
```shell
git clone https://github.com/guopenghui/obsidian-language-learner.git
```

进入文件夹，运行
```shell
cd obsidian-language-learner
# 安装依赖
npm install 
# 构建
npm run build 
# 压缩体积(可选，可以加快加载速度)
npm run minify 
```

## 问题或建议
欢迎提交issue：
+ bug反馈
+ 对新功能的想法
+ 对已有功能的优化

## 新鼠标
在鼠标寿命到头，左键时灵时不灵的艰难的环境下完成了0.0.1版的发布。😭

觉得这款插件好用的朋友，或是想鼓励一下作者，可以赞助孩子买个新鼠标!!🖱

![微信](https://raw.githubusercontent.com/guopenghui/obsidian-language-learner/master/public/wechat.jpg)
![支付宝](https://raw.githubusercontent.com/guopenghui/obsidian-language-learner/master/public/alipay.jpg)