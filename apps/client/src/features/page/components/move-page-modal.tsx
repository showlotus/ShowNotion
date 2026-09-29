import { Modal, Button, Group, Text } from "@mantine/core";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ISpace } from "@/features/space/types/space.types.ts";
import { SpaceSelect } from "@/features/space/components/sidebar/space-select.tsx";
import { useMovePageToSpace } from "@/features/page/hooks/use-move-page-to-space.ts";

interface MovePageModalProps {
  pageId: string;
  slugId: string;
  currentSpaceSlug: string;
  open: boolean;
  onClose: () => void;
}

export default function MovePageModal({
  pageId,
  slugId,
  currentSpaceSlug,
  open,
  onClose,
}: MovePageModalProps) {
  const { t } = useTranslation();
  const [targetSpace, setTargetSpace] = useState<ISpace>(null);
  const movePageToSpace = useMovePageToSpace();

  const handlePageMove = async () => {
    if (!targetSpace) return;

    const moved = await movePageToSpace(pageId, slugId, targetSpace);
    if (moved) {
      onClose();
      setTargetSpace(null);
    }
  };

  const handleChange = (space: ISpace) => {
    setTargetSpace(space);
  };

  return (
    <Modal.Root
      opened={open}
      onClose={onClose}
      size={500}
      padding="xl"
      yOffset="10vh"
      xOffset={0}
      mah={400}
      onClick={(e) => e.stopPropagation()}
    >
      <Modal.Overlay />
      <Modal.Content style={{ overflow: "hidden" }}>
        <Modal.Header py={0}>
          <Modal.Title fw={500}>{t("Move page")}</Modal.Title>
          <Modal.CloseButton aria-label={t("Close")} />
        </Modal.Header>
        <Modal.Body>
          <Text mb="xs" c="dimmed" size="sm">
            {t("Move page to a different space.")}
          </Text>

          <SpaceSelect
            value={currentSpaceSlug}
            clearable={false}
            onChange={handleChange}
          />
          <Group justify="end" mt="md">
            <Button onClick={onClose} variant="default">
              {t("Cancel")}
            </Button>
            <Button onClick={handlePageMove}>{t("Move")}</Button>
          </Group>
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}
