import { findSkillId } from "./db.js";
import { calculateRoute } from "./routing.js";

function skillGraph(db) {
  const graph = new Map();
  for (const relation of db.prepare("SELECT * FROM skill_relations").all()) {
    const neighbors = graph.get(relation.from_skill_id) ?? [];
    neighbors.push(relation.to_skill_id);
    graph.set(relation.from_skill_id, neighbors);
  }
  return graph;
}

function shortestSkillPath(graph, startId, destinationId) {
  if (startId === destinationId) return [startId];
  const queue = [[startId]];
  const visited = new Set([startId]);

  while (queue.length) {
    const path = queue.shift();
    const current = path.at(-1);
    for (const neighbor of graph.get(current) ?? []) {
      if (visited.has(neighbor)) continue;
      const nextPath = [...path, neighbor];
      if (neighbor === destinationId) return nextPath;
      visited.add(neighbor);
      queue.push(nextPath);
    }
  }

  return null;
}

function labelMap(db) {
  return new Map(
    db
      .prepare("SELECT id, name FROM skills")
      .all()
      .map((skill) => [skill.id, skill.name]),
  );
}

function bestEvidence(db, graph, labels, requirement, userSkills) {
  const requirementId = findSkillId(db, requirement);
  let best = null;

  for (const userSkill of userSkills) {
    const path = shortestSkillPath(graph, userSkill.id, requirementId);
    if (!path) continue;
    const distance = path.length - 1;
    const credit = 1 / (1 + distance);
    if (!best || credit > best.credit) {
      best = { userSkill, path, credit };
    }
  }

  if (!best) {
    return {
      skillId: requirementId,
      label: requirement,
      kind: "missing",
      credit: 0,
    };
  }

  return {
    skillId: requirementId,
    label: requirement,
    kind: best.credit === 1 ? "exact" : "related",
    credit: Math.round(best.credit * 100) / 100,
    ...(best.credit < 1
      ? {
          ontologyPath: best.path.map((id) => labels.get(id) ?? id),
        }
      : {}),
    evidenceSource: best.userSkill.source,
  };
}

export function calculateSkillMatch(db, requiredSkills, userSkills) {
  const graph = skillGraph(db);
  const labels = labelMap(db);
  const evidence = requiredSkills.map((requirement) =>
    bestEvidence(db, graph, labels, requirement, userSkills),
  );
  const total = evidence.reduce((sum, item) => sum + item.credit, 0);
  const skillScore = requiredSkills.length
    ? Math.round((total / requiredSkills.length) * 100)
    : 0;

  return {
    skillScore,
    exactSkills: evidence.filter((item) => item.kind === "exact"),
    relatedSkills: evidence.filter((item) => item.kind === "related"),
    missingSkills: evidence.filter((item) => item.kind === "missing"),
  };
}

export function isMatchingProfileComplete(db, profile, userSkills) {
  if (!profile || userSkills.length === 0) return false;

  const mobileNumber = String(profile.mobile_number ?? "").replace(/[\s()-]/g, "");
  const hasRequiredDetails =
    String(profile.full_name ?? "").trim().length >= 2 &&
    /^(?:\+639|09)\d{9}$/.test(mobileNumber) &&
    Boolean(String(profile.barangay ?? "").trim()) &&
    Boolean(String(profile.city ?? "").trim());
  const hasValidHomeNode = Boolean(
    db.prepare("SELECT 1 FROM geo_nodes WHERE id = ?").get(profile.home_node_id),
  );

  return hasRequiredDetails && hasValidHomeNode;
}

export function getUserMatch(db, userId, job) {
  const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(userId);
  const userSkills = db.prepare(`
    SELECT skills.id, skills.name, user_skills.source
    FROM user_skills
    JOIN skills ON skills.id = user_skills.skill_id
    WHERE user_skills.user_id = ?
  `).all(userId);

  if (!isMatchingProfileComplete(db, profile, userSkills) || !job.geoNodeId) {
    return null;
  }

  const route = calculateRoute(db, profile.home_node_id, job.geoNodeId);
  if (!route) return null;

  const skill = calculateSkillMatch(
    db,
    job.requirements.requiredSkills ?? [],
    userSkills,
  );
  const overallScore = Math.round(
    skill.skillScore * 0.7 + route.locationScore * 0.3,
  );
  const exactCount = skill.exactSkills.length;
  const relatedCount = skill.relatedSkills.length;
  const missingCount = skill.missingSkills.length;

  return {
    overallScore,
    skillScore: skill.skillScore,
    locationScore: route.locationScore,
    weights: { skill: 0.7, location: 0.3 },
    exactSkills: skill.exactSkills,
    relatedSkills: skill.relatedSkills,
    missingSkills: skill.missingSkills,
    summary: `${exactCount} exact, ${relatedCount} related, and ${missingCount} missing required skills. The mapped route is ${route.distanceKm} km from your saved home area.`,
    route,
  };
}
