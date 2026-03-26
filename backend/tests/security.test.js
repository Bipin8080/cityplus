import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { protect, optionalProtect } from "../middleware/authMiddleware.js";
import { changePassword } from "../controllers/authController.js";
import { assertCanCreateIssue, assertCanViewIssue } from "../utils/issueAccess.js";
import User from "../models/User.js";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

function createResponseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

test("protect attaches the authenticated user fields expected by controllers", async () => {
  const token = jwt.sign({ id: "user-1", role: "citizen" }, process.env.JWT_SECRET);
  const originalFindById = User.findById;

  User.findById = () => ({
    populate: async () => ({
      _id: "user-1",
      role: "citizen",
      name: "Test Citizen",
      email: "citizen@example.com",
      status: "active",
      department: null
    })
  });

  const req = {
    headers: {
      authorization: `Bearer ${token}`
    }
  };
  const res = createResponseRecorder();
  let nextCalled = false;

  await protect(req, res, () => {
    nextCalled = true;
  });

  User.findById = originalFindById;

  assert.equal(nextCalled, true);
  assert.deepEqual(req.user, {
    id: "user-1",
    role: "citizen",
    name: "Test Citizen",
    email: "citizen@example.com",
    status: "active",
    emailNotifications: true,
    department: null,
    departmentName: null
  });
});

test("optionalProtect allows anonymous requests and still attaches valid users", async () => {
  const anonReq = { headers: {} };
  const anonRes = createResponseRecorder();
  let anonNextCalled = false;

  await optionalProtect(anonReq, anonRes, () => {
    anonNextCalled = true;
  });

  assert.equal(anonNextCalled, true);
  assert.equal(anonReq.user, null);

  const token = jwt.sign({ id: "user-2", role: "citizen" }, process.env.JWT_SECRET);
  const originalFindById = User.findById;

  User.findById = () => ({
    populate: async () => ({
      _id: "user-2",
      role: "citizen",
      name: "Guest Citizen",
      email: "guest@example.com",
      status: "active",
      department: null
    })
  });

  const authReq = {
    headers: {
      authorization: `Bearer ${token}`
    }
  };
  let authNextCalled = false;

  await optionalProtect(authReq, createResponseRecorder(), () => {
    authNextCalled = true;
  });

  User.findById = originalFindById;

  assert.equal(authNextCalled, true);
  assert.equal(authReq.user.email, "guest@example.com");
});

test("changePassword uses the authenticated user instead of a body email", async () => {
  const originalFindById = User.findById;
  const savedUsers = [];
  const fakeUser = {
    password: await bcrypt.hash("secret123", 1),
    save: async function () {
      savedUsers.push(this);
    }
  };

  User.findById = async (id) => {
    assert.equal(id, "user-42");
    return fakeUser;
  };

  const req = {
    user: { id: "user-42" },
    body: {
      email: "other@example.com",
      currentPassword: "secret123",
      newPassword: "newsecret123"
    }
  };
  const res = createResponseRecorder();
  let nextError = null;

  await changePassword(req, res, (error) => {
    nextError = error;
  });

  User.findById = originalFindById;

  assert.equal(nextError, null);
  assert.equal(savedUsers.length, 1);
  assert.equal(await bcrypt.compare("newsecret123", fakeUser.password), true);
  assert.equal(res.body.message, "Password changed successfully");
});

test("issue access helper blocks cross-account citizen reads", () => {
  assert.throws(() => {
    assertCanViewIssue(
      { id: "citizen-1", role: "citizen" },
      { citizen: "citizen-2" }
    );
  }, /Not authorized to view this issue/);
});

test("issue creation helper allows anonymous users but blocks non-citizens", () => {
  assert.doesNotThrow(() => {
    assertCanCreateIssue(null);
  });

  assert.throws(() => {
    assertCanCreateIssue({ id: "staff-1", role: "staff" });
  }, /Citizen access required/);
});
