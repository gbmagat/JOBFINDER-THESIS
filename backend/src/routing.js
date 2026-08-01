function buildGraph(db) {
  const graph = new Map();
  const rows = db.prepare("SELECT * FROM geo_edges").all();
  for (const edge of rows) {
    const current = graph.get(edge.from_node_id) ?? [];
    current.push(edge);
    graph.set(edge.from_node_id, current);
  }
  return graph;
}

function shortestPath(db, startId, destinationId) {
  if (!startId || !destinationId) return null;
  const nodeIds = new Set(
    db
      .prepare("SELECT id FROM geo_nodes")
      .all()
      .map((node) => node.id),
  );
  if (!nodeIds.has(startId) || !nodeIds.has(destinationId)) return null;
  if (startId === destinationId) return { nodeIds: [startId], edges: [] };

  const graph = buildGraph(db);
  const distances = new Map([[startId, 0]]);
  const previous = new Map();
  const unvisited = new Set(nodeIds);

  while (unvisited.size) {
    let currentId = null;
    let currentDistance = Infinity;
    for (const nodeId of unvisited) {
      const distance = distances.get(nodeId) ?? Infinity;
      if (distance < currentDistance) {
        currentId = nodeId;
        currentDistance = distance;
      }
    }

    if (!currentId || currentDistance === Infinity) return null;
    unvisited.delete(currentId);
    if (currentId === destinationId) break;

    for (const edge of graph.get(currentId) ?? []) {
      if (!unvisited.has(edge.to_node_id)) continue;
      const nextDistance = currentDistance + edge.distance_km;
      if (nextDistance < (distances.get(edge.to_node_id) ?? Infinity)) {
        distances.set(edge.to_node_id, nextDistance);
        previous.set(edge.to_node_id, edge);
      }
    }
  }

  const edges = [];
  let cursor = destinationId;
  while (cursor !== startId) {
    const edge = previous.get(cursor);
    if (!edge) return null;
    edges.unshift(edge);
    cursor = edge.from_node_id;
  }

  return {
    nodeIds: [startId, ...edges.map((edge) => edge.to_node_id)],
    edges,
  };
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

const DISTANCE_SCORE_SCALE_KM = 10;

export function calculateDistanceScore(distanceKm) {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return 0;
  const normalizedDistance = distanceKm / DISTANCE_SCORE_SCALE_KM;
  return Math.round((1 / (1 + normalizedDistance)) * 100);
}

export function calculateRoute(db, originNodeId, destinationNodeId) {
  const result = shortestPath(db, originNodeId, destinationNodeId);
  if (!result) return null;

  const nodes = new Map(
    db
      .prepare("SELECT * FROM geo_nodes")
      .all()
      .map((node) => [node.id, node]),
  );
  const distanceKm = round(
    result.edges.reduce((total, edge) => total + edge.distance_km, 0),
  );
  const estimatedFarePhp = Math.round(
    result.edges.reduce((total, edge) => total + (edge.fare_php ?? 0), 0),
  );
  const firstNode = nodes.get(result.nodeIds[0]);
  const lastNode = nodes.get(result.nodeIds.at(-1));
  const modes = [...new Set(result.edges.map((edge) => edge.mode))];
  const mode = modes.length === 0
    ? "walk"
    : modes.length === 1
      ? modes[0]
      : "public-transport";
  const coordinates = result.nodeIds.flatMap((nodeId) => {
    const node = nodes.get(nodeId);
    return node ? [[node.longitude, node.latitude]] : [];
  });
  if (coordinates.length === 1) coordinates.push([...coordinates[0]]);

  return {
    routeId: `route-${originNodeId}-${destinationNodeId}`,
    mode,
    geometry: {
      type: "LineString",
      coordinates,
    },
    distanceKm,
    ...(estimatedFarePhp > 0 ? { estimatedFarePhp } : {}),
    steps: result.edges.map((edge, index) => ({
      order: index + 1,
      instruction: edge.instruction,
      distanceKm: round(edge.distance_km),
    })),
    textSummary:
      firstNode && lastNode
        ? `The shortest mapped route from ${firstNode.name} to ${lastNode.name} is ${distanceKm} km.`
        : `The shortest mapped route is ${distanceKm} km.`,
    isEstimate: true,
    locationScore: calculateDistanceScore(distanceKm),
  };
}
