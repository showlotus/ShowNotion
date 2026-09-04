import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Image, Modal } from "@mantine/core";
import { IMAGE_PREVIEW_EVENT } from "@docmost/editor-ext";
import { getFileUrl } from "@/lib/config.ts";

type ImagePreviewData = {
  src?: string;
  attachmentId?: string;
  alt?: string;
  // 触发预览的源图片位置尺寸，作为 FLIP 展开动画起点，旧协议事件可不带
  fromRect?: { left: number; top: number; width: number; height: number };
};

// 图片预览弹窗：监听 IMAGE_PREVIEW_EVENT 全局事件，以沉浸式纯图模态展示大图
export default function ImageLightbox() {
  const [open, setOpen] = useState(false);
  const [attrs, setAttrs] = useState<ImagePreviewData>({});
  const openRef = useRef(false);
  const imgRef = useRef<HTMLImageElement>(null);
  // 记录来源图片矩形，作为 FLIP 入场动画的起点
  const fromRectRef = useRef<ImagePreviewData["fromRect"]>(undefined);
  // 防止同一张图片重复触发 FLIP 动画
  const animatedRef = useRef(false);

  // 挂载 window 级监听（与 image.ts / image-view.tsx 派发端一致），卸载时清理
  useEffect(() => {
    const handler = (e: Event) => {
      const data = (e as CustomEvent<ImagePreviewData>).detail;
      if (!data?.src) return;
      if (openRef.current) return;
      // 无条件记录来源矩形，旧协议事件为 undefined 时动画守卫自动跳过
      fromRectRef.current = data.fromRect;
      animatedRef.current = false;
      setAttrs(data);
      openRef.current = true;
      setOpen(true);
    };

    window.addEventListener(IMAGE_PREVIEW_EVENT, handler);
    return () => {
      window.removeEventListener(IMAGE_PREVIEW_EVENT, handler);
    };
  }, []);

  // 设置遮罩透明度：与 FLIP 缩放同一 tick 启动 CSS transition 渐入；
  // 找不到遮罩元素时静默忽略（jsdom/异常 DOM 下不抛错）
  const setOverlayOpacity = (value: string) => {
    const overlay = imgRef.current
      ?.closest(".mantine-Modal-root")
      ?.querySelector(".mantine-Modal-overlay");
    if (overlay) {
      (overlay as HTMLElement).style.opacity = value;
    }
  };

  // 执行 FLIP 入场动画：大图从源图位置尺寸平滑放大到最终展示位置，
  // 背景遮罩渐入与图片缩放同 tick 启动（overlay 初始透明 + CSS transition 250ms）
  const playFlipIn = () => {
    const from = fromRectRef.current;
    const img = imgRef.current;
    if (!img || animatedRef.current) return;
    // 旧协议事件无 fromRect：无动画直接展示，遮罩立即显示，不卡透明
    if (!from) {
      setOverlayOpacity("1");
      return;
    }
    // 图片未就绪时不提前显示遮罩（等 onLoad 重试，避免遮罩先暗）
    if (!img.complete || img.naturalWidth === 0) return;
    // 无 WAAPI（jsdom/旧浏览器）：无动画直接展示，遮罩立即显示
    if (typeof img.animate !== "function") {
      setOverlayOpacity("1");
      return;
    }

    // 实时校准起点：派发端在点击时刻捕获 fromRect，但防抖窗口/编辑器选中节点
    // 会触发页面滚动，播放时刻文档图片位置已偏移。动画播放前用文档中图片的
    // 当前视口位置覆盖起点，找不到或尺寸异常时回退 fromRect。
    // 限定 .tiptap 范围：弹窗自身 img 的 src 属性同样是绝对 URL，全文档
    // querySelector 会先匹配到弹窗 img（closest 排除法对自身不可靠）。
    let start = from;
    const live = Array.from(document.querySelectorAll(".tiptap img")).find(
      (el) => (el as HTMLImageElement).src === img.src,
    );
    if (live) {
      const r = live.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        start = { left: r.left, top: r.top, width: r.width, height: r.height };
      }
    }

    const last = img.getBoundingClientRect();
    if (last.width === 0 || last.height === 0) return;

    const sx = start.width / last.width;
    const sy = start.height / last.height;
    const dx = start.left + start.width / 2 - (last.left + last.width / 2);
    const dy = start.top + start.height / 2 - (last.top + last.height / 2);

    animatedRef.current = true;
    img.style.transformOrigin = "center";
    // WAAPI 缩放与遮罩 CSS transition 渐入同 tick 启动，视觉同步
    img.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
        { transform: "none" },
      ],
      { duration: 250, easing: "ease-out" },
    );
    setOverlayOpacity("1");
  };

  // 图片可能已命中缓存而不再触发 onLoad，打开后补一次 complete 检查。
  // 用 useLayoutEffect 在浏览器绘制前启动动画：useEffect 在绘制后才执行，
  // 缓存命中时图片先以无 transform 状态显示一帧，再跳回起点播放，产生视觉闪烁。
  useLayoutEffect(() => {
    if (open) playFlipIn();
  }, [open]);

  // openRef 与 open 同步复位，保证下次事件可再次打开
  const handleClose = () => {
    openRef.current = false;
    setOpen(false);
  };

  // 打开时同步锁定 body 滚动：useLayoutEffect 在浏览器绘制前执行，
  // 弹窗首帧滚动条即隐藏；Mantine 默认 lockScroll 走 useEffect 晚一帧生效，故显式关掉
  useLayoutEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <Modal
      opened={open}
      onClose={handleClose}
      lockScroll={false}
      withCloseButton={false}
      centered
      size="auto"
      transitionProps={{ transition: "fade", duration: 0 }}
      // 遮罩初始透明，CSS transition 250ms 与 FLIP 动画同 tick 启动渐入；
      // 禁用 Mantine 整体淡入（duration 0），避免遮罩先自动显示
      overlayProps={{
        backgroundOpacity: 0.8,
        style: { opacity: 0, transition: "opacity 250ms ease-out" },
      }}
      styles={{
        content: {
          background: "transparent",
          boxShadow: "none",
          borderRadius: 0,
          padding: 0,
          width: "auto",
          maxWidth: "calc(100vw - 64px)",
          // Mantine 默认 max-height: calc(100dvh - 10dvh) 且 overflow-y: auto，
          // 与图片 maxHeight(100vh - 64px) 存在差值，图片按最大高度渲染时会在弹窗内部出现滚动条。
          // 将容器上限与图片对齐（布局无溢出，无需 overflow hidden 防滚动条），
          // overflow visible 让 FLIP 起始帧（transform 后位于文档图位置，可超出弹窗区域）完整可见不被裁剪。
          maxHeight: "calc(100vh - 64px)",
          overflow: "visible",
        },
        // inner 默认 overflow-y auto 同样会裁剪 FLIP 起始帧，显式放开
        inner: { padding: 0, overflow: "visible" },
        body: { padding: 0 },
      }}
    >
      {attrs.src && (
        <Image
          ref={imgRef}
          src={getFileUrl(attrs.src)}
          alt={attrs.alt}
          fit="contain"
          radius="md"
          style={{
            maxWidth: "calc(100vw - 64px)",
            maxHeight: "calc(100vh - 64px)",
            width: "auto",
            height: "auto",
          }}
          onLoad={playFlipIn}
          onError={(e) => {
            // 加载失败时置灰占位，避免白屏；遮罩立即显示，防止透明背景上孤零零灰图
            (e.currentTarget as HTMLImageElement).style.opacity = "0.5";
            setOverlayOpacity("1");
          }}
        />
      )}
    </Modal>
  );
}
