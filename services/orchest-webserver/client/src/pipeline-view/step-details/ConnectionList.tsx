import { SortableStack } from "@/components/SortableStack";
import { ellipsis } from "@/utils/styles";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import DragHandleOutlined from "@mui/icons-material/DragHandleOutlined";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";

type ConnectionInfo = {
  title: string;
  filePath: string;
  uuid: string;
};

export type ConnectionListProps = {
  title: string;
  sortable: boolean;
  connections: readonly ConnectionInfo[];
  onRemove(index: number): void;
  onSwap?(oldIndex: number, newIndex: number): void;
};

export const ConnectionList = ({
  title: listTitle,
  connections,
  sortable,
  onRemove,
  onSwap = () => undefined,
}: ConnectionListProps) => {
  return (
    <Box>
      <Typography
        component="div"
        variant="subtitle2"
        fontSize="14px"
        color="text.secondary"
        sx={{ padding: (theme) => theme.spacing(0, 0) }}
      >
        {listTitle}
      </Typography>
      <SortableStack
        disabled={!sortable}
        onUpdate={async (oldIndex, newIndex) => onSwap(oldIndex, newIndex)}
      >
        {connections.map(({ uuid, title, filePath }, index) => (
          <Stack
            flexDirection="row"
            key={uuid}
            alignItems="center"
            justifyContent="space-between"
            sx={{ width: "100%" }}
          >
            <Stack flexShrink={1} flexDirection="row" gap={1.5} minWidth="0">
              {sortable && (
                <DragHandleOutlined style={{ width: "24px", height: "24px" }} />
              )}
              <Typography sx={ellipsis()} variant="body2" fontSize={14}>
                {title}
              </Typography>
              <Typography
                sx={ellipsis()}
                variant="body2"
                fontSize={14}
                color="text.secondary"
              >
                {filePath}
              </Typography>
            </Stack>

            <IconButton onClick={() => onRemove(index)}>
              <CloseOutlined style={{ width: "20px", height: "20px" }} />
            </IconButton>
          </Stack>
        ))}
      </SortableStack>
    </Box>
  );
};
