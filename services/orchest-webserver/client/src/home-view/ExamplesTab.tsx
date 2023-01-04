import { SnackBar } from "@/components/common/SnackBar";
import { useFetchExamples } from "@/hooks/useFetchExamples";
import Button from "@mui/material/Button";
import blue from "@mui/material/colors/blue";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { ExampleList } from "./components/ExampleList";

export const ExamplesTab = () => {
  const { isFetching, error, refresh } = useFetchExamples();

  return (
    <>
      <ExampleList />
      <SnackBar
        open={hasValue(error) || true}
        message="Failed to fetch examples"
        action={
          <Button
            sx={{ color: blue[200] }}
            onClick={() => refresh()}
            disabled={isFetching}
          >
            Retry
          </Button>
        }
      />
    </>
  );
};
