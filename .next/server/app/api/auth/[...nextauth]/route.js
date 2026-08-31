"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "app/api/auth/[...nextauth]/route";
exports.ids = ["app/api/auth/[...nextauth]/route"];
exports.modules = {

/***/ "@prisma/client":
/*!*********************************!*\
  !*** external "@prisma/client" ***!
  \*********************************/
/***/ ((module) => {

module.exports = require("@prisma/client");

/***/ }),

/***/ "./action-async-storage.external":
/*!*******************************************************************************!*\
  !*** external "next/dist/client/components/action-async-storage.external.js" ***!
  \*******************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/client/components/action-async-storage.external.js");

/***/ }),

/***/ "./request-async-storage.external":
/*!********************************************************************************!*\
  !*** external "next/dist/client/components/request-async-storage.external.js" ***!
  \********************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/client/components/request-async-storage.external.js");

/***/ }),

/***/ "./static-generation-async-storage.external":
/*!******************************************************************************************!*\
  !*** external "next/dist/client/components/static-generation-async-storage.external.js" ***!
  \******************************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/client/components/static-generation-async-storage.external.js");

/***/ }),

/***/ "next/dist/compiled/next-server/app-page.runtime.dev.js":
/*!*************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-page.runtime.dev.js" ***!
  \*************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/compiled/next-server/app-page.runtime.dev.js");

/***/ }),

/***/ "next/dist/compiled/next-server/app-route.runtime.dev.js":
/*!**************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-route.runtime.dev.js" ***!
  \**************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/compiled/next-server/app-route.runtime.dev.js");

/***/ }),

/***/ "assert":
/*!*************************!*\
  !*** external "assert" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("assert");

/***/ }),

/***/ "buffer":
/*!*************************!*\
  !*** external "buffer" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("buffer");

/***/ }),

/***/ "crypto":
/*!*************************!*\
  !*** external "crypto" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("crypto");

/***/ }),

/***/ "events":
/*!*************************!*\
  !*** external "events" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("events");

/***/ }),

/***/ "http":
/*!***********************!*\
  !*** external "http" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("http");

/***/ }),

/***/ "https":
/*!************************!*\
  !*** external "https" ***!
  \************************/
/***/ ((module) => {

module.exports = require("https");

/***/ }),

/***/ "querystring":
/*!******************************!*\
  !*** external "querystring" ***!
  \******************************/
/***/ ((module) => {

module.exports = require("querystring");

/***/ }),

/***/ "url":
/*!**********************!*\
  !*** external "url" ***!
  \**********************/
/***/ ((module) => {

module.exports = require("url");

/***/ }),

/***/ "util":
/*!***********************!*\
  !*** external "util" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("util");

/***/ }),

/***/ "zlib":
/*!***********************!*\
  !*** external "zlib" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("zlib");

/***/ }),

/***/ "(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fauth%2F%5B...nextauth%5D%2Froute&page=%2Fapi%2Fauth%2F%5B...nextauth%5D%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fauth%2F%5B...nextauth%5D%2Froute.ts&appDir=C%3A%5CUsers%5COwaisShaikh%5CDownloads%5Csphaera-app%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5COwaisShaikh%5CDownloads%5Csphaera-app&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!":
/*!************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fauth%2F%5B...nextauth%5D%2Froute&page=%2Fapi%2Fauth%2F%5B...nextauth%5D%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fauth%2F%5B...nextauth%5D%2Froute.ts&appDir=C%3A%5CUsers%5COwaisShaikh%5CDownloads%5Csphaera-app%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5COwaisShaikh%5CDownloads%5Csphaera-app&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D! ***!
  \************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   originalPathname: () => (/* binding */ originalPathname),\n/* harmony export */   patchFetch: () => (/* binding */ patchFetch),\n/* harmony export */   requestAsyncStorage: () => (/* binding */ requestAsyncStorage),\n/* harmony export */   routeModule: () => (/* binding */ routeModule),\n/* harmony export */   serverHooks: () => (/* binding */ serverHooks),\n/* harmony export */   staticGenerationAsyncStorage: () => (/* binding */ staticGenerationAsyncStorage)\n/* harmony export */ });\n/* harmony import */ var next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/dist/server/future/route-modules/app-route/module.compiled */ \"(rsc)/./node_modules/next/dist/server/future/route-modules/app-route/module.compiled.js\");\n/* harmony import */ var next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var next_dist_server_future_route_kind__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! next/dist/server/future/route-kind */ \"(rsc)/./node_modules/next/dist/server/future/route-kind.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! next/dist/server/lib/patch-fetch */ \"(rsc)/./node_modules/next/dist/server/lib/patch-fetch.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var C_Users_OwaisShaikh_Downloads_sphaera_app_app_api_auth_nextauth_route_ts__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./app/api/auth/[...nextauth]/route.ts */ \"(rsc)/./app/api/auth/[...nextauth]/route.ts\");\n\n\n\n\n// We inject the nextConfigOutput here so that we can use them in the route\n// module.\nconst nextConfigOutput = \"\"\nconst routeModule = new next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__.AppRouteRouteModule({\n    definition: {\n        kind: next_dist_server_future_route_kind__WEBPACK_IMPORTED_MODULE_1__.RouteKind.APP_ROUTE,\n        page: \"/api/auth/[...nextauth]/route\",\n        pathname: \"/api/auth/[...nextauth]\",\n        filename: \"route\",\n        bundlePath: \"app/api/auth/[...nextauth]/route\"\n    },\n    resolvedPagePath: \"C:\\\\Users\\\\OwaisShaikh\\\\Downloads\\\\sphaera-app\\\\app\\\\api\\\\auth\\\\[...nextauth]\\\\route.ts\",\n    nextConfigOutput,\n    userland: C_Users_OwaisShaikh_Downloads_sphaera_app_app_api_auth_nextauth_route_ts__WEBPACK_IMPORTED_MODULE_3__\n});\n// Pull out the exports that we need to expose from the module. This should\n// be eliminated when we've moved the other routes to the new format. These\n// are used to hook into the route.\nconst { requestAsyncStorage, staticGenerationAsyncStorage, serverHooks } = routeModule;\nconst originalPathname = \"/api/auth/[...nextauth]/route\";\nfunction patchFetch() {\n    return (0,next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__.patchFetch)({\n        serverHooks,\n        staticGenerationAsyncStorage\n    });\n}\n\n\n//# sourceMappingURL=app-route.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvbmV4dC9kaXN0L2J1aWxkL3dlYnBhY2svbG9hZGVycy9uZXh0LWFwcC1sb2FkZXIuanM/bmFtZT1hcHAlMkZhcGklMkZhdXRoJTJGJTVCLi4ubmV4dGF1dGglNUQlMkZyb3V0ZSZwYWdlPSUyRmFwaSUyRmF1dGglMkYlNUIuLi5uZXh0YXV0aCU1RCUyRnJvdXRlJmFwcFBhdGhzPSZwYWdlUGF0aD1wcml2YXRlLW5leHQtYXBwLWRpciUyRmFwaSUyRmF1dGglMkYlNUIuLi5uZXh0YXV0aCU1RCUyRnJvdXRlLnRzJmFwcERpcj1DJTNBJTVDVXNlcnMlNUNPd2Fpc1NoYWlraCU1Q0Rvd25sb2FkcyU1Q3NwaGFlcmEtYXBwJTVDYXBwJnBhZ2VFeHRlbnNpb25zPXRzeCZwYWdlRXh0ZW5zaW9ucz10cyZwYWdlRXh0ZW5zaW9ucz1qc3gmcGFnZUV4dGVuc2lvbnM9anMmcm9vdERpcj1DJTNBJTVDVXNlcnMlNUNPd2Fpc1NoYWlraCU1Q0Rvd25sb2FkcyU1Q3NwaGFlcmEtYXBwJmlzRGV2PXRydWUmdHNjb25maWdQYXRoPXRzY29uZmlnLmpzb24mYmFzZVBhdGg9JmFzc2V0UHJlZml4PSZuZXh0Q29uZmlnT3V0cHV0PSZwcmVmZXJyZWRSZWdpb249Jm1pZGRsZXdhcmVDb25maWc9ZTMwJTNEISIsIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7QUFBc0c7QUFDdkM7QUFDYztBQUN1QztBQUNwSDtBQUNBO0FBQ0E7QUFDQSx3QkFBd0IsZ0hBQW1CO0FBQzNDO0FBQ0EsY0FBYyx5RUFBUztBQUN2QjtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBO0FBQ0EsWUFBWTtBQUNaLENBQUM7QUFDRDtBQUNBO0FBQ0E7QUFDQSxRQUFRLGlFQUFpRTtBQUN6RTtBQUNBO0FBQ0EsV0FBVyw0RUFBVztBQUN0QjtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ3VIOztBQUV2SCIsInNvdXJjZXMiOlsid2VicGFjazovL3NwaGFlcmEtYXBwLz9kNjU3Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFwcFJvdXRlUm91dGVNb2R1bGUgfSBmcm9tIFwibmV4dC9kaXN0L3NlcnZlci9mdXR1cmUvcm91dGUtbW9kdWxlcy9hcHAtcm91dGUvbW9kdWxlLmNvbXBpbGVkXCI7XG5pbXBvcnQgeyBSb3V0ZUtpbmQgfSBmcm9tIFwibmV4dC9kaXN0L3NlcnZlci9mdXR1cmUvcm91dGUta2luZFwiO1xuaW1wb3J0IHsgcGF0Y2hGZXRjaCBhcyBfcGF0Y2hGZXRjaCB9IGZyb20gXCJuZXh0L2Rpc3Qvc2VydmVyL2xpYi9wYXRjaC1mZXRjaFwiO1xuaW1wb3J0ICogYXMgdXNlcmxhbmQgZnJvbSBcIkM6XFxcXFVzZXJzXFxcXE93YWlzU2hhaWtoXFxcXERvd25sb2Fkc1xcXFxzcGhhZXJhLWFwcFxcXFxhcHBcXFxcYXBpXFxcXGF1dGhcXFxcWy4uLm5leHRhdXRoXVxcXFxyb3V0ZS50c1wiO1xuLy8gV2UgaW5qZWN0IHRoZSBuZXh0Q29uZmlnT3V0cHV0IGhlcmUgc28gdGhhdCB3ZSBjYW4gdXNlIHRoZW0gaW4gdGhlIHJvdXRlXG4vLyBtb2R1bGUuXG5jb25zdCBuZXh0Q29uZmlnT3V0cHV0ID0gXCJcIlxuY29uc3Qgcm91dGVNb2R1bGUgPSBuZXcgQXBwUm91dGVSb3V0ZU1vZHVsZSh7XG4gICAgZGVmaW5pdGlvbjoge1xuICAgICAgICBraW5kOiBSb3V0ZUtpbmQuQVBQX1JPVVRFLFxuICAgICAgICBwYWdlOiBcIi9hcGkvYXV0aC9bLi4ubmV4dGF1dGhdL3JvdXRlXCIsXG4gICAgICAgIHBhdGhuYW1lOiBcIi9hcGkvYXV0aC9bLi4ubmV4dGF1dGhdXCIsXG4gICAgICAgIGZpbGVuYW1lOiBcInJvdXRlXCIsXG4gICAgICAgIGJ1bmRsZVBhdGg6IFwiYXBwL2FwaS9hdXRoL1suLi5uZXh0YXV0aF0vcm91dGVcIlxuICAgIH0sXG4gICAgcmVzb2x2ZWRQYWdlUGF0aDogXCJDOlxcXFxVc2Vyc1xcXFxPd2Fpc1NoYWlraFxcXFxEb3dubG9hZHNcXFxcc3BoYWVyYS1hcHBcXFxcYXBwXFxcXGFwaVxcXFxhdXRoXFxcXFsuLi5uZXh0YXV0aF1cXFxccm91dGUudHNcIixcbiAgICBuZXh0Q29uZmlnT3V0cHV0LFxuICAgIHVzZXJsYW5kXG59KTtcbi8vIFB1bGwgb3V0IHRoZSBleHBvcnRzIHRoYXQgd2UgbmVlZCB0byBleHBvc2UgZnJvbSB0aGUgbW9kdWxlLiBUaGlzIHNob3VsZFxuLy8gYmUgZWxpbWluYXRlZCB3aGVuIHdlJ3ZlIG1vdmVkIHRoZSBvdGhlciByb3V0ZXMgdG8gdGhlIG5ldyBmb3JtYXQuIFRoZXNlXG4vLyBhcmUgdXNlZCB0byBob29rIGludG8gdGhlIHJvdXRlLlxuY29uc3QgeyByZXF1ZXN0QXN5bmNTdG9yYWdlLCBzdGF0aWNHZW5lcmF0aW9uQXN5bmNTdG9yYWdlLCBzZXJ2ZXJIb29rcyB9ID0gcm91dGVNb2R1bGU7XG5jb25zdCBvcmlnaW5hbFBhdGhuYW1lID0gXCIvYXBpL2F1dGgvWy4uLm5leHRhdXRoXS9yb3V0ZVwiO1xuZnVuY3Rpb24gcGF0Y2hGZXRjaCgpIHtcbiAgICByZXR1cm4gX3BhdGNoRmV0Y2goe1xuICAgICAgICBzZXJ2ZXJIb29rcyxcbiAgICAgICAgc3RhdGljR2VuZXJhdGlvbkFzeW5jU3RvcmFnZVxuICAgIH0pO1xufVxuZXhwb3J0IHsgcm91dGVNb2R1bGUsIHJlcXVlc3RBc3luY1N0b3JhZ2UsIHN0YXRpY0dlbmVyYXRpb25Bc3luY1N0b3JhZ2UsIHNlcnZlckhvb2tzLCBvcmlnaW5hbFBhdGhuYW1lLCBwYXRjaEZldGNoLCAgfTtcblxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9YXBwLXJvdXRlLmpzLm1hcCJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fauth%2F%5B...nextauth%5D%2Froute&page=%2Fapi%2Fauth%2F%5B...nextauth%5D%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fauth%2F%5B...nextauth%5D%2Froute.ts&appDir=C%3A%5CUsers%5COwaisShaikh%5CDownloads%5Csphaera-app%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5COwaisShaikh%5CDownloads%5Csphaera-app&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!\n");

/***/ }),

/***/ "(rsc)/./app/api/auth/[...nextauth]/route.ts":
/*!*********************************************!*\
  !*** ./app/api/auth/[...nextauth]/route.ts ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   GET: () => (/* binding */ handler),\n/* harmony export */   POST: () => (/* binding */ handler)\n/* harmony export */ });\n/* harmony import */ var next_auth__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next-auth */ \"(rsc)/./node_modules/next-auth/index.js\");\n/* harmony import */ var next_auth__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(next_auth__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var _lib_auth__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @/lib/auth */ \"(rsc)/./lib/auth.ts\");\n\n\nconst handler = next_auth__WEBPACK_IMPORTED_MODULE_0___default()(_lib_auth__WEBPACK_IMPORTED_MODULE_1__.authOptions);\n\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9hcHAvYXBpL2F1dGgvWy4uLm5leHRhdXRoXS9yb3V0ZS50cyIsIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUFpQztBQUNRO0FBRXpDLE1BQU1FLFVBQVVGLGdEQUFRQSxDQUFDQyxrREFBV0E7QUFFTyIsInNvdXJjZXMiOlsid2VicGFjazovL3NwaGFlcmEtYXBwLy4vYXBwL2FwaS9hdXRoL1suLi5uZXh0YXV0aF0vcm91dGUudHM/YzhhNCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgTmV4dEF1dGggZnJvbSBcIm5leHQtYXV0aFwiO1xuaW1wb3J0IHsgYXV0aE9wdGlvbnMgfSBmcm9tIFwiQC9saWIvYXV0aFwiO1xuXG5jb25zdCBoYW5kbGVyID0gTmV4dEF1dGgoYXV0aE9wdGlvbnMpO1xuXG5leHBvcnQgeyBoYW5kbGVyIGFzIEdFVCwgaGFuZGxlciBhcyBQT1NUIH07XG4iXSwibmFtZXMiOlsiTmV4dEF1dGgiLCJhdXRoT3B0aW9ucyIsImhhbmRsZXIiLCJHRVQiLCJQT1NUIl0sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(rsc)/./app/api/auth/[...nextauth]/route.ts\n");

/***/ }),

/***/ "(rsc)/./lib/auth.ts":
/*!*********************!*\
  !*** ./lib/auth.ts ***!
  \*********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   authOptions: () => (/* binding */ authOptions)\n/* harmony export */ });\n/* harmony import */ var next_auth_providers_azure_ad__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next-auth/providers/azure-ad */ \"(rsc)/./node_modules/next-auth/providers/azure-ad.js\");\n/* harmony import */ var _currentUser__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./currentUser */ \"(rsc)/./lib/currentUser.ts\");\n\n\n// Reads the three values you get from the Entra ID App Registration:\n// tenant ID, client (application) ID, and client secret.\n// See ENTRA_ID_SETUP.md for how to create these in the Azure portal.\n//\n// The `scope` here requests Microsoft Graph Mail + Calendar permissions\n// on top of standard sign-in scopes, so the access token we get back can\n// call Graph on the signed-in user's behalf (lib/graph.ts). These must\n// also be added + admin-consented under API permissions on the App\n// Registration in the Azure portal, or the token Microsoft issues won't\n// actually carry them.\n//\n// HARDENING NOTE: the temporary email/password Credentials provider that\n// existed during development has been removed. Microsoft Entra ID is now\n// the ONLY sign-in method, matching PRD PF01 (Entra ID is the sole\n// production auth method).\nconst GRAPH_SCOPES = \"openid profile email offline_access User.Read Mail.Read Mail.Send Calendars.ReadWrite\";\nasync function refreshAccessToken(token) {\n    try {\n        const url = `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`;\n        const response = await fetch(url, {\n            method: \"POST\",\n            headers: {\n                \"Content-Type\": \"application/x-www-form-urlencoded\"\n            },\n            body: new URLSearchParams({\n                client_id: process.env.AZURE_AD_CLIENT_ID,\n                client_secret: process.env.AZURE_AD_CLIENT_SECRET,\n                grant_type: \"refresh_token\",\n                refresh_token: token.refreshToken,\n                scope: GRAPH_SCOPES\n            })\n        });\n        const refreshed = await response.json();\n        if (!response.ok) throw refreshed;\n        return {\n            ...token,\n            accessToken: refreshed.access_token,\n            accessTokenExpires: Date.now() + refreshed.expires_in * 1000,\n            refreshToken: refreshed.refresh_token ?? token.refreshToken\n        };\n    } catch (err) {\n        console.error(\"Failed to refresh Graph access token:\", err);\n        return {\n            ...token,\n            graphError: \"RefreshAccessTokenError\"\n        };\n    }\n}\nconst authOptions = {\n    providers: [\n        (0,next_auth_providers_azure_ad__WEBPACK_IMPORTED_MODULE_0__[\"default\"])({\n            clientId: process.env.AZURE_AD_CLIENT_ID,\n            clientSecret: process.env.AZURE_AD_CLIENT_SECRET,\n            tenantId: process.env.AZURE_AD_TENANT_ID,\n            authorization: {\n                params: {\n                    scope: GRAPH_SCOPES\n                }\n            }\n        })\n    ],\n    session: {\n        strategy: \"jwt\"\n    },\n    pages: {\n        signIn: \"/sign-in\"\n    },\n    callbacks: {\n        // On sign-in, resolve (or create) the real database User row and cache\n        // its id/role/teamId onto the JWT, and capture the Graph\n        // access/refresh tokens. Refresh happens automatically here whenever\n        // the cached access token has expired.\n        async jwt ({ token, account, profile }) {\n            if (account) {\n                if (profile) {\n                    token.oid = profile.oid;\n                }\n                if (token.email) {\n                    const dbUser = await (0,_currentUser__WEBPACK_IMPORTED_MODULE_1__.getOrCreateUserByEmail)(token.email, token.name, token.oid);\n                    token.userId = dbUser.id;\n                    token.role = dbUser.role;\n                    token.teamId = dbUser.teamId;\n                }\n                token.accessToken = account.access_token;\n                token.refreshToken = account.refresh_token;\n                token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : undefined;\n                return token;\n            }\n            if (token.accessTokenExpires && Date.now() < token.accessTokenExpires) {\n                return token;\n            }\n            if (token.refreshToken) {\n                return refreshAccessToken(token);\n            }\n            return token;\n        },\n        async session ({ session, token }) {\n            if (session.user) {\n                session.user.oid = token.oid;\n                session.user.id = token.userId;\n                session.user.role = token.role;\n                session.user.teamId = token.teamId;\n            }\n            // NOTE (security trade-off, documented deliberately): the Graph\n            // access token is attached to `session` so both server components\n            // and our own API routes can call Microsoft Graph on the user's\n            // behalf via getServerSession(). Because NextAuth's built-in\n            // /api/auth/session route serializes whatever `session` returns,\n            // an already-authenticated user could see their OWN short-lived\n            // (~1hr) token via devtools — there is no cross-user exposure, and\n            // the token only grants Mail/Calendar access to that same user's\n            // own mailbox. The refresh token is deliberately NOT exposed here\n            // (kept only in the encrypted JWT) since it's longer-lived and more\n            // sensitive.\n            session.accessToken = token.accessToken;\n            session.graphError = token.graphError;\n            return session;\n        }\n    }\n};\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9saWIvYXV0aC50cyIsIm1hcHBpbmdzIjoiOzs7Ozs7QUFFMkQ7QUFDSjtBQUV2RCxxRUFBcUU7QUFDckUseURBQXlEO0FBQ3pELHFFQUFxRTtBQUNyRSxFQUFFO0FBQ0Ysd0VBQXdFO0FBQ3hFLHlFQUF5RTtBQUN6RSx1RUFBdUU7QUFDdkUsbUVBQW1FO0FBQ25FLHdFQUF3RTtBQUN4RSx1QkFBdUI7QUFDdkIsRUFBRTtBQUNGLHlFQUF5RTtBQUN6RSx5RUFBeUU7QUFDekUsbUVBQW1FO0FBQ25FLDJCQUEyQjtBQUMzQixNQUFNRSxlQUNKO0FBRUYsZUFBZUMsbUJBQW1CQyxLQUFVO0lBQzFDLElBQUk7UUFDRixNQUFNQyxNQUFNLENBQUMsa0NBQWtDLEVBQUVDLFFBQVFDLEdBQUcsQ0FBQ0Msa0JBQWtCLENBQUMsa0JBQWtCLENBQUM7UUFDbkcsTUFBTUMsV0FBVyxNQUFNQyxNQUFNTCxLQUFLO1lBQ2hDTSxRQUFRO1lBQ1JDLFNBQVM7Z0JBQUUsZ0JBQWdCO1lBQW9DO1lBQy9EQyxNQUFNLElBQUlDLGdCQUFnQjtnQkFDeEJDLFdBQVdULFFBQVFDLEdBQUcsQ0FBQ1Msa0JBQWtCO2dCQUN6Q0MsZUFBZVgsUUFBUUMsR0FBRyxDQUFDVyxzQkFBc0I7Z0JBQ2pEQyxZQUFZO2dCQUNaQyxlQUFlaEIsTUFBTWlCLFlBQVk7Z0JBQ2pDQyxPQUFPcEI7WUFDVDtRQUNGO1FBRUEsTUFBTXFCLFlBQVksTUFBTWQsU0FBU2UsSUFBSTtRQUNyQyxJQUFJLENBQUNmLFNBQVNnQixFQUFFLEVBQUUsTUFBTUY7UUFFeEIsT0FBTztZQUNMLEdBQUduQixLQUFLO1lBQ1JzQixhQUFhSCxVQUFVSSxZQUFZO1lBQ25DQyxvQkFBb0JDLEtBQUtDLEdBQUcsS0FBS1AsVUFBVVEsVUFBVSxHQUFHO1lBQ3hEVixjQUFjRSxVQUFVSCxhQUFhLElBQUloQixNQUFNaUIsWUFBWTtRQUM3RDtJQUNGLEVBQUUsT0FBT1csS0FBSztRQUNaQyxRQUFRQyxLQUFLLENBQUMseUNBQXlDRjtRQUN2RCxPQUFPO1lBQUUsR0FBRzVCLEtBQUs7WUFBRStCLFlBQVk7UUFBMEI7SUFDM0Q7QUFDRjtBQUVPLE1BQU1DLGNBQStCO0lBQzFDQyxXQUFXO1FBQ1RyQyx3RUFBZUEsQ0FBQztZQUNkc0MsVUFBVWhDLFFBQVFDLEdBQUcsQ0FBQ1Msa0JBQWtCO1lBQ3hDdUIsY0FBY2pDLFFBQVFDLEdBQUcsQ0FBQ1csc0JBQXNCO1lBQ2hEc0IsVUFBVWxDLFFBQVFDLEdBQUcsQ0FBQ0Msa0JBQWtCO1lBQ3hDaUMsZUFBZTtnQkFDYkMsUUFBUTtvQkFBRXBCLE9BQU9wQjtnQkFBYTtZQUNoQztRQUNGO0tBQ0Q7SUFDRHlDLFNBQVM7UUFDUEMsVUFBVTtJQUNaO0lBQ0FDLE9BQU87UUFDTEMsUUFBUTtJQUNWO0lBQ0FDLFdBQVc7UUFDVCx1RUFBdUU7UUFDdkUseURBQXlEO1FBQ3pELHFFQUFxRTtRQUNyRSx1Q0FBdUM7UUFDdkMsTUFBTUMsS0FBSSxFQUFFNUMsS0FBSyxFQUFFNkMsT0FBTyxFQUFFQyxPQUFPLEVBQUU7WUFDbkMsSUFBSUQsU0FBUztnQkFDWCxJQUFJQyxTQUFTO29CQUNYOUMsTUFBTStDLEdBQUcsR0FBRyxRQUE4QkEsR0FBRztnQkFDL0M7Z0JBQ0EsSUFBSS9DLE1BQU1nRCxLQUFLLEVBQUU7b0JBQ2YsTUFBTUMsU0FBUyxNQUFNcEQsb0VBQXNCQSxDQUN6Q0csTUFBTWdELEtBQUssRUFDWGhELE1BQU1rRCxJQUFJLEVBQ1ZsRCxNQUFNK0MsR0FBRztvQkFFWC9DLE1BQU1tRCxNQUFNLEdBQUdGLE9BQU9HLEVBQUU7b0JBQ3hCcEQsTUFBTXFELElBQUksR0FBR0osT0FBT0ksSUFBSTtvQkFDeEJyRCxNQUFNc0QsTUFBTSxHQUFHTCxPQUFPSyxNQUFNO2dCQUM5QjtnQkFFQXRELE1BQU1zQixXQUFXLEdBQUd1QixRQUFRdEIsWUFBWTtnQkFDeEN2QixNQUFNaUIsWUFBWSxHQUFHNEIsUUFBUTdCLGFBQWE7Z0JBQzFDaEIsTUFBTXdCLGtCQUFrQixHQUFHcUIsUUFBUVUsVUFBVSxHQUN6Q1YsUUFBUVUsVUFBVSxHQUFHLE9BQ3JCQztnQkFFSixPQUFPeEQ7WUFDVDtZQUVBLElBQ0VBLE1BQU13QixrQkFBa0IsSUFDeEJDLEtBQUtDLEdBQUcsS0FBTTFCLE1BQU13QixrQkFBa0IsRUFDdEM7Z0JBQ0EsT0FBT3hCO1lBQ1Q7WUFFQSxJQUFJQSxNQUFNaUIsWUFBWSxFQUFFO2dCQUN0QixPQUFPbEIsbUJBQW1CQztZQUM1QjtZQUVBLE9BQU9BO1FBQ1Q7UUFDQSxNQUFNdUMsU0FBUSxFQUFFQSxPQUFPLEVBQUV2QyxLQUFLLEVBQUU7WUFDOUIsSUFBSXVDLFFBQVFrQixJQUFJLEVBQUU7Z0JBQ2ZsQixRQUFRa0IsSUFBSSxDQUFzQlYsR0FBRyxHQUFHL0MsTUFBTStDLEdBQUc7Z0JBR2pEUixRQUFRa0IsSUFBSSxDQUFxQkwsRUFBRSxHQUFHcEQsTUFBTW1ELE1BQU07Z0JBR2xEWixRQUFRa0IsSUFBSSxDQUF1QkosSUFBSSxHQUFHckQsTUFBTXFELElBQUk7Z0JBR3BEZCxRQUFRa0IsSUFBSSxDQUFnQ0gsTUFBTSxHQUFHdEQsTUFBTXNELE1BQU07WUFJcEU7WUFFQSxnRUFBZ0U7WUFDaEUsa0VBQWtFO1lBQ2xFLGdFQUFnRTtZQUNoRSw2REFBNkQ7WUFDN0QsaUVBQWlFO1lBQ2pFLGdFQUFnRTtZQUNoRSxtRUFBbUU7WUFDbkUsaUVBQWlFO1lBQ2pFLGtFQUFrRTtZQUNsRSxvRUFBb0U7WUFDcEUsYUFBYTtZQUNaZixRQUFxQ2pCLFdBQVcsR0FBR3RCLE1BQU1zQixXQUFXO1lBR3BFaUIsUUFBb0NSLFVBQVUsR0FBRy9CLE1BQU0rQixVQUFVO1lBSWxFLE9BQU9RO1FBQ1Q7SUFDRjtBQUNGLEVBQUUiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9zcGhhZXJhLWFwcC8uL2xpYi9hdXRoLnRzP2JmN2UiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHR5cGUgeyBOZXh0QXV0aE9wdGlvbnMgfSBmcm9tIFwibmV4dC1hdXRoXCI7XG5pbXBvcnQgdHlwZSB7IEpXVCB9IGZyb20gXCJuZXh0LWF1dGgvand0XCI7XG5pbXBvcnQgQXp1cmVBRFByb3ZpZGVyIGZyb20gXCJuZXh0LWF1dGgvcHJvdmlkZXJzL2F6dXJlLWFkXCI7XG5pbXBvcnQgeyBnZXRPckNyZWF0ZVVzZXJCeUVtYWlsIH0gZnJvbSBcIi4vY3VycmVudFVzZXJcIjtcblxuLy8gUmVhZHMgdGhlIHRocmVlIHZhbHVlcyB5b3UgZ2V0IGZyb20gdGhlIEVudHJhIElEIEFwcCBSZWdpc3RyYXRpb246XG4vLyB0ZW5hbnQgSUQsIGNsaWVudCAoYXBwbGljYXRpb24pIElELCBhbmQgY2xpZW50IHNlY3JldC5cbi8vIFNlZSBFTlRSQV9JRF9TRVRVUC5tZCBmb3IgaG93IHRvIGNyZWF0ZSB0aGVzZSBpbiB0aGUgQXp1cmUgcG9ydGFsLlxuLy9cbi8vIFRoZSBgc2NvcGVgIGhlcmUgcmVxdWVzdHMgTWljcm9zb2Z0IEdyYXBoIE1haWwgKyBDYWxlbmRhciBwZXJtaXNzaW9uc1xuLy8gb24gdG9wIG9mIHN0YW5kYXJkIHNpZ24taW4gc2NvcGVzLCBzbyB0aGUgYWNjZXNzIHRva2VuIHdlIGdldCBiYWNrIGNhblxuLy8gY2FsbCBHcmFwaCBvbiB0aGUgc2lnbmVkLWluIHVzZXIncyBiZWhhbGYgKGxpYi9ncmFwaC50cykuIFRoZXNlIG11c3Rcbi8vIGFsc28gYmUgYWRkZWQgKyBhZG1pbi1jb25zZW50ZWQgdW5kZXIgQVBJIHBlcm1pc3Npb25zIG9uIHRoZSBBcHBcbi8vIFJlZ2lzdHJhdGlvbiBpbiB0aGUgQXp1cmUgcG9ydGFsLCBvciB0aGUgdG9rZW4gTWljcm9zb2Z0IGlzc3VlcyB3b24ndFxuLy8gYWN0dWFsbHkgY2FycnkgdGhlbS5cbi8vXG4vLyBIQVJERU5JTkcgTk9URTogdGhlIHRlbXBvcmFyeSBlbWFpbC9wYXNzd29yZCBDcmVkZW50aWFscyBwcm92aWRlciB0aGF0XG4vLyBleGlzdGVkIGR1cmluZyBkZXZlbG9wbWVudCBoYXMgYmVlbiByZW1vdmVkLiBNaWNyb3NvZnQgRW50cmEgSUQgaXMgbm93XG4vLyB0aGUgT05MWSBzaWduLWluIG1ldGhvZCwgbWF0Y2hpbmcgUFJEIFBGMDEgKEVudHJhIElEIGlzIHRoZSBzb2xlXG4vLyBwcm9kdWN0aW9uIGF1dGggbWV0aG9kKS5cbmNvbnN0IEdSQVBIX1NDT1BFUyA9XG4gIFwib3BlbmlkIHByb2ZpbGUgZW1haWwgb2ZmbGluZV9hY2Nlc3MgVXNlci5SZWFkIE1haWwuUmVhZCBNYWlsLlNlbmQgQ2FsZW5kYXJzLlJlYWRXcml0ZVwiO1xuXG5hc3luYyBmdW5jdGlvbiByZWZyZXNoQWNjZXNzVG9rZW4odG9rZW46IEpXVCk6IFByb21pc2U8SldUPiB7XG4gIHRyeSB7XG4gICAgY29uc3QgdXJsID0gYGh0dHBzOi8vbG9naW4ubWljcm9zb2Z0b25saW5lLmNvbS8ke3Byb2Nlc3MuZW52LkFaVVJFX0FEX1RFTkFOVF9JRH0vb2F1dGgyL3YyLjAvdG9rZW5gO1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsLCB7XG4gICAgICBtZXRob2Q6IFwiUE9TVFwiLFxuICAgICAgaGVhZGVyczogeyBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZFwiIH0sXG4gICAgICBib2R5OiBuZXcgVVJMU2VhcmNoUGFyYW1zKHtcbiAgICAgICAgY2xpZW50X2lkOiBwcm9jZXNzLmVudi5BWlVSRV9BRF9DTElFTlRfSUQgYXMgc3RyaW5nLFxuICAgICAgICBjbGllbnRfc2VjcmV0OiBwcm9jZXNzLmVudi5BWlVSRV9BRF9DTElFTlRfU0VDUkVUIGFzIHN0cmluZyxcbiAgICAgICAgZ3JhbnRfdHlwZTogXCJyZWZyZXNoX3Rva2VuXCIsXG4gICAgICAgIHJlZnJlc2hfdG9rZW46IHRva2VuLnJlZnJlc2hUb2tlbiBhcyBzdHJpbmcsXG4gICAgICAgIHNjb3BlOiBHUkFQSF9TQ09QRVMsXG4gICAgICB9KSxcbiAgICB9KTtcblxuICAgIGNvbnN0IHJlZnJlc2hlZCA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICBpZiAoIXJlc3BvbnNlLm9rKSB0aHJvdyByZWZyZXNoZWQ7XG5cbiAgICByZXR1cm4ge1xuICAgICAgLi4udG9rZW4sXG4gICAgICBhY2Nlc3NUb2tlbjogcmVmcmVzaGVkLmFjY2Vzc190b2tlbixcbiAgICAgIGFjY2Vzc1Rva2VuRXhwaXJlczogRGF0ZS5ub3coKSArIHJlZnJlc2hlZC5leHBpcmVzX2luICogMTAwMCxcbiAgICAgIHJlZnJlc2hUb2tlbjogcmVmcmVzaGVkLnJlZnJlc2hfdG9rZW4gPz8gdG9rZW4ucmVmcmVzaFRva2VuLFxuICAgIH07XG4gIH0gY2F0Y2ggKGVycikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJGYWlsZWQgdG8gcmVmcmVzaCBHcmFwaCBhY2Nlc3MgdG9rZW46XCIsIGVycik7XG4gICAgcmV0dXJuIHsgLi4udG9rZW4sIGdyYXBoRXJyb3I6IFwiUmVmcmVzaEFjY2Vzc1Rva2VuRXJyb3JcIiB9O1xuICB9XG59XG5cbmV4cG9ydCBjb25zdCBhdXRoT3B0aW9uczogTmV4dEF1dGhPcHRpb25zID0ge1xuICBwcm92aWRlcnM6IFtcbiAgICBBenVyZUFEUHJvdmlkZXIoe1xuICAgICAgY2xpZW50SWQ6IHByb2Nlc3MuZW52LkFaVVJFX0FEX0NMSUVOVF9JRCBhcyBzdHJpbmcsXG4gICAgICBjbGllbnRTZWNyZXQ6IHByb2Nlc3MuZW52LkFaVVJFX0FEX0NMSUVOVF9TRUNSRVQgYXMgc3RyaW5nLFxuICAgICAgdGVuYW50SWQ6IHByb2Nlc3MuZW52LkFaVVJFX0FEX1RFTkFOVF9JRCBhcyBzdHJpbmcsXG4gICAgICBhdXRob3JpemF0aW9uOiB7XG4gICAgICAgIHBhcmFtczogeyBzY29wZTogR1JBUEhfU0NPUEVTIH0sXG4gICAgICB9LFxuICAgIH0pLFxuICBdLFxuICBzZXNzaW9uOiB7XG4gICAgc3RyYXRlZ3k6IFwiand0XCIsXG4gIH0sXG4gIHBhZ2VzOiB7XG4gICAgc2lnbkluOiBcIi9zaWduLWluXCIsXG4gIH0sXG4gIGNhbGxiYWNrczoge1xuICAgIC8vIE9uIHNpZ24taW4sIHJlc29sdmUgKG9yIGNyZWF0ZSkgdGhlIHJlYWwgZGF0YWJhc2UgVXNlciByb3cgYW5kIGNhY2hlXG4gICAgLy8gaXRzIGlkL3JvbGUvdGVhbUlkIG9udG8gdGhlIEpXVCwgYW5kIGNhcHR1cmUgdGhlIEdyYXBoXG4gICAgLy8gYWNjZXNzL3JlZnJlc2ggdG9rZW5zLiBSZWZyZXNoIGhhcHBlbnMgYXV0b21hdGljYWxseSBoZXJlIHdoZW5ldmVyXG4gICAgLy8gdGhlIGNhY2hlZCBhY2Nlc3MgdG9rZW4gaGFzIGV4cGlyZWQuXG4gICAgYXN5bmMgand0KHsgdG9rZW4sIGFjY291bnQsIHByb2ZpbGUgfSkge1xuICAgICAgaWYgKGFjY291bnQpIHtcbiAgICAgICAgaWYgKHByb2ZpbGUpIHtcbiAgICAgICAgICB0b2tlbi5vaWQgPSAocHJvZmlsZSBhcyB7IG9pZD86IHN0cmluZyB9KS5vaWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRva2VuLmVtYWlsKSB7XG4gICAgICAgICAgY29uc3QgZGJVc2VyID0gYXdhaXQgZ2V0T3JDcmVhdGVVc2VyQnlFbWFpbChcbiAgICAgICAgICAgIHRva2VuLmVtYWlsLFxuICAgICAgICAgICAgdG9rZW4ubmFtZSxcbiAgICAgICAgICAgIHRva2VuLm9pZCBhcyBzdHJpbmcgfCB1bmRlZmluZWRcbiAgICAgICAgICApO1xuICAgICAgICAgIHRva2VuLnVzZXJJZCA9IGRiVXNlci5pZDtcbiAgICAgICAgICB0b2tlbi5yb2xlID0gZGJVc2VyLnJvbGUgYXMgXCJBR0VOVFwiIHwgXCJNQU5BR0VSXCIgfCBcIkFETUlOXCI7XG4gICAgICAgICAgdG9rZW4udGVhbUlkID0gZGJVc2VyLnRlYW1JZDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRva2VuLmFjY2Vzc1Rva2VuID0gYWNjb3VudC5hY2Nlc3NfdG9rZW47XG4gICAgICAgIHRva2VuLnJlZnJlc2hUb2tlbiA9IGFjY291bnQucmVmcmVzaF90b2tlbjtcbiAgICAgICAgdG9rZW4uYWNjZXNzVG9rZW5FeHBpcmVzID0gYWNjb3VudC5leHBpcmVzX2F0XG4gICAgICAgICAgPyBhY2NvdW50LmV4cGlyZXNfYXQgKiAxMDAwXG4gICAgICAgICAgOiB1bmRlZmluZWQ7XG5cbiAgICAgICAgcmV0dXJuIHRva2VuO1xuICAgICAgfVxuXG4gICAgICBpZiAoXG4gICAgICAgIHRva2VuLmFjY2Vzc1Rva2VuRXhwaXJlcyAmJlxuICAgICAgICBEYXRlLm5vdygpIDwgKHRva2VuLmFjY2Vzc1Rva2VuRXhwaXJlcyBhcyBudW1iZXIpXG4gICAgICApIHtcbiAgICAgICAgcmV0dXJuIHRva2VuO1xuICAgICAgfVxuXG4gICAgICBpZiAodG9rZW4ucmVmcmVzaFRva2VuKSB7XG4gICAgICAgIHJldHVybiByZWZyZXNoQWNjZXNzVG9rZW4odG9rZW4pO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdG9rZW47XG4gICAgfSxcbiAgICBhc3luYyBzZXNzaW9uKHsgc2Vzc2lvbiwgdG9rZW4gfSkge1xuICAgICAgaWYgKHNlc3Npb24udXNlcikge1xuICAgICAgICAoc2Vzc2lvbi51c2VyIGFzIHsgb2lkPzogc3RyaW5nIH0pLm9pZCA9IHRva2VuLm9pZCBhc1xuICAgICAgICAgIHwgc3RyaW5nXG4gICAgICAgICAgfCB1bmRlZmluZWQ7XG4gICAgICAgIChzZXNzaW9uLnVzZXIgYXMgeyBpZD86IHN0cmluZyB9KS5pZCA9IHRva2VuLnVzZXJJZCBhc1xuICAgICAgICAgIHwgc3RyaW5nXG4gICAgICAgICAgfCB1bmRlZmluZWQ7XG4gICAgICAgIChzZXNzaW9uLnVzZXIgYXMgeyByb2xlPzogc3RyaW5nIH0pLnJvbGUgPSB0b2tlbi5yb2xlIGFzXG4gICAgICAgICAgfCBzdHJpbmdcbiAgICAgICAgICB8IHVuZGVmaW5lZDtcbiAgICAgICAgKHNlc3Npb24udXNlciBhcyB7IHRlYW1JZD86IHN0cmluZyB8IG51bGwgfSkudGVhbUlkID0gdG9rZW4udGVhbUlkIGFzXG4gICAgICAgICAgfCBzdHJpbmdcbiAgICAgICAgICB8IG51bGxcbiAgICAgICAgICB8IHVuZGVmaW5lZDtcbiAgICAgIH1cblxuICAgICAgLy8gTk9URSAoc2VjdXJpdHkgdHJhZGUtb2ZmLCBkb2N1bWVudGVkIGRlbGliZXJhdGVseSk6IHRoZSBHcmFwaFxuICAgICAgLy8gYWNjZXNzIHRva2VuIGlzIGF0dGFjaGVkIHRvIGBzZXNzaW9uYCBzbyBib3RoIHNlcnZlciBjb21wb25lbnRzXG4gICAgICAvLyBhbmQgb3VyIG93biBBUEkgcm91dGVzIGNhbiBjYWxsIE1pY3Jvc29mdCBHcmFwaCBvbiB0aGUgdXNlcidzXG4gICAgICAvLyBiZWhhbGYgdmlhIGdldFNlcnZlclNlc3Npb24oKS4gQmVjYXVzZSBOZXh0QXV0aCdzIGJ1aWx0LWluXG4gICAgICAvLyAvYXBpL2F1dGgvc2Vzc2lvbiByb3V0ZSBzZXJpYWxpemVzIHdoYXRldmVyIGBzZXNzaW9uYCByZXR1cm5zLFxuICAgICAgLy8gYW4gYWxyZWFkeS1hdXRoZW50aWNhdGVkIHVzZXIgY291bGQgc2VlIHRoZWlyIE9XTiBzaG9ydC1saXZlZFxuICAgICAgLy8gKH4xaHIpIHRva2VuIHZpYSBkZXZ0b29scyDigJQgdGhlcmUgaXMgbm8gY3Jvc3MtdXNlciBleHBvc3VyZSwgYW5kXG4gICAgICAvLyB0aGUgdG9rZW4gb25seSBncmFudHMgTWFpbC9DYWxlbmRhciBhY2Nlc3MgdG8gdGhhdCBzYW1lIHVzZXInc1xuICAgICAgLy8gb3duIG1haWxib3guIFRoZSByZWZyZXNoIHRva2VuIGlzIGRlbGliZXJhdGVseSBOT1QgZXhwb3NlZCBoZXJlXG4gICAgICAvLyAoa2VwdCBvbmx5IGluIHRoZSBlbmNyeXB0ZWQgSldUKSBzaW5jZSBpdCdzIGxvbmdlci1saXZlZCBhbmQgbW9yZVxuICAgICAgLy8gc2Vuc2l0aXZlLlxuICAgICAgKHNlc3Npb24gYXMgeyBhY2Nlc3NUb2tlbj86IHN0cmluZyB9KS5hY2Nlc3NUb2tlbiA9IHRva2VuLmFjY2Vzc1Rva2VuIGFzXG4gICAgICAgIHwgc3RyaW5nXG4gICAgICAgIHwgdW5kZWZpbmVkO1xuICAgICAgKHNlc3Npb24gYXMgeyBncmFwaEVycm9yPzogc3RyaW5nIH0pLmdyYXBoRXJyb3IgPSB0b2tlbi5ncmFwaEVycm9yIGFzXG4gICAgICAgIHwgc3RyaW5nXG4gICAgICAgIHwgdW5kZWZpbmVkO1xuXG4gICAgICByZXR1cm4gc2Vzc2lvbjtcbiAgICB9LFxuICB9LFxufTsiXSwibmFtZXMiOlsiQXp1cmVBRFByb3ZpZGVyIiwiZ2V0T3JDcmVhdGVVc2VyQnlFbWFpbCIsIkdSQVBIX1NDT1BFUyIsInJlZnJlc2hBY2Nlc3NUb2tlbiIsInRva2VuIiwidXJsIiwicHJvY2VzcyIsImVudiIsIkFaVVJFX0FEX1RFTkFOVF9JRCIsInJlc3BvbnNlIiwiZmV0Y2giLCJtZXRob2QiLCJoZWFkZXJzIiwiYm9keSIsIlVSTFNlYXJjaFBhcmFtcyIsImNsaWVudF9pZCIsIkFaVVJFX0FEX0NMSUVOVF9JRCIsImNsaWVudF9zZWNyZXQiLCJBWlVSRV9BRF9DTElFTlRfU0VDUkVUIiwiZ3JhbnRfdHlwZSIsInJlZnJlc2hfdG9rZW4iLCJyZWZyZXNoVG9rZW4iLCJzY29wZSIsInJlZnJlc2hlZCIsImpzb24iLCJvayIsImFjY2Vzc1Rva2VuIiwiYWNjZXNzX3Rva2VuIiwiYWNjZXNzVG9rZW5FeHBpcmVzIiwiRGF0ZSIsIm5vdyIsImV4cGlyZXNfaW4iLCJlcnIiLCJjb25zb2xlIiwiZXJyb3IiLCJncmFwaEVycm9yIiwiYXV0aE9wdGlvbnMiLCJwcm92aWRlcnMiLCJjbGllbnRJZCIsImNsaWVudFNlY3JldCIsInRlbmFudElkIiwiYXV0aG9yaXphdGlvbiIsInBhcmFtcyIsInNlc3Npb24iLCJzdHJhdGVneSIsInBhZ2VzIiwic2lnbkluIiwiY2FsbGJhY2tzIiwiand0IiwiYWNjb3VudCIsInByb2ZpbGUiLCJvaWQiLCJlbWFpbCIsImRiVXNlciIsIm5hbWUiLCJ1c2VySWQiLCJpZCIsInJvbGUiLCJ0ZWFtSWQiLCJleHBpcmVzX2F0IiwidW5kZWZpbmVkIiwidXNlciJdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(rsc)/./lib/auth.ts\n");

/***/ }),

/***/ "(rsc)/./lib/currentUser.ts":
/*!****************************!*\
  !*** ./lib/currentUser.ts ***!
  \****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   getOrCreateCurrentUser: () => (/* binding */ getOrCreateCurrentUser),\n/* harmony export */   getOrCreateUserByEmail: () => (/* binding */ getOrCreateUserByEmail)\n/* harmony export */ });\n/* harmony import */ var _prisma__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./prisma */ \"(rsc)/./lib/prisma.ts\");\n\n// Core lookup/creation logic, usable both from server components (which\n// have a full Session) and from the NextAuth jwt callback (which only has\n// email/name/oid, not a full Session object) — see lib/auth.ts.\nasync function getOrCreateUserByEmail(email, name, entraId) {\n    const existing = await _prisma__WEBPACK_IMPORTED_MODULE_0__.prisma.user.findUnique({\n        where: {\n            email\n        }\n    });\n    if (existing) return existing;\n    const user = await _prisma__WEBPACK_IMPORTED_MODULE_0__.prisma.user.create({\n        data: {\n            email,\n            name: name ?? email.split(\"@\")[0],\n            entraId: entraId ?? undefined,\n            pointEvents: {\n                create: [\n                    {\n                        label: \"Welcome bonus — account created\",\n                        points: 25\n                    }\n                ]\n            },\n            badges: {\n                create: [\n                    {\n                        name: \"Getting Started\",\n                        description: \"Signed in to Sphaera for the first time\"\n                    }\n                ]\n            },\n            streaks: {\n                create: [\n                    {\n                        label: \"Daily mission completion\",\n                        currentCount: 0,\n                        resetRule: \"Resets at midnight if the day's mission isn't completed\"\n                    }\n                ]\n            }\n        }\n    });\n    return user;\n}\nasync function getOrCreateCurrentUser(session) {\n    const email = session.user?.email;\n    if (!email) {\n        throw new Error(\"Session has no email — cannot resolve a User row\");\n    }\n    const entraId = session.user?.oid;\n    return getOrCreateUserByEmail(email, session.user?.name, entraId);\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9saWIvY3VycmVudFVzZXIudHMiLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQ2tDO0FBRWxDLHdFQUF3RTtBQUN4RSwwRUFBMEU7QUFDMUUsZ0VBQWdFO0FBQ3pELGVBQWVDLHVCQUNwQkMsS0FBYSxFQUNiQyxJQUFvQixFQUNwQkMsT0FBdUI7SUFFdkIsTUFBTUMsV0FBVyxNQUFNTCwyQ0FBTUEsQ0FBQ00sSUFBSSxDQUFDQyxVQUFVLENBQUM7UUFBRUMsT0FBTztZQUFFTjtRQUFNO0lBQUU7SUFDakUsSUFBSUcsVUFBVSxPQUFPQTtJQUVyQixNQUFNQyxPQUFPLE1BQU1OLDJDQUFNQSxDQUFDTSxJQUFJLENBQUNHLE1BQU0sQ0FBQztRQUNwQ0MsTUFBTTtZQUNKUjtZQUNBQyxNQUFNQSxRQUFRRCxNQUFNUyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDakNQLFNBQVNBLFdBQVdRO1lBQ3BCQyxhQUFhO2dCQUNYSixRQUFRO29CQUFDO3dCQUFFSyxPQUFPO3dCQUFtQ0MsUUFBUTtvQkFBRztpQkFBRTtZQUNwRTtZQUNBQyxRQUFRO2dCQUNOUCxRQUFRO29CQUNOO3dCQUNFTixNQUFNO3dCQUNOYyxhQUFhO29CQUNmO2lCQUNEO1lBQ0g7WUFDQUMsU0FBUztnQkFDUFQsUUFBUTtvQkFDTjt3QkFDRUssT0FBTzt3QkFDUEssY0FBYzt3QkFDZEMsV0FDRTtvQkFDSjtpQkFDRDtZQUNIO1FBQ0Y7SUFDRjtJQUVBLE9BQU9kO0FBQ1Q7QUFFTyxlQUFlZSx1QkFBdUJDLE9BQWdCO0lBQzNELE1BQU1wQixRQUFRb0IsUUFBUWhCLElBQUksRUFBRUo7SUFDNUIsSUFBSSxDQUFDQSxPQUFPO1FBQ1YsTUFBTSxJQUFJcUIsTUFBTTtJQUNsQjtJQUNBLE1BQU1uQixVQUFXa0IsUUFBUWhCLElBQUksRUFBbUNrQjtJQUNoRSxPQUFPdkIsdUJBQXVCQyxPQUFPb0IsUUFBUWhCLElBQUksRUFBRUgsTUFBTUM7QUFDM0QiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9zcGhhZXJhLWFwcC8uL2xpYi9jdXJyZW50VXNlci50cz83Yjk4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB0eXBlIHsgU2Vzc2lvbiB9IGZyb20gXCJuZXh0LWF1dGhcIjtcclxuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSBcIi4vcHJpc21hXCI7XHJcblxyXG4vLyBDb3JlIGxvb2t1cC9jcmVhdGlvbiBsb2dpYywgdXNhYmxlIGJvdGggZnJvbSBzZXJ2ZXIgY29tcG9uZW50cyAod2hpY2hcclxuLy8gaGF2ZSBhIGZ1bGwgU2Vzc2lvbikgYW5kIGZyb20gdGhlIE5leHRBdXRoIGp3dCBjYWxsYmFjayAod2hpY2ggb25seSBoYXNcclxuLy8gZW1haWwvbmFtZS9vaWQsIG5vdCBhIGZ1bGwgU2Vzc2lvbiBvYmplY3QpIOKAlCBzZWUgbGliL2F1dGgudHMuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRPckNyZWF0ZVVzZXJCeUVtYWlsKFxyXG4gIGVtYWlsOiBzdHJpbmcsXHJcbiAgbmFtZT86IHN0cmluZyB8IG51bGwsXHJcbiAgZW50cmFJZD86IHN0cmluZyB8IG51bGxcclxuKSB7XHJcbiAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHsgd2hlcmU6IHsgZW1haWwgfSB9KTtcclxuICBpZiAoZXhpc3RpbmcpIHJldHVybiBleGlzdGluZztcclxuXHJcbiAgY29uc3QgdXNlciA9IGF3YWl0IHByaXNtYS51c2VyLmNyZWF0ZSh7XHJcbiAgICBkYXRhOiB7XHJcbiAgICAgIGVtYWlsLFxyXG4gICAgICBuYW1lOiBuYW1lID8/IGVtYWlsLnNwbGl0KFwiQFwiKVswXSxcclxuICAgICAgZW50cmFJZDogZW50cmFJZCA/PyB1bmRlZmluZWQsXHJcbiAgICAgIHBvaW50RXZlbnRzOiB7XHJcbiAgICAgICAgY3JlYXRlOiBbeyBsYWJlbDogXCJXZWxjb21lIGJvbnVzIOKAlCBhY2NvdW50IGNyZWF0ZWRcIiwgcG9pbnRzOiAyNSB9XSxcclxuICAgICAgfSxcclxuICAgICAgYmFkZ2VzOiB7XHJcbiAgICAgICAgY3JlYXRlOiBbXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIG5hbWU6IFwiR2V0dGluZyBTdGFydGVkXCIsXHJcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIlNpZ25lZCBpbiB0byBTcGhhZXJhIGZvciB0aGUgZmlyc3QgdGltZVwiLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICBdLFxyXG4gICAgICB9LFxyXG4gICAgICBzdHJlYWtzOiB7XHJcbiAgICAgICAgY3JlYXRlOiBbXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIGxhYmVsOiBcIkRhaWx5IG1pc3Npb24gY29tcGxldGlvblwiLFxyXG4gICAgICAgICAgICBjdXJyZW50Q291bnQ6IDAsXHJcbiAgICAgICAgICAgIHJlc2V0UnVsZTpcclxuICAgICAgICAgICAgICBcIlJlc2V0cyBhdCBtaWRuaWdodCBpZiB0aGUgZGF5J3MgbWlzc2lvbiBpc24ndCBjb21wbGV0ZWRcIixcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgXSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgfSk7XHJcblxyXG4gIHJldHVybiB1c2VyO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0T3JDcmVhdGVDdXJyZW50VXNlcihzZXNzaW9uOiBTZXNzaW9uKSB7XHJcbiAgY29uc3QgZW1haWwgPSBzZXNzaW9uLnVzZXI/LmVtYWlsO1xyXG4gIGlmICghZW1haWwpIHtcclxuICAgIHRocm93IG5ldyBFcnJvcihcIlNlc3Npb24gaGFzIG5vIGVtYWlsIOKAlCBjYW5ub3QgcmVzb2x2ZSBhIFVzZXIgcm93XCIpO1xyXG4gIH1cclxuICBjb25zdCBlbnRyYUlkID0gKHNlc3Npb24udXNlciBhcyB7IG9pZD86IHN0cmluZyB9IHwgdW5kZWZpbmVkKT8ub2lkO1xyXG4gIHJldHVybiBnZXRPckNyZWF0ZVVzZXJCeUVtYWlsKGVtYWlsLCBzZXNzaW9uLnVzZXI/Lm5hbWUsIGVudHJhSWQpO1xyXG59Il0sIm5hbWVzIjpbInByaXNtYSIsImdldE9yQ3JlYXRlVXNlckJ5RW1haWwiLCJlbWFpbCIsIm5hbWUiLCJlbnRyYUlkIiwiZXhpc3RpbmciLCJ1c2VyIiwiZmluZFVuaXF1ZSIsIndoZXJlIiwiY3JlYXRlIiwiZGF0YSIsInNwbGl0IiwidW5kZWZpbmVkIiwicG9pbnRFdmVudHMiLCJsYWJlbCIsInBvaW50cyIsImJhZGdlcyIsImRlc2NyaXB0aW9uIiwic3RyZWFrcyIsImN1cnJlbnRDb3VudCIsInJlc2V0UnVsZSIsImdldE9yQ3JlYXRlQ3VycmVudFVzZXIiLCJzZXNzaW9uIiwiRXJyb3IiLCJvaWQiXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./lib/currentUser.ts\n");

/***/ }),

/***/ "(rsc)/./lib/prisma.ts":
/*!***********************!*\
  !*** ./lib/prisma.ts ***!
  \***********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   prisma: () => (/* binding */ prisma)\n/* harmony export */ });\n/* harmony import */ var _prisma_client__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @prisma/client */ \"@prisma/client\");\n/* harmony import */ var _prisma_client__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_prisma_client__WEBPACK_IMPORTED_MODULE_0__);\n\n// Standard Next.js singleton pattern — prevents creating a new PrismaClient\n// (and new DB connection pool) on every hot-reload in development.\nconst globalForPrisma = globalThis;\nconst prisma = globalForPrisma.prisma ?? new _prisma_client__WEBPACK_IMPORTED_MODULE_0__.PrismaClient();\nif (true) {\n    globalForPrisma.prisma = prisma;\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9saWIvcHJpc21hLnRzIiwibWFwcGluZ3MiOiI7Ozs7OztBQUE4QztBQUU5Qyw0RUFBNEU7QUFDNUUsbUVBQW1FO0FBQ25FLE1BQU1DLGtCQUFrQkM7QUFFakIsTUFBTUMsU0FBU0YsZ0JBQWdCRSxNQUFNLElBQUksSUFBSUgsd0RBQVlBLEdBQUc7QUFFbkUsSUFBSUksSUFBcUMsRUFBRTtJQUN6Q0gsZ0JBQWdCRSxNQUFNLEdBQUdBO0FBQzNCIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vc3BoYWVyYS1hcHAvLi9saWIvcHJpc21hLnRzPzk4MjIiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgUHJpc21hQ2xpZW50IH0gZnJvbSBcIkBwcmlzbWEvY2xpZW50XCI7XHJcblxyXG4vLyBTdGFuZGFyZCBOZXh0LmpzIHNpbmdsZXRvbiBwYXR0ZXJuIOKAlCBwcmV2ZW50cyBjcmVhdGluZyBhIG5ldyBQcmlzbWFDbGllbnRcclxuLy8gKGFuZCBuZXcgREIgY29ubmVjdGlvbiBwb29sKSBvbiBldmVyeSBob3QtcmVsb2FkIGluIGRldmVsb3BtZW50LlxyXG5jb25zdCBnbG9iYWxGb3JQcmlzbWEgPSBnbG9iYWxUaGlzIGFzIHVua25vd24gYXMgeyBwcmlzbWE/OiBQcmlzbWFDbGllbnQgfTtcclxuXHJcbmV4cG9ydCBjb25zdCBwcmlzbWEgPSBnbG9iYWxGb3JQcmlzbWEucHJpc21hID8/IG5ldyBQcmlzbWFDbGllbnQoKTtcclxuXHJcbmlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gXCJwcm9kdWN0aW9uXCIpIHtcclxuICBnbG9iYWxGb3JQcmlzbWEucHJpc21hID0gcHJpc21hO1xyXG59Il0sIm5hbWVzIjpbIlByaXNtYUNsaWVudCIsImdsb2JhbEZvclByaXNtYSIsImdsb2JhbFRoaXMiLCJwcmlzbWEiLCJwcm9jZXNzIl0sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(rsc)/./lib/prisma.ts\n");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, ["vendor-chunks/next","vendor-chunks/next-auth","vendor-chunks/@babel","vendor-chunks/jose","vendor-chunks/openid-client","vendor-chunks/oauth","vendor-chunks/preact","vendor-chunks/uuid","vendor-chunks/yallist","vendor-chunks/preact-render-to-string","vendor-chunks/cookie","vendor-chunks/oidc-token-hash","vendor-chunks/@panva"], () => (__webpack_exec__("(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fauth%2F%5B...nextauth%5D%2Froute&page=%2Fapi%2Fauth%2F%5B...nextauth%5D%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fauth%2F%5B...nextauth%5D%2Froute.ts&appDir=C%3A%5CUsers%5COwaisShaikh%5CDownloads%5Csphaera-app%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5COwaisShaikh%5CDownloads%5Csphaera-app&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!")));
module.exports = __webpack_exports__;

})();