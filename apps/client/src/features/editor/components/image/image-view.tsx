import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Group, Image, Loader, Text } from "@mantine/core";
import { type MouseEvent, useEffect, useMemo, useRef } from "react";
import { getFileUrl } from "@/lib/config.ts";
import clsx from "clsx";
import classes from "./image-view.module.css";
import { useTranslation } from "react-i18next";
import { IMAGE_PREVIEW_EVENT } from "@docmost/editor-ext";

export default function ImageView(props: NodeViewProps) {
  const { t } = useTranslation();
  const { editor, node, selected } = props;
  const { src, width, align, alt, aspectRatio, placeholder } = node.attrs;
  const alignClass = useMemo(() => {
    if (align === "left") return "alignLeft";
    if (align === "right") return "alignRight";
    if (align === "center") return "alignCenter";
    return "alignCenter";
  }, [align]);
  const previewSrc = useMemo(() => {
    editor.storage.shared.imagePreviews =
      editor.storage.shared.imagePreviews || {};

    if (placeholder?.id) {
      return editor.storage.shared.imagePreviews[placeholder.id];
    }

    return null;
  }, [placeholder, editor]);

  // 防抖定时器与双击标记，保持组件实例内（与 image.ts 同语义）
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDoubleRef = useRef(false);

  // 组件卸载时清理挂起的定时器
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  // 派发图片预览事件（window 目标，与 image.ts 一致），携带原图位置供弹窗动画使用
  const dispatchPreview = (fromRect: {
    left: number;
    top: number;
    width: number;
    height: number;
  }) => {
    window.dispatchEvent(
      new CustomEvent(IMAGE_PREVIEW_EVENT, {
        detail: {
          src: node.attrs.src,
          attachmentId: node.attrs.attachmentId,
          alt: node.attrs.alt,
          fromRect,
        },
      }),
    );
  };

  // 只读态单击防抖合并：350ms 内第二次点击视为双击，事件时刻捕获原图位置
  const handleClick = (e: MouseEvent<HTMLImageElement>) => {
    if (!editor.isEditable) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        pendingDoubleRef.current = true;
      } else {
        const rect = e.currentTarget.getBoundingClientRect();
        const fromRect = {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        };
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          dispatchPreview(fromRect);
        }, 350);
      }
    }
  };

  // 双击：先取判断值再清理，只读/可编辑均可打开，事件时刻捕获原图位置
  const handleDoubleClick = (e: MouseEvent<HTMLImageElement>) => {
    const shouldOpen = pendingDoubleRef.current || editor.isEditable;
    if (pendingDoubleRef.current) {
      clearTimeout(timerRef.current);
      pendingDoubleRef.current = false;
    }
    if (shouldOpen) {
      const rect = e.currentTarget.getBoundingClientRect();
      dispatchPreview({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      });
    }
  };

  return (
    <NodeViewWrapper data-drag-handle>
      <div
        className={clsx(
          selected && "ProseMirror-selectednode",
          classes.imageWrapper,
          !src && placeholder && classes.skeleton,
          alignClass,
        )}
        style={{
          aspectRatio: aspectRatio ? aspectRatio : src ? undefined : "16 / 9",
          width,
        }}
      >
        {src && (
          <Image
            radius="md"
            fit="contain"
            src={getFileUrl(src)}
            alt={alt}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            style={!editor.isEditable ? { cursor: "pointer" } : undefined}
          />
        )}
        {!src && previewSrc && (
          <Group pos="relative" h="100%" w="100%">
            <Image
              radius="md"
              fit="contain"
              src={previewSrc}
              alt={placeholder?.name}
            />
            <Loader size={20} pos="absolute" bottom={6} right={6} />
          </Group>
        )}
        {!src && !previewSrc && placeholder && (
          <Group justify="center" wrap="nowrap" gap="xs" maw="100%" px="md">
            <Loader size={20} style={{ flexShrink: 0 }} />
            <Text component="span" size="sm" truncate="end">
              {placeholder?.name
                ? t("Uploading {{name}}", { name: placeholder.name })
                : t("Uploading file")}
            </Text>
          </Group>
        )}
      </div>
    </NodeViewWrapper>
  );
}
