import { createHttpError } from "./response.js";

const issuePopulateOptionsByRole = {
  citizen: [
    { path: "assignedTo", select: "name" },
    { path: "department", select: "name" }
  ],
  staff: [
    { path: "citizen", select: "name" },
    { path: "assignedTo", select: "name" },
    { path: "department", select: "name" }
  ],
  admin: [
    { path: "citizen", select: "name email" },
    { path: "assignedTo", select: "name email" },
    { path: "department", select: "name" }
  ]
};

export const getIssuePopulateOptions = (role) => {
  return issuePopulateOptionsByRole[role] || issuePopulateOptionsByRole.citizen;
};

export const assertCanCreateIssue = (user) => {
  if (user && user.role !== "citizen") {
    throw createHttpError("Citizen access required to create issues", 403);
  }
};

export const assertCanViewIssue = (user, issue) => {
  if (!user) {
    throw createHttpError("Authentication required", 401);
  }

  if (user.role === "admin") {
    return;
  }

  if (user.role === "citizen") {
    if (!issue.citizen || issue.citizen.toString() !== user.id) {
      throw createHttpError("Not authorized to view this issue", 403);
    }
    return;
  }

  if (user.role === "staff") {
    const assignedTo = issue.assignedTo ? issue.assignedTo.toString() : null;
    const department = issue.department ? issue.department.toString() : null;

    if (assignedTo === user.id) {
      return;
    }

    if (user.department && department && user.department.toString() === department) {
      return;
    }

    throw createHttpError("Not authorized to view this issue", 403);
  }

  throw createHttpError("Access denied", 403);
};
