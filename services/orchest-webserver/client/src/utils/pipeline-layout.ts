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
import {
  addOutgoingConnections,
  clearOutgoingConnections,
} from "./webserver-utils";

type SubGraph = {
  uuid: string;
  incoming_connections: string[];
}[];

type Point = { x: number; y: number };
type Data = { id: string; parentIds: string[] };

type TransformedDag = {
  data: Data;
  dataChildren: { child: TransformedDag; points: Point[] }[];
  value: number;
  x: number;
  y: number;
};

type DagRoots = {
  proots: TransformedDag[];
};

function isDagRoots(value: DagRoots | TransformedDag): value is DagRoots {
  return value.hasOwnProperty("proots");
}

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
const collectNodes = (
  dag: TransformedDag | DagRoots,
  nodes: Record<string, Point>
) => {
  const roots = isDagRoots(dag) ? dag.proots : [dag];

  roots.forEach((root) => {
    const id = root.data.id;
    nodes[id] = nodes[id] || { x: root.x, y: root.y };

    root.dataChildren.forEach((childDag) =>
      collectNodes(childDag.child, nodes)
    );
  });
};

const generateDagData = (subGraph: SubGraph) => {
  return subGraph.map((step) => {
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

const computeBoundingBox = (nodes: Record<string, Point>) => {
  let minX = Number.MAX_VALUE;
  let minY = Number.MAX_VALUE;
  let maxX = Number.MIN_VALUE;
  let maxY = Number.MIN_VALUE;

  Object.values(nodes).forEach((node) => {
    minX = Math.min(node.x, minX);
    minY = Math.min(node.y, minY);
    maxX = Math.max(node.x, maxX);
    maxY = Math.max(node.y, maxY);
  });

  return { minX, minY, maxX, maxY };
};

const moveNodesTopLeft = (nodes: Record<string, Point>) => {
  let boundingBox = computeBoundingBox(nodes);
  translateNodes(nodes, -boundingBox.minX, -boundingBox.minY);
};

const layoutSubGraph = (
  subGraph: SubGraph,
  nodeRadius: number,
  scaleX: number,
  scaleY: number,
  offsetX: number,
  offsetY: number
): Record<string, Point> => {
  const stratify = dagStratify();
  const dag = stratify(generateDagData(subGraph));

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

  return nodes;
};

const traverseNode = (
  step: IPipelineStepState,
  allSteps: { [uuid: string]: IPipelineStepState },
  seenNodes: Set<string>,
  subGraph: IPipelineStepState[]
) => {
  // DFS
  step.outgoing_connections.forEach((stepUuid) => {
    if (!seenNodes.has(stepUuid)) {
      seenNodes.add(stepUuid);

      subGraph.push(allSteps[stepUuid]);
      traverseNode(allSteps[stepUuid], allSteps, seenNodes, subGraph);
    }
  });
};

const collectSubGraphs = (pipelineJson) => {
  // Return subGraphs in sorted order (number of nodes, in descending order)

  // Augment pipelineJson
  addOutgoingConnections(pipelineJson.steps);

  // Traverse root nodes
  let seenNodes: Set<string> = new Set();
  let subGraphs: { uuid: string; incoming_connections: string[] }[][] = [];

  Object.keys(pipelineJson.steps).forEach((stepUuid) => {
    let step = pipelineJson.steps[stepUuid];

    // Start at unseen root nodes
    if (!seenNodes.has(stepUuid) && step.incoming_connections.length == 0) {
      // Found untraversed root node
      let graphNodes = [step];
      seenNodes.add(stepUuid);
      traverseNode(step, pipelineJson.steps, seenNodes, graphNodes);

      // Add to subGraphs
      subGraphs.push(graphNodes);
    }
  });

  // Sort subGraphs (big to small)
  subGraphs.sort((a, b) => b.length - a.length);

  // Remove annotations after being done with them
  clearOutgoingConnections(pipelineJson.steps);

  return subGraphs;
};

export const layoutPipeline = (
  pipelineJson: PipelineJson,
  nodeRadius: number,
  scaleX: number,
  scaleY: number,
  offsetX: number,
  offsetY: number,
  verticalGraphMargin: number,
  stepHeight: number
) => {
  const _pipelineJson = _.cloneDeep(pipelineJson);

  const subGraphs = collectSubGraphs(_pipelineJson);

  // layout each subgraph top left
  let laidOutSubGraphs = subGraphs.map((subGraph) =>
    layoutSubGraph(subGraph, nodeRadius, scaleX, scaleY, 0, 0)
  );

  // use layout results to vertically stack subgraphs
  let x = offsetX;
  let y = offsetY;
  for (let laidOutSubGraph of laidOutSubGraphs) {
    translateNodes(laidOutSubGraph, x, y);

    let boundingBox = computeBoundingBox(laidOutSubGraph);

    // Vertically stack, so only move the y 'pointer'
    // stepHeight is needed because the alignment only includes the center coordinates
    // of the steps
    y += boundingBox.maxY - boundingBox.minY + stepHeight + verticalGraphMargin;

    // Write node positions to _pipelineJson
    Object.entries(laidOutSubGraph).forEach((subgraph) => {
      const [stepUuid, node] = subgraph;
      _pipelineJson.steps[stepUuid].meta_data.position[0] = node.x;
      _pipelineJson.steps[stepUuid].meta_data.position[1] = node.y;
    });
  }

  return _pipelineJson;
};
