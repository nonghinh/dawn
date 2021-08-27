(function () {
    "use strict";

    var BODYTYPES = ["DAYS", "MONTHS", "YEARS"];
    var MONTHS = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    var WEEKDAYS = [
        "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
    ];

    /** @typedef {Object.<string, Function[]>} Handlers */
    /** @typedef {function(String, Function): null} AddHandler */
    /** @typedef {("DAYS"|"MONTHS"|"YEARS")} BodyType */
    /** @typedef {string|number} StringNum */
    /** @typedef {Object.<string, StringNum>} StringNumObj */

    /**
     * The local state
     * @typedef {Object} InstanceState
     * @property {Date} value
     * @property {Number} year
     * @property {Number} month
     * @property {Number} day
     * @property {Number} time
     * @property {Number} hours
     * @property {Number} minutes
     * @property {Number} seconds
     * @property {BodyType} bodyType
     * @property {Boolean} visible
     * @property {Number} cancelBlur
     */

    /**
     * @typedef {Object} Config
     * @property {String} dateFormat
     * @property {String} timeFormat
     * @property {Boolean} showDate
     * @property {Boolean} showTime
     * @property {Number} paddingX
     * @property {Number} paddingY
     * @property {BodyType} defaultView
     * @property {"TOP"|"BOTTOM"} direction
    */

    /**
     * @class
     * @param {HTMLElement} elem
     * @param {Config} config
     */
    function DTS(elem, config) {
        var config = config || {};

        /** @type {Config} */
        var defaultConfig = {
            defaultView: BODYTYPES[0],
            dateFormat: "dd/mm/yyyy",
            timeFormat: "HH:MM:SS",
            showDate: true,
            showTime: false,
            paddingX: 5,
            paddingY: 5,
            direction: 'TOP'
        }

        if (!elem) {
            throw TypeError("input element or selector required for contructor");
        }
        if (Object.getPrototypeOf(elem) === String.prototype) {
            var _elem = document.querySelectorAll(elem);
            if (!_elem[0]){
                throw Error('"' + elem + '" not found.');
            }
            elem = _elem[0];
        }
        this.config = setDefaults(config, defaultConfig);
        this.dateFormat = this.config.dateFormat;
        this.timeFormat = this.config.timeFormat;
        this.dateFormatRegEx = new RegExp("yyyy|yy|mm|dd", "gi");
        this.timeFormatRegEx = new RegExp("hh|mm|ss|a", "gi");
        this.inputElem = elem;
        this.dtbox = null;
        this.setup();
    }
    DTS.prototype.setup = function () {
        var handler = this.inputElemHandler.bind(this);
        this.inputElem.addEventListener("focus", handler, false)
        this.inputElem.addEventListener("blur", handler, false);
    }
    DTS.prototype.inputElemHandler = function (e) {
        if (e.type == "focus") {
            if (!this.dtbox) {
                this.dtbox = new DTBox(e.target, this);
            }
            this.dtbox.visible = true;
        } else if (e.type == "blur" && this.dtbox && this.dtbox.visible) {
            var self = this;
            setTimeout(function () {
                if (self.dtbox.cancelBlur > 0) {
                    self.dtbox.cancelBlur -= 1;
                 } else {
                    self.dtbox.visible = false;
                    self.inputElem.blur();
                 }
            }, 100);
        }
    }
    /**
     * @class
     * @param {HTMLElement} elem
     * @param {DTS} settings
     */
    function DTBox(elem, settings) {
        /** @type {DTBox} */
        var self = this;

        /** @type {Handlers} */
        var handlers = {};

        /** @type {InstanceState} */
        var localState = {};

        /**
         * @param {String} key
         * @param {*} default_val
         */
        function getterSetter(key, default_val) {
            return {
                get: function () {
                    var val = localState[key];
                    return val === undefined ? default_val : val;
                },
                set: function (val) {
                    var prevState = self.state;
                    var _handlers = handlers[key] || [];
                    localState[key] = val;
                    for (var i = 0; i < _handlers.length; i++) {
                        _handlers[i].bind(self)(localState, prevState);
                    }
                },
            };
        };

        /** @type {AddHandler} */
        function addHandler(key, handlerFn) {
            if (!key || !handlerFn) {
                return false;
            }
            if (!handlers[key]) {
                handlers[key] = [];
            }
            handlers[key].push(handlerFn);
        }

        Object.defineProperties(this, {
            visible: getterSetter("visible", false),
            bodyType: getterSetter("bodyType", settings.config.defaultView),
            value: getterSetter("value"),
            year: getterSetter("year", 0),
            month: getterSetter("month", 0),
            day: getterSetter("day", 0),
            hours: getterSetter("hours", 0),
            minutes: getterSetter("minutes", 0),
            seconds: getterSetter("seconds", 0),
            cancelBlur: getterSetter("cancelBlur", 0),
            addHandler: {value: addHandler},
            month_long: {
                get: function () {
                    return MONTHS[self.month];
                },
            },
            month_short: {
                get: function () {
                    return self.month_long.slice(0, 3);
                },
            },
            state: {
                get: function () {
                    return Object.assign({}, localState);
                },
            },
            time: {
                get: function() {
                    var hours = self.hours * 60 * 60 * 1000;
                    var minutes = self.minutes * 60 * 1000;
                    var seconds = self.seconds * 1000;
                    return  hours + minutes + seconds;
                }
            },
        });
        this.el = {};
        this.settings = settings;
        this.elem = elem;
        this.setup();
    }
    DTBox.prototype.setup = function () {
        Object.defineProperties(this.el, {
            wrapper: { value: null, configurable: true },
            header: { value: null, configurable: true },
            body: { value: null, configurable: true },
            footer: { value: null, configurable: true }
        });
        this.setupWrapper();
        if (this.settings.config.showDate) {
            this.setupHeader();
            this.setupBody();
        }
        if (this.settings.config.showTime) {
            this.setupFooter();
        }

        var self = this;
        this.addHandler("visible", function (state, prevState) {
            if (state.visible && !prevState.visible){
                document.body.appendChild(this.el.wrapper);

                var parts = self.elem.value.trim().split(/\s+/); /* Hinh change here*/
                var startDate = undefined;
                var startTime = 0;
                if (self.settings.config.showDate) {
                    startDate = parseDate(parts[0], self.settings);
                }
                if (self.settings.config.showTime) {
                    startTime = parseTime(parts[parts.length-1], self.settings);
                    startTime = startTime || 0;
                }
                if (!(startDate && startDate.getTime())) {
                    startDate = new Date();
                    startDate = new Date(
                        startDate.getFullYear(),
                        startDate.getMonth(),
                        startDate.getDate()
                    );
                }
                var value = new Date(startDate.getTime() + startTime);
                self.value = value;
                self.year = value.getFullYear();
                self.month = value.getMonth();
                self.day = value.getDate();
                self.hours = value.getHours();
                self.minutes = value.getMinutes();
                self.seconds = value.getSeconds();

                if (self.settings.config.showDate) {
                    self.setHeaderContent();
                    self.setBodyContent();
                }
                if (self.settings.config.showTime) {
                    self.setFooterContent();
                }
            } else if (!state.visible && prevState.visible) {
                document.body.removeChild(this.el.wrapper);
            }
        });
    }
    DTBox.prototype.setupWrapper = function () {
        if (!this.el.wrapper) {
            var el = document.createElement("div");
            el.classList.add("date-selector-wrapper");
            Object.defineProperty(this.el, "wrapper", { value: el });
        }
        var self = this;
        var htmlRoot = document.getElementsByTagName('html')[0];
        function setPosition(e){
            var minTopSpace = 300;
            var box = getOffset(self.elem);
            var config = self.settings.config;
            var paddingY = config.paddingY || 5;
            var paddingX = config.paddingX || 5;
            var top = box.top + self.elem.offsetHeight + paddingY;
            var left = box.left + paddingX;
            var bottom = htmlRoot.clientHeight - box.top + paddingY;

            self.el.wrapper.style.left = `${left}px`;
            if (box.top > minTopSpace && config.direction != 'BOTTOM') {
                self.el.wrapper.style.bottom = `${bottom}px`;
                self.el.wrapper.style.top = '';
            } else {
                self.el.wrapper.style.top = `${top}px`;
                self.el.wrapper.style.bottom = '';
            }
        }

        function handler(e) {
            self.cancelBlur += 1;
            setTimeout(function(){
                self.elem.focus();
            }, 50);
        }
        setPosition();
        this.setPosition = setPosition;
        this.el.wrapper.addEventListener("mousedown", handler, false);
        this.el.wrapper.addEventListener("touchstart", handler, false);
        window.addEventListener('resize', this.setPosition);
    }
    DTBox.prototype.setupHeader = function () {
        if (!this.el.header) {
            var row = document.createElement("div");
            var classes = ["cal-nav-prev", "cal-nav-current", "cal-nav-next"];
            row.classList.add("cal-header");
            for (var i = 0; i < 3; i++) {
                var cell = document.createElement("div");
                cell.classList.add("cal-nav", classes[i]);
                cell.onclick = this.onHeaderChange.bind(this);
                row.appendChild(cell);
            }
            row.children[0].innerHTML = "&lt;";
            row.children[2].innerHTML = "&gt;";
            Object.defineProperty(this.el, "header", { value: row });
            tryAppendChild(row, this.el.wrapper);
        }
        this.setHeaderContent();
    }
    DTBox.prototype.setHeaderContent = function () {
        var content = this.year;
        if ("DAYS" == this.bodyType) {
            content = this.month_long + " " + content;
        } else if ("YEARS" == this.bodyType) {
            var start = this.year + 10 - (this.year % 10);
            content = start - 10 + "-" + (start - 1);
        }
        this.el.header.children[1].innerText = content;
    }
    DTBox.prototype.setupBody = function () {
        if (!this.el.body) {
            var el = document.createElement("div");
            el.classList.add("cal-body");
            Object.defineProperty(this.el, "body", { value: el });
            tryAppendChild(el, this.el.wrapper);
        }
        var toAppend = null;
        function makeGrid(rows, cols, className, firstRowClass, clickHandler) {
            var grid = document.createElement("div");
            grid.classList.add(className);
            for (var i = 1; i < rows + 1; i++) {
                var row = document.createElement("div");
                row.classList.add("cal-row", "cal-row-" + i);
                if (i == 1 && firstRowClass) {
                    row.classList.add(firstRowClass);
                }
                for (var j = 1; j < cols + 1; j++) {
                    var col = document.createElement("div");
                    col.classList.add("cal-cell", "cal-col-" + j);
                    col.onclick = clickHandler;
                    row.appendChild(col);
                }
                grid.appendChild(row);
            }
            return grid;
        }
        if ("DAYS" == this.bodyType) {
            toAppend = this.el.body.calDays;
            if (!toAppend) {
                toAppend = makeGrid(7, 7, "cal-days", "cal-day-names", this.onDateSelected.bind(this));
                for (var i = 0; i < 7; i++) {
                    var cell = toAppend.children[0].children[i];
                    cell.innerText = WEEKDAYS[i].slice(0, 2);
                    cell.onclick = null;
                }
                this.el.body.calDays = toAppend;
            }
        } else if ("MONTHS" == this.bodyType) {
            toAppend = this.el.body.calMonths;
            if (!toAppend) {
                toAppend = makeGrid(3, 4, "cal-months", null, this.onMonthSelected.bind(this));
                for (var i = 0; i < 3; i++) {
                    for (var j = 0; j < 4; j++) {
                        var monthShort = MONTHS[4 * i + j].slice(0, 3);
                        toAppend.children[i].children[j].innerText = monthShort;
                    }
                }
                this.el.body.calMonths = toAppend;
            }
        } else if ("YEARS" == this.bodyType) {
            toAppend = this.el.body.calYears;
            if (!toAppend) {
                toAppend = makeGrid(3, 4, "cal-years", null, this.onYearSelected.bind(this));
                this.el.body.calYears = toAppend;
            }
        }
        empty(this.el.body);
        tryAppendChild(toAppend, this.el.body);
        this.setBodyContent();
    }
    DTBox.prototype.setBodyContent = function () {
        var grid = this.el.body.children[0];
        var classes = ["cal-cell-prev", "cal-cell-next", "cal-value"];
        if ("DAYS" == this.bodyType) {
            var oneDayMilliSecs = 24 * 60 * 60 * 1000;
            var start = new Date(this.year, this.month, 1);
            var adjusted = new Date(start.getTime() - oneDayMilliSecs * start.getDay());

            grid.children[6].style.display = "";
            for (var i = 1; i < 7; i++) {
                for (var j = 0; j < 7; j++) {
                    var cell = grid.children[i].children[j];
                    var month = adjusted.getMonth();
                    var date = adjusted.getDate();

                    cell.innerText = date;
                    cell.classList.remove(classes[0], classes[1], classes[2]);
                    if (month != this.month) {
                        if (i == 6 && j == 0) {
                            grid.children[6].style.display = "none";
                            break;
                        }
                        cell.classList.add(month < this.month ? classes[0] : classes[1]);
                    } else if (isEqualDate(adjusted, this.value)){
                        cell.classList.add(classes[2]);
                    }
                    adjusted = new Date(adjusted.getTime() + oneDayMilliSecs);
                }
            }
        } else if ("YEARS" == this.bodyType) {
            var year = this.year - (this.year % 10) - 1;
            for (i = 0; i < 3; i++) {
                for (j = 0; j < 4; j++) {
                    grid.children[i].children[j].innerText = year;
                    year += 1;
                }
            }
            grid.children[0].children[0].classList.add(classes[0]);
            grid.children[2].children[3].classList.add(classes[1]);
        }
    }

    /** @param {Event} e */
    DTBox.prototype.onTimeChange = function(e) {
        e.stopPropagation();
        if (e.type == 'mousedown') {
            this.cancelBlur += 1;
            return;
        }

        var el = e.target;
        this[el.name] = parseInt(el.value) || 0;
        this.setupFooter();
        if (e.type == 'change') {
            var self = this;
            setTimeout(function(){
                self.elem.focus();
            }, 50);
        }
        this.setInputValue();
    }

    DTBox.prototype.setupFooter = function() {
        if (!this.el.footer) {
            var footer = document.createElement("div");
            var handler = this.onTimeChange.bind(this);
            var self = this;

            function makeRow(label, name, range, changeHandler) {
                var row = document.createElement("div");
                row.classList.add('cal-time');

                var labelCol = row.appendChild(document.createElement("div"));
                labelCol.classList.add('cal-time-label');
                labelCol.innerText = label;

                var valueCol = row.appendChild(document.createElement("div"));
                valueCol.classList.add('cal-time-value');
                valueCol.innerText = '00';

                var inputCol = row.appendChild(document.createElement("div"));
                var slider = inputCol.appendChild(document.createElement("input"));
                Object.assign(slider, {step:1, min:0, max:range, name:name, type:'range'});
                Object.defineProperty(footer, name, {value: slider});
                inputCol.classList.add('cal-time-slider');
                slider.onchange = changeHandler;
                slider.oninput = changeHandler;
                slider.onmousedown = changeHandler;
                self[name] = self[name] || parseInt(slider.value) || 0;
                footer.appendChild(row)
            }
            makeRow('HH:', 'hours', 23, handler);
            makeRow('MM:', 'minutes', 59, handler);
            makeRow('SS:', 'seconds', 59, handler);

            footer.classList.add("cal-footer");
            Object.defineProperty(this.el, "footer", { value: footer });
            tryAppendChild(footer, this.el.wrapper);
        }
        this.setFooterContent();
    }

    DTBox.prototype.setFooterContent = function() {
        if (this.el.footer) {
            var footer = this.el.footer;
            footer.hours.value = this.hours;
            footer.children[0].children[1].innerText = padded(this.hours, 2);
            footer.minutes.value = this.minutes;
            footer.children[1].children[1].innerText = padded(this.minutes, 2);
            footer.seconds.value = this.seconds;
            footer.children[2].children[1].innerText = padded(this.seconds, 2);
        }
    }

    DTBox.prototype.setInputValue = function() {
        var date = new Date(this.year, this.month, this.day);
        var strings = [];
        if (this.settings.config.showDate) {
            strings.push(renderDate(date, this.settings));
        }
        if (this.settings.config.showTime) {
            var joined = new Date(date.getTime() + this.time);
            strings.push(renderTime(joined, this.settings));
        }
        this.elem.value = strings.join(' '); /* Hinh change here*/
    }

    DTBox.prototype.onDateSelected = function (e) {
        var row = e.target.parentNode;
        var date = parseInt(e.target.innerText);
        if (!(row.nextSibling && row.nextSibling.nextSibling) && date < 8) {
            this.month += 1;
        } else if (!(row.previousSibling && row.previousSibling.previousSibling) && date > 7) {
            this.month -= 1;
        }
        this.day = parseInt(e.target.innerText);
        this.value = new Date(this.year, this.month, this.day);
        this.setInputValue();
        this.setHeaderContent();
        this.setBodyContent();
    }

    /** @param {Event} e */
    DTBox.prototype.onMonthSelected = function (e) {
        var col = 0;
        var row = 2;
        var cell = e.target;
        if (cell.parentNode.nextSibling){
            row = cell.parentNode.previousSibling ? 1: 0;
        }
        if (cell.previousSibling) {
            col = 3;
            if (cell.nextSibling) {
                col = cell.previousSibling.previousSibling ? 2 : 1;
            }
        }
        this.month = 4 * row + col;
        this.bodyType = "DAYS";
        this.setHeaderContent();
        this.setupBody();
    }

    /** @param {Event} e */
    DTBox.prototype.onYearSelected = function (e) {
        this.year = parseInt(e.target.innerText);
        this.bodyType = "MONTHS";
        this.setHeaderContent();
        this.setupBody();
    }

    /** @param {Event} e */
    DTBox.prototype.onHeaderChange = function (e) {
        var cell = e.target;
        if (cell.previousSibling && cell.nextSibling) {
            var idx = BODYTYPES.indexOf(this.bodyType);
            if (idx < 0 || !BODYTYPES[idx + 1]) {
                return;
            }
            this.bodyType = BODYTYPES[idx + 1];
            this.setupBody();
        } else {
            var sign = cell.previousSibling ? 1 : -1;
            switch (this.bodyType) {
                case "DAYS":
                    this.month += sign * 1;
                    break;
                case "MONTHS":
                    this.year += sign * 1;
                    break;
                case "YEARS":
                    this.year += sign * 10;
            }
            if (this.month > 11 || this.month < 0) {
                this.year += Math.floor(this.month / 11);
                this.month = this.month > 11 ? 0 : 11;
            }
        }
        this.setHeaderContent();
        this.setBodyContent();
    }


    /**
     * @param {HTMLElement} elem
     * @returns {{left:number, top:number}}
     */
    function getOffset(elem) {
        var box = elem.getBoundingClientRect();
        var left = window.pageXOffset !== undefined ? window.pageXOffset :
            (document.documentElement || document.body.parentNode || document.body).scrollLeft;
        var top = window.pageYOffset !== undefined ? window.pageYOffset :
            (document.documentElement || document.body.parentNode || document.body).scrollTop;
        return { left: box.left + left, top: box.top + top };
    }
    function empty(e) {
        for (; e.children.length; ) e.removeChild(e.children[0]);
    }
    function tryAppendChild(newChild, refNode) {
        try {
            refNode.appendChild(newChild);
            return newChild;
        } catch (e) {
            console.trace(e);
        }
    }

    /** @class */
    function hookFuncs() {
        /** @type {Handlers} */
        this._funcs = {};
    }
    /**
     * @param {string} key
     * @param {Function} func
     */
    hookFuncs.prototype.add = function(key, func){
        if (!this._funcs[key]){
            this._funcs[key] = [];
        }
        this._funcs[key].push(func)
    }
    /**
     * @param {String} key
     * @returns {Function[]} handlers
     */
    hookFuncs.prototype.get = function(key){
        return this._funcs[key] ? this._funcs[key] : [];
    }

    /**
     * @param {Array.<string>} arr
     * @param {String} string
     * @returns {Array.<string>} sorted string
     */
    function sortByStringIndex(arr, string) {
        return arr.sort(function(a, b){
            var h = string.indexOf(a);
            var l = string.indexOf(b);
            var rank = 0;
            if (h < l) {
                rank = -1;
            } else if (l < h) {
                rank = 1;
            } else if (a.length > b.length) {
                rank = -1;
            } else if (b.length > a.length) {
                rank = 1;
            }
            return rank;
        });
    }

    /**
     * Remove keys from array that are not in format
     * @param {string[]} keys
     * @param {string} format
     * @returns {string[]} new filtered array
     */
    function filterFormatKeys(keys, format) {
        var out = [];
        var formatIdx = 0;
        for (var i = 0; i<keys.length; i++) {
            var key = keys[i];
            if (format.slice(formatIdx).indexOf(key) > -1) {
                formatIdx += key.length;
                out.push(key);
            }
        }
        return out;
    }

    /**
     * @template {StringNumObj} FormatObj
     * @param {string} value
     * @param {string} format
     * @param {FormatObj} formatObj
     * @param {function(Object.<string, hookFuncs>): null} setHooks
     * @returns {FormatObj} formatObj
     */
    function parseData(value, format, formatObj, setHooks) {
        var hooks = {
            canSkip: new hookFuncs(),
            updateValue: new hookFuncs(),
        }
        var keys = sortByStringIndex(Object.keys(formatObj), format);
        var filterdKeys = filterFormatKeys(keys, format);
        var vstart = 0; // value start
        if (setHooks) {
            setHooks(hooks);
        }

        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var fstart = format.indexOf(key);
            var _vstart = vstart; // next value start
            var val = null;
            var canSkip = false;
            var funcs = hooks.canSkip.get(key);

            vstart = vstart || fstart;

            for (var j = 0; j < funcs.length; j++) {
                if (funcs[j](formatObj)){
                    canSkip = true;
                    break;
                }
            }
            if (fstart > -1 && !canSkip) {
                var sep = null;
                var stop = vstart + key.length;
                var fnext = -1;
                var nextKeyIdx = i + 1;
                _vstart += key.length; // set next value start if current key is found

                // get next format token used to determine separator
                while (fnext == -1 && nextKeyIdx < keys.length){
                    var nextKey = keys[nextKeyIdx];
                    nextKeyIdx += 1;
                    if (filterdKeys.indexOf(nextKey) === -1) {
                        continue;
                    }
                    fnext = nextKey ? format.indexOf(nextKey) : -1; // next format start
                }
                if (fnext > -1){
                    sep = format.slice(stop, fnext);
                    if (sep) {
                        var _stop = value.slice(vstart).indexOf(sep);
                        if (_stop && _stop > -1){
                            stop = _stop + vstart;
                            _vstart = stop + sep.length;
                        }
                    }
                }
                val = parseInt(value.slice(vstart, stop));

                var funcs = hooks.updateValue.get(key);
                for (var k = 0; k < funcs.length; k++) {
                    val = funcs[k](val, formatObj, vstart, stop);
                }
            }
            formatObj[key] = { index: vstart, value: val };
            vstart = _vstart; // set next value start
        }
        return formatObj;
    }

    /**
     * @param {String} value
     * @param {DTS} settings
     * @returns {Date} date object
     */
    function parseDate(value, settings) {
        /** @type {{yyyy:number=, yy:number=, mm:number=, dd:number=}} */
        var formatObj = {yyyy:null, yy:null, mm:null, dd:null};
        var format = ((settings.dateFormat) || '').toLowerCase();
        if (!format) {
            throw new TypeError('dateFormat not found (' + settings.dateFormat + ')');
        }
        var formatObj = parseData(value, format, formatObj, function(hooks){
            hooks.canSkip.add("yy", function(data){
                return data["yyyy"].value;
            });
            hooks.updateValue.add("yy", function(val){
                return 100 * Math.floor(new Date().getFullYear() / 100) + val;
            });
        });
        var year = formatObj["yyyy"].value || formatObj["yy"].value;
        var month = formatObj["mm"].value - 1;
        var date = formatObj["dd"].value;
        var result = new Date(year, month, date);
        return result;
    }

    /**
     * @param {String} value
     * @param {DTS} settings
     * @returns {Number} time in milliseconds <= (24 * 60 * 60 * 1000) - 1
     */
    function parseTime(value, settings) {
        var format = ((settings.timeFormat) || '').toLowerCase();
        if (!format) {
            throw new TypeError('timeFormat not found (' + settings.timeFormat + ')');
        }

        /** @type {{hh:number=, mm:number=, ss:number=, a:string=}} */
        var formatObj = {hh:null, mm:null, ss:null, a:null};
        var formatObj = parseData(value, format, formatObj, function(hooks){
            hooks.updateValue.add("a", function(val, data, start, stop){
                return value.slice(start, start + 2);
            });
        });
        var hours = formatObj["hh"].value;
        var minutes = formatObj["mm"].value;
        var seconds = formatObj["ss"].value;
        var am_pm = formatObj["a"].value;
        var am_pm_lower = am_pm ? am_pm.toLowerCase() : am_pm;
        if (am_pm && ["am", "pm"].indexOf(am_pm_lower) > -1){
            if (am_pm_lower == 'am' && hours == 12){
                hours = 0;
            } else if (am_pm_lower == 'pm') {
                hours += 12;
            }
        }
        var time = hours * 60 * 60 * 1000 + minutes * 60 * 1000 + seconds * 1000;
        return time;
    }

    /**
     * @param {Date} value
     * @param {DTS} settings
     * @returns {String} date string
     */
    function renderDate(value, settings) {
        var format = settings.dateFormat.toLowerCase();
        var date = value.getDate();
        var month = value.getMonth() + 1;
        var year = value.getFullYear();
        var yearShort = year % 100;
        var formatObj = {
            dd: date < 10 ? "0" + date : date,
            mm: month < 10 ? "0" + month : month,
            yyyy: year,
            yy: yearShort < 10 ? "0" + yearShort : yearShort
        };
        var str = format.replace(settings.dateFormatRegEx, function (found) {
            return formatObj[found];
        });

        return str;
    }

    /**
     * @param {Date} value
     * @param {DTS} settings
     * @returns {String} date string
     */
    function renderTime(value, settings) {
        var Format = settings.timeFormat;
        var format = Format.toLowerCase();
        var hours = value.getHours();
        var minutes = value.getMinutes();
        var seconds = value.getSeconds();
        var am_pm = null;
        var hh_am_pm = null;
        if (format.indexOf('a') > -1) {
            am_pm = hours >= 12 ? 'pm' : 'am';
            am_pm = Format.indexOf('A') > -1 ? am_pm.toUpperCase() : am_pm;
            hh_am_pm = hours == 0 ? '12' : (hours > 12 ? hours%12 : hours);
        }
        var formatObj = {
            hh: am_pm ? hh_am_pm : (hours < 10 ? "0" + hours : hours),
            mm: minutes < 10 ? "0" + minutes : minutes,
            ss: seconds < 10 ? "0" + seconds : seconds,
            a: am_pm,
        };
        var str = format.replace(settings.timeFormatRegEx, function (found) {
            return formatObj[found];
        });
        return str;
    }

    /**
     * checks if two dates are equal
     * @param {Date} date1
     * @param {Date} date2
     * @returns {Boolean} true or false
     */
    function isEqualDate(date1, date2) {
        if (!(date1 && date2)) return false;
        return (date1.getFullYear() == date2.getFullYear() &&
                date1.getMonth() == date2.getMonth() &&
                date1.getDate() == date2.getDate());
    }

    /**
     * @param {Number} val
     * @param {Number} pad
     * @param {*} default_val
     * @returns {String} padded string
     */
    function padded(val, pad, default_val) {
        var default_val = default_val || 0;
        var valStr = '' + (parseInt(val) || default_val);
        var diff = Math.max(pad, valStr.length) - valStr.length;
        return ('' + default_val).repeat(diff) + valStr;
    }

    /**
     * @template X
     * @template Y
     * @param {X} obj
     * @param {Y} objDefaults
     * @returns {X|Y} merged object
     */
    function setDefaults(obj, objDefaults) {
        var keys = Object.keys(objDefaults);
        for (var i=0; i<keys.length; i++) {
            var key = keys[i];
            if (!Object.prototype.hasOwnProperty.call(obj, key)) {
                obj[key] = objDefaults[key];
            }
        }
        return obj;
    }


    window.dtsel = Object.create({},{
        DTS: { value: DTS },
        DTObj: { value: DTBox },
        fn: {
            value: Object.defineProperties({}, {
                empty: { value: empty },
                appendAfter: {
                    value: function (newElem, refNode) {
                        refNode.parentNode.insertBefore(newElem, refNode.nextSibling);
                    },
                },
                getOffset: { value: getOffset },
                parseDate: { value: parseDate },
                renderDate: { value: renderDate },
                parseTime: {value: parseTime},
                renderTime: {value: renderTime},
                setDefaults: {value: setDefaults},
            }),
        },
    });
})();

var etsCf = {
    isAppInit: false,
    baseUrl: '',
    submitLink: '',
    recaptchaItems: {},
    initApp: function () {
        if (this.isAppInit) {
            return false;
        }
        if (typeof ETS_CF_BASE_URL !== 'undefined') {
            etsCf.baseUrl = ETS_CF_BASE_URL;
        }
        etsCf.submitLink = etsCf.baseUrl + '/contact-form/submit-form';
        if (typeof ETS_CF_INIT === 'undefined' || !ETS_CF_INIT || typeof ETS_CF_DATA === 'undefined' || !ETS_CF_DATA) {
            return false;
        }
        this.isAppInit = true;
        if (ETS_CF_DATA.length) {
            for (var c = 0; c < ETS_CF_DATA.length; c++) {

                if (ETS_CF_DATA[c].form_content.type_form == 'floating') {
                    etsCf.createForm(ETS_CF_DATA[c]);
                } else if (etsCf.isPageHasShortcode(ETS_CF_DATA[c].shortcode)) {
                    etsCf.createForm(ETS_CF_DATA[c]);
                }
            }
        }

        /*Init datetime*/
        if (document.querySelectorAll('.ets_cf_input_datetime').length) {
            var instance = new dtsel.DTS('.ets_cf_input_datetime', {
                direction: 'TOP',
                dateFormat: "dd/mm/yyyy",
                showTime: true,
                timeFormat: "HH:MM:SS"
            });
        }
        if (document.querySelectorAll('.ets_cf_input_date').length) {
            var instance = new dtsel.DTS('.ets_cf_input_date', {
                direction: 'TOP',
                dateFormat: "dd/mm/yyyy",
                showTime: false
            });
        }

        etsCf.setReCaptcha();
        etsCf.initNumberRange();
        etsCf.initEvents();

    },
    isPageHasShortcode: function (shortcode) {
        var pageContent = document.body.innerText;
        var codePatt = new RegExp('\\{ets_cf_' + shortcode + '\\}');
        return codePatt.test(pageContent);
    },
    createForm: function (formData) {
        var form = '';
        if (formData.form_content.type_form == 'popup') {
            form = etsCf.createPopupForm(formData);
        } else if (formData.form_content.type_form == 'floating') {
            form = etsCf.createPopupForm(formData, true);
        } else {
            form = etsCf.renderHtmlFrom(formData);
        }
        var appendToBody = false;
        if (formData.form_content.type_form == 'floating') {
            appendToBody = true;
        }
        this.addForm(form, formData.shortcode, appendToBody);
    },
    renderHtmlFrom: function (formData) {
        var formDesc = '';
        if (formData.form_content.info.description) {
            formDesc = `<div class="ets_cf_desc"><p>${formData.form_content.info.description}</p></div>`
        }
        var idForm = `etsCfBox${etsCf.makeRandom(10)}`;
        var html = `<div class="ets_cf_box" id="${idForm}">
            <div class="ets_cf_wrapper">
                <div class="ets_cf_header">
                    <h3 class="ets_cf_title ${formData.form_content.info.alignment_title ? 'ets_cf_align_' + formData.form_content.info.alignment_title : ''} ${formData.form_content.info.bold_title ? 'ets_cf_bold' : ''} ${formData.form_content.info.uppercase_title ? 'ets_cf_uppercase' : ''} ${!formData.form_content.info.display_title_on_store ? 'ets_cf_hidden' : ''}">${formData.title}</h3>
                    <div class="${formData.form_content.info.alignment_description ? 'ets_cf_align_' + formData.form_content.info.alignment_description : ''} ${!formData.form_content.info.display_description_on_store ? 'ets_cf_hidden' : ''}">${formDesc}</div>
                </div>
                <div class="ets_cf_body">
                    <form class="ets_cf_form_data_contact" autocomplete="off" action="${this.submitLink}" method="post" enctype="multipart/form-data">
                        ${etsCf.createFormData(formData)}
                        <input type="hidden" name="shortcode" value="${formData.shortcode}" />
                        <input type="hidden" name="form_id" value="${formData.id}" />
                        <input type="hidden" name="shop_domain" value="${ETS_CF_SHOP_DOMAIN}" />
                    </form>
                </div>
            </div>
        </div>`;
        if (formData.form_content.decoration && formData.form_content.decoration.length) {
            var styleForm = formData.form_content.decoration[0];
            html += `<style type="text/css">
                #${idForm}{
                    ${styleForm.form_background_color ? `background-color: ${styleForm.form_background_color};` : ''};
                    ${styleForm.form_width ? 'width:' + styleForm.form_width + 'px;' : ''}
                    ${styleForm.form_padding ? 'padding:' + styleForm.form_padding + 'px;' : ''}
                    ${styleForm.enable_background_image ? 'background-image:url(\'' + styleForm.form_decoration_image + '\');' : ''}}

                ${styleForm.title_color ? `#${idForm} .ets_cf_title{color: ${styleForm.title_color};}` : ''}
                ${styleForm.form_description_color ? `#${idForm} .ets_cf_desc, #${idForm} .ets_cf_desc p{color: ${styleForm.form_description_color};}` : ''}
                ${styleForm.label_color ? `#${idForm} .ets_cf_form_label{color: ${styleForm.label_color};}` : ''}
                ${styleForm.hover_color ? ` #${idForm} .ets_cf_btn:hover, #${idForm} .ets_cf_btn:focus{background-color: ${styleForm.hover_color};}` : ''}

               ${styleForm.other_color_1 ? `#${idForm} .ets_cf_form_control, .ets_cf_radio_item input:checked+.ets_cf_radio_check, .ets_cf_radio_item input +.ets_cf_radio_check,.ets_cf_checkbox_item .ets_cf_checkbox_check, .ets_cf_radio_item .ets_cf_radio_check{border-color: ${styleForm.other_color_1};}#${idForm} .ets_cf_checkbox_item input:checked + .ets_cf_checkbox_check, .ets_cf_checkbox_item input:checked+.ets_cf_checkbox_check,#${idForm} .ets_cf_radio_item input:checked + .ets_cf_radio_check:after{background-color: ${styleForm.other_color_1};}` : ''}
               ${styleForm.other_color_1 ? `#${idForm} .ets_cf_toggle_view_password svg{color: ${styleForm.other_color_1};fill: ${styleForm.other_color_1};}` : ''}
                ${styleForm.other_color_2 ? `#${idForm} .ets_cf_form_control,#${idForm} .ets_cf_cutom_select i.ets_icon_arrow:before{color: ${styleForm.other_color_2};}` : ''}
                ${styleForm.other_color_2 ? `#${idForm} .ets_cf_cutom_select i.ets_icon_arrow:before{border-color: ${styleForm.other_color_2};}` : ''}
               ${styleForm.other_color_2 ? `#${idForm} .ets_cf_field_desc, #${idForm} .ets_cf_file_type_txt, #${idForm} span.ets_cf_file_size_txt{color: ${styleForm.other_color_2}; opacity: 0.85;}` : ''}

                ${styleForm.btn_text_color ? `#${idForm} .ets_cf_btn_submit, #${idForm} .ets_cf_btn_submit_step{color: ${styleForm.btn_text_color};}#${idForm} .ets_cf_btn_submit .ets_cf_icon svg, #${idForm} .ets_cf_btn_submit_step .ets_cf_icon svg{color: ${styleForm.btn_text_color};fill: ${styleForm.btn_text_color};}` : ''}
                ${styleForm.btn_background_color ? `#${idForm} .ets_cf_btn_submit, #${idForm} .ets_cf_btn_submit_step{background-color: ${styleForm.btn_background_color};border-color: ${styleForm.btn_background_color};}` : ''}
                ${styleForm.btn_text_hover_color ? `#${idForm} .ets_cf_btn_submit:hover,#${idForm} .ets_cf_btn_submit:focus, #${idForm} .ets_cf_btn_submit_step:hover,#${idForm} .ets_cf_btn_submit_step:focus{color: ${styleForm.btn_text_hover_color};}#${idForm} .ets_cf_btn_submit:hover .ets_cf_icon svg,#${idForm} .ets_cf_btn_submit:focus .ets_cf_icon svg, #${idForm} .ets_cf_btn_submit_step:hover .ets_cf_icon svg,#${idForm} .ets_cf_btn_submit_step:focus .ets_cf_icon svg{color: ${styleForm.btn_text_hover_color};fill: ${styleForm.btn_text_hover_color};}` : ''}
                ${styleForm.btn_background_hover_color ? `#${idForm} .ets_cf_btn_submit:hover,#${idForm} .ets_cf_btn_submit:focus, #${idForm} .ets_cf_btn_submit_step:hover,#${idForm} .ets_cf_btn_submit_step:focus{background-color: ${styleForm.btn_background_hover_color};border-color: ${styleForm.btn_background_hover_color};}` : ''}

                ${styleForm.btn_text_next_color ? `#${idForm} .ets_cf_btn_next_step{color: ${styleForm.btn_text_next_color};}#${idForm} .ets_cf_btn_next_step .ets_cf_icon svg{color: ${styleForm.btn_text_next_color};fill: ${styleForm.btn_text_next_color};}` : ''}
                ${styleForm.btn_background_next_color ? `#${idForm} .ets_cf_btn_next_step{background-color: ${styleForm.btn_background_next_color}; border-color: ${styleForm.btn_background_next_color};}` : ''}
                ${styleForm.btn_text_hover_next_color ? `#${idForm} .ets_cf_btn_next_step:hover,#${idForm} .ets_cf_btn_next_step:focus{color: ${styleForm.btn_text_hover_next_color};}#${idForm} .ets_cf_btn_next_step:hover .ets_cf_icon svg,#${idForm} .ets_cf_btn_next_step:focus .ets_cf_icon svg{color: ${styleForm.btn_text_hover_next_color};fill: ${styleForm.btn_text_hover_next_color};}` : ''}
                ${styleForm.btn_background_hover_next_color ? `#${idForm} .ets_cf_btn_next_step:hover,#${idForm} .ets_cf_btn_next_step:focus{background-color: ${styleForm.btn_background_hover_next_color};border-color: ${styleForm.btn_background_hover_next_color};}` : ''}

                ${styleForm.btn_text_previous_color ? `#${idForm} .ets_cf_btn_back_step{color: ${styleForm.btn_text_previous_color};}#${idForm} .ets_cf_btn_back_step .ets_cf_icon svg{color: ${styleForm.btn_text_previous_color};fill: ${styleForm.btn_text_previous_color};}` : ''}
                ${styleForm.btn_background_previous_color ? `#${idForm} .ets_cf_btn_back_step{background-color: ${styleForm.btn_background_previous_color};border-color: ${styleForm.btn_background_previous_color};}` : ''}
                ${styleForm.btn_text_hover_previous_color ? `#${idForm} .ets_cf_btn_back_step:hover,#${idForm} .ets_cf_btn_back_step:focus{color: ${styleForm.btn_text_hover_previous_color};}#${idForm} .ets_cf_btn_back_step:hover .ets_cf_icon svg,#${idForm} .ets_cf_btn_back_step:focus .ets_cf_icon svg{color: ${styleForm.btn_text_hover_previous_color};fill: ${styleForm.btn_text_hover_previous_color};}` : ''}
                ${styleForm.btn_background_hover_previous_color ? `#${idForm} .ets_cf_btn_back_step:hover,#${idForm} .ets_cf_btn_back_step:focus{background-color: ${styleForm.btn_background_hover_previous_color};border-color: ${styleForm.btn_background_hover_previous_color};}` : ''}

                ${styleForm.inactive_step ? `#${idForm} .ets_cf_step_item .ets_cf_step_number, #${idForm} .step-line:before{background-color: ${styleForm.inactive_step};}` : ''}
                ${styleForm.completed_step ? `#${idForm} .ets_cf_step_item.ets_cf_step_completed .ets_cf_step_number, #${idForm} .ets_cf_step_completed .step-line:before{background-color: ${styleForm.completed_step};}` : ''}
                ${styleForm.activating_step ? `#${idForm} .ets_cf_step_item.ets_cf_step_active .ets_cf_step_number, #${idForm} .ets_cf_step_active .step-line:before{background-color: ${styleForm.activating_step};}` : ''}
                ${styleForm.label_step_color ? `#${idForm}  .ets_cf_step_title {color: ${styleForm.label_step_color};}` : ''}
                ${styleForm.description_step_color ? `#${idForm} .ets_cf_step_desc {color: ${styleForm.description_step_color};}` : ''}
                ${styleForm.round_corner_input_field ? `#${idForm} .ets_cf_form_control{border-radius: ${styleForm.radius_pixel}px;}` : ''}
            </style>`;
        }
        return html;
    },
    createFormData: function (formData) {
        var formContent = '';
        var forms = formData.form_content.form;
        if (formData.form_content.type_form !== 'multiple') {
            for (var i = 0; i < forms.length; i++) {
                formContent += `<div class="ets_cf_row ets_cf_row_${i}" data-row="${i}">${etsCf.createCol(forms[i], formData)}</div>`;
            }
            var styleForm = null;
            if (formData.form_content.decoration && formData.form_content.decoration.length) {
                styleForm = formData.form_content.decoration[0];
            }
            var btnSubmitContent = '';
            if (formData.form_content.btn_submit.btn_type != 'label') {
                if (formData.form_content.btn_submit.btn_custom_icon) {
                    btnSubmitContent += `<i class="ets_cf_icon_img"><img src="${formData.form_content.btn_submit.btn_custom_icon}" alt="" /> </i>`;
                } else {
                    btnSubmitContent += `<i class="ets_cf_icon">${formData.form_content.btn_submit.btn_icon}</i>`;
                }
            }
            if (formData.form_content.btn_submit.btn_type != 'icon') {
                btnSubmitContent += ` ${formData.form_content.btn_submit.btn_label}`;
            }
            formContent += `<div class="ets_cf_content_footer ets_cf_submit_${styleForm ? styleForm.btn_submit_position : ''}">
                            <button type="submit" class="ets_cf_btn ets_cf_btn_submit ets_cf_btn_${formData.form_content.btn_submit.btn_type}">${btnSubmitContent}</button>
                        </div>`;
        } else if (formData.form_content.type_form == 'multiple') {
            formContent += etsCf.createStepForm(formData.form_content.step_multiple_form, formData.form_content.form, formData);
        }

        return formContent;
    },
    createPopupForm: function (formData, isFloating) {
        isFloating = isFloating || false;
        var btnConfig = formData.form_content.buttonDecoration;
        var btnId = `etsCfBtnPopup${this.makeRandom(10)}`;
        var btnPosition = '';
        var verticalAttr = 'margin-right';
        if (isFloating) {
            btnPosition = 'ets_cf_btn_pos_' + btnConfig.btn_position;
            if (btnPosition == 'bottom_left' || btnPosition == 'top_left' || btnPosition == 'middle_left') {
                verticalAttr = 'margin-left';
            }
        }
        var btnStyle = `<style type="text/css">
                  ${btnConfig.btn_background ? `#${btnId}{background-color: ${btnConfig.btn_background};}` : ''}
                  ${btnConfig.btn_text_color ? `#${btnId}{color: ${btnConfig.btn_text_color};fill: ${btnConfig.btn_text_color};}#${btnId} .ets_cf_icon svg{color: ${btnConfig.btn_text_color};fill: ${btnConfig.btn_text_color};}` : ''}
                  ${btnConfig.btn_border ? `#${btnId}{border-color: ${btnConfig.btn_border};}` : ''}
                  #${btnId}{border-radius: ${btnConfig.btn_round_button ? btnConfig.btn_round_button : '0'}px;}

                  ${btnConfig.btn_background_hover ? `#${btnId}:hover,#${btnId}:focus{background-color: ${btnConfig.btn_background_hover};}` : ''}
                  ${btnConfig.btn_border_hover ? `#${btnId}:hover,#${btnId}:focus{border-color: ${btnConfig.btn_border_hover};}` : ''}
                  ${btnConfig.btn_text_color_hover ? `#${btnId}:hover,#${btnId}:focus{color: ${btnConfig.btn_text_color_hover};fill: ${btnConfig.btn_text_color_hover};}#${btnId}:hover .ets_cf_icon svg,#${btnId}:focus .ets_cf_icon svg{color: ${btnConfig.btn_text_color_hover};fill: ${btnConfig.btn_text_color_hover};}` : ''}
                  ${btnConfig.btn_position_up != '' ? `#${btnId}{margin-bottom: ${btnConfig.btn_position_up}px;}` : ''}
                  ${btnConfig.btn_position_left != '' ? `#${btnId}{${verticalAttr}: ${btnConfig.btn_position_left}px;}` : ''}
            </style>`;
        var html = `${btnStyle}<div class="ets_cf_section form_${btnPosition} ${isFloating ? 'ets_cf_floating_open_form' : 'ets_cf_popup_open_form'}">
                <button type="button" class="ets_cf_btn ${isFloating ? 'ets_cf_btn_floating_open_form' : 'ets_cf_btn_popup_open_form'} js-ets_cf_btn_popup_open_form ${btnPosition} ${isFloating && btnConfig.btn_circle_icon ? 'ets_cf_circle_icon' : ''}"
                    id="${btnId}">${isFloating && btnConfig.btn_type != 'label' && btnConfig.btn_icon && !btnConfig.btn_custom_icon ? `<i class="ets_cf_icon">${btnConfig.btn_icon}</i>` : ''}${isFloating && btnConfig.btn_type != 'label' && btnConfig.btn_custom_icon ? `<i class="ets_cf_icon_img"><img src="${btnConfig.btn_custom_icon}" alt="" class="ets_cf_img_icon" /> </i>` : ''}${(isFloating && btnConfig.btn_type != 'icon') || !isFloating ? btnConfig.btn_label : ''}</button>
                <div class="ets_cf_popup">
                    <div class="ets_cf_popup_table">
                        <div class="ets_cf_popup_table-cell">
                            <div class="ets_cf_popup_content">
                                <button class="ets_cf_btn_close_popup js-ets_cf_btn_close_popup"><i class="ets_cf_icon">${this.icons.close}</i></button>
                                ${this.renderHtmlFrom(formData)}
                            </div>
                        </div>
                    </div>
                </div>
        </div>`;
        return html;
    },
    createStepForm: function (steps, forms, formData) {
        var styleForm = null;
        if (formData.form_content.decoration && formData.form_content.decoration.length) {
            styleForm = formData.form_content.decoration[0];
        }
        var html = `<div class="ets_cf_form_step_box">`;
        html += `<div class="ets_cf_form_step_header ${styleForm.step_type !== 'all' ? 'ets_cf_hidden' : ''}">`;
        for (var i = 0; i < steps.length; i++) {
            html += `<div class="step-ets-step ets_cf_step_item ${i == 0 ? 'ets_cf_step_active' : ''}" data-step-index="${i}">
                                    <span class="step-line"></span>
                                    <div class="ets_cf_step_number js-ets_cf_step_number">${i + 1}</div>
                                    <div class="ets_cf_step_title step-ets-label-title">${steps[i].step_label_title ? steps[i].step_label_title : ''}</div>
                                    <div class="ets_cf_step_desc step-ets-description">${steps[i].step_description ? steps[i].step_description : ''}</div>
                            </div>`;
        }
        html += `</div>`;
        html += `<div class="ets_cf_form_step_body">`;

        for (var s = 0; s < forms.length; s++) {
            var btnBackContent = '';
            if (formData.form_content.btn_previous.btn_type != 'label') {
                if (formData.form_content.btn_previous.btn_custom_icon) {
                    btnBackContent += `<i class="ets_cf_icon_img"><img src="${formData.form_content.btn_previous.btn_custom_icon}" alt="" /> </i>`;
                } else {
                    btnBackContent += `<i class="ets_cf_icon">${formData.form_content.btn_previous.btn_icon}</i>`;
                }
            }
            if (formData.form_content.btn_previous.btn_type != 'icon') {
                btnBackContent += ` ${formData.form_content.btn_previous.btn_label}`;
            }
            var btnNextContent = '';
            if (formData.form_content.btn_next.btn_type != 'label') {
                if (formData.form_content.btn_next.btn_custom_icon) {
                    btnNextContent += `<i class="ets_cf_icon_img"><img src="${formData.form_content.btn_next.btn_custom_icon}" alt="" /> </i>`;
                } else {
                    btnNextContent += `<i class="ets_cf_icon">${formData.form_content.btn_next.btn_icon}</i>`;
                }
            }
            if (formData.form_content.btn_next.btn_type != 'icon') {
                btnNextContent += ` ${formData.form_content.btn_next.btn_label}`;
            }

            var btnSubmitContent = '';
            if (formData.form_content.btn_submit.btn_type != 'label') {
                if (formData.form_content.btn_submit.btn_custom_icon) {
                    btnSubmitContent += `<i class="ets_cf_icon_img"><img src="${formData.form_content.btn_submit.btn_custom_icon}" alt="" /> </i>`;
                } else {
                    btnSubmitContent += `<i class="ets_cf_icon">${formData.form_content.btn_submit.btn_icon}</i>`;
                }
            }
            if (formData.form_content.btn_submit.btn_type != 'icon') {
                btnSubmitContent += ` ${formData.form_content.btn_submit.btn_label}`;
            }
            var formHeaderSingle = '';
            if (styleForm.step_type != 'all') {
                formHeaderSingle = `<div class="ets_cf_header_single">
                                <div class="ets_cf_step_title step-ets-label-title">${steps[s].step_label_title ? steps[s].step_label_title : ''}</div>
                                 <div class="ets_cf_step_desc step-ets-description">${steps[s].step_description ? steps[s].step_description : ''}</div>
                            </div>`;
            }
            html += `<div class="ets_cf_step_form_item ets_cf_step_form_item_${s} ${s == 0 ? 'ets_cf_step_active' : ''}" data-step-index="${s}">
                                ${formHeaderSingle}
                                <div class="ets_cf_step_content">
                                      `;
            for (var i = 0; i < forms[s].length; i++) {
                html += `<div class="ets_cf_row ets_cf_row_${i}" data-row="${i}">${etsCf.createCol(forms[s][i], formData)}</div>`;
            }
            html += `
                                </div>
                                <div class="ets_cf_step_footer ets_cf_submit_${styleForm ? styleForm.btn_submit_position : ''}">
                                    ${s > 0 ? `<button type="button" class="ets_cf_btn ets_cf_btn_back_step js-ets_cf_btn_back_step">${btnBackContent}</button>` : ''}
                                    ${s < (forms.length - 1) ? `<button type="button" class="ets_cf_btn ets_cf_btn_next_step js-ets_cf_btn_next_step">${btnNextContent}</button>` : ''}
                                    ${s == (forms.length - 1) ? `<button type="submit" class="ets_cf_btn ets_cf_btn_submit_step js-ets_cf_btn_submit_step ets_cf_btn_${formData.form_content.btn_submit.btn_type}" >${btnSubmitContent}</button>` : ''}
                                </div>
                        </div>`;
        }
        html += ` </div>
                </div>`;

        return html;
    },
    createCol: function (cols, formData) {
        if (!cols || !cols.length) return '';
        var colData = '';
        for (var i = 0; i < cols.length; i++) {
            colData += `<div class="ets_cf_col_item ets_cf_col_${cols[i].width}">${etsCf.createInputField(cols[i].fields, formData)}</div>`;
        }
        return colData;
    },
    createInputField: function (fields, formData) {
        if (!fields || !fields.length) return '';
        var fieldData = '';
        for (var i = 0; i < fields.length; i++) {
            fieldData += etsCf.createFieldItem(fields[i], formData);
        }
        return fieldData;
    },
    createFieldItem: function (field, formData) {
        var input = '';
        if (field.key == 'reCaptcha') {
            if (ETS_CF_CONFIG.recaptcha.type == 'v2') {
                return `<div class="ets_cf_form_group" id="ets_cf_ipg_${etsCf.makeRandom(10)}">
                            ${field.options.label ? `<label class="ets_cf_form_label required" data-key=${field.key}>${field.options.label}</label>` : ''}

                            <div id="etsCfRecaptchav2${etsCf.makeRandom(5)}" data-theme="${field.options.theme}"
                                data-size="${field.options.size}" class="ets_cf_recaptcha ets_cf_recaptcha_v2"></div>
                            <input type="hidden" class="ets_cf_reacptcha_response" name="recaptcha_${etsCf.makeRandom(5)}" />
                            <div class="ets_cf_item_error"></div>
                        </div>`;
            } else if (ETS_CF_CONFIG.recaptcha.type == 'v3') {
                return `<input type="hidden" class="ets_cf_recaptcha_v3" id="etsCfRecaptchaV3${etsCf.makeRandom(5)}" value="">`;
            }
        }
        switch (field.key) {
            case 'text':
                input = `<input type="text" data-required="${field.options.required}" data-validate="isString" autocomplete="off" class="ets_cf_form_control" name="${field.options.name}"
                            value="${field.options.default_value ? field.options.default_value : ''}"
                            data-default="${field.options.default_value ? field.options.default_value : ''}"
                            placeholder="${field.options.placeholder ? field.options.placeholder : ''}"/>`;
                break;
            case 'url':
                var currentUrl = window.location.href;

                input = `<input type="text" data-required="${field.options.required}" data-valiadte="isUrl" autocomplete="off"
                    class="ets_cf_form_control" ${field.options.read_only ? 'readonly' : ''} name="${field.options.name}"
                    value="${field.options.use_current_page_url_as_default ? currentUrl : (field.options.default_value ? field.options.default_value : '')}"
                    data-default="${field.options.use_current_page_url_as_default ? currentUrl : (field.options.default_value ? field.options.default_value : '')}"
                    placeholder="${field.options.placeholder ? field.options.placeholder : ''}" />`;
                break;
            case 'email':
                input = `<input type="${field.key}" data-required="${field.options.required}" autocomplete="off"  class="ets_cf_form_control" data-validate="isEmail" name="${field.options.name}"
                            value="${field.options.default_value ? field.options.default_value : ''}"
                            data-default="${field.options.default_value ? field.options.default_value : ''}"
                             placeholder="${field.options.placeholder ? field.options.placeholder : ''}"
                             max-char="${field.options.max_character ? field.options.max_character : ''}"/>`;
                break;
            case 'textarea':
                var t_rows = 3;
                if (field.options.rows) {
                    t_rows = field.options.rows;
                }
                input = `<textarea name="${field.options.name}" id="textarea${etsCf.makeRandom(10)}" data-required="${field.options.required}" data-validate="isString" class="ets_cf_form_control"
                             rows="${t_rows}"
                             placeholder="${field.options.placeholder ? field.options.placeholder : ''}"
                             data-default="${field.options.default_value ? field.options.default_value : ''}"
                             data-limit-char="${field.options.max_character ? field.options.max_character : ''}">${field.options.default_value ? field.options.default_value : ''}</textarea>`;
                break;
            case 'phone':
                input = `<input type="tel" class="ets_cf_form_control" autocomplete="off"  data-required="${field.options.required}" data-validate="isPhoneNumber" name="${field.options.name}"
                            value="${field.options.default_value ? field.options.default_value : ''}"
                            data-default="${field.options.default_value ? field.options.default_value : ''}"
                             placeholder="${field.options.placeholder ? field.options.placeholder : ''}"
                             max-char="${field.options.max_character ? field.options.max_character : ''}"/>`;
                break;
            case 'password':
                input = `<div class="ets_cf_input_group_password">
                                <input type="password" class="ets_cf_form_control" data-required="${field.options.required}" data-validate="isPassword" name="${field.options.name}"
                             max-char="${field.options.max_character ? field.options.max_character : ''}"/>
                             <span class="ets_cf_toggle_view_password js-ets_cf_toggle_view_password js-ets_cf_show_password ets_cf_active"><i class="ets_cf_icon">${etsCf.icons.eye}</i></span>
                             <span class="ets_cf_toggle_view_password js-ets_cf_toggle_view_password js-ets_cf_hide_password"><i class="ets_cf_icon">${etsCf.icons.eye_slash}</i></span>
                        </div>`;
                break;
            case 'number':
                if (field.options.field_type == 'slider') {

                    input = `<div class="ets_cf_range_wrap">
                                <div class="ets_cf_range_value"></div>
                                <input class="ets_cf_input_range" type="range" autocomplete="off"
                                data-required="${field.options.required}" data-validate="isNumber" name="${field.options.name}"
                                min="${(typeof field.options.min == 'number' || typeof field.options.min == 'string') && field.options.min != "" ? field.options.min : '0'}"
                                 max="${(typeof field.options.max == 'number' || typeof field.options.max == 'string') && field.options.max != "" ? field.options.max : '100'}"
                                 value="${field.options.default_value ? field.options.default_value : '0'}"
                                 data-default="${field.options.default_value ? field.options.default_value : '0'}"
                                 step="${field.options.step ? field.options.step : 1}"
                                 max-char="${field.options.max_character ? field.options.max_character : ''}" />
                                <span class="ets_cf_rang_min">${field.options.min !== null ? field.options.min : ''}</span>
                                <span class="ets_cf_rang_max">${field.options.max !== null ? field.options.max : ''}</span>
                            </div>`;
                } else {
                    input = `<input type="number" class="ets_cf_form_control" autocomplete="off"  data-required="${field.options.required}" data-validate="isNumber" name="${field.options.name}"
                                value="${field.options.default_value ? field.options.default_value : ''}"
                                data-default="${field.options.default_value ? field.options.default_value : ''}"
                                placeholder="${field.options.placeholder ? field.options.default_value : ''}"
                                min="${(typeof field.options.min == 'number' || typeof field.options.min == 'string') && field.options.min != "" ? field.options.min : '0'}"
                                 max="${(typeof field.options.max == 'number' || typeof field.options.max == 'string') && field.options.max != "" ? field.options.max : '100'}"
                             step="${field.options.step ? field.options.step : 1}"
                             max-char="${field.options.max_character ? field.options.max_character : ''}"/>`;
                }
                break;
            case 'date':
                var dtClass = 'ets_cf_input_date';
                var dtValidate = 'isDate';
                if (field.options.allow_customer_select_time) {
                    dtClass = 'ets_cf_input_datetime';
                    dtValidate = 'isDatetime';
                }
                input = `<div class="input_group"><input type="text" autocomplete="off"  data-required="${field.options.required}" data-validate="${dtValidate}" class="ets_cf_form_control ${dtClass}" name="${field.options.name}"
                            value="${field.options.default_value ? field.options.default_value : ''}"
                            data-default="${field.options.default_value ? field.options.default_value : ''}"
                             placeholder="${field.options.placeholder ? field.options.placeholder : ''}"
                             ${field.options.min !== null ? `min="${field.options.min}"` : ''}
                             ${field.options.max !== null ? `max="${field.options.max}"` : ''}
                             step="${field.options.step ? field.options.step : 1}"
                             max-char="${field.options.max_character ? field.options.max_character : ''}"/>
                             <span class="suffix">
                                <i class="ets_cf_icon">
                                    <svg width="14" height="14" viewBox="0 0 1792 1792" xmlns="http://www.w3.org/2000/svg"><path d="M192 1664h288v-288h-288v288zm352 0h320v-288h-320v288zm-352-352h288v-320h-288v320zm352 0h320v-320h-320v320zm-352-384h288v-288h-288v288zm736 736h320v-288h-320v288zm-384-736h320v-288h-320v288zm768 736h288v-288h-288v288zm-384-352h320v-320h-320v320zm-352-864v-288q0-13-9.5-22.5t-22.5-9.5h-64q-13 0-22.5 9.5t-9.5 22.5v288q0 13 9.5 22.5t22.5 9.5h64q13 0 22.5-9.5t9.5-22.5zm736 864h288v-320h-288v320zm-384-384h320v-288h-320v288zm384 0h288v-288h-288v288zm32-480v-288q0-13-9.5-22.5t-22.5-9.5h-64q-13 0-22.5 9.5t-9.5 22.5v288q0 13 9.5 22.5t22.5 9.5h64q13 0 22.5-9.5t9.5-22.5zm384-64v1280q0 52-38 90t-90 38h-1408q-52 0-90-38t-38-90v-1280q0-52 38-90t90-38h128v-96q0-66 47-113t113-47h64q66 0 113 47t47 113v96h384v-96q0-66 47-113t113-47h64q66 0 113 47t47 113v96h128q52 0 90 38t38 90z"/></svg>
                                </i>
                             </span>
                             </div>`;
                break;
            case 'file':
                input = `<input type="file" class="ets_cf_form_control" data-required="${field.options.required}" data-validate="isFile"name="${field.options.name}"
                              max-size="${field.options.file_size}" file-types="${field.options.acceptable_file ? field.options.acceptable_file.join(',') : ''}"
                             max-char="${field.options.max_character ? field.options.max_character : ''}"/>
                            <div class="ets_cf_file_desc">
                                 Max file size: 10Mb. Accepted formats: .pdf, .jpg, .png, .gif, .doc, .docx, .csv, .xls, .xlsx, .txt, .zip, .rar
                            </div>`;
                break;
            case 'dropdown':
                var sOptions = '';
                var valDefault = [];

                if (field.options.options) {

                    for (var i = 0; i < field.options.options.length; i++) {
                        if (field.options.options[i].disabled) {
                            continue;
                        }
                        if (field.options.options[i].default) {
                            valDefault.push(field.options.options[i].value);
                        }
                        sOptions += `<option value="${typeof field.options.options[i].static !== 'undefined' && field.options.options[i].static ? '' : field.options.options[i].value}" ${field.options.options[i].default ? ' selected="selected"' : ''}>${field.options.options[i].label}</option>`;
                    }
                }
                input = `<div class="ets_cf_cutom_select"> ${field.options.multiline ? '' : '<i class="ets_icon_arrow"></i>'} <select class="ets_cf_form_control"
                            data-required="${field.options.required}" data-valiadte="isString"
                            data-default="${valDefault.join('|')}"
                            name="${field.options.name}${field.options.multiline ? '[]' : ''}" ${field.options.multiline ? 'multiple' : ''}>
                    ${sOptions}
                </select></div>`;
                break;
            case 'checkbox':
                var cOptions = '';
                if (field.options.options) {
                    for (var i = 0; i < field.options.options.length; i++) {
                        var opt = field.options.options[i];
                        var labelOpt = `<span class="ets_cf_checkbox_title">${opt.label}</span>`;
                        cOptions += `<div class="ets_cf_checkbox_item ${field.options.in_line ? 'ets_cf_checkbox_inline' : 'ets_cf_checkbox_block'}">
                                        <label>
                                            ${field.options.label_first ? labelOpt : ''}
                                             <input type="checkbox" name="${field.options.name}[]"
                                                data-required="${field.options.required}" data-default="${opt.default ? opt.default : ''}"
                                                value="${opt.value}" ${opt.default ? ' checked="checked"' : ''}/>
                                                <span class="ets_cf_checkbox_check"></span>
                                             ${!field.options.label_first ? labelOpt : ''}
                                        </label>
                                    </div>`;
                    }
                }
                input = `<div class="ets_cf_checkbox_group">${cOptions}</div>`;
                break;
            case 'radio':
                var rOptions = '';
                if (field.options.options) {
                    for (var i = 0; i < field.options.options.length; i++) {
                        var opt = field.options.options[i];
                        var labelOpt = `<span class="ets_cf_radio_title">${opt.label}</span>`;
                        rOptions += `<div class="ets_cf_radio_item  ${field.options.in_line ? 'ets_cf_radio_inline' : 'ets_cf_radio_block'}">
                                        <label>
                                            ${field.options.label_first ? labelOpt : ''}
                                             <input type="radio" name="${field.options.name}"
                                                data-required="${field.options.required}" data-default="${opt.default ? opt.default : ''}"
                                                data-required="${field.options.required}" value="${opt.value}" ${opt.default ? ' checked="checked"' : ''}/>
                                                <span class="ets_cf_radio_check"></span>
                                             ${!field.options.label_first ? labelOpt : ''}
                                        </label>
                                    </div>`;
                    }
                }
                input = `<div class="ets_cf_radio_group">${rOptions}</div>`;
                break;
            case 'html':
                input = `<div class="ets_cf_html">${field.options.html ? field.options.html : ''}</div>`;
                break;
            case 'quiz':
                input = `<div class="ets_cf_quiz ets_cf_checkbox_item ets_cf_checkbox_block">
                          <label class="ets_cf_quiz_question">${field.options.question}</label>
                          <span class="ets_cf_checkbox_check"></span>
                          <input class="ets_cf_quiz_answer ets_cf_form_control" data-required="${field.options.required}" data-answer="${field.options.answer}"
                            name="${field.options.name}" type="text" placeholder="${field.options.placeholder ? field.options.placeholder : ''}" value="" />
                    </div>`;
                break;
            case 'acceptance':
                input = `<div class="ets_cf_acpt ets_cf_checkbox_item ets_cf_checkbox_block">
                          <label class="ets_cf_quiz_question">
                               <input type="checkbox" data-required="true" data-acceptance="true" name="${field.options.name}" value="1" ${field.options.default ? ' checked="checked"' : ''} />
                               <span class="ets_cf_checkbox_check"></span>
                               <span class="ets_cf_acpt_title">${field.options.condition}</span>
                          </label>
                    </div>`;
                break;
        }

        var inputHtml = `<div class="ets_cf_form_group" id="ets_cf_ipg_${etsCf.makeRandom(10)}">
                <label class="ets_cf_form_label ${field.options.required ? 'required' : ''}" data-key=${field.key}>${field.options.label}</label>
                ${input}
                <div class="ets_cf_field_desc">${field.options.description ? field.options.description : ''}</div>
                <div class="ets_cf_item_error"></div>
            </div>`;

        return inputHtml;
    },
    addForm: function (htmlForm, shortCode, appendToBody) {
        appendToBody = appendToBody || false;
        if (appendToBody) {
            document.body.innerHTML = document.body.innerHTML + htmlForm;
        } else {
            document.body.innerHTML = document.body.innerHTML.replace(new RegExp('\\{ets_cf_' + shortCode + '\\}', 'g'), htmlForm);
        }
    },
    initEvents: function () {
        document.addEventListener('click', function (event) {
            if (event.target.classList.contains('js-ets_cf_close_thank_msg') || event.target.closest('.js-ets_cf_close_thank_msg')) {
                if (event.target.closest('.ets_cf_thank_msg').classList.contains('ets_cf_remove_form')) {
                    if (event.target.closest('.ets_cf_popup')) {
                        event.target.closest('.ets_cf_popup').classList.remove('ets_cf_popup_active');
                    } else {
                        event.target.closest('.ets_cf_box').remove();
                    }
                } else
                    event.target.closest('.ets_cf_thank_msg').remove();
            }

            var popupForms = document.querySelectorAll('.ets_cf_popup');
            for (var i = 0; i < popupForms.length; i++) {
                if (event.target == popupForms[i]) {
                    popupForms[i].closest('.ets_cf_popup').classList.remove('ets_cf_popup_active');
                }
            }
        });

        var forms = document.querySelectorAll('form.ets_cf_form_data_contact');
        if (forms.length) {
            for (var i = 0; i < forms.length; i++) {
                forms[i].addEventListener('submit', function (e) {
                    e.preventDefault();
                    if (etsCf.validateSubmitForm(this)) {
                        etsCf.submitContactForm(this);
                    } else {
                        etsCf.resetCatchav2(this);
                    }
                    return false;
                });
            }
        }
        this.onClick('.js-ets_cf_toggle_view_password', function (el) {
            etsCf.toggleViewPassword(el);
        });

        var rangeInputs = document.querySelectorAll('.ets_cf_input_range');
        if (rangeInputs.length) {
            for (var i = 0; i < rangeInputs.length; i++) {
                rangeInputs[i].addEventListener('input', function () {
                    etsCf.setInputRange(this);
                });
            }
        }
        var changeInputs = document.querySelectorAll('input,textarea,select');
        if (changeInputs.length) {
            for (var i = 0; i < changeInputs.length; i++) {
                var inputOnChange = ['file', 'checkbox', 'radio'];
                var inputType = changeInputs[i].getAttribute('type');
                if (inputOnChange.indexOf(inputType) !== -1 || changeInputs[i].tagName == 'select') {
                    changeInputs[i].addEventListener('change', function () {
                        etsCf.clearInputError(this);
                    });
                } else
                    changeInputs[i].addEventListener('input', function () {
                        etsCf.clearInputError(this);
                    });
            }
        }

        this.onClick('.js-ets_cf_btn_next_step', function (el) {
            etsCf.nextStep(el);
        });

        this.onClick('.js-ets_cf_btn_back_step', function (el) {
            etsCf.backStep(el);
        });
        this.onClick('.js-ets_cf_step_number', function (el) {
            etsCf.onClickStep(el);
        });

        this.onClick('.js-ets_cf_btn_popup_open_form', function (el) {
            etsCf.onOpenPopupForm(el);
        });

        this.onClick('.js-ets_cf_btn_close_popup', function (el) {
            etsCf.onClosePopupForm(el);
        });


    },
    onClick: function (selector, callback) {
        var els = document.querySelectorAll(selector);
        if (els.length) {
            for (var i = 0; i < els.length; i++) {
                els[i].addEventListener('click', function () {
                    callback(this);
                });
            }
        }
    },
    onClosePopupForm: function (el) {
        el.closest('.ets_cf_popup').classList.remove('ets_cf_popup_active');
    },
    onOpenPopupForm: function (el) {
        el.nextElementSibling.classList.add('ets_cf_popup_active');
        var thankBox = el.nextElementSibling.querySelector('.ets_cf_thank_msg');
        if (thankBox)
            thankBox.remove();
        el.nextElementSibling.classList.remove('ets_cf_only_thank');
        el.nextElementSibling.querySelector('.ets_cf_box').classList.remove('ets_cf_hidden');
        el.nextElementSibling.querySelector('.ets_cf_wrapper').classList.remove('ets_cf_hidden');

    },
    toggleViewPassword: function (el) {
        el.classList.remove('ets_cf_active');
        if (el.classList.contains('js-ets_cf_show_password')) {
            el.closest('.ets_cf_input_group_password').querySelector('input[type=password]').setAttribute('type', 'text');
            el.closest('.ets_cf_input_group_password').querySelector('.js-ets_cf_hide_password').classList.add('ets_cf_active');
        } else if (el.classList.contains('js-ets_cf_hide_password')) {
            el.closest('.ets_cf_input_group_password').querySelector('input[type=text]').setAttribute('type', 'password');
            el.closest('.ets_cf_input_group_password').querySelector('.js-ets_cf_show_password').classList.add('ets_cf_active');
        }
    },
    validateSubmitForm: function (form) {
        etsCf.clearFormErrors(form);
        var inputs = form.querySelectorAll('input,textarea,select');
        if (!inputs.length) {
            return false;
        }
        /* Validate js form*/
        var hasError = false;
        for (var i = 0; i < inputs.length; i++) {
            if (!etsCf.validateInput(inputs[i]) && !hasError) {
                hasError = true;
            }
        }
        if (!this.validateRecaptcha(form)) {
            hasError = true;
        }
        return !hasError;
    },
    validateInput: function (input) {
        var trans = {};
        if (typeof ETS_CF_CONFIG !== 'undefined' && typeof ETS_CF_CONFIG.translations !== 'undefined') {
            trans = ETS_CF_CONFIG.translations;
        }

        var isRequired = input.getAttribute('data-required');
        var value = input.value;
        var inputType = input.type;
        if (isRequired && isRequired == 'true' && (inputType == 'checkbox' || inputType == 'radio')) {
            var inputItems = input.closest('.ets_cf_form_group').querySelectorAll('input[type="' + inputType + '"]');
            var hasChecked = false;
            for (var i = 0; i < inputItems.length; i++) {
                if (inputItems[i].checked) {
                    hasChecked = true;
                    break;
                }
            }
            if (!hasChecked) {
                input.closest('.ets_cf_form_group').classList.add('ets_cf_field_invalid');
                var acpt = input.getAttribute('data-acceptance');
                if (acpt && acpt == 'true') {
                    input.closest('.ets_cf_form_group').querySelector('.ets_cf_item_error').innerHTML = trans.translation_field_4;
                } else
                    input.closest('.ets_cf_form_group').querySelector('.ets_cf_item_error').innerHTML = trans.translation_field_5;
                return false;
            }
            return true;
        }

        if (isRequired && isRequired == 'true' && !value) {
            input.closest('.ets_cf_form_group').classList.add('ets_cf_field_invalid');
            input.closest('.ets_cf_form_group').querySelector('.ets_cf_item_error').innerHTML = trans.translation_field_5;
            return false;
        }
        var validate = input.getAttribute('data-validate');
        if (!validate) {
            validate = 'isString';
        }
        if (value && validate && typeof etsCf[validate] === 'function') {
            var isValid;
            if (validate == 'isFile') {
                //var fileTypes = input.getAttribute('file-types');
                /*if (fileTypes) {
                    fileTypes = fileTypes.split(',');
                } else {
                    fileTypes = ['png', 'jpg', 'jpeg', 'gif', 'pdf', 'doc', 'docx','csv', 'xls', 'xlsx', 'txt', 'zip', 'rar'];
                }*/
                var fileTypes = ['png', 'jpg', 'jpeg', 'gif', 'pdf', 'doc', 'docx', 'csv', 'xls', 'xlsx', 'txt', 'zip', 'rar'];
                var maxSize = input.getAttribute('max-size');
                if (maxSize) {
                    maxSize = parseFloat(maxSize);
                } else {
                    maxSize = 10;
                }
                isValid = etsCf.isFile(input, fileTypes, maxSize);
            } else {
                isValid = etsCf[validate](value);
            }
            if (!isValid) {
                input.closest('.ets_cf_form_group').classList.add('ets_cf_field_invalid');
                input.closest('.ets_cf_form_group').querySelector('.ets_cf_item_error').innerHTML = trans.translation_field_7;
                return false;
            }
        }
        return true;
    },
    clearInputError: function (el) {
        if (el.closest('.ets_cf_form_group') && el.closest('.ets_cf_form_group').querySelector('.ets_cf_item_error')) {
            el.closest('.ets_cf_form_group').querySelector('.ets_cf_item_error').innerHTML = '';
        }
    },
    submitContactForm: function (form) {
        var actionUrl = form.getAttribute('action');
        var formData = new FormData(form);
        formData.append('browser', this.detectBrowser());

        etsCf.clearFormErrors(form);
        var btnSubmits = form.querySelectorAll('button[type="submit"]');

        if (btnSubmits.length) {
            if (btnSubmits[0].classList.contains('ets_cf_btn_loading')) {
                return false;
            }
            for (var i = 0; i < btnSubmits.length; i++) {
                btnSubmits[i].disabled = true;
                btnSubmits[i].classList.add('ets_cf_btn_loading');
            }
        }
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () {
            var DONE = 4;
            var OK = 200;
            if (xhr.readyState == DONE) {
                if (btnSubmits.length) {
                    for (var i = 0; i < btnSubmits.length; i++) {
                        btnSubmits[i].disabled = false;
                        btnSubmits[i].classList.remove('ets_cf_btn_loading');
                    }
                }
            }
            if (xhr.readyState == DONE && xhr.status == OK) {
                //Success
                var responseText = xhr.responseText;
                var json = JSON.parse(responseText);
                if (json.success) {
                    etsCf.resetCatchav2(form);
                    if (json.thank_msg) {
                        etsCf.showThankMessage(form, json.thank_msg, json.keep_form);
                    }
                    if (!json.keep_form) {
                        if (form.closest('.ets_cf_popup')) {
                            form.closest('.ets_cf_popup').classList.add('ets_cf_only_thank');
                        } else {
                            form.closest('.ets_cf_box').classList.add('ets_cf_only_thank')
                        }
                        form.closest('.ets_cf_wrapper').classList.add('ets_cf_hidden');
                        etsCf.clearForm(form);
                    } else {
                        etsCf.clearForm(form);
                    }
                } else {
                    if (json.errors) {
                        etsCf.setFormError(form, json.errors);
                    }
                }
            } else {
                //Error
            }
        }
        xhr.open('POST', actionUrl);
        xhr.send(formData);

    },
    resetCatchav2: function (form) {
        var reCaptchaV2Items = form.querySelectorAll('.ets_cf_recaptcha_v2');
        if (reCaptchaV2Items.length && typeof grecaptcha !== 'undefined') {
            for (var i = 0; i < reCaptchaV2Items.length; i++) {
                var idCp = reCaptchaV2Items[i].getAttribute('id');
                if (typeof etsCf.recaptchaItems[idCp] !== 'undefined') {
                    grecaptcha.reset(etsCf.recaptchaItems[idCp]);
                }
            }
        }
    },
    clearFormErrors: function (form) {
        var items = form.querySelectorAll('.ets_cf_field_invalid');
        for (var i = 0; i < items.length; i++) {
            items[i].classList.remove('ets_cf_field_invalid');
            items[i].querySelector('.ets_cf_item_error').innerHTML = '';
        }
    },
    setFormError: function (form, errors) {
        var firstError = null;
        Object.keys(errors).forEach(function (key) {
            if (!firstError) {
                firstError = {key: key, error: errors[key][0]};
            }
            if (key == 'g-recaptcha-response') {
                var inputCaptcha = form.querySelectorAll('.ets_cf_recaptcha');
                if (inputCaptcha) {
                    for (var i = 0; i < inputCaptcha.length; i++) {
                        inputCaptcha[i].closest('.ets_cf_form_group').classList.add('ets_cf_field_invalid');
                        if (inputCaptcha[i].closest('.ets_cf_form_group').querySelector('.ets_cf_item_error'))
                            inputCaptcha[i].closest('.ets_cf_form_group').querySelector('.ets_cf_item_error').innerHTML = errors[key][0];
                    }

                }
            } else if (form.querySelector('[name="' + key + '"]')) {
                form.querySelector('[name="' + key + '"]').closest('.ets_cf_form_group').classList.add('ets_cf_field_invalid');
                form.querySelector('[name="' + key + '"]').closest('.ets_cf_form_group').querySelector('.ets_cf_item_error').innerHTML = errors[key][0];
            } else if (form.querySelector('[name="' + key + '[]"]')) {
                form.querySelector('[name="' + key + '[]"]').closest('.ets_cf_form_group').classList.add('ets_cf_field_invalid');
                form.querySelector('[name="' + key + '[]"]').closest('.ets_cf_form_group').querySelector('.ets_cf_item_error').innerHTML = errors[key][0];
            }
        });
        if (!firstError) {
            return false;
        }
        if (form.querySelector('.ets_cf_form_step_box')) {
            var indexStep = -1;
            if (firstError.key == 'g-recaptcha-response' && form.querySelector('.ets_cf_recaptcha')) {
                indexStep = form.querySelector('.ets_cf_recaptcha').closest('.ets_cf_step_form_item').getAttribute('data-step-index');
            } else if (form.querySelector('[name="' + firstError.key + '"]')) {
                indexStep = form.querySelector('[name="' + firstError.key + '"]').closest('.ets_cf_step_form_item').getAttribute('data-step-index');
            }
            if (indexStep !== -1) {
                var stepboxs = form.querySelectorAll('.ets_cf_step_form_item');
                if (stepboxs.length) {
                    for (var i = 0; i < stepboxs.length; i++) {
                        if (parseInt(indexStep) > i) {
                            form.querySelector('.ets_cf_form_step_header .ets_cf_step_item:nth-child(' + (i + 1) + ')').classList.remove('ets_cf_step_completed');
                        }
                        if (stepboxs[i].getAttribute('data-step-index') != indexStep) {
                            stepboxs[i].classList.remove('ets_cf_step_active');
                            form.querySelector('.ets_cf_form_step_header .ets_cf_step_item:nth-child(' + (i + 1) + ')').classList.remove('ets_cf_step_active');
                        } else {
                            stepboxs[i].classList.add('ets_cf_step_active');
                            form.querySelector('.ets_cf_form_step_header .ets_cf_step_item:nth-child(' + (i + 1) + ')').classList.add('ets_cf_step_active');
                        }
                    }
                }
            }
        }
        var idItemGroup = null;
        if (firstError.key == 'g-recaptcha-response' && form.querySelector('.ets_cf_recaptcha')) {
            idItemGroup = form.querySelector('.ets_cf_recaptcha').closest('.ets_cf_form_group').getAttribute('id');
        } else if (form.querySelector('[name="' + firstError.key + '"]')) {
            idItemGroup = form.querySelector('[name="' + firstError.key + '"]').closest('.ets_cf_form_group').getAttribute('id');
        }
        if (idItemGroup) {
            document.getElementById(idItemGroup).scrollIntoView({block: "center"});
        }
    },
    clearForm: function (form) {

        var inputs = form.querySelectorAll('input, textarea, select');
        if (!inputs.length) {
            return false;
        }

        for (var i = 0; i < inputs.length; i++) {
            if (!inputs[i].closest('.ets_cf_form_group')) {
                continue;
            }
            inputs[i].closest('.ets_cf_form_group').classList.remove('ets_cf_field_invalid');
            inputs[i].closest('.ets_cf_form_group').querySelector('.ets_cf_item_error').innerHTML = '';
            var defaultVal = inputs[i].getAttribute('data-default')
            if (inputs[i].getAttribute('type') == 'checkbox' || inputs[i].getAttribute('type') == 'radio') {
                if (defaultVal && defaultVal == 'true') {
                    inputs[i].checked = true;
                } else {
                    inputs[i].checked = false;
                }
            } else if (inputs[i].getAttribute('type') == 'file') {
                inputs[i].value = '';
            } else if (inputs[i].tagName == 'SELECT' && inputs[i].multiple) {
                var options = inputs[i].querySelectorAll('option');
                var defaultValArr = defaultVal.split('|');
                if (options.length && defaultValArr.length) {
                    for (var t = 0; t < options.length; t++) {
                        if (defaultValArr.indexOf(options[t].value) !== -1) {
                            options.selected = true;
                        }
                    }
                }
            } else {
                if (defaultVal) {
                    inputs[i].value = defaultVal;
                } else
                    inputs[i].value = '';
            }
        }
    },
    showThankMessage: function (form, message, isKeepForm) {
        var html = `<div class="ets_cf_thank_msg ${isKeepForm ? '' : 'ets_cf_remove_form'}">
                    <button class="ets_cf_close_thank_msg js-ets_cf_close_thank_msg"><i class="ets_cf_icon">${etsCf.icons.close}</i></button>
                    ${etsCf.nl2br(message)}
            </div>`;
        if (form.closest('.ets_cf_box').querySelector('.ets_cf_thank_msg')) {
            form.closest('.ets_cf_box').querySelector('.ets_cf_thank_msg').remove();
        }
        form.closest('.ets_cf_box').appendChild(this.createElementFromHTML(html));
    },
    setReCaptcha: function () {
        if (!ETS_CF_CONFIG || !ETS_CF_CONFIG.recaptcha) {
            return false;
        }

        if (document.querySelectorAll('.ets_cf_recaptcha_v2').length && ETS_CF_CONFIG.recaptcha.type == 'v2') {
            var linkRecaptcha = document.createElement('script');
            linkRecaptcha.setAttribute('src', 'https://www.google.com/recaptcha/api.js?onload=etsCfLoadRecaptcha&render=explicit');
            linkRecaptcha.setAttribute('async', 'async');
            linkRecaptcha.setAttribute('defer', 'defer');
            document.getElementsByTagName('head')[0].append(linkRecaptcha);
        } else if (document.querySelectorAll('.ets_cf_recaptcha_v3').length && ETS_CF_CONFIG.recaptcha.type == 'v3') {
            var linkRecaptcha = document.createElement('script');
            linkRecaptcha.setAttribute('src', 'https://www.google.com/recaptcha/api.js?onload=etsCfLoadRecaptchaV3&render=' + ETS_CF_CONFIG.recaptcha.site_key_v3);
            document.getElementsByTagName('head')[0].append(linkRecaptcha);
        }
    },
    validateNextStep: function (stepForm) {
        var inputs = stepForm.querySelectorAll('input,textarea,select');
        if (!inputs.length) {
            return false;
        }
        var hasError = false;
        for (var i = 0; i < inputs.length; i++) {
            if (!etsCf.validateInput(inputs[i]) && !hasError) {
                hasError = true;
            }
        }
        if (!this.validateRecaptcha(stepForm)) {
            hasError = true;
        }
        return !hasError;
    },
    validateRecaptcha: function (parentEl) {
        var trans = {};
        if (typeof ETS_CF_CONFIG !== 'undefined' && typeof ETS_CF_CONFIG.translations !== 'undefined') {
            trans = ETS_CF_CONFIG.translations;
        }
        var recaptchaItem = parentEl.querySelector('.ets_cf_recaptcha_v2');
        if (recaptchaItem && typeof grecaptcha !== 'undefined') {
            var idItem = recaptchaItem.getAttribute('id');
            if (typeof etsCf.recaptchaItems[idItem] !== 'undefined') {
                var response = grecaptcha.getResponse(etsCf.recaptchaItems[idItem]);
                if (!response) {
                    recaptchaItem.closest('.ets_cf_form_group').querySelector('.ets_cf_item_error').innerHTML = trans.translation_field_8
                    return false;
                }
            }
        }
        return true;
    },
    onClickStep: function (el) {

        if (!el.closest('.ets_cf_step_item').classList.contains('ets_cf_step_completed')) {
            return false;
        }
        var index = etsCf.getIndex(el.closest('.ets_cf_step_item'));

        if (index !== -1) {

            var stepForms = el.closest('.ets_cf_box').querySelectorAll('.ets_cf_step_form_item');
            for (var i = 0; i < stepForms.length; i++) {
                stepForms[i].classList.remove('ets_cf_step_active');
                if (i > index) {
                    stepForms[i].closest('.ets_cf_box').querySelector('.ets_cf_form_step_header .ets_cf_step_item:nth-child(' + (i + 1) + ')').classList.remove('ets_cf_step_completed');
                }
            }
            el.closest('.ets_cf_box').querySelector('.ets_cf_step_form_item:nth-child(' + (index + 1) + ')').classList.add('ets_cf_step_active');

            //el.closest('.ets_cf_box').querySelector('.ets_cf_form_step_header .ets_cf_step_item.ets_cf_step_active').classList.add('ets_cf_step_completed');
            el.closest('.ets_cf_box').querySelector('.ets_cf_form_step_header .ets_cf_step_item.ets_cf_step_active').classList.remove('ets_cf_step_active');
            el.closest('.ets_cf_box').querySelector('.ets_cf_form_step_header .ets_cf_step_item:nth-child(' + (index + 1) + ')').classList.add('ets_cf_step_active');
        }
    },
    nextStep: function (el) {
        el.closest('.ets_cf_step_form_item').classList.add('ets_cf_step_completed');
        if (!this.validateNextStep(el.closest('.ets_cf_step_form_item'))) {
            return false;
        }
        el.closest('.ets_cf_step_form_item').classList.remove('ets_cf_step_active');
        if (el.closest('.ets_cf_step_form_item').nextElementSibling) {
            el.closest('.ets_cf_step_form_item').nextElementSibling.classList.add('ets_cf_step_active');
        }
        if (el.closest('.ets_cf_box').querySelector('.ets_cf_step_form_item.ets_cf_step_active')) {
            var index = etsCf.getIndex(el.closest('.ets_cf_box').querySelector('.ets_cf_step_form_item.ets_cf_step_active'));
            if (index !== -1) {
                el.closest('.ets_cf_box').querySelector('.ets_cf_form_step_header .ets_cf_step_item.ets_cf_step_active').classList.add('ets_cf_step_completed');
                el.closest('.ets_cf_box').querySelector('.ets_cf_form_step_header .ets_cf_step_item.ets_cf_step_active').classList.remove('ets_cf_step_active');
                el.closest('.ets_cf_box').querySelector('.ets_cf_form_step_header .ets_cf_step_item:nth-child(' + (index + 1) + ')').classList.add('ets_cf_step_active');
            }
        }
    },
    backStep: function (el) {
        var indexOld = etsCf.getIndex(el.closest('.ets_cf_box').querySelector('.ets_cf_step_form_item.ets_cf_step_active'));
        el.closest('.ets_cf_step_form_item').classList.remove('ets_cf_step_active');
        if (indexOld !== -1) {

            el.closest('.ets_cf_box').querySelector('.ets_cf_form_step_header .ets_cf_step_item:nth-child(' + (indexOld + 1) + ')').classList.remove('ets_cf_step_completed');
        }

        if (el.closest('.ets_cf_step_form_item').previousElementSibling) {
            el.closest('.ets_cf_step_form_item').previousElementSibling.classList.add('ets_cf_step_active');
        }
        if (el.closest('.ets_cf_box').querySelector('.ets_cf_step_form_item.ets_cf_step_active')) {
            var index = etsCf.getIndex(el.closest('.ets_cf_box').querySelector('.ets_cf_step_form_item.ets_cf_step_active'));
            if (index !== -1) {
                //el.closest('.ets_cf_box').querySelector('.ets_cf_form_step_header .ets_cf_step_item.ets_cf_step_active').classList.add('ets_cf_step_completed');
                el.closest('.ets_cf_box').querySelector('.ets_cf_form_step_header .ets_cf_step_item.ets_cf_step_active').classList.remove('ets_cf_step_active');
                el.closest('.ets_cf_box').querySelector('.ets_cf_form_step_header .ets_cf_step_item:nth-child(' + (index + 1) + ')').classList.add('ets_cf_step_active');
            }
        }
    },
    getIndex: function (node) {
        var children = node.parentNode.childNodes;
        var num = 0;
        for (var i = 0; i < children.length; i++) {
            if (children[i] == node) return num;
            if (children[i].nodeType == 1) num++;
        }
        return -1;
    },
    makeRandom: function (length) {
        var result = '';
        var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        var charactersLength = characters.length;
        for (var i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() *
                charactersLength));
        }
        return result;
    },
    icons: {
        eye: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" fill=\"currentColor\" class=\"bi bi-eye\" viewBox=\"0 0 16 16\">\n" +
            "  <path d=\"M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z\"/>" +
            "  <path d=\"M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z\"/>\n" +
            "</svg>",
        eye_slash: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" fill=\"currentColor\" class=\"bi bi-eye-slash\" viewBox=\"0 0 16 16\">" +
            "  <path d=\"M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z\"/>" +
            "  <path d=\"M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z\"/>" +
            "  <path d=\"M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12-.708.708z\"/>" +
            "</svg>",
        save: "<svg width=\"14\" height=\"14\" viewBox=\"0 0 1792 1792\" xmlns=\"http://www.w3.org/2000/svg\">" +
            "<path d=\"M512 1536h768v-384h-768v384zm896 0h128v-896q0-14-10-38.5t-20-34.5l-281-281q-10-10-34-20t-39-10v416q0 40-28 68t-68 28h-576q-40 0-68-28t-28-68v-416h-128v1280h128v-416q0-40 28-68t68-28h832q40 0 68 28t28 68v416zm-384-928v-320q0-13-9.5-22.5t-22.5-9.5h-192q-13 0-22.5 9.5t-9.5 22.5v320q0 13 9.5 22.5t22.5 9.5h192q13 0 22.5-9.5t9.5-22.5zm640 32v928q0 40-28 68t-68 28h-1344q-40 0-68-28t-28-68v-1344q0-40 28-68t68-28h928q40 0 88 20t76 48l280 280q28 28 48 76t20 88z\"></path>" +
            "</svg>",
        close: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" fill=\"currentColor\" class=\"bi bi-x-lg\" viewBox=\"0 0 16 16\">\n" +
            "  <path d=\"M1.293 1.293a1 1 0 0 1 1.414 0L8 6.586l5.293-5.293a1 1 0 1 1 1.414 1.414L9.414 8l5.293 5.293a1 1 0 0 1-1.414 1.414L8 9.414l-5.293 5.293a1 1 0 0 1-1.414-1.414L6.586 8 1.293 2.707a1 1 0 0 1 0-1.414z\"/>\n" +
            "</svg>"
    },
    recaptchaOnloadCallback: function () {
        var recaptchaV2Els = document.querySelectorAll('.ets_cf_recaptcha_v2');
        if (recaptchaV2Els.length && ETS_CF_CONFIG.recaptcha.type == 'v2') {
            for (var i = 0; i < recaptchaV2Els.length; i++) {
                var idItem = recaptchaV2Els[i].getAttribute('id');
                if (idItem) {
                    var wg = grecaptcha.render(idItem, {
                        'sitekey': ETS_CF_CONFIG.recaptcha.site_key_v2,
                        'theme': recaptchaV2Els[i].getAttribute('data-theme'),
                        'size': recaptchaV2Els[i].getAttribute('data-size')
                    });
                    etsCf.recaptchaItems[idItem] = wg;
                }
            }
        }
    },
    getRecaptchaV3: function () {
        var recaptchaV3Els = document.querySelectorAll('.ets_cf_recaptcha_v3');
        if (recaptchaV3Els.length && ETS_CF_CONFIG.recaptcha.type == 'v3') {
            grecaptcha.ready(function () {
                grecaptcha.execute(ETS_CF_CONFIG.recaptcha.site_key_v3, {action: 'validate_captcha'})
                    .then(function (token) {
                        for (var i = 0; i < recaptchaV3Els.length; i++)
                            recaptchaV3Els[i].value = token;
                    });
            });
        }
    },
    isFill: function (str) {
        str = str.trim();
        return typeof str === 'string' && str.length > 0;
    },
    isString: function (str) {
        str = str.trim();
        return typeof str === 'string' || str instanceof String;
    },
    isInt: function (n) {
        return Number(n) === n && n % 1 === 0;
    },
    isFloat: function (n) {
        return Number(n) === n && n % 1 !== 0;
    },
    isNumber: function (n) {
        return !isNaN(n);
    },
    isEmail: function (email) {
        const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(String(email).toLowerCase());
    },
    isPhoneNumber: function (phone) {
        phone = phone.trim();
        return /^([0-9\s\-\+\(\)]*)$/g.test(phone);
    },
    isUrl: function (str) {
        str = str.trim();
        var pattern = new RegExp('^(https?:\\/\\/)?' + // protocol
            '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
            '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
            '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
            '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
            '(\\#[-a-z\\d_]*)?$', 'i'); // fragment locator
        return !!pattern.test(str);
    },
    isDate: function (date) {
        return /^(\d{2})\/(\d{2})\/(\d{4})$/g.test(date);
    },
    isDatetime: function (date) {
        return /^(\d{2})\/(\d{2})\/(\d{4})\s(\d{2}):(\d{2}):(\d{2})$/g.test(date);
    },
    isFileName: function (oInput) {
        if (oInput.type == "file") {
            var fullPath = oInput.value;
            var sFileName = fullPath.replace(/^.*[\\\/]/, '');
            sFileName = sFileName.replace(/\s+/g, '_');
            return /^[a-zA-Z0-9_.\-\(\)]+$/.test(sFileName);
        }
        return false;
    },
    isFile: function (oInput, _validFileExtensions, maxSize) {
        if (!this.isFileName(oInput)) {
            return false;
        }
        if (oInput.type == "file") {
            var sFileName = oInput.value;
            if (sFileName.length > 0) {
                var blnValid = false;
                if (!_validFileExtensions.length) {
                    blnValid = true;
                }
                for (var j = 0; j < _validFileExtensions.length; j++) {
                    var sCurExtension = _validFileExtensions[j];
                    if (sFileName.substr(sFileName.length - sCurExtension.length, sCurExtension.length).toLowerCase() == sCurExtension.toLowerCase()) {
                        blnValid = true;
                        break;
                    }
                }

                if (!blnValid) {
                    return false;
                }
            }
            const size = (oInput.files[0].size / 1024 / 1024).toFixed(2);
            //Validate file size
            if (size > maxSize) {
                return false
            }
        }
        return true;
    },
    initNumberRange: function () {
        var rangeInputs = document.querySelectorAll('.ets_cf_input_range');
        if (rangeInputs.length) {
            for (var i = 0; i < rangeInputs.length; i++) {
                this.setInputRange(rangeInputs[i]);
            }
        }
    },
    setInputRange: function (range) {
        var bubble = range.previousElementSibling;
        var val = range.value;
        var min = 0;
        var unit = '';

        if (range.getAttribute('min'))
            min = range.getAttribute('min');
        var max = 0;
        if (range.getAttribute('max'))
            max = range.getAttribute('max');
        if (!val || val == '0') {
            val = 0;
        }
        try {
            if (min && parseFloat(min) > parseFloat(val)) {
                val = min;
            } else if (max && parseFloat(max) < parseFloat(val)) {
                val = max;
            }
        } catch (e) {

        }
        const newVal = Number(((val - min) * 100) / (max - min));
        bubble.innerHTML = '<span>' + val + unit + '</span>';
        bubble.style.left = 'calc(' + newVal + '% + (' + (10 - newVal * 0.2) + 'px))';
    },
    nl2br: function (str, is_xhtml) {
        if (typeof str === 'undefined' || str === null) {
            return '';
        }
        var breakTag = (is_xhtml || typeof is_xhtml === 'undefined') ? '<br />' : '<br>';
        return (str + '').replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1' + breakTag + '$2');
    },
    createElementFromHTML: function (htmlString) {
        var div = document.createElement('div');
        div.innerHTML = htmlString.trim();
        return div.firstChild;
    },
    detectBrowser: function () {
        if ((navigator.userAgent.indexOf("Opera") || navigator.userAgent.indexOf('OPR')) != -1) {
            return 'Opera';
        } else if (navigator.userAgent.indexOf("Edg") != -1) {
            return 'Edge';
        } else if (navigator.userAgent.indexOf("Chrome") != -1) {
            return 'Chrome';
        } else if (navigator.userAgent.indexOf("Safari") != -1) {
            return 'Safari';
        } else if (navigator.userAgent.indexOf("Firefox") != -1) {
            return 'Firefox';
        } else if ((navigator.userAgent.indexOf("MSIE") != -1) || (!!document.documentMode == true)) {
            return 'IE';//crap
        } else {
            return 'Unknown';
        }
    },
    getTextNodesContaining: function (txt) {
        var root = document.body
        var nodes = [],
            node,
            tree = document.createTreeWalker(
                root,
                4, // NodeFilter.SHOW_TEXT
                {
                    acceptNode: node => RegExp(txt).test(node.data)
                });
        while (node = tree.nextNode()) { // only return accepted nodes
            nodes.push(node);
        }
        return nodes;
    }
};
document.addEventListener("DOMContentLoaded", function () {
    if (typeof ETS_CF_INIT == 'undefined' || !ETS_CF_INIT) {
        var etsCfCounterApp = 0;
        var etsCfIntervalApp = setInterval(function () {
            if (typeof ETS_CF_INIT !== 'undefined' && ETS_CF_INIT) {
                etsCf.initApp();
                clearInterval(etsCfIntervalApp);
            }
            etsCfCounterApp += 200;
            if (etsCfCounterApp >= 5000) {
                clearInterval(etsCfIntervalApp);
            }
        }, 200);
    } else {
        etsCf.initApp();
    }
});

var etsCfLoadRecaptcha = function () {
    etsCf.recaptchaOnloadCallback();
}
var etsCfLoadRecaptchaV3 = function () {
    etsCf.getRecaptchaV3();
}

