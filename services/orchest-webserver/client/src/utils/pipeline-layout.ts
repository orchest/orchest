import {
  coordCenter,
  dagStratify,
  decrossOpt,
  layeringSimplex,
  sugiyama,
} from "d3-dag";

import { IPipelineStepState } from "@/pipeline-view/PipelineView";
import _ from "lodash";

const rotate = (array, angle) => {
  return array.map((p) => {
    const d2r = (a) => {
      return (a * Math.PI) / 180;
    };
    return [
      Math.cos(d2r(angle)) * p[0] - Math.sin(d2r(angle)) * p[1],
      Math.sin(d2r(angle)) * p[0] - Math.cos(d2r(angle)) * p[1],
    ];
  });
};

// Extract solution from dag
const collectNodes = (dag, nodes) => {
  const id = dag.data.id;
  if (nodes[id] === undefined) {
    nodes[id] = { x: dag.x, y: dag.y };
  }
  for (const childDag of dag.dataChildren) {
    collectNodes(childDag.child, nodes);
  }
};

const generateDagData = (pipelineJson) => {
  return Object.values(pipelineJson.steps).map((step: IPipelineStepState) => ({
    id: step.uuid,
    parentIds: step.incoming_connections,
  }));
};

const rotateNodes = (nodes, angle) => {
  for (let id in nodes) {
    let rotatedPoints = rotate([[nodes[id].x, nodes[id].y]], angle)[0];
    nodes[id] = { x: rotatedPoints[0], y: rotatedPoints[1] };
  }
};

const scaleNodes = (nodes, scaleX, scaleY) => {
  for (let id in nodes) {
    nodes[id].x *= scaleX;
    nodes[id].y *= scaleY;
  }
};

const translateNodes = (
  nodes: {
    [key: string]: { x: number; y: number };
  },
  translateX,
  translateY
) => {
  // Add x and y distance to all points
  for (let node of Object.values(nodes)) {
    node.x += translateX;
    node.y += translateY;
  }
};

const moveNodesTopLeft = (nodes: {
  [key: string]: { x: number; y: number };
}) => {
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
  pipelineJson,
  nodeRadius,
  scaleX,
  scaleY,
  offsetX,
  offsetY
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
    .nodeSize(() => [nodeRadius, nodeRadius]);

  // Performs mutable operation on dag
  // @ts-ignore
  layout(dag);

  // Extract nodes from dag
  let nodes = {};

  // These three functions are pass by reference
  collectNodes(dag, nodes);
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
