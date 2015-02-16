# JSONLazyLoad
*v1.0.2*

##### What is it?
JSONLazyLoad is a jQuery plugin that loads dynamic content from a server when the user scrolls or resizes the window.

##### Features
- Fully-configurable jQuery plugin that can be used to load JSON, JSONP, or any other content type (despite its name).
- JSONLazyLoad ensures that there's always a scrollbar in your content; you only need to specify how many items to fetch per request and the library does the rest.
- Show a loading graphic of your choice when users scroll and have been waiting more than N milliseconds.
- Specify a scroll threshold that can trigger the Ajax call when the user reaches the very bottom of the scroll area or some amount of pixels above it.
- Handles multiple lazy loaders on the same page.

##### How do I use it?

This shows a simple way to instantiate the lazy loader to grab ten Brad Pitt movies from the iTunes web service on each Ajax request.

```javascript
/*jslint browser: true */
/*global jQuery: false */

(function ($) {
    'use strict';

    // Variable declaration.
    var my_callback, settings;

    // Define our callback when items are loaded from the server.
    // This function will append the movie poster image to the target element.
    my_callback = function (lazy_loader, items) {
        var target = lazy_loader.target();
        items.forEach(function (item) {
            $('<article><img></article>')
                .find('img').attr('src', item.artworkUrl100).end()
                .appendTo(target).hide().fadeIn('slow');
        });
    };

    $(document).ready(function () {
        // Define our settings.
        settings = {
            behavior: {
                ensure_scrollbar: true,
                fetch_amount: 10,
                fetch_immediate: true,
                initial_offset: 0,
                loader_delay: 250
            },
            elements: {
                scroll_target: $(window)
            },
            results: {
                item_callback: my_callback,
                item_key: 'results'
            },
            ws: {
                data_type: 'jsonp',
                limit_param: 'limit',
                offset_param: 'offset',
                url: 'http://itunes.apple.com/search?media=movie&explicit=No&term=Brad+Pitt'
            }
        };

        // Instantiate JSONLazyLoad with our settings.  This will also fire off the initial Ajax request(s).
        $('#lazy-loader').jsonlazyload(settings);
    });
}(jQuery));
```