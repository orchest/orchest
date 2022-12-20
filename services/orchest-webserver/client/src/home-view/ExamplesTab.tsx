import { useFetchExamples } from "@/hooks/useFetchExamples";
import React from "react";
import { ExampleList } from "./components/ExampleList";

export const ExamplesTab = () => {
  useFetchExamples();

  return <ExampleList />;
};
