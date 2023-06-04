"use strict";
exports.__esModule = true;
exports.initStore = void 0;
var toolkit_1 = require("@reduxjs/toolkit");
var slice_1 = require("../flash/slice");
var mapSlice_1 = require("../mapSlice");
var slice_2 = require("../controls/slice");
var slice_3 = require("../sidebar/slice");
var listener_1 = require("./listener");
var initStore = function (initState) {
    return (0, toolkit_1.configureStore)({
        reducer: {
            map: mapSlice_1["default"],
            controls: slice_2["default"],
            flash: slice_1["default"],
            sidebar: slice_3["default"]
        },
        middleware: function (getDefault) { return getDefault().prepend(listener_1.middleware); },
        preloadedState: {
            map: {
                id: initState.id,
                tokens: initState.tokens
            }
        }
    });
};
exports.initStore = initStore;
