/**
 * TimelineSlider 0.0.1
 * https://github.com/dolymood/Timeline
 * MIT licensed
 *
 * Copyright (c) 2014 dolymood(aijc.net)
 */

;(function(win, $) {
	'use strict'

	var OPTIONS = {

		// 拆分panel差值
		panelDiffNum: 10,

		// 是否显示所有events
		showAllEvents: true,

		// 检测resize
		checkResize: false,

		// 构建单个项内容
		buildItemContent: function(evt, index) {
			return evt.id;
		}

	};

	// 是否正在处理点击prevBtn
	var navPreving = false;

	var updatePosTimeout;

	/**
	 * TimelineSlider类
	 * @param {String|Object} ele      jquery选择器或者jquery对象
	 * @param {Object}        timeline Timeline实例
	 * @param {Object}        options  配置项
	 */
	function TimelineSlider(ele, timeline, options) {
		this.ele = $(ele);
		this.timeline = timeline;
		this.options = $.extend({}, OPTIONS, options);
		this.EVENT = $({});

		this.inited = false;

		this.x = 0;
		this.curIndex = -1;
		this.focusEle = null;

		var init = $.proxy(this.init, this);
		if (timeline.inited) {
			setTimeout(init);
		} else {
			timeline.on('inited', init);
		}
	}
	win.TimelineSlider = TimelineSlider;

	$.extend(TimelineSlider.prototype, {

		/**
		 * 初始化工作
		 */
		init: function() {
			// 构建基本结构
			this._initContainer();
			this._initBody();
			this._initItemsContainer();
			this._initCursor();
			this._initNavBtn();
			
			this._body.append(this._cursor).append(this._itemsContainer);

			// 先隐藏
			this.hideContainer();
			this._container.append(this._body)
										 .append(this._nextNavBtn)
										 .append(this._prevNavBtn);
			this.ele.append(this._container);

			// 计算初始宽
			this._bodyWidth = this._body.width();
			this._baseX = this._bodyWidth / 2;

			// 刷新 填充内容
			this.refresh();

			// 绑定事件
			this._bindEvents();

			// 已经初始化了
			this.inited = true;
		},

		/**
		 * 显示元素
		 */
		showContainer: function() {
			this.ele.css('visibility', 'visible');
		},

		/**
		 * 隐藏元素
		 */
		hideContainer: function() {
			this.ele.css('visibility', 'hidden');
		},

		/**
		 * 刷新 更新内容
		 */
		refresh: function() {
			this.events = this.options.showAllEvents ? this.timeline.sourceData.events.concat() : this.timeline.getShowedEvents();
			this._itemsContainer.html(this._buildPanels());

			var panels = this._itemsContainer.find('.tls-item-panel');
			this._itemsContainer.width(panels.allWidth(true) + 500);
		},

		/**
		 * 初始化container
		 */
		_initContainer: function() {
			this._container = $('<div class="tls-container"></div>');
		},

		/**
		 * 初始化body
		 */
		_initBody: function() {
			this._body = $('<div class="tls-body"></div>');
		},

		/**
		 * 初始化itemsContainer
		 */
		_initItemsContainer: function() {
			this._itemsContainer = $('<div class="tls-items-container"></div>');
		},

		/**
		 * 创建timelineSlider的cursor
		 */
		_initCursor: function() {
			this._cursor = $('<div class="tls-cursor"></div>');
		},

		/**
		 * 初始化navBtns
		 */
		_initNavBtn: function() {
			this._nextNavBtn = $('<div class="tls-nav-next"></div>');
			this._prevNavBtn = $('<div class="tls-nav-prev"></div>');
		},

		/**
		 * 构建panel
		 * @return {String} 字符串结果
		 */
		_buildPanels: function() {
			var that = this;
			var panelDiffNum = this.options.panelDiffNum;
			var ret = '';
			var enddiv = '</div>';
			var lastPanel = '';
			var lastPid;
			if (this.timeline.options.reverseDate) {
				this.events.reverse();
			}
			$.each(this.events, function (index, evt) {
				var pid = that._getPid(index, panelDiffNum);
				if (pid !== lastPid) {
					// 创建新的panel
					lastPid = pid;
					if (ret) {
						// 添加闭合div
						ret += enddiv;
					}
					lastPanel = that._buildPanel(pid, index);
					ret += lastPanel;
				}
				// 构建每一项内容
				ret += that._buildItem(index, index - pid * panelDiffNum, that.options.buildItemContent.call(that, evt, index));
			});
			ret += enddiv;
			return ret;
		},

		/**
		 * 得到panel的id
		 * @param  {Number} index        次序
		 * @param  {Number} panelDiffNum 拆分panel差值
		 * @return {Number}              panel的id
		 */
		_getPid: function(index, panelDiffNum) {
			if (!panelDiffNum) panelDiffNum = this.options.panelDiffNum;
			return Math.floor(index / panelDiffNum);
		},

		/**
		 * 构建panel主体
		 * @param  {Number} id         panel的id
		 * @param  {Number} startIndex 开始index
		 * @return {String}            构建结果字符串
		 */
		_buildPanel: function(id, startIndex) {
			return '<div class="tls-item-panel" id="tls-panel-' + id + '" data-start-index="' + startIndex + '">';
		},

		/**
		 * 构建panel主体
		 * @param  {Number} index   在events中次序
		 * @param  {Number} rindex  相对当前panel的次序
		 * @param  {String} content 内容
		 * @return {String}         构建结果字符串
		 */
		_buildItem: function(index, rindex, content) {
			var cls = 'tls-item-' + (rindex + 1);
			return '<div class="tls-item ' + cls + '" data-index="' + index + '">' + content + '</div>';
		},

		/**
		 * 显示隐藏navBtn
		 */
		_checkNav: function() {
			this._nextNavBtn[this.events[this.curIndex + 1] ? 'show' : 'hide']();
			this._prevNavBtn[this.events[this.curIndex - 1] ? 'show' : 'hide']();
		},

		/**
		 * 检测日期，更新timeline
		 */
		_checkCurDate: function() {
			var evt = this.events[this.curIndex];
			var timeline = this.timeline;
			var _date = timeline.getValidDate(Timeline.parseDateByLevel(evt[timeline.options.reverseDate ? 'endDate' : 'startDate'], timeline.getDateLevel()));
			// 如果当前日期和focusDate不相等
			if (!timeline.equalByLevel(_date)) {
				timeline.moveTo(_date);
			}
		},

		/**
		 * 绑定一些基础事件
		 */
		_bindEvents: function() {
			var that = this;
			!this.options.showAllEvents && this.timeline.on('_refresh', function(e) {
				that.inited && that.refresh();
			});
			this.timeline.on('dateChange', function(e, date, moving) {
				that.moveTo(date, moving);
			});

			this.options.checkResize && $(window).on('resize', $.proxy(this._onResize, this));

			this._container.delegate('.tls-nav-next', 'click', $.proxy(this._onNavNext, this));
			this._container.delegate('.tls-nav-prev', 'click', $.proxy(this._onNavPrev, this));
		},

		/**
		 * 下一个导航按钮点击处理函数
		 */
		_onNavNext: function() {
			this._setFocus(this.curIndex + 1, false, true);
		},

		/**
		 * 上一个导航按钮点击处理函数
		 */
		_onNavPrev: function() {
			navPreving = true;
			this._setFocus(this.curIndex - 1, false, true);
			navPreving = false;
		},

		/**
		 * resize处理函数
		 */
		_onResize: function() {
			clearTimeout(this._resizeTimeout);
			var that = this;
			this._resizeTimeout = setTimeout(function() {
				that._bodyWidth = that._body.width();
				that._baseX = that._bodyWidth / 2;
				that._doUpdatePos(that.focusEle.offset().left + that.focusEle.outerWidth() / 2);
			}, 100);
		},

		/**
		 * 移动到指定日期
		 * @param  {Date} date   指定日期
		 * @param  {Boolean} moving 是否在mousemove中
		 */
		moveTo: function(date, moving) {
			var that = this;
			var timeline = this.timeline;
			var reverseDate = timeline.options.reverseDate;
			var focusEle = that.focusEle;
			if (!reverseDate && navPreving) date = timeline.getNextDate();
			if (reverseDate && focusEle && !navPreving) date = timeline.getPrevDate();
			$.each(this.events, function(index, evt) {
				var _date = timeline.getValidDate(
					Timeline.parseDateByLevel(
						evt[reverseDate ? 'endDate' : 'startDate'], 'MSSECONDS'
					)
				);
				var c = reverseDate ?
									focusEle ?
										_date - date < 0 ?
											true :
											false :
										_date - date <= 0 ?
												true :
												false :
									_date - date >= 0 ?
										true :
										false;
				if (c) {
					that._setFocus(navPreving ? index - 1 : index, moving);
					return false;
				}
			});
		},

		/**
		 * 设置焦点相关
		 * @param {Number}  index     当前次序
		 * @param {Boolean} moving    是否在mousemove中
		 * @param {Boolean} checkDate 是否需要检测日期
		 */
		_setFocus: function(index, moving, checkDate) {
			if (index === this.curIndex) return;
			this.focusEle = this._getEle(index);
			this.curIndex = index;
			this._doUpdatePos(this.focusEle.offset().left + this.focusEle.outerWidth() / 2, moving);
			this._checkNav();
			checkDate && this._checkCurDate();
		},

		/**
		 * 根据index得到元素
		 * @param  {Number} index 当前次序
		 * @return {Object}       jquery包装过元素对象
		 */
		_getEle: function(index) {
			return $('#tls-panel-' + this._getPid(index)).find('.tls-item[data-index="' + index + '"]');
		},

		/**
		 * 更新位置
		 * @param  {Number}  offsetX  offset差值
		 * @param  {Boolean} moving   是否在mousemove中
		 */
		_doUpdatePos: function(offsetX, moving) {
			var that = this;
			var offset;
			var x;
			if (typeof that._itemsContainerOffset == 'undefined') {
				// 初始第一次
				offset = that._itemsContainer.offset();
				x = that.x = offset.left - offsetX  + that._baseX;
				that._itemsContainer.css('left', x);
				that._itemsContainerOffset = that._itemsContainer.offset();
				// 此时显示元素
				that.showContainer();
				return;
			}
			if (!moving) {
				doMove();
				return;
			}
			// 针对于正在mousemove中 比较快
			// 还需要有动画效果 所以需要
			// 加上延迟处理
			var duration = 250;
			clearTimeout(updatePosTimeout);
			updatePosTimeout = setTimeout(doMove, duration);

			function doMove(x) {
				offset = that._itemsContainerOffset;
				x = that.x = offset.left - offsetX + that._baseX;
				that._itemsContainer.animate({
					left: x
				}, {
					duration: duration,
					queue : false,
					complete: function() {
						that._itemsContainerOffset = that._itemsContainer.offset();
					}
				});
			}
		}

	});

	function afterGetTimeline() {
		if (!Timeline || Timeline.id !== 'Timeline') {
			throw new Error('Timeline is error.');
		}
		// 拓展事件相关
		if (TimelineSlider.prototype.on && TimelineSlider.prototype.off) {
			return;
		}
		$.each(['on', 'off', 'trigger'], function(_, name) {
			TimelineSlider.prototype[name] = function() {
				return Timeline.prototype[name].apply(this, arguments);
			};
		});
	}

	// 支持MD
	if (typeof module === 'object' && module && typeof module.exports === 'object') {
		require('./timline');
		afterGetTimeline();
		module.exports = TimelineSlider;
	} else {
		if (typeof define === 'function' && define.amd) {
			define(['./timeline'], function() {
				afterGetTimeline();
				return TimelineSlider;
			});
		}
	}

}(window, $));