Timeline
========

## 横向时间轴组件

[DEMO](http://demo.aijc.net/js/Timeline/example/timeline.html)

### 基本配置使用：

#### Timeline：

```js
var tl = new Timeline('#timelineID', timelineData, {
	// 最小zoom
	minZoom: 1,
	// 最大zoom
	maxZoom: 50,

	// 初始化zoom
	zoom: 25,

	// 是否是由最近时间开始
	reverseDate: false,

	// 当不是有效日期点时 是否触发datechange事件
	alwaysTrigger: false,

	// 鼠标滚轮缩放
	mouseZoom: true,

	// 检测resize
	checkResize: false,

	// 即使超出了也显示当前级别的所有日期 
	showAllLevelDate: false

});
```

#### TimelineSlider：

```js
var tls = new TimelineSlider('#timelineSlideID', tl, {
	
	// 拆分panel差值
	panelDiffNum: 10,

	// 是否显示所有events
	showAllEvents: true,

	// 检测resize
	checkResize: false,

	// 左右切换时是否按panel切换
	navPanel: false,

	// 构建单个项内容
	buildItemContent: function(evt, index) {
		return '<img src="//s4.kuaipan.cn/i/4/135.png"><span>' + evt.id + '</span>';
	}

});
```

兼容性：

_IE7+（IE6未测试），其他浏览器_

编码风格：

_用的tab，tab大小为2个空格_

协议：

_[MIT](https://github.com/dolymood/Timeline/blob/master/LICENSE)_
