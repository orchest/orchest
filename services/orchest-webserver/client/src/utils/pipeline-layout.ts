import { IPipelineStepState } from "@/pipeline-view/PipelineView";
import { PipelineJson } from "@/types";
import {
  coordCenter,
  dagStratify,
  decrossOpt,
  layeringSimplex,
  NodeSizeAccessor,
  sugiyama,
} from "d3-dag";
import _ from "lodash";

type Point = { x: number; y: number };
type Data = { id: string; parentIds: string[] };

type TransformedDag = {
  data: Data;
  dataChildren: { child: TransformedDag; points: Point[] }[];
  value: number;
  x: number;
  y: number;
};

const degreesToRadians = (angle: number) => {
  return (angle * Math.PI) / 180;
};

const rotate = (point: Point, angle: number) => {
  return {
    x:
      Math.cos(degreesToRadians(angle)) * point.x -
      Math.sin(degreesToRadians(angle)) * point.y,
    y:
      Math.sin(degreesToRadians(angle)) * point.x -
      Math.cos(degreesToRadians(angle)) * point.y,
  };
};

// Extract solution from dag
const collectNodes = (dag: TransformedDag, nodes: Record<string, Point>) => {
  const id = dag.data.id;
  if (nodes[id] === undefined) {
    nodes[id] = { x: dag.x, y: dag.y };
  }

  dag.dataChildren.forEach((childDag) => collectNodes(childDag.child, nodes));
};

const generateDagData = (pipelineJson: PipelineJson) => {
  return Object.values(pipelineJson.steps).map((step: IPipelineStepState) => {
    return {
      id: step.uuid,
      parentIds: step.incoming_connections,
    };
  });
};

const rotateNodes = (nodes: Record<string, Point>, angle: number) => {
  for (let id in nodes) {
    nodes[id] = rotate(nodes[id], angle);
  }
};

const scaleNodes = (
  nodes: Record<string, Point>,
  scaleX: number,
  scaleY: number
) => {
  for (let id in nodes) {
    nodes[id].x *= scaleX;
    nodes[id].y *= scaleY;
  }
};

const translateNodes = (
  nodes: Record<string, Point>,
  translateX: number,
  translateY: number
) => {
  // Add x and y distance to all points
  for (let node of Object.values(nodes)) {
    node.x += translateX;
    node.y += translateY;
  }
};

const moveNodesTopLeft = (nodes: Record<string, Point>) => {
  // Find lowest x coordinate
  // Find lowest y coordinate
  let lowestX = Number.MAX_VALUE;
  let lowestY = Number.MAX_VALUE;

  for (let node of Object.values(nodes)) {
    if (node.x < lowestX) {
      lowestX = node.x;
    }
    if (node.y < lowestY) {
      lowestY = node.y;
    }
  }

  translateNodes(nodes, -lowestX, -lowestY);
};

export const layoutPipeline = (
  pipelineJson: PipelineJson,
  nodeRadius: number,
  scaleX: number,
  scaleY: number,
  offsetX: number,
  offsetY: number
) => {
  const _pipelineJson = _.cloneDeep(pipelineJson);

  const stratify = dagStratify();
  const dag = stratify(generateDagData(_pipelineJson));

  const layering = layeringSimplex();
  const decrossing = decrossOpt();
  const coord = coordCenter();

  const layout = sugiyama()
    .layering(layering)
    .decross(decrossing)
    .coord(coord)
    .nodeSize<NodeSizeAccessor<{ id: string; parentIds: string[] }, unknown>>(
      () => [nodeRadius, nodeRadius]
    );

  // Performs mutable operation on dag
  layout(dag);

  // Extract nodes from dag
  let nodes = {};

  // These three functions are pass by reference
  collectNodes((dag as unknown) as TransformedDag, nodes);
  // Default orientation is bottom to top
  rotateNodes(nodes, -90);
  moveNodesTopLeft(nodes);
  scaleNodes(nodes, scaleX, scaleY);
  translateNodes(nodes, offsetX, offsetY);

  // Change values in _pipelineJson
  for (let stepUUID of Object.keys(nodes)) {
    _pipelineJson.steps[stepUUID].meta_data.position[0] = nodes[stepUUID].x;
    _pipelineJson.steps[stepUUID].meta_data.position[1] = nodes[stepUUID].y;
  }

  return _pipelineJson;
};
