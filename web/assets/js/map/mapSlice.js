"use strict";
exports.__esModule = true;
exports.selectInitialViewAt = exports.selectViewAt = exports.selectTokens = exports.selectId = exports.flyTo = exports.maybeTimeoutInitialViewAt = exports.syncInitialViewAt = exports.reportViewAt = void 0;
var toolkit_1 = require("@reduxjs/toolkit");
var mapSlice = (0, toolkit_1.createSlice)({
    name: 'map',
    initialState: null,
    reducers: {
        reportViewAt: function (state, _a) {
            var payload = _a.payload;
            state.viewAt = payload;
        },
        syncInitialViewAt: function (state, _a) {
            var payload = _a.payload;
            if (state.initialViewAt === null) {
                console.warn('Rejecting initial view at as timed out');
            }
            else {
                state.initialViewAt = payload;
            }
        },
        maybeTimeoutInitialViewAt: function (state, _action) {
            if (state.initialViewAt === undefined) {
                console.warn('Timed out initial view at');
                state.initialViewAt = null;
            }
        }
    }
});
exports["default"] = mapSlice.reducer;
// Actions
var actions = mapSlice.actions;
exports.reportViewAt = actions.reportViewAt, exports.syncInitialViewAt = actions.syncInitialViewAt, exports.maybeTimeoutInitialViewAt = actions.maybeTimeoutInitialViewAt;
exports.flyTo = (0, toolkit_1.createAction)('map/flyTo', function (to, options) {
    if (options === void 0) { options = {}; }
    return ({
        payload: { to: to, options: options }
    });
});
// Selectors
var select = function (s) { return s.map; };
var selectId = function (s) { return select(s).id; };
exports.selectId = selectId;
var selectTokens = function (s) { return select(s).tokens; };
exports.selectTokens = selectTokens;
var selectViewAt = function (s) { return select(s).viewAt; };
exports.selectViewAt = selectViewAt;
var selectInitialViewAt = function (s) { return select(s).initialViewAt; };
exports.selectInitialViewAt = selectInitialViewAt;
