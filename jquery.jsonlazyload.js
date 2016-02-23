/*
    jquery.jasonlazyload.js
    2016-02-23
    v1.1.0

    The MIT License (MIT)

    Copyright (c) 2015 Joe Ridino

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.

    JSONLazyLoad is a jQuery plugin that loads dynamic content from a server when
    the user scrolls or resizes the window.

    This plugin will handle the browser events and call the web service for
    items, then hand them off for rendering.  See the default_settings object
    below for detailed information about the possible settings.

    Usage:
    jQuery('#my-element').jsonlazyload(my_options);
*/

/*jslint browser: true, unparam: true */
/*global jQuery: false */

(function ($) {
    'use strict';

    var JSONLazyLoad = function (element, options) {
        var default_settings = {
            // Behavior-type settings.
            behavior: {
                // If true, does automatic Ajax calls to ensure there's always
                // a scrollbar present in the scroll target.
                ensure_scrollbar: false,

                // The number of items to fetch from the server.
                fetch_amount: 10,

                // If true, fetches items immediately after instantiating.
                fetch_immediate: true,

                // The initial offset for pagination.  Normally this will be 0.
                initial_offset: 0,

                // After this many milliseconds elements.loader will be shown.
                loader_delay: 100,

                // The number of pixels from the bottom of the scroll target
                // that triggers a new Ajax request.  Normally, this would be 0
                // if you want to have new items load when the scrollbar reaches
                // its bottom, but due to some browser quirks setting this to a
                // value of 1 is more reliable.
                scroll_threshold: 1
            },
            // Files-based web service.
            files: {
                // The number to add to files_offset after retrieving a file.
                // Normally, this will be 1, but it can also be -1 to represent
                // grabbing files in DESC order.
                increment: 1,

                // The offset that represents the last file.
                last_offset: 0,

                // The file pattern to use when retrieving the next file.
                // e.g. If you specify "data[n].json" then the "[n]" will be
                // replaced with the current page number.  So if the initial
                // offset is 0, the first request will be to "data1.json".
                pattern: ''
            },
            // jQuery elements.
            elements: {
                // The jQuery element that scroll events are attached to.
                scroll_target: $(window),

                // The jQuery element that will be displayed when N
                // (behavior.loader_delay) number of milliseconds have elapsed
                // since the start of an Ajax request.
                loader: null
            },
            // Callbacks and other settings pertaining to the Ajax response.
            results: {
                // Function that gets called right before an Ajax request.
                // Signature: function (lazy_loader, limit)
                before_callback: null,

                // Function that gets called when an Ajax request fails.
                // Signature: function (lazy_loader)
                fail_callback: null,

                // Function that gets called when an Ajax request succeeds.
                // Signature: function (lazy_loader, data)
                item_callback: null,

                // Specifies an object key inside the Ajax response that holds
                // the items array.  When null, it is assumed the items array
                // is the response itself.
                item_key: null
            },
            // Web service settings.
            ws: {
                // Content-type string suitable for jQuery.ajax() call.
                data_type: 'json',

                // The name of the limit parameter for the web service.
                limit_param: 'limit',

                // The name of the offset paraemter for the web service.
                offset_param: 'offset',

                // The URL to the web service.  Can have additional query
                // parameters outside of limit and offset if needed.
                url: ''
            }
        },
            added_event_handlers = false,
            ajaxing = false,
            check_add_event_handlers,
            files_offset = 0,
            has_scrollbar,
            init,
            jquery_element = $(element),
            loaded_all = false,
            loader_hide,
            loader_show,
            loader_timeout_id,
            offset = 0,
            prev_scroll_top = 0,
            promise = null,
            promise_always,
            promise_done,
            promise_fail,
            resize_check,
            scroll_check,
            self = this,
            settings = null,
            tear_down;

        /**
         * Returns the jQuery element that is the lazy load target.
         * 
         * @return
         *     The jQuery element that is the lazy load target.
         */
        this.target = function () {
            return jquery_element;
        };

        /**
         * Fetches items from the server given the amount of items to fetch.
         * 
         * This function is aware of the items that we have fetched previously
         * by way of the offset variable.  The fetch will start from the offset
         * and grab as many items as it can, up to the limit specified.
         * 
         * Also, this function will trigger your callbacks when the Ajax request
         * finishes in addition to showing the loader if the Ajax request is
         * taking too long.
         * 
         * @param limit
         *     The number of items to fetch.
         */
        this.fetch_items = function (limit) {
            if (ajaxing || loaded_all) {
                return;
            }

            var params = {}, url;
            if (settings.files.pattern) {
                url = settings.files.pattern.replace('[n]', files_offset + 1);
            } else {
                url = settings.ws.url;
                params[settings.ws.limit_param] = limit;
                params[settings.ws.offset_param] = offset;
            }

            if (settings.results.before_callback) {
                settings.results.before_callback(this, limit);
            }

            if (settings.elements.loader) {
                loader_timeout_id = setTimeout(loader_show, settings.behavior.loader_delay);
            }
            ajaxing = true;
            promise = $.ajax({
                url: url,
                data: params,
                dataType: settings.ws.data_type
            });

            promise.done(promise_done);
            promise.fail(promise_fail);
            promise.always(promise_always);
        };

        /**
         * If the scroll target does not have a vertical scrollbar more items
         * are fetched from the server to try to obtain one.
         */
        this.ensure_scrollbar = function () {
            if (!has_scrollbar()) {
                self.fetch_items(settings.behavior.fetch_amount);
            }
        };

        /**
         * Removes jQuery events and hides the loader if it's visible.
         */
        this.destroy = function () {
            tear_down();
        };

        /**
         * Removes jQuery events and hides the loader if it's visible.
         */
        tear_down = function () {
            settings.elements.scroll_target.off('scroll', scroll_check);
            $(window).off('resize', resize_check);
            if (settings.elements.loader) {
                loader_hide();
            }
        };

        /**
         * Returns true if the scroll target has a vertical scrollbar.
         *
         * @return
         *     Returns true if the scroll target has a vertical scrollbar. 
         */
        has_scrollbar = function () {
            var client_height, scroll_height;
            client_height = settings.elements.scroll_target.innerHeight();
            if ($.isWindow(settings.elements.scroll_target[0])) {
                scroll_height = $(document).height();
            } else {
                scroll_height = settings.elements.scroll_target[0].scrollHeight;
            }

            return scroll_height > client_height;
        };

        /**
         * Fetches more items when the user is scrolling the scroll target and
         * the scroll position is near the bottom of the target.  The threshold
         * is also taken into account.
         */
        scroll_check = function () {
            var threshold, needs_ajax, new_scroll_top, scroll_height;
            new_scroll_top = settings.elements.scroll_target.scrollTop();
            if (new_scroll_top > prev_scroll_top && !(ajaxing || loaded_all)) {
                if ($.isWindow(settings.elements.scroll_target[0])) {
                    scroll_height = $(document).height();
                } else {
                    scroll_height = settings.elements.scroll_target[0].scrollHeight;
                }
                threshold = scroll_height - settings.behavior.scroll_threshold;
                needs_ajax = (new_scroll_top + settings.elements.scroll_target.innerHeight()) >= threshold;
                if (needs_ajax) {
                    self.fetch_items(settings.behavior.fetch_amount);
                }
            }

            prev_scroll_top = new_scroll_top;
        };

        /**
         * Calls ensure_scrollbar() to obtain a vertical scrollbar when the
         * window is resized.
         */
        resize_check = function () {
            if (ajaxing || loaded_all) {
                return;
            }

            if (settings.behavior.ensure_scrollbar) {
                self.ensure_scrollbar();
            }
        };

        /**
         * Adds 'scroll' and 'resize' event handlers if they have not been
         * added before.
         */
        check_add_event_handlers = function () {
            if (!added_event_handlers) {
                settings.elements.scroll_target.on('scroll', scroll_check);
                $(window).on('resize', resize_check);
                added_event_handlers = true;
            }
        };

        /**
         * Called when the Ajax request has a successful response.
         * 
         * The item_callback is triggered to notify the client of new items.
         * 
         * @param data
         *     The data from the server, which has already been transformed by
         *     jQuery based on the content type specified.
         */
        promise_done = function (data) {
            var completed = false,
                dataEmpty = false;
            if (settings.results.item_key) {
                data = data[settings.results.item_key];
            }

            if (settings.files.pattern) {
                completed = (files_offset === settings.files.last_offset);
                files_offset += settings.files.increment;
            } else {
                if ($.isArray(data)) {
                    offset += data.length;
                    if (data.length === 0) {
                        completed = true;
                        dataEmpty = true;
                    }
                } else {
                    offset += 1;
                    if (data === '') {
                        completed = true;
                        dataEmpty = true;
                    }
                }
            }

            if (!dataEmpty) {
                settings.results.item_callback(self, data);
            }

            if (completed) {
                loaded_all = true;
                tear_down();
            }

            check_add_event_handlers();
        };

        /**
         * Called when the Ajax request fails.
         * 
         * The fail_callback is triggered to notify the client of the failure.
         */
        promise_fail = function () {
            if (settings.results.fail_callback) {
                settings.results.fail_callback(self);
            }
        };

        /**
         * Called when the Ajax request either fails or succeeds.
         * 
         * The main purpose of this function is to reset our flags, hide the
         * loader and ensure we have a scrollbar (which in turn calls the server
         * again if needed).
         * 
         * @param data
         *     The data from the server, which has already been transformed by
         *     jQuery into a JavaScript object based on the content type
         *     specified.
         * @param status
         *     Status string from jQuery.ajax.  Normally, this is 'success'
         *     unless the ajax call fails.
         */
        promise_always = function (data, status) {
            ajaxing = false;

            if (settings.elements.loader) {
                loader_hide();
            }

            if (!loaded_all && status === 'success' && settings.behavior.ensure_scrollbar) {
                self.ensure_scrollbar();
            }
        };

        /**
         * Shows the loader.
         */
        loader_show = function () {
            settings.elements.loader.show();
        };

        /**
         * Hides the loader and clears our loader timeout.
         */
        loader_hide = function () {
            clearTimeout(loader_timeout_id);
            settings.elements.loader.hide();
        };

        /**
         * Merges in user settings and fetches some items to start if specified.
         */
        init = function () {
            settings = $.extend(true, {}, default_settings, options);
            offset = settings.behavior.initial_offset;
            files_offset = settings.behavior.initial_offset;
            if (settings.behavior.fetch_immediate) {
                self.fetch_items(settings.behavior.fetch_amount);
            } else {
                check_add_event_handlers();
            }
        };

        init();
    };

    /**
     * Iterates over each element and instantiates a new instance of
     * JSONLazyLoad.
     * 
     * The JSONLazyLoad instance is stuffed into a data property of the element
     * called 'jsonlazyload'.
     * 
     * Usage:
     * jQuery('#my-element').jsonlazyload(my_options);
     * 
     * @param options
     *     An object representing the options for the instances.
     *     See default_settings object for detailed options information.
     *   
     * @return
     *     The jQuery object that was used to call this plugin.
     */
    $.fn.jsonlazyload = function (options) {
        return this.each(function () {
            var jsonlazyload = new JSONLazyLoad(this, options);
            $(this).data('jsonlazyload', jsonlazyload);
        });
    };
}(jQuery));