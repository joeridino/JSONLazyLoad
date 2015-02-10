/*jslint browser: true */
/*global jQuery: false */

(function ($) {
    'use strict';

    var base_settings,
        create_constrained_lazy_loader,
        create_window_lazy_loader,
        fetch_amount = 3,
        lazy_loaders = [],
        items_callback,
        movie_map = [],
        object_copy;

    // Creates a lazy loader with a constrained height that has its own
    // scrollbar.
    create_constrained_lazy_loader = function () {
        var base_settings_copy,
            parent,
            settings,
            target;

        base_settings_copy = object_copy(base_settings);
        parent = $('#items-container-constrained');
        settings = $.extend({}, base_settings_copy, {
            elements: {
                scroll_target: parent,
                loader: $('.loader', parent)
            }
        });
        settings.ws.url = 'http://itunes.apple.com/search?media=movie&explicit=No&term=Brad+Pitt';
        target = $('.items', parent);
        lazy_loaders[target.attr('id')] = target.jsonlazyload(settings);
    };

    // Creates a lazy loader that updates when the window itself scrolls.
    create_window_lazy_loader = function () {
        var base_settings_copy,
            parent,
            settings,
            target;

        base_settings_copy = object_copy(base_settings);
        parent = $('#items-container-window');
        settings = $.extend({}, base_settings_copy, {
            elements: {
                scroll_target: $(window),
                loader: $('.loader', parent)
            }
        });
        settings.ws.url = 'http://itunes.apple.com/search?media=movie&explicit=No&term=Tom+Cruise';
        target = $('.items', parent);
        lazy_loaders[target.attr('id')] = target.jsonlazyload(settings);
    };

    // Appends new items to the target.
    items_callback = function (lazy_loader, items) {
        var target, target_id;
        target = lazy_loader.target();
        target_id = target.attr('id');
        if (!movie_map.hasOwnProperty(target_id)) {
            movie_map[target_id] = [];
        }
        items.forEach(function (item) {
            var name = item.trackName;
            if (movie_map[target_id].hasOwnProperty(item.trackName)) {
                name += ' (itunes duplicate detected)';
            }
            movie_map[target_id][item.trackName] = true;

            $('.item-template article').clone()
                .find('img').attr('src', item.artworkUrl100).end()
                .find('h2').text(name).end()
                .find('time').text(new Date(item.releaseDate).toDateString()).end()
                .appendTo(target).hide().fadeIn('slow');
        });
    };

    // Helper function to copy 1 object to another.
    object_copy = function (o) {
        var p = {};
        Object.getOwnPropertyNames(o).forEach(function (prop) {
            if (typeof o[prop] === 'object') {
                p[prop] = object_copy(o[prop]);
            } else {
                p[prop] = o[prop];
            }
        });

        return p;
    };

    // These are the base settings for each lazy loader on this page.
    base_settings = {
        behavior: {
            ensure_scrollbar: true,
            fetch_amount: fetch_amount,
            fetch_immediate: true,
            initial_offset: 0,
            loader_delay: 250
        },
        results: {
            item_callback: items_callback,
            item_key: 'results'
        },
        ws: {
            data_type: 'jsonp',
            limit_param: 'limit',
            offset_param: 'offset'
        }
    };

    $(document).ready(function () {
        // When the Load button is clicked, fetch items for all lazy loaders.
        $('.button-container button').on('click', function () {
            var target_ids = Object.keys(lazy_loaders);
            target_ids.forEach(function (target_id) {
                var jsonlazyload = lazy_loaders[target_id].data('jsonlazyload');
                jsonlazyload.fetch_items(fetch_amount);
            });
        });

        // Create both of our lazy loaders through our helper functions.
        create_constrained_lazy_loader();
        create_window_lazy_loader();
    });
}(jQuery));