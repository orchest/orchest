export const mockStrategyJson = {
  "ac578410-0cab-4c58-a968-19ee7386203a": {
    key: "ac578410-0cab-4c58-a968-19ee7386203a",
    parameters: {
      baz: '["hello", "world"]',
    },
    title: "Data exploration",
  },
  pipeline_parameters: {
    key: "pipeline_parameters",
    parameters: {
      bar: "[true, false]",
      foo: "[123, 456]",
    },
    title: "california-housing",
  },
};

export const mockParameters = {
  "ac578410-0cab-4c58-a968-19ee7386203a#baz": ["hello", "world"],
  "pipeline_parameters#bar": [true, false],
  "pipeline_parameters#foo": [123, 456],
};

export const mockPipelineRuns = [
  {
    "ac578410-0cab-4c58-a968-19ee7386203a#baz": "hello",
    "pipeline_parameters#bar": true,
    "pipeline_parameters#foo": 123,
  },
  {
    "ac578410-0cab-4c58-a968-19ee7386203a#baz": "hello",
    "pipeline_parameters#bar": true,
    "pipeline_parameters#foo": 456,
  },
  {
    "ac578410-0cab-4c58-a968-19ee7386203a#baz": "hello",
    "pipeline_parameters#bar": false,
    "pipeline_parameters#foo": 123,
  },
  {
    "ac578410-0cab-4c58-a968-19ee7386203a#baz": "hello",
    "pipeline_parameters#bar": false,
    "pipeline_parameters#foo": 456,
  },
  {
    "ac578410-0cab-4c58-a968-19ee7386203a#baz": "world",
    "pipeline_parameters#bar": true,
    "pipeline_parameters#foo": 123,
  },
  {
    "ac578410-0cab-4c58-a968-19ee7386203a#baz": "world",
    "pipeline_parameters#bar": true,
    "pipeline_parameters#foo": 456,
  },
  {
    "ac578410-0cab-4c58-a968-19ee7386203a#baz": "world",
    "pipeline_parameters#bar": false,
    "pipeline_parameters#foo": 123,
  },
  {
    "ac578410-0cab-4c58-a968-19ee7386203a#baz": "world",
    "pipeline_parameters#bar": false,
    "pipeline_parameters#foo": 456,
  },
];
