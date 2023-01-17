import { IconButton } from "@/components/common/IconButton";
import { SshKey } from "@/types";
import { humanizeDate } from "@/utils/date-time";
import { ellipsis } from "@/utils/styles";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React from "react";

type SshKeyListProps = {
  list: SshKey[];
  onDelete: (uuid: string) => void;
  onCreate: () => void;
};

export const SshKeyList = ({ list, onDelete, onCreate }: SshKeyListProps) => {
  return (
    <>
      <Typography variant="h6" gutterBottom>
        SSH keys
      </Typography>
      {list.length > 0 && (
        <Box
          sx={{
            minWidth: (theme) => ({ xs: "95%", md: theme.spacing(100) }),
          }}
        >
          <Box
            sx={{
              fontWeight: (theme) => theme.typography.fontWeightMedium,
            }}
          >
            <Stack direction="row" alignItems="center" sx={{ width: "100%" }}>
              <Box
                sx={{
                  padding: (theme) => theme.spacing(2),
                  flex: 1,
                }}
              >
                Nickname
              </Box>
              <Box sx={{ flex: 1 }}>Date added</Box>
              <Box sx={{ minWidth: (theme) => theme.spacing(5) }} />
            </Stack>
            <Divider />
          </Box>
          {list.map((sshKey) => {
            return (
              <Box key={sshKey.uuid}>
                <Stack direction="row" alignItems="center">
                  <Box
                    sx={{
                      padding: (theme) => theme.spacing(2),
                      flex: 1,
                      ...ellipsis(),
                    }}
                  >
                    {sshKey.name}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    {humanizeDate(sshKey.created_time, "yyyy-MM-dd")}
                  </Box>
                  <Box>
                    <IconButton
                      title="Delete key"
                      onClick={() => onDelete(sshKey.uuid)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </Stack>
                <Divider />
              </Box>
            );
          })}
        </Box>
      )}

      <Button startIcon={<AddIcon />} onClick={onCreate}>
        Add ssh key
      </Button>
    </>
  );
};
