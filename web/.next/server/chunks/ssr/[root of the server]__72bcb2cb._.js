module.exports = {

"[externals]/next/dist/compiled/next-server/app-page.runtime.dev.js [external] (next/dist/compiled/next-server/app-page.runtime.dev.js, cjs)": (function(__turbopack_context__) {

var { g: global, __dirname, m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page.runtime.dev.js"));

module.exports = mod;
}}),
"[project]/app/box/page.tsx [app-ssr] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
__turbopack_context__.s({
    "default": (()=>ImageCropper)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$rnd$2f$lib$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react-rnd/lib/index.js [app-ssr] (ecmascript)");
"use client";
;
;
;
const ASPECT_RATIO = 4 / 5;
const BOX_COUNT = 3;
function ImageCropper({ imageSrc }) {
    const containerRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [imgDimensions, setImgDimensions] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])({
        width: 0,
        height: 0
    });
    const [boxes, setBoxes] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(Array.from({
        length: BOX_COUNT
    }, (_, i)=>({
            x: i * 120,
            y: 50,
            width: 120,
            height: 120 / ASPECT_RATIO
        })));
    const handleBoxChange = (index, data)=>{
        const newBoxes = [
            ...boxes
        ];
        newBoxes[index] = {
            ...newBoxes[index],
            ...data
        };
        setBoxes(newBoxes);
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "relative mt-4",
        ref: containerRef,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                src: imageSrc,
                alt: "Uploaded",
                onLoad: (e)=>{
                    const { width, height } = e.currentTarget;
                    setImgDimensions({
                        width,
                        height
                    });
                },
                style: {
                    width: "100%",
                    maxWidth: "800px"
                }
            }, void 0, false, {
                fileName: "[project]/app/box/page.tsx",
                lineNumber: 37,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute top-0 left-0",
                style: {
                    width: imgDimensions.width,
                    height: imgDimensions.height
                },
                children: boxes.map((box, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$rnd$2f$lib$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Rnd"], {
                        size: {
                            width: box.width,
                            height: box.height
                        },
                        position: {
                            x: box.x,
                            y: box.y
                        },
                        onDragStop: (_, d)=>handleBoxChange(i, {
                                x: d.x,
                                y: d.y
                            }),
                        onResizeStop: (_, __, ref, ___, pos)=>handleBoxChange(i, {
                                width: parseFloat(ref.style.width),
                                height: parseFloat(ref.style.height),
                                x: pos.x,
                                y: pos.y
                            }),
                        lockAspectRatio: ASPECT_RATIO,
                        bounds: "parent",
                        style: {
                            border: "2px solid red",
                            zIndex: 10,
                            position: "absolute"
                        }
                    }, i, false, {
                        fileName: "[project]/app/box/page.tsx",
                        lineNumber: 56,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/app/box/page.tsx",
                lineNumber: 48,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                className: "mt-4 px-4 py-2 bg-blue-500 text-white rounded",
                onClick: async ()=>{
                    const img = new Image();
                    img.src = imageSrc;
                    await img.decode();
                    boxes.forEach((box, i)=>{
                        const canvas = document.createElement("canvas");
                        const scaleX = img.naturalWidth / imgDimensions.width;
                        const scaleY = img.naturalHeight / imgDimensions.height;
                        canvas.width = box.width * scaleX;
                        canvas.height = box.height * scaleY;
                        const ctx = canvas.getContext("2d");
                        ctx.drawImage(img, box.x * scaleX, box.y * scaleY, box.width * scaleX, box.height * scaleY, 0, 0, canvas.width, canvas.height);
                        // Example: Show cropped canvas
                        const dataURL = canvas.toDataURL("image/png");
                        const preview = new Image();
                        preview.src = dataURL;
                        document.body.appendChild(preview);
                    });
                },
                children: "Crop Images"
            }, void 0, false, {
                fileName: "[project]/app/box/page.tsx",
                lineNumber: 81,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/box/page.tsx",
        lineNumber: 36,
        columnNumber: 5
    }, this);
}
}}),

};

//# sourceMappingURL=%5Broot%20of%20the%20server%5D__72bcb2cb._.js.map