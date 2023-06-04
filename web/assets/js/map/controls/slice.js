"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.selectGeolocation = exports.exitFullscreen = exports.requestFullscreen = exports.zoomOut = exports.zoomIn = exports.requestGeolocation = exports.clearGeolocation = void 0;
var toolkit_1 = require("@reduxjs/toolkit");
var slice_1 = require("../flash/slice");
var mapSlice_1 = require("../mapSlice");
var listener_1 = require("../store/listener");
var initialState = {
    geolocation: {
        updating: false
    }
};
var slice = (0, toolkit_1.createSlice)({
    name: 'controls',
    initialState: initialState,
    reducers: {
        setGeolocation: function (state, _a) {
            var payload = _a.payload;
            state.geolocation = payload;
        },
        clearGeolocation: function (state, _action) {
            state.geolocation = { updating: false };
        }
    }
});
exports["default"] = slice.reducer;
var actions = slice.actions;
exports.clearGeolocation = actions.clearGeolocation;
exports.requestGeolocation = (0, toolkit_1.createAction)('controls/requestGeolocation');
exports.zoomIn = (0, toolkit_1.createAction)('controls/zoomIn');
exports.zoomOut = (0, toolkit_1.createAction)('controls/zoomOut');
exports.requestFullscreen = (0, toolkit_1.createAction)('controls/requestFullscreen'); // Requires transient user activation
exports.exitFullscreen = (0, toolkit_1.createAction)('controls/exitFullscreen');
var selectGeolocation = function (state) {
    return state.controls.geolocation;
};
exports.selectGeolocation = selectGeolocation;
(0, listener_1.startListening)({
    actionCreator: exports.zoomIn,
    effect: function (_action, l) {
        var current = (0, mapSlice_1.selectViewAt)(l.getState());
        if (!current)
            return;
        l.dispatch((0, mapSlice_1.flyTo)({ zoom: Math.round(current.zoom + 1) }));
    }
});
(0, listener_1.startListening)({
    actionCreator: exports.zoomOut,
    effect: function (_action, l) {
        var current = (0, mapSlice_1.selectViewAt)(l.getState());
        if (!current)
            return;
        l.dispatch((0, mapSlice_1.flyTo)({ zoom: Math.round(current.zoom - 1) }));
    }
});
(0, listener_1.startListening)({
    actionCreator: exports.requestFullscreen,
    effect: function (_action, l) { return __awaiter(void 0, void 0, void 0, function () {
        var e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (document.fullscreenElement) {
                        console.info('Suppressing requestFullscreen as already fullscreen');
                        return [2 /*return*/];
                    }
                    if (!document.fullscreenEnabled) {
                        l.dispatch((0, slice_1.flash)({
                            kind: 'error',
                            title: 'Fullscreen disabled',
                            body: 'Your browser indicated fullscreen is disabled'
                        }));
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, window.appNode.requestFullscreen({ navigationUI: 'hide' })];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    e_1 = _a.sent();
                    if (e_1 instanceof TypeError) {
                        l.dispatch((0, slice_1.flash)({
                            kind: 'error',
                            title: 'Error',
                            body: 'Your browser refused to enter fullscreen mode'
                        }));
                    }
                    else {
                        throw e_1;
                    }
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); }
});
(0, listener_1.startListening)({
    actionCreator: exports.exitFullscreen,
    effect: function (_action, _l) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!document.fullscreenElement) {
                        console.info('Suppressing exitFullscreen as not fullscreen');
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, document.exitFullscreen()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); }
});
(0, listener_1.startListening)({
    matcher: (0, toolkit_1.isAnyOf)(exports.requestGeolocation, exports.clearGeolocation),
    effect: function (action, l) { return __awaiter(void 0, void 0, void 0, function () {
        var prev, result, _a, accuracy, latitude, longitude, position, err;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (action.type === exports.clearGeolocation.type) {
                        l.cancelActiveListeners();
                        return [2 /*return*/];
                    }
                    prev = (0, exports.selectGeolocation)(l.getState());
                    l.dispatch(actions.setGeolocation({
                        updating: true,
                        value: prev.value
                    }));
                    return [4 /*yield*/, l.fork(function (_f) {
                            return new Promise(function (res, rej) {
                                navigator.geolocation.getCurrentPosition(res, rej, {
                                    maximumAge: 1000 * 60 * 60 * 24 * 7,
                                    timeout: 1000 * 10,
                                    enableHighAccuracy: true
                                });
                            });
                        }).result];
                case 1:
                    result = _b.sent();
                    if (result.status === 'ok') {
                        _a = result.value.coords, accuracy = _a.accuracy, latitude = _a.latitude, longitude = _a.longitude;
                        position = [longitude, latitude];
                        l.dispatch(actions.setGeolocation({
                            updating: false,
                            value: { accuracy: accuracy, position: position }
                        }));
                        l.dispatch((0, mapSlice_1.flyTo)({ center: position }, { ignoreIfCenterVisible: true }));
                    }
                    else if (result.status === 'cancelled') {
                        // We received clearGeolocation
                        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                    }
                    else if (result.status === 'rejected') {
                        err = result.error;
                        if (!(err instanceof GeolocationPositionError)) {
                            throw err;
                        }
                        l.dispatch(actions.setGeolocation({ updating: false, value: undefined }));
                        if (err.code === GeolocationPositionError.PERMISSION_DENIED) {
                            l.dispatch((0, slice_1.flash)({
                                kind: 'error',
                                title: 'Location permission denied'
                            }));
                        }
                        else if (err.code === GeolocationPositionError.POSITION_UNAVAILABLE ||
                            err.code === GeolocationPositionError.TIMEOUT) {
                            l.dispatch((0, slice_1.flash)({
                                kind: 'error',
                                title: 'Location unavailable'
                            }));
                        }
                        else {
                            throw new Error("Unexpected GeolocationPositionError code: ".concat(err.code, " msg: ").concat(err.message));
                        }
                    }
                    return [2 /*return*/];
            }
        });
    }); }
});
