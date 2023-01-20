import { usePipelinesApi } from "@/api/pipelines/usePipelinesApi";
import { useProjectsApi } from "@/api/projects/useProjectsApi";
import { useJobPipelines } from "@/hooks/useJobPipelines";
import { PipelineMetaData } from "@/types";
import { basename } from "@/utils/path";
import { uniquePipelineId } from "@/utils/pipeline";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import MenuItem from "@mui/material/MenuItem";
import OutlinedInput from "@mui/material/OutlinedInput";
import Typography from "@mui/material/Typography";
import React from "react";
import { MultiFilter } from "./MultiFilter";

export type PipelineFilterProps = {
  selected: PipelineMetaData[];
  onChange: (pipelines: PipelineMetaData[]) => void;
};

export const PipelineFilter = ({ selected, onChange }: PipelineFilterProps) => {
  const jobPipelines = useJobPipelines();
  const projects = useProjectsApi((api) => api.projects);
  const pipelines = usePipelinesApi((api) => api.pipelines);
  const [search, setSearch] = React.useState("");

  const pipelineMap = React.useMemo(() => {
    const lowerSearch = search.toLowerCase();

    return Object.fromEntries(
      jobPipelines
        .concat(pipelines ?? [])
        .filter(
          (pipeline) =>
            !lowerSearch || pipeline.name.toLowerCase().includes(lowerSearch)
        )
        .map((pipeline) => [uniquePipelineId(pipeline), pipeline])
    );
  }, [jobPipelines, pipelines, search]);

  const handleChange = (uniqueIds: string[]) =>
    onChange(uniqueIds.map((uniqueId) => pipelineMap[uniqueId]));

  return (
    <MultiFilter
      label="Pipeline"
      id="pipeline"
      minWidth="100px"
      selected={selected.map(uniquePipelineId)}
      onChange={(values) => handleChange(values)}
      prettify={(uniqueId) => pipelineMap[uniqueId].name}
      MenuProps={{
        sx: { ".MuiMenu-paper": { maxWidth: "300px" } },
      }}
    >
      <Box paddingX={1}>
        <OutlinedInput
          fullWidth
          size="small"
          value={search}
          placeholder="Search"
          aria-label="Search pipelines"
          onChange={({ target }) => setSearch(target.value)}
          startAdornment={
            <SearchOutlined color="action" sx={{ marginRight: 1 }} />
          }
        />
      </Box>

      {Object.values(pipelineMap).map((pipeline) => {
        const uniqueId = uniquePipelineId(pipeline);
        const project = projects?.[pipeline.project_uuid];

        return (
          <MenuItem dense key={uniqueId} value={uniqueId}>
            <Checkbox
              checked={selected.map(uniquePipelineId).includes(uniqueId)}
            />
            {project ? (
              <Typography color="text.secondary" variant="body2">
                {basename(project.path)}&nbsp;/
              </Typography>
            ) : null}
            <Typography color="text.primary" variant="body2">
              &nbsp;
              {pipeline.name}
            </Typography>
          </MenuItem>
        );
      })}
    </MultiFilter>
  );
};
