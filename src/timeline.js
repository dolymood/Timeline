/**
 * Timeline 0.0.1
 * https://github.com/dolymood/Timeline
 * MIT licensed
 *
 * Copyright (c) 2014 dolymood(aijc.net)
 */

;(function(win, $) {
	'use strict'

	// 拓展jquery原型方法
	$.extend($.fn, {

		allWidth: function(outer) {
			var w = 0;
			this.each(function() {
				w += $(this)[outer ? 'outerWidth' : 'width']();
			});
			return w;
		}

	});

	// 得到十年为单位值
	Date.prototype.getDE = function() {
		return Math.floor(this.getFullYear() / 10) * 10;
	}

	// 统一位数
	function pad(val, len, cut) {
		if (len < 1) return '';
		if (typeof cut === 'undefined') cut = true;
		val = '' + val;
		for (var i = 0 ; i < len; i++) {
				val = '0' + val;
		}
		i = val.length - len;
		return val.substring(cut ? i : i > 0 ? len : i);
	}

	var OPTIONS = {

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
		mouseZoom: true

	};

	var SHOWLEVELS = {
		'DE': 5,
		'YEAR': 4,
		'MONTH': 3,
		'DAY': 2,
		'HOUR': 1,

		'5': 'getDE',
		'4': 'getFullYear',
		'3': 'getMonth',
		'2': 'getDate',
		'1': 'getHours'
	};

	var DATELEVEL = {
		'YEAR': 1,
		'MONTH': 2,
		'DAY': 3,
		'HOUR': 4,
		'MINUTES': 5,
		'SECONDS': 6,
		'MSSECONDS': 7,

		'4': 'YEAR',
		'3': 'MONTH',
		'2': 'DAY',
		'1': 'HOUR'
	};

	var YEARDR = 10;
	var MONTHDR = 12;
	var DAYDR = 30;
	var HOURDR = 24;
	var TOTAL = YEARDR + MONTHDR + DAYDR + HOURDR;
	var TREESCALE = {
		'DE': YEARDR / TOTAL,
		'YEAR': (YEARDR + MONTHDR) / TOTAL,
		'MONTH': (YEARDR + MONTHDR + DAYDR) / TOTAL,
		'DAY': 1
	};

	var ONEDAY = 24 * 60 * 60 * 1000;
	var ONEMONTH = 30 * ONEDAY;
	var ONEYEAR = 12 * ONEMONTH;
	var ONEDE = 10 * ONEYEAR;

	var SPACE = '&nbsp;';

	var ZOOMLEVELNUM = 4;

	var EVENTSOKMAP = null;

	/**
	 * 横向时间轴
	 * @param {String|Object} ele    元素选择器或者元素或者jquery封装元素
	 * @param {String|Object} source 数据源地址或者数据源对象
	 * @param {Object} options       配置项
	 */
	function Timeline(ele, source, options) {
		this.ele = $(ele);
		this.EVENT = $({});
		this.source = source;
		this.options = $.extend({}, OPTIONS, options);
		this._setZoom(this.options.zoom);

		this.minX = 0;
		this.maxX = 0;

		this.startEventsIndex = 0;
		this.endEventsIndex = 0;

		this.focusDate = this.focusEle = null;

		this.showLevel = SHOWLEVELS.DAY;
		this.zoomLevel = ZOOMLEVELNUM;

		this.yZoomUnit = this.mZoomUnit =
		this.dZoomUnit = this.hZoomUnit =
		this.zoomUnit = 1;

		this.inited = false;

		this.init();
	}
	Timeline.id = 'Timeline';
	win.Timeline = Timeline;

	$.extend(Timeline.prototype, {

		on: function() {
			this.EVENT.on.apply(this.EVENT, arguments);
			return this;
		},

		off: function() {
			this.EVENT.off.apply(this.EVENT, arguments);
			return this;
		},

		trigger: function() {
			this.EVENT.trigger.apply(this.EVENT, arguments);
			return this;
		},

		/**
		 * 初始化
		 */
		init: function() {
			var that = this;
			var succ = function(data) {
				that.EVENT.trigger('sourceLoaded', data);
				that.sourceData = data;
				// 焦点日期
				that._initFocusDate = that.sourceData.focus_date;
				that.endEventsIndex = that.sourceData.events.length - 1;
				that._build();
				that.inited = true;
				that.EVENT.trigger('inited');
			};
			var err = function(xhr, data) {
				that.EVENT.trigger('sourceFailed', data);
			};

			this._initZoomTree();

			if (typeof this.source === 'string') {
				this._getSource().then(succ, err);
				return;
			}
			setTimeout(function() {
				succ(that.source);
			});
		},

		/**
		 * 得到资源
		 * @return {Object} promise对象
		 */
		_getSource: function() {
			return $.get(this.source);
		},

		/**
		 * 构建结构并初始化
		 */
		_build: function() {
			this._buildContainer();
			this._buildCursor();
			this._buildBody();

			this.focusDate = this.getValidDate(this._initFocusDate);

			this._container.append(this._body);
			this.ele.append(this._container);

			this._containerWidth = this._container.width();
			this._baseX = this._containerWidth / 2;

			this._bodyOffset = this._body.offset();

			this.refresh();

			this._bindEvents();
		},


		/**
		 * 得到可用日期
		 * @param  {Date|String} date 日期
		 * @return {Date}             可用日期
		 */
		getValidDate: function(date) {
			if (date && typeof date == 'string') {
				date = parse2Date(date);
			}
			var range = this.getRange();
			var start = range.start;
			var end = range.end;
			if (!date) {
				date = new Date(start.getTime() + (end - start) / 2);
			} else {
				if (start - date > 0) {
					date = cloneDate(start);
				}
				if (end - date < 0) {
					date = cloneDate(end);
				}
			}
			
			return date;
		},

		/**
		 * 刷新
		 */
		refresh: function() {
			this._comLevel();
			this._comRangeDiff();
			this._refresh();
			this.moveTo(this.focusDate);
			this.EVENT.trigger('refresh', this);
		},

		/**
		 * 计算需要显示的范围差（毫秒）
		 * @return {Number} 范围差
		 */
		_comRangeDiff: function() {
			var showLevel = this.showLevel;
			var diff;

			// 120
			if (showLevel === SHOWLEVELS.YEAR) {
				// 年
				diff = 12 * ONEDE;
			} else if (showLevel === SHOWLEVELS.MONTH) {
				// 月
				diff = 10 * ONEYEAR;
			} else if (showLevel === SHOWLEVELS.DAY) {
				// 日
				diff = 4 * ONEMONTH;
			} else {
				// 小时
				diff = 5 * ONEDAY;
			}

			this._rangeDiff = diff;
			return diff;
		},

		/**
		 * 内部更新片段
		 */
		_refresh: function() {
			var that = this, range;

			range = this._getTempRange();

			this._comEventsEdge(range);

			// todo: 判断下条件 优化
			this._body.html(this._buildItems(range)).prepend(this._cursor);

			this._itemsWidth = 0;
			this._body.width(this._getAllItemsWidth() + 1000);

			this.focusEle = null;

			// 更新后需要计算可移动的范围
			setTimeout(function() {
				that.computeBound();
			});

			this.EVENT.trigger('_refresh', this);
		},

		/**
		 * 更新有效日期MAP对象
		 * @param  {[type]} start [description]
		 * @param  {[type]} end   [description]
		 */
		_updateEventsOKMap: function(start, end) {
			if (!EVENTSOKMAP) EVENTSOKMAP = {};
			EVENTSOKMAP[start.getTime()] = true;
			EVENTSOKMAP[end.getTime()] = true;
		},

		/**
		 * 检测日期是否是有效日期点
		 * @param  {Date}    date 待检测日期
		 * @return {Boolean}      是否是有效日期点
		 */
		checkDateOK: function(date) {
			return !!EVENTSOKMAP[date.getTime()];	
		},

		/**
		 * 计算开始和结束位置
		 * @param  {Object} range 当前范围
		 */
		_comEventsEdge: function(range) {
			var events = this.sourceData.events;
			var level = this.getDateLevel();
			var setStart = false;
			var setEnd = false;
			var start;
			var end;
			var tmp;
			EVENTSOKMAP = null;
			for (var i = 0, len = events.length; i < len; i++) {
				tmp = events[i];
				start = parseDateByLevel(tmp.startDate, level);
				end = parseDateByLevel(tmp.endDate, level);
				this._updateEventsOKMap(start, end);
				start = this.getValidDate(start);
				end = this.getValidDate(end);
				if (!setStart && start - range.start >= 0) {
					// 左边界
					this.startEventsIndex = i;
					setStart = true;
				}
				if (!setEnd && end - range.end > 0) {
					// 右边界
					this.endEventsIndex = i;
					setEnd = true;
				}
				
				if (setStart && setEnd) break;
			}
			if (!setEnd) {
				// 最后也没有大于的
				this.endEventsIndex = len - 1;
			}
		},

		/**
		 * 得到日期level
		 * @return {String} 日期level
		 */
		getDateLevel: function() {
			return DATELEVEL[this.showLevel];
		},

		/**
		 * 得到显示的events部分
		 * @return {Array} 显示的events
		 */
		getShowedEvents: function() {
			return this.sourceData.events.slice(this.startEventsIndex, this.endEventsIndex + 1);
		},

		/**
		 * 判断当前级别下日期和比较日期是否相等
		 * @param  {Date}    date      待判断日期
		 * @param  {Date}    focusDate 比较日期（默认focusDate）
		 * @return {Boolean}           是否相等
		 */
		equalByLevel: function(date, focusDate) {
			var _date = this.getValidDate(parseDateByLevel(date, this.getDateLevel()));
			focusDate = this.getValidDate(parseDateByLevel(focusDate || this.focusDate, this.getDateLevel()));
			return equalDate(_date, focusDate);
		},

		/**
		 * 得到当前显示的日期范围
		 * @return {Object} 日期范围
		 */
		_getTempRange: function() {
			var realRange = this.getRange();
			var focusTime = this.focusDate.getTime();

			var startDate = cloneDate(focusTime - this._rangeDiff);
			var endDate = cloneDate(focusTime + this._rangeDiff);

			if (startDate - realRange.start < 0) {
				startDate = cloneDate(realRange.start);
			}
			if (endDate - realRange.end > 0) {
				endDate = cloneDate(realRange.end);
			}

			return this._formatRange(startDate, endDate);
		},

		/**
		 * 移动到某日期
		 * @param  {Date|String} date 移动到的日期
		 */
		moveTo: function(date) {
			date = this.getValidDate(date);
			this._setFocusDate(date);

			// 根据不同level计算得到位置
			var id = this._getItemId(date, this.showLevel);
			var level = id.split('-')[1];
			var method = SHOWLEVELS[level - 1];
			var v = date[method]();
			if (!this.focusEle || this.focusEle.attr('data-id') != v) {
				this.focusEle = $('#' + id).find('.tl-subitem-label[data-id="' + v + '"]');
			}
			
			this.updatePos();
		},

		/**
		 * 设置当前focusDate的值
		 * @param {Date}    date  要设置的值
		 * @param {Boolean} noref 是否不刷新
		 */
		_setFocusDate: function(date, noref) {
			var that = this;
			if (this.inited && this.focusDate && equalDate(this.focusDate, date)) {
				return;
			}
			if (noref) {
				this.focusDate = this.getValidDate(date);
			} else {
				this.focusDate = date;
				this._refresh();
			}
			if (!this.options.alwaysTrigger && !this.checkDateOK(parseDateByLevel(this.focusDate, this.getDateLevel()))) {
				return;
			}
			if (this.inited) {
				this.EVENT.trigger('dateChange', [this.focusDate, noref]);
			} else {
				setTimeout(function() {
					that.EVENT.trigger('dateChange', [that.focusDate, noref]);
				});
			}
		},

		/**
		 * 更新位置
		 */
		updatePos: function() {
			var offsetLeft = this.focusEle.offset().left + this.focusEle.outerWidth() / 2;
			var offX = this._parseOffset2X(offsetLeft);

			this.x = -offX;
			this._doUpdatePos();
		},

		/**
		 * 更新元素位置
		 */
		_doUpdatePos: function() {
			this._body.css('left', this.x);
			this._cursor.css('left', this._baseX + -this.x);

			this._bodyOffset = this._body.offset();
		},

		/**
		 * 将offsetLeft的值转为需要移动的值
		 * @param  {Number} offsetLeft 需要转换的offsetLeft的值
		 * @return {Number}            转换后的值
		 */
		_parseOffset2X: function(offsetLeft) {
			return offsetLeft - this._bodyOffset.left - this._baseX;
		},

		/**
		 * 根据left值定位日期、元素
		 */
		_posByX: function(newX) {
			var that = this;
			if (newX > this.maxX) {
				newX = this.maxX;
			}
			if (newX < this.minX) {
				newX = this.minX;
			}

			this.x = newX;
			this._doUpdatePos();

			// 根据位置得到当前日期 然后定位
			// 优先判断当前的focusEle是否符合
			if (checkIn(this.focusEle)) {
				return;
			}

			this._body.find('.tl-item').each(function() {
				var ele = $(this);
				if (checkIn(ele)) {
					ele.find('.tl-subitem-label').each(function() {
						var ele = $(this);
						if (checkIn(ele)) {
							// 得到了
							that.focusEle = ele;
							var date = that._getDateByEle(ele);
							that._setFocusDate(date, true);
							return false;
						}
					});
					return false;
				}
			});

			

			function checkIn(ele) {
				var eWidth = ele.outerWidth();
				var ol = that._parseOffset2X(ele.offset().left);
				var x = -newX;
				if (x >= ol && x <= ol + eWidth) {
					// 在这个item范围内
					return true;
				} else {
					return false;
				}
			}
		},

		/**
		 * 得到所有时间项的宽
		 * @return {Number} 所有时间项的宽的值
		 */
		_getAllItemsWidth: function() {
			if (!this._itemsWidth) {
				this._itemsWidth = $('.tl-item').allWidth();
			}
			return this._itemsWidth;
		},

		/**
		 * 计算最小、最大位置
		 */
		computeBound: function() {
			if (!this._containerWidth) {
				this._containerWidth = this._container.width();
				this._baseX = this._containerWidth / 2;
			}
			this.maxX = this._baseX;
			this.minX = -(this._baseX + this._getAllItemsWidth() - this._containerWidth);
		},

		/**
		 * 设置zoom
		 */
		_setZoom: function(zoom) {
			zoom = zoom - 0;
			if (zoom < this.options.minZoom) {
				zoom = this.options.minZoom;
			}
			if (zoom > this.options.maxZoom) {
				zoom = this.options.maxZoom;
			}
			this.zoom = zoom;
		},

		/**
		 * 缩放到指定zoom
		 */
		zoomTo: function(zoom) {
			zoom = zoom - 0;
			if (zoom === this.zoom) return;
			this._setZoom(zoom);
			this.refresh();
			this.EVENT.trigger('zoomChange', this.zoom);
		},

		/**
		 * 按照差值缩放
		 */
		zoomBy: function(n) {
			this.zoomTo(this.zoom + n);
		},

		/**
		 * 放大zoom
		 */
		zoomIn: function() {
			this.zoomBy(this.zoomUnit);
		},

		/**
		 * 缩小zoom
		 */
		zoomOut: function() {
			this.zoomBy(-this.zoomUnit);
		},

		/**
		 * 创建timeline的container
		 * @return {[type]} [description]
		 */
		_buildContainer: function() {
			this._container = $('<div class="tl-container"></div>');
		},

		/**
		 * 创建timeline的cursor
		 */
		_buildCursor: function() {
			this._cursor = $('<div class="tl-cursor"></div>');
		},

		/**
		 * 创建timeline的body
		 */
		_buildBody: function() {
			this._body = $('<div class="tl-body"></div>');
		},

		/**
		 * 初始化zoom临界值树
		 * @return {Object} zoom临界值树对象
		 */
		_initZoomTree: function() {

			if (this._zoomTree) {
				return this._zoomTree;
			}

			var minZoom = this.options.minZoom;
			var maxZoom = this.options.maxZoom;
			var diff = maxZoom - minZoom;
			var ret = {};
			
			ret['YEAR'] = maxZoom - TREESCALE.DE * diff;
			ret['MONTH'] = maxZoom - TREESCALE.YEAR * diff;
			ret['DAY'] = maxZoom - TREESCALE.MONTH * diff;
			ret['HOUR'] = maxZoom - TREESCALE.DAY * diff;
			
			this._zoomTree = ret;

			this.yZoomUnit = (this.options.maxZoom - ret.YEAR) / 4;
			this.mZoomUnit = (ret.YEAR - ret.MONTH) / 4;
			this.dZoomUnit = (ret.MONTH - ret.DAY) / 4;
			this.hZoomUnit = (ret.DAY - ret.HOUR) / 4;

			return ret;
		},

		/**
		 * 计算显示和zoom级别
		 */
		_comLevel: function() {
			var zoomTree = this._zoomTree;
			var zoom = this.zoom;

			if (zoom >= zoomTree.YEAR) {
				// 以1年为单位
				this.showLevel = SHOWLEVELS.YEAR;
				this.zoomLevel = getZoomLevel(zoomTree.YEAR, this.options.maxZoom, ZOOMLEVELNUM, zoom);
				this.zoomUnit = this.yZoomUnit;
			} else if (zoom >= zoomTree.MONTH) {
				// 以1月为单位
				this.showLevel = SHOWLEVELS.MONTH;
				this.zoomLevel = getZoomLevel(zoomTree.MONTH, zoomTree.YEAR, ZOOMLEVELNUM, zoom);
				this.zoomUnit = this.mZoomUnit;
			} else if (zoom >= zoomTree.DAY) {
				// 以1天为单位 
				this.showLevel = SHOWLEVELS.DAY;
				this.zoomLevel = getZoomLevel(zoomTree.DAY, zoomTree.MONTH, ZOOMLEVELNUM, zoom);
				this.zoomUnit = this.dZoomUnit;
			} else {
				// 以1小时为单位
				this.showLevel = SHOWLEVELS.HOUR;
				this.zoomLevel = getZoomLevel(zoomTree.HOUR, zoomTree.DAY, ZOOMLEVELNUM, zoom);
				this.zoomUnit = this.hZoomUnit;
			}
		},

		/**
		 * 构建项内容
		 * @param  {Object} range  范围
		 * @return {String}        构建好的标签字符串
		 */
		_buildItems: function(range) {
			var map = {
				'4': '_buildYears',
				'3': '_buildMonths',
				'2': '_buildDays',
				'1': '_buildHours'
			};

			return this[map[this.showLevel]](range);
		},

		/**
		 * 构建年项
		 * @param  {Object} range  范围
		 * @return {String}        构建好的标签字符串
		 */
		_buildYears: function(range) {
			var reverseDate = this.options.reverseDate;
			var tmp = range[reverseDate ? 'end' : 'start'];
			var lastDE = tmp.getDE();

			var subitemLabels = '<div class="tl-subitem-labels">';
			var endDiv = '</div>';

			var buildDE = function() {
				return '<div class="tl-item tl-item-years" id="tl-' + SHOWLEVELS.DE + '-' + lastDE + '">';
			};

			var ret = buildDE() + this._buildSubItemBody(lastDE + 's') +
								subitemLabels;
			tmp = newDate(tmp.getFullYear());
			if (reverseDate) {
				var start = newDate(range.start.getFullYear());
				while (tmp - start >= 0) {
					if (tmp.getDE() < lastDE) {
						lastDE = tmp.getDE();
						ret += endDiv + endDiv + buildDE();
						ret += this._buildSubItemBody(lastDE + 's') + subitemLabels;
					}
					ret += this._buildYear(tmp);
					tmp.setFullYear(tmp.getFullYear() - 1);
				}
			} else {
				while (tmp - range.end <= 0) {
					if (tmp.getDE() > lastDE) {
						lastDE = tmp.getDE();
						ret += endDiv + endDiv + buildDE();
						ret += this._buildSubItemBody(lastDE + 's') + subitemLabels;
					}
					ret += this._buildYear(tmp);
					tmp.setFullYear(tmp.getFullYear() + 1);
				}
			}
			
			ret += endDiv + endDiv;
			return ret;
		},

		/**
		 * 构建年子项
		 * @param  {Date} date  日期
		 * @return {String}     构建好的标签字符串
		 */
		_buildYear: function(date) {
			var y = date.getFullYear();
			var v = this.zoomLevel >= ZOOMLEVELNUM ? SPACE :
							this.zoomLevel >= ZOOMLEVELNUM - 1 ? SPACE + SPACE :
							this.zoomLevel >= ZOOMLEVELNUM - 2 ? SPACE + SPACE + SPACE :
							y;
			return this._getSubitemLabel(y, v, date);
		},

		/**
		 * 构建月项
		 * @param  {Object} range  范围
		 * @return {String}        构建好的标签字符串
		 */
		_buildMonths: function(range) {
			var reverseDate = this.options.reverseDate;
			var tmp = range[reverseDate ? 'end' : 'start'];
			var lastYear = tmp.getFullYear();

			var subitemLabels = '<div class="tl-subitem-labels">';
			var endDiv = '</div>';

			var buildY = function() {
				return '<div class="tl-item tl-item-months" id="tl-' + SHOWLEVELS.YEAR + '-' + lastYear + '">';
			};

			var ret = buildY() + this._buildSubItemBody(lastYear) +
								subitemLabels;
			tmp = newDate(tmp.getFullYear(), tmp.getMonth());
			if (reverseDate) {
				var start = newDate(range.start.getFullYear(), range.start.getMonth());
				while (tmp - start >= 0) {
					if (tmp.getFullYear() < lastYear) {
						lastYear = tmp.getFullYear();
						ret += endDiv + endDiv + buildY();
						ret += this._buildSubItemBody(lastYear) + subitemLabels;
					}
					ret += this._buildMonth(tmp);
					tmp.setMonth(tmp.getMonth() - 1);
				}
			} else {
				while (tmp - range.end <= 0) {
					if (tmp.getFullYear() > lastYear) {
						lastYear = tmp.getFullYear();
						ret += endDiv + endDiv + buildY();
						ret += this._buildSubItemBody(lastYear) + subitemLabels;
					}
					ret += this._buildMonth(tmp);
					tmp.setMonth(tmp.getMonth() + 1);
				}
			}
			
			ret += endDiv + endDiv;
			return ret;
		},

		/**
		 * 构建月子项
		 * @param  {Date} date  日期
		 * @return {String}     构建好的标签字符串
		 */
		_buildMonth: function(date) {
			var m = date.getMonth() + 1;
			var v = this.zoomLevel >= ZOOMLEVELNUM ? SPACE :
							this.zoomLevel >= ZOOMLEVELNUM - 1 ? m :
							this.zoomLevel >= ZOOMLEVELNUM - 2 ? m + '月' :
							date.getFullYear() + '-' + m;

			return this._getSubitemLabel(m - 1, v, date);
		},

		/**
		 * 构建天项
		 * @param  {Object} range  范围
		 * @return {String}        构建好的标签字符串
		 */
		_buildDays: function(range) {
			var reverseDate = this.options.reverseDate;
			var tmp = range[reverseDate ? 'end' : 'start'];
			var lastYear = tmp.getFullYear();
			var lastMonth = tmp.getMonth();

			var subitemLabels = '<div class="tl-subitem-labels">';
			var endDiv = '</div>';

			var buildYM = function() {
				return '<div class="tl-item tl-item-days" id="tl-' + SHOWLEVELS.MONTH + '-' + lastYear + '-' + lastMonth + '">';
			};

			var getIn = function() {
				return lastYear + '-' + (lastMonth + 1);
			};

			var ret = buildYM() +
								this._buildSubItemBody(getIn()) +
								subitemLabels;
			var tmpt;
			tmp = newDate(tmp.getFullYear(), tmp.getMonth(), tmp.getDate());
			if (reverseDate) {
				var start = newDate(range.start.getFullYear(), range.start.getMonth(), range.start.getDate());
				while (tmp - start >= 0) {
					tmpt = tmp.getFullYear();
					if (tmpt < lastYear) {
						lastYear = tmpt;
						lastMonth = tmp.getMonth();
						ret += endDiv + endDiv + buildYM();
						ret += this._buildSubItemBody(getIn()) + subitemLabels;
					} else if (tmpt === lastYear) {
						tmpt = tmp.getMonth();
						if (tmpt < lastMonth) {
							lastMonth = tmpt;
							ret += endDiv + endDiv + buildYM();
							ret += this._buildSubItemBody(getIn()) + subitemLabels;
						}
					}
					ret += this._buildDay(tmp);
					tmp.setDate(tmp.getDate() - 1);
				}
			} else {
				while (tmp - range.end <= 0) {
					tmpt = tmp.getFullYear();
					if (tmpt > lastYear) {
						lastYear = tmpt;
						lastMonth = tmp.getMonth();
						ret += endDiv + endDiv + buildYM();
						ret += this._buildSubItemBody(getIn()) + subitemLabels;
					} else if (tmpt === lastYear) {
						tmpt = tmp.getMonth();
						if (tmpt > lastMonth) {
							lastMonth = tmpt;
							ret += endDiv + endDiv + buildYM();
							ret += this._buildSubItemBody(getIn()) + subitemLabels;
						}
					}
					ret += this._buildDay(tmp);
					tmp.setDate(tmp.getDate() + 1);
				}
			}
			
			ret += endDiv + endDiv;
			return ret;
		},

		/**
		 * 构建天子项
		 * @param  {Date} date  日期
		 * @return {String}     构建好的标签字符串
		 */
		_buildDay: function(date) {
			var d = date.getDate();
			var v = this.zoomLevel >= ZOOMLEVELNUM ? SPACE :
							this.zoomLevel >= ZOOMLEVELNUM - 1 ? d :
							this.zoomLevel >= ZOOMLEVELNUM - 2 ? d + '日' :
							date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + d;
			return this._getSubitemLabel(d, v, date);
		},

		/**
		 * 构建小时项
		 * @param  {Object} range  范围
		 * @return {String}        构建好的标签字符串
		 */
		_buildHours: function(range) {
			var reverseDate = this.options.reverseDate;
			var tmp = range[reverseDate ? 'end' : 'start'];
			var lastYear = tmp.getFullYear();
			var lastMonth = tmp.getMonth();
			var lastDay = tmp.getDate();

			var subitemLabels = '<div class="tl-subitem-labels">';
			var endDiv = '</div>';

			var buildYMD = function() {
				return '<div class="tl-item tl-item-hours" id="tl-' + SHOWLEVELS.DAY + '-' + lastYear + '-' + lastMonth + '-' + lastDay + '">';
			};

			var getIn = function() {
				return lastYear + '-' + (lastMonth + 1) + '-' + lastDay;
			};

			var ret = buildYMD() +
								this._buildSubItemBody(getIn()) +
								subitemLabels;
			var tmpt;
			tmp = newDate(tmp.getFullYear(), tmp.getMonth(), tmp.getDate(), tmp.getHours());
			if (reverseDate) {
				var start = newDate(range.start.getFullYear(), range.start.getMonth(), range.start.getDate(), range.start.getHours());
				while (tmp - start >= 0) {
					tmpt = tmp.getFullYear();
					if (tmpt < lastYear) {
						lastYear = tmpt;
						lastMonth = tmp.getMonth();
						lastDay = tmp.getDate();
						ret += endDiv + endDiv + buildYMD();
						ret += this._buildSubItemBody(getIn()) + subitemLabels;
					} else if (tmpt === lastYear) {
						tmpt = tmp.getMonth();
						if (tmpt < lastMonth) {
							lastMonth = tmpt;
							lastDay = tmp.getDate();
							ret += endDiv + endDiv + buildYMD();
							ret += this._buildSubItemBody(getIn()) + subitemLabels;
						} else if (tmpt === lastMonth) {
							tmpt = tmp.getDate();
							if (tmpt < lastDay) {
								lastDay = tmpt;
								ret += endDiv + endDiv + buildYMD();
								ret += this._buildSubItemBody(getIn()) + subitemLabels;
							}
						}
					}
					ret += this._buildHour(tmp);
					tmp.setHours(tmp.getHours() - 1);
				}
			} else {
				while (tmp - range.end <= 0) {
					tmpt = tmp.getFullYear();
					if (tmpt > lastYear) {
						lastYear = tmpt;
						lastMonth = tmp.getMonth();
						lastDay = tmp.getDate();
						ret += endDiv + endDiv + buildYMD();
						ret += this._buildSubItemBody(getIn()) + subitemLabels;
					} else if (tmpt === lastYear) {
						tmpt = tmp.getMonth();
						if (tmpt > lastMonth) {
							lastMonth = tmpt;
							lastDay = tmp.getDate();
							ret += endDiv + endDiv + buildYMD();
							ret += this._buildSubItemBody(getIn()) + subitemLabels;
						} else if (tmpt === lastMonth) {
							tmpt = tmp.getDate();
							if (tmpt > lastDay) {
								lastDay = tmpt;
								ret += endDiv + endDiv + buildYMD();
								ret += this._buildSubItemBody(getIn()) + subitemLabels;
							}
						}
					}
					ret += this._buildHour(tmp);
					tmp.setHours(tmp.getHours() + 1);
				}
			}
			
			ret += endDiv + endDiv;
			return ret;
		},

		/**
		 * 构建小时子项
		 * @param  {Date} date  日期
		 * @return {String}     构建好的标签字符串
		 */
		_buildHour: function(date) {
			var h = date.getHours();
			var v = this.zoomLevel >= ZOOMLEVELNUM ? SPACE :
							this.zoomLevel >= ZOOMLEVELNUM - 1 ? h :
							this.zoomLevel >= ZOOMLEVELNUM - 2 ? h + '时' :
							date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + ' ' + h + '时';
			return this._getSubitemLabel(h, v, date);
		},

		/**
		 * 构建日期子项label内容
		 * @param  {String}  id  真实值
		 * @param  {String}  val 显示值
		 * @param  {Boolean} ok  是否是有效日期点
		 * @return {String}      构建好的标签字符串
		 */
		_getSubitemLabel: function(id, val, date) {
			var levelClass = ' tl-subitem-label-' + this.zoomLevel;
			if (date && this.checkDateOK(date)) {
				levelClass += ' tl-subitem-label-ok';
			}
			return '<div class="tl-subitem-label' + levelClass + '" data-id="' + id + '">' + val + '</div>';
		},

		/**
		 * 根据日期得到日期大项的id
		 * @param  {date}   info 日期
		 * @param  {Number} info 显示级别
		 * @return {String}      id
		 */
		_getItemId: function(date, level) {
			var id = 'tl-';
			if (level == SHOWLEVELS.YEAR) {
				id += SHOWLEVELS.DE + '-' + date.getDE();
			} else if (level == SHOWLEVELS.MONTH) {
				id += SHOWLEVELS.YEAR + '-' + date.getFullYear();
			} else if (level == SHOWLEVELS.DAY) {
				id += SHOWLEVELS.MONTH + '-' + date.getFullYear() + '-' + date.getMonth();
			} else {
				// HOUR
				id += SHOWLEVELS.DAY + '-' + date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate();
			}
			return id;
		},

		/**
		 * 构建日期子项body内容
		 * @param  {String} info 显示内容
		 * @return {String}      构建好的标签字符串
		 */
		_buildSubItemBody: function(info) {
			return '<div class="tl-subitem-body"><div class="tl-subitem-body-line"></div><div class="tl-subitem-body-label">' + info + '</div></div>';
		},

		/**
		 * 绑定需要的事件
		 */
		_bindEvents: function() {
			var that = this;

			$(window).on('resize', $.proxy(this._onResize, this));
			
			this._container.delegate('.tl-subitem-label', 'click', $.proxy(this._onSubitemClick, this));

			this._container.on('mousedown', $.proxy(this._onMousedown, this));

			this.options.mouseZoom && this._container.on('mousewheel', $.proxy(this._onMousewheel, this));
		},

		/**
		 * 鼠标滚轮滚动处理函数
		 */
		_onMousewheel: function(e) {
			e.preventDefault();
			var oe = e.originalEvent;
			var delta = 0;
			if (oe.wheelDelta) {
				delta = oe.wheelDelta;
			} else if ('detail' in oe) {
				delta = -oe.detail * 40;
			}
			var zoomTree = this._zoomTree;
			var curLevel = this.showLevel;
			var zoomLevel = this.zoomLevel;
			var zoom = this.zoom;
			var map = {
				'4': 'YEAR',
				'3': 'MONTH',
				'2': 'DAY',
				'1': 'HOUR'
			};
			var n = .00000001;
			var targetZoom, tmp;
			if (delta > 0) {
				// 缩小zoom
				targetZoom = zoom - this.zoomUnit;
				if (curLevel > 1) {
					tmp = zoomTree[map[curLevel]];
					if (zoom >= tmp && targetZoom <= tmp) {
						// 跨级了
						if (zoomLevel > ZOOMLEVELNUM - 3) {
							// 没有显示最小级别
							targetZoom = tmp + n;
						} else {
							targetZoom = tmp - n;
						}
					}
				}
			} else {
				targetZoom = zoom + this.zoomUnit;
				if (curLevel < 4) {
					tmp = zoomTree[map[curLevel + 1]];
					if (zoom <= tmp && targetZoom >= tmp) {
						// 跨级了
						if (zoomLevel < ZOOMLEVELNUM) {
							// 没有显示最大级别
							targetZoom = tmp - n;
						} else {
							targetZoom = tmp + n;
						}
					}
				}
			}

			this.zoomTo(targetZoom);
		},

		/**
		 * 鼠标按下处理函数
		 */
		_onMousedown: function(e) {
			var doc = $(document);
			var downed = true;
			var moved = false;
			var that = this;

			var startX = e.pageX;

			doc.on('mousemove', mousemove);
			doc.on('mouseup', mouseup);

			function mousemove(e) {
				if (!downed) return;
				e.preventDefault();
				moved = true;
				doMove(e.pageX);
			}

			function doMove(x) {
				var diff = x - startX;
				var newX = that.x + diff;
				that._posByX(newX);
				startX = x;
			}

			function mouseup(e) {
				downed = false;
				doc.off('mousemove', mousemove);
				doc.off('mouseup', mouseup);
				doc = null;
				if (!moved) return;
				// 重新移动到focusDate
				that._refresh();
				that.moveTo(that.focusDate);
				
			}

		},

		/**
		 * 点击日期标签处理函数
		 */
		_onSubitemClick: function(e) {
			var ele = $(e.target);
			e.stopPropagation();
			this.moveTo(this._getDateByEle(ele));
		},

		/**
		 * resize处理函数
		 */
		_onResize: function() {
			clearTimeout(this._resizeTimeout);
			var that = this;
			this._resizeTimeout = setTimeout(function() {
				that._containerWidth = that._container.width();
				that._baseX = that._containerWidth / 2;
				that.computeBound();
				that.updatePos();
			}, 100);
		},

		/**
		 * 得到某元素的代表日期
		 * @param  {Object} ele jquery封装过的元素
		 * @return {Date}        日期
		 */
		_getDateByEle: function(ele) {
			var v = ele.attr('data-id');
			var d;
			if (this.showLevel >= SHOWLEVELS.YEAR) {
				d = newDate(v);
			} else if (this.showLevel == SHOWLEVELS.MONTH) {
				d = _getDate(+v + 1);
			} else if (this.showLevel == SHOWLEVELS.DAY) {
				// 2012-0
				d = _getDate(v);
			} else {
				d = _getDate();
				d.setHours(v);
			}
			return d;

			function _getDate(v) {
				var d = ele.closest('.tl-item').prop('id').substr(5).split('-');
				if (d[1]) d[1] = d[1] - 0 + 1;
				v && d.push(v);
				d = d.join('-');
				return parse2Date(d, true);
			}
		},

		/**
		 * 格式化日期范围
		 * @param  {Date} start 开始日期
		 * @param  {Date} end   结束日期
		 * @return {Object}     格式化后结果
		 */
		_formatRange: function(start, end) {
			return {
				start: start,
				end: end
			};
		},

		/**
		 * 得到实际日期时间范围
		 * @return {Object} 范围
		 */
		getRange: function(hard) {
			if (!hard && this._realRange) {
				return this._realRange;
			}
			// 假定得到数据已经排过序了
			// 且日期可以传入Date参数中
			var events = this.sourceData.events;
			this._realRange = this._formatRange(
				parse2Date(events[0].startDate),
				parse2Date(events[events.length - 1].endDate || events[events.length - 1].startDate)
			);
			return this._realRange;
		}


	});
	
	// 得到focusDate上个日期 下个日期
	$.each(['getPrevDate', 'getNextDate'], function(_, name) {
		Timeline.prototype[name] = function() {
			var date = this.focusDate;
			var k = this.options.reverseDate ? 1 : -1;
			var d;
			if (name !== 'getPrevDate') {
				k = -k;
			}
			if (this.showLevel >= SHOWLEVELS.YEAR) {
				d = newDate(date.getFullYear() + k);
			} else if (this.showLevel == SHOWLEVELS.MONTH) {
				d = newDate(date.getFullYear(), date.getMonth() + k);
			} else if (this.showLevel == SHOWLEVELS.DAY) {
				// 2012-0
				d = newDate(date.getFullYear(), date.getMonth(), date.getDate() + k);
			} else {
				d = newDate(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours() + k);
			}
			return this.getValidDate(d);
		};
	});

	
	/**
	 * 计算缩放级别
	 * @param  {Number} start 开始zoom值
	 * @param  {Number} end   结束zoom值
	 * @param  {Number} pn    划分为几个等级
	 * @param  {Number} num   当前zoom值
	 * @return {Number}       处在等级位置
	 */
	function getZoomLevel(start, end, pn, num) {
		return Math.ceil((num - start) / ((end - start) / pn));
	}
	Timeline.getZoomLevel = getZoomLevel;

	/**
	 * 复制日期
	 * @param  {Date} date  待复制日期
	 * @return {Date}       复制得到新日期
	 */
	function cloneDate(date) {
		if (date.getTime) {
			return new Date(date.getTime());
		}
		return parse2Date(date);
	}
	Timeline.cloneDate = cloneDate;

	/**
	 * 得到日期
	 * @param  {Number} y   年
	 * @return {Date}       得到的日期
	 */
	function newDate(y) {
		var retDate = new Date();
		// 重置时间
		for (var i = 0; i < 7; i++) {
			if (!arguments[i] || (arguments[i] = arguments[i] - 0) < 0) {
				arguments[i] = 0;
			}
		}
		if (y) retDate.setFullYear(y);
		retDate.setMonth(arguments[1]);
		if (!arguments[2]) arguments[2] = 1;
		retDate.setDate(arguments[2]);
		retDate.setHours(arguments[3]);
		retDate.setMinutes(arguments[4]);
		retDate.setSeconds(arguments[5]);
		retDate.setMilliseconds(arguments[6]);
		return retDate;
	}
	Timeline.newDate = newDate;

	/**
	 * 将日期转为某一级日期
	 * @param  {Date}   date  待转日期
	 * @param  {String} level YEAR|MONTH|DAY|HOUR
	 * @return {Date}         转换后日期
	 */
	function parseDateByLevel(date, level) {
		if (!date.getTime) {
			date = parse2Date(date);
		}
		var r = [date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()];
		var args = r.slice(0, DATELEVEL[level] || 4);
		return newDate.apply(this, args);
	}
	Timeline.parseDateByLevel = parseDateByLevel;

	/**
	 * 格式化日期字符串为日期（'2014-01-12 12:34:38:299'）
	 * 这种设置有的浏览器支持（Chrome）有的则不支持
	 * @param  {String|Number} str       支持的需要格式化的日期
	 * @param  {Boolean}       overwrite 重写小时，Chrome上如果是
	 *                                   10+月份，得到小时是8
	 * @return {Date}       格式化后日期
	 */
	function parse2Date(str, overwrite) {
		var retDate;
		try {
			retDate = new Date(str);
			overwrite && retDate.setHours(0);
		} catch(e) {
			spDate();
		}
		if (isNaN(retDate.getTime())) {
			spDate();
		}
		return retDate;

		function spDate() {
			// 首先划分得到年月日
			// 日中日中可能
			var s = str.split('-');
			var a;
			if (a = s[2]) {
				a.split(' ');
				// 日
				s[2] = a[0];
				if (a[1]) {
					s.length = 3;
					s.push.apply(s, a[1].split(':'));
				}
			}
			if (s[1]) s[1] -= 1;
			retDate = newDate.apply(this, s);
		}
	}
	Timeline.parse2Date = parse2Date;

	/**
	 * 判断两个日期是否相等
	 * @param  {Date}    date1 日期1
	 * @param  {Date}    date2 日期2
	 * @return {Boolean}       是否相等
	 */
	function equalDate(date1, date2) {
		if (date1 === date2 || date1.getTime() === date2.getTime()) {
			return true;
		}
		return false;
	}
	Timeline.equalDate = equalDate;

	// 支持MD
	if (typeof module === 'object' && module && typeof module.exports === 'object') {
		module.exports = Timeline;
	} else {
		if (typeof define === 'function' && define.amd) {
			define([], function() { return Timeline; });
		}
	}

}(window, $));
