import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { IMAGE_PREVIEW_EVENT } from '@docmost/editor-ext';
import ImageLightbox from './image-lightbox';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// jsdom 未实现 matchMedia，MantineProvider 依赖它检测颜色方案
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const dispatchPreview = (detail: unknown) => {
  act(() => {
    window.dispatchEvent(new CustomEvent(IMAGE_PREVIEW_EVENT, { detail }));
  });
};

const renderLightbox = () =>
  render(
    <MantineProvider>
      <ImageLightbox />
    </MantineProvider>,
  );

// 点击遮罩关闭弹窗（沉浸式弹窗无关闭按钮，遮罩点击是唯一鼠标关闭途径）
const clickOverlay = () => {
  fireEvent.click(document.querySelector('.mantine-Modal-overlay')!);
};

describe('ImageLightbox', () => {
  it('renders with modal closed initially', () => {
    renderLightbox();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens on IMAGE_PREVIEW_EVENT and renders image with absolutized src', async () => {
    renderLightbox();
    dispatchPreview({ src: '/api/attachments/x.png', alt: '图' });

    const dialog = await screen.findByRole('dialog');
    const img = dialog.querySelector('img');
    expect(img).not.toBeNull();
    // getFileUrl 将 /api/ 前缀补全为后端地址，host 依赖 jsdom 环境，只断言路径段
    expect(new URL(img!.src).pathname).toBe('/api/attachments/x.png');
    expect(img!.alt).toBe('图');
    // 沉浸式纯图弹窗：无关闭按钮、无 header，图片带视口留白约束
    expect(screen.queryByRole('button')).toBeNull();
    expect(document.querySelector('.mantine-Modal-header')).toBeNull();
    expect(img!.style.maxWidth).toBe('calc(100vw - 64px)');
    expect(img!.style.maxHeight).toBe('calc(100vh - 64px)');
    // radius="md" 与编辑器内原图一致（Mantine Image 经 CSS 变量下发，主题默认 8px）
    expect(img!.style.getPropertyValue('--image-radius')).toBe('var(--mantine-radius-md)');
    expect(getComputedStyle(document.querySelector('.mantine-Modal-body')!).padding).toBe('0px');
    // 容器上限与图片对齐（覆盖 Mantine 默认 90dvh max-height），
    // overflow visible 放行 FLIP 起始帧（transform 溢出弹窗区域）不被裁剪
    const modalContent = document.querySelector(
      '.mantine-Modal-content',
    ) as HTMLElement;
    expect(modalContent.style.maxHeight).toBe('calc(100vh - 64px)');
    expect(modalContent.style.overflow).toBe('visible');
    const modalInner = modalContent.closest(
      '.mantine-Modal-inner',
    ) as HTMLElement;
    expect(modalInner.style.overflow).toBe('visible');
    // 无 fromRect 事件 → 无动画路径 → 遮罩立即显示（不卡透明）
    const overlay = document.querySelector(
      '.mantine-Modal-overlay',
    ) as HTMLElement;
    expect(overlay.style.opacity).toBe('1');
  });

  it('shows overlay immediately for no-fromRect legacy events', async () => {
    renderLightbox();
    dispatchPreview({ src: '/api/attachments/x.png', alt: 'x' });

    const dialog = await screen.findByRole('dialog');
    // 无 fromRect → 无动画路径 → 遮罩立即显示
    const overlay = document.querySelector(
      '.mantine-Modal-overlay',
    ) as HTMLElement;
    expect(overlay.style.opacity).toBe('1');
    expect(dialog.querySelector('img')).not.toBeNull();
  });

  it('fades overlay to 1 when animation is ready to play', async () => {
    renderLightbox();
    dispatchPreview({
      src: '/api/attachments/x.png',
      fromRect: { left: 100, top: 80, width: 200, height: 120 },
    });
    const dialog = await screen.findByRole('dialog');
    const img = dialog.querySelector('img') as HTMLImageElement;
    const overlay = document.querySelector(
      '.mantine-Modal-overlay',
    ) as HTMLElement;
    // 图片未就绪（jsdom complete=false）：遮罩保持透明，等待 onLoad
    expect(overlay.style.opacity).toBe('0');

    // 模拟图片就绪：jsdom 无 img.animate → 走无动画分支 → 遮罩显示
    Object.defineProperty(img, 'complete', {
      configurable: true,
      get: () => true,
    });
    Object.defineProperty(img, 'naturalWidth', {
      configurable: true,
      get: () => 200,
    });
    await act(async () => {
      fireEvent.load(img);
    });
    expect(overlay.style.opacity).toBe('1');
  });

  it('locks body scroll synchronously on open and restores on close', async () => {
    renderLightbox();
    expect(document.body.style.overflow).toBe('');

    dispatchPreview({ src: '/api/attachments/x.png' });
    await screen.findByRole('dialog');
    // useLayoutEffect 在绘制前同步锁定，弹窗首帧 body 即不可滚动
    expect(document.body.style.overflow).toBe('hidden');

    await act(async () => {
      clickOverlay();
    });
    await waitFor(() => expect(document.body.style.overflow).toBe(''));
  });

  it('reopens after close (openRef resets)', async () => {
    renderLightbox();
    dispatchPreview({ src: '/api/attachments/a.png' });
    await screen.findByRole('dialog');

    await act(async () => {
      clickOverlay();
    });
    // 等待 Mantine 关闭过渡结束后 Modal 卸载
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    // openRef 已复位，同 src 事件可再次打开
    dispatchPreview({ src: '/api/attachments/a.png' });
    await screen.findByRole('dialog');
    expect(document.querySelectorAll('[role="dialog"]').length).toBe(1);
  });

  it('dedups events while open and cleans up listener on unmount', async () => {
    const { unmount } = renderLightbox();
    dispatchPreview({ src: '/api/attachments/b.png' });
    await screen.findByRole('dialog');

    // 打开状态下连续 dispatch 同 src，第二次被 openRef 拦截，Modal 只出现一次
    dispatchPreview({ src: '/api/attachments/b.png' });
    dispatchPreview({ src: '/api/attachments/b.png' });
    expect(document.querySelectorAll('[role="dialog"]').length).toBe(1);

    // 卸载后监听器移除，dispatch 不再触发任何副作用
    unmount();
    expect(() => dispatchPreview({ src: '/api/attachments/c.png' })).not.toThrow();
  });

  it('stays closed when event detail has no src', () => {
    renderLightbox();
    dispatchPreview({ alt: 'x' });
    dispatchPreview({});
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens normally with fromRect in detail (FLIP guarded in jsdom)', async () => {
    renderLightbox();
    dispatchPreview({
      src: '/api/attachments/x.png',
      fromRect: { left: 100, top: 80, width: 200, height: 120 },
    });

    // jsdom 无 img.animate，动画守卫跳过，弹窗直接展示不抛错
    const dialog = await screen.findByRole('dialog');
    expect(dialog.querySelector('img')).not.toBeNull();
  });

  it('opens normally without fromRect (backward compatible)', async () => {
    renderLightbox();
    dispatchPreview({ src: '/api/attachments/x.png' });

    await screen.findByRole('dialog');
    expect(document.querySelectorAll('[role="dialog"]').length).toBe(1);
  });

  it('reopens without fromRect after close (no stale rect)', async () => {
    renderLightbox();
    dispatchPreview({
      src: '/api/attachments/x.png',
      fromRect: { left: 100, top: 80, width: 200, height: 120 },
    });
    await screen.findByRole('dialog');

    await act(async () => {
      clickOverlay();
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    // 重开事件不带 fromRect，fromRectRef 被无条件重置，无陈旧矩形残留
    dispatchPreview({ src: '/api/attachments/y.png' });
    await screen.findByRole('dialog');
    expect(document.querySelectorAll('[role="dialog"]').length).toBe(1);
  });

  it('falls back to fromRect when no matching document image exists', async () => {
    renderLightbox();
    // jsdom 中弹窗自身 img 会被 live 校准排除（closest .mantine-Modal-root），
    // 且无文档图片 → 回退 fromRect 路径，动画守卫跳过不抛错
    dispatchPreview({
      src: '/api/attachments/x.png',
      fromRect: { left: 100, top: 80, width: 200, height: 120 },
    });

    await screen.findByRole('dialog');
    expect(document.querySelectorAll('[role="dialog"]').length).toBe(1);
  });
});
