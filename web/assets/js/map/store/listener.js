"use strict";
exports.__esModule = true;
exports.stopListening = exports.startListening = exports.middleware = void 0;
var toolkit_1 = require("@reduxjs/toolkit");
var listener = (0, toolkit_1.createListenerMiddleware)();
exports.middleware = listener.middleware;
exports.startListening = listener.startListening;
exports.stopListening = listener.stopListening;
