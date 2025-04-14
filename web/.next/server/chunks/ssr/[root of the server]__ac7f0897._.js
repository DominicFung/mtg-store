module.exports = {

"[externals]/next/dist/compiled/next-server/app-page.runtime.dev.js [external] (next/dist/compiled/next-server/app-page.runtime.dev.js, cjs)": (function(__turbopack_context__) {

var { g: global, __dirname, m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page.runtime.dev.js"));

module.exports = mod;
}}),
"[externals]/stream [external] (stream, cjs)": (function(__turbopack_context__) {

var { g: global, __dirname, m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("stream", () => require("stream"));

module.exports = mod;
}}),
"[externals]/events [external] (events, cjs)": (function(__turbopack_context__) {

var { g: global, __dirname, m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("events", () => require("events"));

module.exports = mod;
}}),
"[externals]/buffer [external] (buffer, cjs)": (function(__turbopack_context__) {

var { g: global, __dirname, m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("buffer", () => require("buffer"));

module.exports = mod;
}}),
"[externals]/util [external] (util, cjs)": (function(__turbopack_context__) {

var { g: global, __dirname, m: module, e: exports } = __turbopack_context__;
{
const mod = __turbopack_context__.x("util", () => require("util"));

module.exports = mod;
}}),
"[project]/app/box/imageCropper.tsx [app-ssr] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
__turbopack_context__.s({
    "default": (()=>GroupedCropBoxes)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$rnd$2f$lib$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react-rnd/lib/index.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jszip$2f$lib$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/jszip/lib/index.js [app-ssr] (ecmascript)");
;
;
;
;
const BOX_WIDTHS = [
    293,
    255,
    293
];
const ORIGINAL_HEIGHT = 326;
const TOTAL_ORIGINAL_WIDTH = BOX_WIDTHS.reduce((a, b)=>a + b, 0);
const GAP = 10;
function GroupedCropBoxes({ imageSrc, setCrops }) {
    const [imgDimensions, setImgDimensions] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])({
        width: 0,
        height: 0
    });
    const [groupBox, setGroupBox] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])({
        x: 0,
        y: 0,
        width: 0,
        height: 0
    });
    const [croppedImages, setCroppedImages] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const calculateFittingSize = (imgW, imgH)=>{
        const scaleX = imgW / TOTAL_ORIGINAL_WIDTH;
        const scaleY = imgH / ORIGINAL_HEIGHT;
        const scale = Math.min(scaleX, scaleY);
        const width = TOTAL_ORIGINAL_WIDTH * scale;
        const height = ORIGINAL_HEIGHT * scale;
        const x = (imgW - width) / 2;
        const y = (imgH - height) / 2;
        return {
            x,
            y,
            width,
            height
        };
    };
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (imgDimensions.width && imgDimensions.height) {
            const initialBox = calculateFittingSize(imgDimensions.width, imgDimensions.height);
            setGroupBox(initialBox);
        }
    }, [
        imgDimensions
    ]);
    const handleCropAndDownload = async ()=>{
        const img = new Image();
        img.src = imageSrc;
        await img.decode();
        const scaleX = img.naturalWidth / imgDimensions.width;
        const scaleY = img.naturalHeight / imgDimensions.height;
        let xOffset = 0;
        const previews = [];
        const zip = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jszip$2f$lib$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"]();
        let crops = [
            "",
            "",
            ""
        ];
        for(let i = 0; i < 3; i++){
            const widthRatio = BOX_WIDTHS[i] / TOTAL_ORIGINAL_WIDTH;
            const boxWidth = groupBox.width * widthRatio;
            const canvas = document.createElement("canvas");
            canvas.width = boxWidth * scaleX;
            canvas.height = groupBox.height * scaleY;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, (groupBox.x + xOffset) * scaleX, groupBox.y * scaleY, boxWidth * scaleX, groupBox.height * scaleY, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/png");
            previews.push(dataUrl);
            // Add to ZIP
            const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
            zip.file(`crop-${i + 1}.png`, base64Data, {
                base64: true
            });
            // add to cropped images
            crops[i] = dataUrl;
            xOffset += boxWidth;
        }
        setCroppedImages(previews);
        setCrops(crops);
        //Generate and download ZIP
        const content = await zip.generateAsync({
            type: "blob"
        });
        const zipUrl = URL.createObjectURL(content);
        const link = document.createElement("a");
        link.href = zipUrl;
        link.download = "cropped-images.zip";
        link.click();
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "relative mt-4",
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
                fileName: "[project]/app/box/imageCropper.tsx",
                lineNumber: 104,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute top-0 left-0",
                style: {
                    width: imgDimensions.width,
                    height: imgDimensions.height
                },
                children: groupBox.width > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$rnd$2f$lib$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Rnd"], {
                    size: {
                        width: groupBox.width,
                        height: groupBox.height
                    },
                    position: {
                        x: groupBox.x,
                        y: groupBox.y
                    },
                    onDragStop: (_, d)=>{
                        const maxX = imgDimensions.width - groupBox.width;
                        const maxY = imgDimensions.height - groupBox.height;
                        setGroupBox({
                            ...groupBox,
                            x: Math.max(0, Math.min(d.x, maxX)),
                            y: Math.max(0, Math.min(d.y, maxY))
                        });
                    },
                    onResizeStop: (_, __, ref, ___, pos)=>{
                        let newWidth = parseFloat(ref.style.width);
                        let newHeight = parseFloat(ref.style.height);
                        const scaleX = imgDimensions.width / TOTAL_ORIGINAL_WIDTH;
                        const scaleY = imgDimensions.height / ORIGINAL_HEIGHT;
                        const maxScale = Math.min(scaleX, scaleY);
                        const maxW = TOTAL_ORIGINAL_WIDTH * maxScale;
                        const maxH = ORIGINAL_HEIGHT * maxScale;
                        newWidth = Math.min(newWidth, maxW);
                        newHeight = Math.min(newHeight, maxH);
                        setGroupBox({
                            width: newWidth,
                            height: newHeight,
                            x: Math.max(0, Math.min(pos.x, imgDimensions.width - newWidth)),
                            y: Math.max(0, Math.min(pos.y, imgDimensions.height - newHeight))
                        });
                    },
                    lockAspectRatio: TOTAL_ORIGINAL_WIDTH / ORIGINAL_HEIGHT,
                    bounds: "parent",
                    style: {
                        border: "1px dashed #333",
                        display: "flex",
                        flexDirection: "row",
                        position: "absolute",
                        background: "rgba(255,255,255,0.02)"
                    },
                    children: BOX_WIDTHS.map((w, i)=>{
                        const widthRatio = w / TOTAL_ORIGINAL_WIDTH;
                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            style: {
                                width: `${widthRatio * 100}%`,
                                height: "100%",
                                border: "2px solid red",
                                boxSizing: "border-box"
                            }
                        }, i, false, {
                            fileName: "[project]/app/box/imageCropper.tsx",
                            lineNumber: 168,
                            columnNumber: 17
                        }, this);
                    })
                }, void 0, false, {
                    fileName: "[project]/app/box/imageCropper.tsx",
                    lineNumber: 122,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/box/imageCropper.tsx",
                lineNumber: 114,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                className: "mt-4 px-4 py-2 bg-green-600 text-white rounded",
                onClick: handleCropAndDownload,
                children: "Crop and Download"
            }, void 0, false, {
                fileName: "[project]/app/box/imageCropper.tsx",
                lineNumber: 183,
                columnNumber: 7
            }, this),
            croppedImages.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-4 flex gap-[10px]",
                children: croppedImages.map((src, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                        src: src,
                        alt: `Crop ${i + 1}`,
                        className: "border border-gray-300 rounded shadow",
                        style: {
                            maxHeight: "200px"
                        }
                    }, i, false, {
                        fileName: "[project]/app/box/imageCropper.tsx",
                        lineNumber: 194,
                        columnNumber: 13
                    }, this))
            }, void 0, false, {
                fileName: "[project]/app/box/imageCropper.tsx",
                lineNumber: 192,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/box/imageCropper.tsx",
        lineNumber: 103,
        columnNumber: 5
    }, this);
}
}}),
"[project]/app/box/page.tsx [app-ssr] (ecmascript)": ((__turbopack_context__) => {
"use strict";

var { g: global, __dirname } = __turbopack_context__;
{
__turbopack_context__.s({
    "default": (()=>Home)
});
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$dropzone$2f$dist$2f$es$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/node_modules/react-dropzone/dist/es/index.js [app-ssr] (ecmascript) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$dropzone$2f$dist$2f$es$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/react-dropzone/dist/es/index.js [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$box$2f$imageCropper$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/box/imageCropper.tsx [app-ssr] (ecmascript)");
'use client';
;
;
;
;
function Home() {
    const [image, setImage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [crops, setCrops] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const onDrop = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((acceptedFiles)=>{
        const file = acceptedFiles[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ()=>setImage(reader.result);
        reader.readAsDataURL(file);
    }, []);
    const { getRootProps, getInputProps, isDragActive } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$dropzone$2f$dist$2f$es$2f$index$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["useDropzone"])({
        onDrop,
        accept: {
            'image/*': []
        },
        multiple: false
    });
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "p-4",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                ...getRootProps(),
                className: `border-2 border-dashed p-10 text-center rounded-md cursor-pointer transition ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        ...getInputProps()
                    }, void 0, false, {
                        fileName: "[project]/app/box/page.tsx",
                        lineNumber: 42,
                        columnNumber: 9
                    }, this),
                    isDragActive ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-blue-500 font-semibold",
                        children: "Drop the image here..."
                    }, void 0, false, {
                        fileName: "[project]/app/box/page.tsx",
                        lineNumber: 44,
                        columnNumber: 11
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-gray-500",
                        children: "Drag & drop an image here, or click to select one"
                    }, void 0, false, {
                        fileName: "[project]/app/box/page.tsx",
                        lineNumber: 46,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/box/page.tsx",
                lineNumber: 36,
                columnNumber: 7
            }, this),
            image && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$box$2f$imageCropper$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                imageSrc: image,
                setCrops: setCrops
            }, void 0, false, {
                fileName: "[project]/app/box/page.tsx",
                lineNumber: 50,
                columnNumber: 17
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/box/page.tsx",
        lineNumber: 28,
        columnNumber: 5
    }, this);
}
}}),

};

//# sourceMappingURL=%5Broot%20of%20the%20server%5D__ac7f0897._.js.map