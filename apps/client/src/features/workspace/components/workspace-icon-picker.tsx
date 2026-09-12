import { useAtom } from "jotai";
import { IconLayoutGrid } from "@tabler/icons-react";
import EmojiPicker from "@/components/ui/emoji-picker.tsx";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import { updateWorkspace } from "@/features/workspace/services/workspace-service.ts";
import useUserRole from "@/hooks/use-user-role.tsx";

interface WorkspaceIconPickerProps {
  size?: number;
  emojiSize?: number;
  iconSize?: number;
}

// 工作区 emoji 图标选择器：与页面树图标同源，为空时显示占位 Icon
export default function WorkspaceIconPicker({
  size = 26,
  emojiSize = 16,
  iconSize = Math.round(size * 0.7),
}: WorkspaceIconPickerProps) {
  const [workspace, setWorkspace] = useAtom(workspaceAtom);
  const { isAdmin } = useUserRole();

  const handleEmojiSelect = async (emoji: { native: string }) => {
    const updatedWorkspace = await updateWorkspace({ icon: emoji.native });
    setWorkspace(updatedWorkspace);
  };

  const handleRemoveEmoji = async () => {
    const updatedWorkspace = await updateWorkspace({ icon: null });
    setWorkspace(updatedWorkspace);
  };

  // display: flex 包装 ActionIcon，消除行盒基线影响，保证 emoji 与占位 Icon 切换时高度恒定
  return (
    <div style={{ display: "flex" }}>
      <EmojiPicker
        onEmojiSelect={handleEmojiSelect}
        removeEmojiAction={handleRemoveEmoji}
        icon={
          workspace?.icon ? (
            <span style={{ fontSize: emojiSize, lineHeight: 1 }}>
              {workspace.icon}
            </span>
          ) : (
            <IconLayoutGrid size={iconSize} />
          )
        }
        readOnly={!isAdmin}
        actionIconProps={{ size: `${size}px` }}
      />
    </div>
  );
}
