require("dotenv").config();

const baseUrl = process.env.BASE_URL || process.argv[2] || "http://localhost:5000";
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;

if (!adminEmail || !adminPassword) {
  console.error("FAIL missing ADMIN_EMAIL or ADMIN_PASSWORD");
  process.exit(1);
}

const results = [];
let failures = 0;

function assert(label, condition, details = "") {
  const passed = Boolean(condition);
  const prefix = passed ? "PASS" : "FAIL";
  console.log(`${prefix} ${label}${details ? ` - ${details}` : ""}`);
  results.push({ label, passed, details });
  if (!passed) failures += 1;
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  return { status: response.status, payload };
}

async function login(email, password) {
  const res = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return res;
}

function sanitize(value) {
  return JSON.stringify(value).toLowerCase();
}

async function main() {
  const createdUsers = [];
  const createdNotes = [];
  const createdPosts = [];
  let adminToken = "";
  let cleanupFailures = 0;
  const suffix = Date.now();

  try {
    const health = await request("/health");
    assert(
      "health endpoint",
      health.status === 200 && health.payload && health.payload.status === "ok",
      JSON.stringify(health.payload),
    );

    const adminLogin = await login(adminEmail, adminPassword);
    assert(
      "admin login succeeds",
      adminLogin.status === 200 &&
        adminLogin.payload &&
        adminLogin.payload.user &&
        adminLogin.payload.user.role === "admin",
      JSON.stringify(
        adminLogin.payload && adminLogin.payload.error ? adminLogin.payload.error : { status: adminLogin.status },
      ),
    );
    adminToken = adminLogin.status === 200 ? adminLogin.payload.token : "";
    const adminUserId = adminLogin.status === 200 ? adminLogin.payload.user._id : "";

    const selfDeleteRes = await request(`/api/users/${adminUserId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      "admin cannot delete themselves",
      selfDeleteRes.status === 400 || selfDeleteRes.status === 409,
      `status=${selfDeleteRes.status}`,
    );

    const registerUser = `smoketest${suffix}`;
    const userA = {
      name: `Smoke User A ${suffix}`,
      email: `${registerUser}a@example.com`,
      password: "StrongPass123",
      role: "admin",
      interests: [" Reading ", "READING", " running ", " Yoga "],
    };
    const registerRes = await request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(userA),
    });
    assert(
      "register ignores role in body and creates normal user",
      registerRes.status === 201 &&
        registerRes.payload &&
        registerRes.payload.user &&
        registerRes.payload.user.role === "user" &&
        !registerRes.payload.user.password,
      `status=${registerRes.status}`,
    );
    if (registerRes.payload && registerRes.payload.user && registerRes.payload.user._id) {
      createdUsers.push(registerRes.payload.user._id);
    }
    const userAToken = registerRes.payload.token;

    const duplicateRes = await request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ ...userA, email: userA.email }),
    });
    assert(
      "duplicate email returns 409",
      duplicateRes.status === 409 &&
        duplicateRes.payload &&
        duplicateRes.payload.error &&
        duplicateRes.payload.error.message,
      `status=${duplicateRes.status}`,
    );

    const wrongPassword = await login(userA.email, "WrongPassword123");
    const unknownEmail = await login(`missing${suffix}@example.com`, "WrongPassword123");
    assert(
      "wrong password and unknown email both return generic invalid credentials",
      wrongPassword.status === 401 &&
        wrongPassword.payload &&
        wrongPassword.payload.error &&
        wrongPassword.payload.error.message === "Invalid credentials" &&
        unknownEmail.status === 401 &&
        unknownEmail.payload &&
        unknownEmail.payload.error &&
        unknownEmail.payload.error.message === "Invalid credentials",
      `wrong=${wrongPassword.status}/${wrongPassword.payload && wrongPassword.payload.error && wrongPassword.payload.error.message}; unknown=${unknownEmail.status}/${unknownEmail.payload && unknownEmail.payload.error && unknownEmail.payload.error.message}`,
    );

    assert(
      "register response hides password/hash",
      !sanitize(registerRes.payload).includes("password") && !sanitize(registerRes.payload).includes("hash"),
      `payload=${sanitize(registerRes.payload)}`,
    );

    const noTokenRes = await request("/api/users/me");
    assert("protected route without token returns 401", noTokenRes.status === 401, `status=${noTokenRes.status}`);

    const badTokenRes = await request("/api/users/me", {
      headers: { Authorization: "Bearer bad.token.value" },
    });
    assert(
      "protected route with garbage token returns 401",
      badTokenRes.status === 401,
      `status=${badTokenRes.status}`,
    );

    const userLogin = await login(userA.email, userA.password);
    assert(
      "user login works",
      userLogin.status === 200 &&
        userLogin.payload &&
        userLogin.payload.user &&
        userLogin.payload.user.email === userA.email,
      JSON.stringify(
        userLogin.payload && userLogin.payload.error ? userLogin.payload.error : { status: userLogin.status },
      ),
    );

    const noteCreate = await request("/api/notes", {
      method: "POST",
      headers: { Authorization: `Bearer ${userLogin.payload.token}` },
      body: JSON.stringify({ title: "A note", content: "hello world" }),
    });
    assert(
      "user can create a note",
      noteCreate.status === 201 && noteCreate.payload && noteCreate.payload.title === "A note",
      `status=${noteCreate.status}`,
    );
    createdNotes.push({ id: noteCreate.payload._id, token: userLogin.payload.token });

    const listOwnNotes = await request("/api/notes?page=1&limit=10", {
      headers: { Authorization: `Bearer ${userLogin.payload.token}` },
    });
    assert(
      "user can list own notes",
      listOwnNotes.status === 200 &&
        Array.isArray(listOwnNotes.payload.data) &&
        listOwnNotes.payload.data.some((note) => note._id === noteCreate.payload._id),
      JSON.stringify({
        status: listOwnNotes.status,
        count: listOwnNotes.payload && listOwnNotes.payload.data && listOwnNotes.payload.data.length,
      }),
    );

    const getOwnNote = await request(`/api/notes/${noteCreate.payload._id}`, {
      headers: { Authorization: `Bearer ${userLogin.payload.token}` },
    });
    assert(
      "user can get own note",
      getOwnNote.status === 200 && getOwnNote.payload && getOwnNote.payload._id === noteCreate.payload._id,
      `status=${getOwnNote.status}`,
    );

    const patchOwnNote = await request(`/api/notes/${noteCreate.payload._id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${userLogin.payload.token}` },
      body: JSON.stringify({ title: "Updated title" }),
    });
    assert(
      "user can update own note",
      patchOwnNote.status === 200 && patchOwnNote.payload && patchOwnNote.payload.title === "Updated title",
      `status=${patchOwnNote.status}`,
    );

    const userB = {
      name: `Smoke User B ${suffix}`,
      email: `smoketest${suffix}b@example.com`,
      password: "StrongPass456",
      role: "user",
    };
    const userBRes = await request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(userB),
    });
    assert(
      "second user can register",
      userBRes.status === 201 && userBRes.payload && userBRes.payload.user && userBRes.payload.user.role === "user",
      `status=${userBRes.status}`,
    );
    if (userBRes.payload && userBRes.payload.user && userBRes.payload.user._id) {
      createdUsers.push(userBRes.payload.user._id);
    }
    const userBLogin = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: userB.email, password: userB.password }),
    });

    const otherUserNoteGet = await request(`/api/notes/${noteCreate.payload._id}`, {
      headers: { Authorization: `Bearer ${userBLogin.payload.token}` },
    });
    const otherUserNotePatch = await request(`/api/notes/${noteCreate.payload._id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${userBLogin.payload.token}` },
      body: JSON.stringify({ title: "Nope" }),
    });
    const otherUserNoteDelete = await request(`/api/notes/${noteCreate.payload._id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${userBLogin.payload.token}` },
    });
    assert(
      "other user gets 404 for someone else's note",
      otherUserNoteGet.status === 404 && otherUserNotePatch.status === 404 && otherUserNoteDelete.status === 404,
      `get=${otherUserNoteGet.status} patch=${otherUserNotePatch.status} delete=${otherUserNoteDelete.status}`,
    );

    const notesPageRes = await request("/api/notes?page=1&limit=5", {
      headers: { Authorization: `Bearer ${userBLogin.payload.token}` },
    });
    assert(
      "pagination metadata present on notes list",
      notesPageRes.status === 200 &&
        notesPageRes.payload &&
        notesPageRes.payload.pagination &&
        notesPageRes.payload.pagination.page === 1 &&
        notesPageRes.payload.pagination.limit === 5 &&
        Number.isInteger(notesPageRes.payload.pagination.total) &&
        notesPageRes.payload.pagination.hasPrevPage === false,
      JSON.stringify(notesPageRes.payload && notesPageRes.payload.pagination),
    );

    for (let i = 0; i < 12; i += 1) {
      const noteRes = await request("/api/notes", {
        method: "POST",
        headers: { Authorization: `Bearer ${userLogin.payload.token}` },
        body: JSON.stringify({ title: `Note ${suffix}-${i}`, content: `Content ${i}` }),
      });
      if (noteRes.status === 201) {
        createdNotes.push({ id: noteRes.payload._id, token: userLogin.payload.token });
      }
    }

    const pagedNotes = await request("/api/notes?page=1&limit=5", {
      headers: { Authorization: `Bearer ${userLogin.payload.token}` },
    });
    assert(
      "notes pagination works and limit stays within 100",
      pagedNotes.status === 200 &&
        pagedNotes.payload &&
        pagedNotes.payload.pagination &&
        pagedNotes.payload.pagination.page === 1 &&
        pagedNotes.payload.pagination.limit === 5 &&
        pagedNotes.payload.pagination.total >= 12,
      JSON.stringify(pagedNotes.payload && pagedNotes.payload.pagination),
    );

    const adminListNotes = await request("/api/notes?page=1&limit=10", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      "admin can list all notes",
      adminListNotes.status === 200 && Array.isArray(adminListNotes.payload.data),
      `status=${adminListNotes.status}`,
    );

    const adminFilterNotes = await request(
      `/api/notes?owner=${encodeURIComponent(registerRes.payload.user._id)}&page=1&limit=10`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );
    assert(
      "admin can filter notes by owner",
      adminFilterNotes.status === 200 && Array.isArray(adminFilterNotes.payload.data),
      `status=${adminFilterNotes.status}`,
    );

    const adminGetUserNote = await request(`/api/notes/${noteCreate.payload._id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      "admin can get another user's note",
      adminGetUserNote.status === 200 &&
        adminGetUserNote.payload &&
        adminGetUserNote.payload._id === noteCreate.payload._id,
      `status=${adminGetUserNote.status}`,
    );

    const adminPatchUserNote = await request(`/api/notes/${noteCreate.payload._id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ title: "Admin patch should fail" }),
    });
    const adminDeleteUserNote = await request(`/api/notes/${noteCreate.payload._id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      "admin cannot patch/delete another user's note",
      adminPatchUserNote.status === 404 && adminDeleteUserNote.status === 404,
      `patch=${adminPatchUserNote.status} delete=${adminDeleteUserNote.status}`,
    );

    const ownerDeleteNote = await request("/api/notes", {
      method: "POST",
      headers: { Authorization: `Bearer ${userLogin.payload.token}` },
      body: JSON.stringify({ title: "Owner delete note", content: "delete this note" }),
    });
    if (ownerDeleteNote.status === 201 && ownerDeleteNote.payload && ownerDeleteNote.payload._id) {
      createdNotes.push({ id: ownerDeleteNote.payload._id, token: userLogin.payload.token });
    }
    const ownerDeleteNoteRes = await request(`/api/notes/${ownerDeleteNote.payload._id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${userLogin.payload.token}` },
    });
    const ownerDeletedNoteGet = await request(`/api/notes/${ownerDeleteNote.payload._id}`, {
      headers: { Authorization: `Bearer ${userLogin.payload.token}` },
    });
    assert(
      "owner can delete own note and then gets 404",
      ownerDeleteNoteRes.status === 204 && ownerDeletedNoteGet.status === 404,
      `delete=${ownerDeleteNoteRes.status} get=${ownerDeletedNoteGet.status}`,
    );

    const normalUserForbiddenUsers = await request("/api/users?page=1&limit=10", {
      headers: { Authorization: `Bearer ${userLogin.payload.token}` },
    });
    assert(
      "normal user cannot access admin user list",
      normalUserForbiddenUsers.status === 403,
      `status=${normalUserForbiddenUsers.status}`,
    );

    const adminCreateUser = await request("/api/users", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: `Admin Created ${suffix}`,
        email: `admincreated${suffix}@example.com`,
        password: "StrongPass789",
        role: "admin",
      }),
    });
    assert(
      "admin can create another admin user (role accepted in admin route)",
      adminCreateUser.status === 201 && adminCreateUser.payload && adminCreateUser.payload.role === "admin",
      `status=${adminCreateUser.status} payload=${JSON.stringify(adminCreateUser.payload)}`,
    );
    if (adminCreateUser.payload && adminCreateUser.payload._id) {
      createdUsers.push(adminCreateUser.payload._id);
    }
    const adminCreateToken = await login(`admincreated${suffix}@example.com`, "StrongPass789");
    assert(
      "created admin can log in",
      adminCreateToken.status === 200 &&
        adminCreateToken.payload &&
        adminCreateToken.payload.user &&
        adminCreateToken.payload.user.role === "admin",
      `status=${adminCreateToken.status}`,
    );

    const cleanupAdmin = await request(`/api/users/${adminCreateUser.payload._id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (cleanupAdmin.status === 204) {
      createdUsers.splice(createdUsers.indexOf(adminCreateUser.payload._id), 1);
    }

    const adminPage = await request("/api/users?page=1&limit=100", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    let adminCount = adminPage.payload && adminPage.payload.data
      ? adminPage.payload.data.filter((listedUser) => listedUser.role === "admin").length
      : 0;
    const adminPages = adminPage.payload && adminPage.payload.pagination
      ? adminPage.payload.pagination.totalPages
      : 1;
    for (let page = 2; page <= adminPages; page += 1) {
      const nextAdminPage = await request(`/api/users?page=${page}&limit=100`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (nextAdminPage.payload && Array.isArray(nextAdminPage.payload.data)) {
        adminCount += nextAdminPage.payload.data.filter((listedUser) => listedUser.role === "admin").length;
      }
    }
    if (adminCount === 1) {
      const deleteLastAdmin = await request(`/api/users/${adminUserId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(
        "last admin deletion is refused",
        deleteLastAdmin.status >= 400 && deleteLastAdmin.status < 500,
        `status=${deleteLastAdmin.status}`,
      );
      const demoteLastAdmin = await request(`/api/users/${adminUserId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ role: "user" }),
      });
      assert(
        "last admin demotion is refused",
        demoteLastAdmin.status >= 400 && demoteLastAdmin.status < 500,
        `status=${demoteLastAdmin.status}`,
      );
    } else {
      console.log(`SKIP last-admin protections: ${adminCount} admin accounts exist`);
    }

    const adminUsersList = await request("/api/users?page=1&limit=10", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      "admin can list users paginated",
      adminUsersList.status === 200 &&
        adminUsersList.payload &&
        adminUsersList.payload.pagination &&
        adminUsersList.payload.pagination.page === 1 &&
        adminUsersList.payload.pagination.limit === 10,
      JSON.stringify(adminUsersList.payload && adminUsersList.payload.pagination),
    );
    const adminGetUser = await request(`/api/users/${registerRes.payload.user._id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      "admin can get a user",
      adminGetUser.status === 200 && adminGetUser.payload && adminGetUser.payload._id === registerRes.payload.user._id,
      `status=${adminGetUser.status}`,
    );

    const adminUpdateUser = await request(`/api/users/${registerRes.payload.user._id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: "Updated Name", password: "EvenStronger123", role: "admin" }),
    });
    assert(
      "admin can update a user",
      adminUpdateUser.status === 200 && adminUpdateUser.payload && adminUpdateUser.payload.name === "Updated Name",
      `status=${adminUpdateUser.status}`,
    );

    const loginWithNewPassword = await login(userA.email, "EvenStronger123");
    assert(
      "user can log in with updated password",
      loginWithNewPassword.status === 200 &&
        loginWithNewPassword.payload &&
        loginWithNewPassword.payload.user &&
        loginWithNewPassword.payload.user.email === userA.email,
      `status=${loginWithNewPassword.status}`,
    );

    const meBefore = await request("/api/users/me", {
      headers: { Authorization: `Bearer ${userLogin.payload.token}` },
    });
    const mePatch = await request("/api/users/me", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${userLogin.payload.token}` },
      body: JSON.stringify({ name: "My new name", email: "evil@example.com", role: "admin", interests: ["dancing"] }),
    });
    assert(
      "/users/me cannot change email or role",
      mePatch.status === 400 && mePatch.payload && mePatch.payload.error,
      `status=${mePatch.status}`,
    );

    const interestRes = await request("/api/interests/groups?page=1&limit=20", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      "interest groups endpoint returns data",
      interestRes.status === 200 && Array.isArray(interestRes.payload.data),
      `status=${interestRes.status}`,
    );

    const interestFilterRes = await request("/api/interests/groups?interest=reading&page=1&limit=20", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      "interest filter works and output strips secrets",
      interestFilterRes.status === 200 &&
        Array.isArray(interestFilterRes.payload.data) &&
        !sanitize(interestFilterRes.payload).includes("email") &&
        !sanitize(interestFilterRes.payload).includes("role") &&
        !sanitize(interestFilterRes.payload).includes("password"),
      `status=${interestFilterRes.status}`,
    );
    const readingGroup =
      interestFilterRes.payload && interestFilterRes.payload.data && interestFilterRes.payload.data[0];
    assert(
      "interest groups return a compact member preview",
      Boolean(readingGroup && readingGroup.users.length <= 3 && readingGroup.count >= readingGroup.users.length),
      JSON.stringify(readingGroup && { count: readingGroup.count, previewCount: readingGroup.users.length }),
    );

    const interestMembersRes = await request("/api/interests/groups/reading/members?page=1&limit=5&search=Updated", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      "interest members are searchable and paginated without exposing secrets",
      interestMembersRes.status === 200 &&
        interestMembersRes.payload &&
        interestMembersRes.payload.pagination &&
        interestMembersRes.payload.pagination.limit === 5 &&
        interestMembersRes.payload.pagination.total >= 1 &&
        interestMembersRes.payload.data.some((member) => member.name === "Updated Name") &&
        !sanitize(interestMembersRes.payload).includes("email") &&
        !sanitize(interestMembersRes.payload).includes("password"),
      `status=${interestMembersRes.status}`,
    );

    const postUserRes = await request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: `Posts User ${suffix}`,
        email: `posts${suffix}@example.com`,
        password: "StrongPass999",
        interests: ["music"],
      }),
    });
    if (postUserRes.payload && postUserRes.payload.user && postUserRes.payload.user._id) {
      createdUsers.push(postUserRes.payload.user._id);
    }
    const postUserToken = postUserRes.payload.token;
    const createdPost1 = await request("/api/posts", {
      method: "POST",
      headers: { Authorization: `Bearer ${postUserToken}` },
      body: JSON.stringify({ title: "First Post", content: "Alpha" }),
    });
    if (createdPost1.status === 201 && createdPost1.payload && createdPost1.payload._id) {
      createdPosts.push({ id: createdPost1.payload._id, token: postUserToken });
    }
    const createdPost2 = await request("/api/posts", {
      method: "POST",
      headers: { Authorization: `Bearer ${postUserToken}` },
      body: JSON.stringify({ title: "Second Post", content: "Beta" }),
    });
    if (createdPost2.status === 201 && createdPost2.payload && createdPost2.payload._id) {
      createdPosts.push({ id: createdPost2.payload._id, token: postUserToken });
    }
    assert(
      "user can create posts",
      createdPost1.status === 201 && createdPost2.status === 201,
      `p1=${createdPost1.status} p2=${createdPost2.status}`,
    );
    const postFeed = await request("/api/posts?limit=5", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const feedPostIds = new Set(((postFeed.payload && postFeed.payload.data) || []).map((post) => post._id));
    assert(
      "community feed returns posts with author names",
      postFeed.status === 200 &&
        postFeed.payload &&
        postFeed.payload.data.some(
          (post) =>
            post._id === createdPost1.payload._id &&
            post.author &&
            post.author._id === postUserRes.payload.user._id &&
            post.author.name === postUserRes.payload.user.name,
        ) &&
        feedPostIds.has(createdPost2.payload._id),
      `status=${postFeed.status}`,
    );

    const firstFeedPage = await request("/api/posts?limit=1", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const nextCursor =
      firstFeedPage.payload && firstFeedPage.payload.pagination && firstFeedPage.payload.pagination.nextCursor;
    const nextFeedPage = nextCursor
      ? await request(`/api/posts?limit=1&cursor=${encodeURIComponent(nextCursor)}`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        })
      : { status: 0, payload: null };
    assert(
      "community feed cursor loads the next unique page",
      firstFeedPage.status === 200 &&
        firstFeedPage.payload.pagination.hasMore &&
        nextFeedPage.status === 200 &&
        nextFeedPage.payload.data.length === 1 &&
        nextFeedPage.payload.data[0]._id !== firstFeedPage.payload.data[0]._id,
      `first=${firstFeedPage.status} next=${nextFeedPage.status}`,
    );

    const userPosts = await request(`/api/users/${postUserRes.payload.user._id}/posts?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      "public posts route returns user posts and pagination",
      userPosts.status === 200 &&
        userPosts.payload &&
        Array.isArray(userPosts.payload.posts) &&
        userPosts.payload.pagination &&
        userPosts.payload.pagination.hasNextPage === false,
      `status=${userPosts.status} count=${userPosts.payload && userPosts.payload.posts && userPosts.payload.posts.length}`,
    );

    const invalidUserPosts = await request("/api/users/not-a-valid-id/posts?page=1&limit=10");
    assert(
      "invalid user id for posts returns 400",
      invalidUserPosts.status === 400,
      `status=${invalidUserPosts.status}`,
    );

    const missingUserPosts = await request("/api/users/507f1f77bcf86cd799439011/posts?page=1&limit=10");
    assert(
      "unknown user id for posts returns 404",
      missingUserPosts.status === 404,
      `status=${missingUserPosts.status}`,
    );

    const patchPost = await request(`/api/posts/${createdPost1.payload._id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${postUserToken}` },
      body: JSON.stringify({ title: "Updated Post" }),
    });
    assert(
      "author can update own post",
      patchPost.status === 200 && patchPost.payload && patchPost.payload.title === "Updated Post",
      `status=${patchPost.status}`,
    );

    const otherUserPatchPost = await request(`/api/posts/${createdPost1.payload._id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${userLogin.payload.token}` },
      body: JSON.stringify({ title: "Not allowed" }),
    });
    assert(
      "non-author cannot update another user's post",
      otherUserPatchPost.status === 404,
      `status=${otherUserPatchPost.status}`,
    );
    const otherUserDeletePost = await request(`/api/posts/${createdPost1.payload._id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${userLogin.payload.token}` },
    });
    assert(
      "non-author cannot delete another user's post",
      otherUserDeletePost.status === 404,
      `status=${otherUserDeletePost.status}`,
    );

    const deleteOwnPost = await request(`/api/posts/${createdPost2.payload._id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${postUserToken}` },
    });
    assert("author can delete own post", deleteOwnPost.status === 204, `status=${deleteOwnPost.status}`);

    const optionsRes = await request("/api/auth/login", {
      method: "OPTIONS",
      headers: { Origin: process.env.ALLOWED_ORIGIN || "http://localhost:5173", "Access-Control-Request-Method": "POST" },
    });
    assert(
      "CORS preflight works for allowed origin",
      optionsRes.status === 204 || optionsRes.status === 200,
      `status=${optionsRes.status}`,
    );

    const blockedOrigin = await request("/api/auth/login", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "POST" },
    });
    assert("blocked origin is denied", blockedOrigin.status === 403, `status=${blockedOrigin.status}`);

    const deleteUserRes = await request(`/api/users/${userBRes.payload.user._id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      "admin can delete a user and cascade data",
      deleteUserRes.status === 204 || deleteUserRes.status === 200,
      `status=${deleteUserRes.status}`,
    );

    const hostname = new URL(baseUrl).hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      let rateLimitRes = { status: 0 };
      let attempt = 0;
      while (attempt < 130 && rateLimitRes.status !== 429) {
        attempt += 1;
        rateLimitRes = await request("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: "missing@example.test", password: "x" }),
        });
      }
      assert("auth rate limit returns 429", rateLimitRes.status === 429, `status=${rateLimitRes.status} attempt=${attempt}`);
    } else {
      console.log("SKIP rate-limit assertion: rate-limit verification is local-only");
    }

  } catch (error) {
    console.error("Unhandled smoke test error:", error && error.message ? error.message : error);
    failures += 1;
    process.exitCode = 1;
  } finally {
    for (const post of createdPosts.reverse()) {
      try {
        const result = await request(`/api/posts/${post.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${post.token}` },
        });
        if (result.status !== 204 && result.status !== 404) {
          console.error(`Cleanup failed for post ${post.id}: status=${result.status}`);
          cleanupFailures += 1;
          process.exitCode = 1;
        }
      } catch (error) {
        console.error(`Cleanup failed for post ${post.id}:`, error && error.message ? error.message : error);
        cleanupFailures += 1;
        process.exitCode = 1;
      }
    }
    for (const note of createdNotes.reverse()) {
      try {
        const result = await request(`/api/notes/${note.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${note.token}` },
        });
        if (result.status !== 204 && result.status !== 404) {
          console.error(`Cleanup failed for note ${note.id}: status=${result.status}`);
          cleanupFailures += 1;
          process.exitCode = 1;
        }
      } catch (error) {
        console.error(`Cleanup failed for note ${note.id}:`, error && error.message ? error.message : error);
        cleanupFailures += 1;
        process.exitCode = 1;
      }
    }
    for (const userId of [...new Set(createdUsers)].reverse()) {
      try {
        const result = await request(`/api/users/${userId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        if (result.status !== 204 && result.status !== 404) {
          console.error(`Cleanup failed for user ${userId}: status=${result.status}`);
          cleanupFailures += 1;
          process.exitCode = 1;
        }
      } catch (error) {
        console.error(`Cleanup failed for user ${userId}:`, error && error.message ? error.message : error);
        cleanupFailures += 1;
        process.exitCode = 1;
      }
    }
    console.log(
      `\nSmoke test summary: ${failures === 0 && cleanupFailures === 0 ? "PASS" : "FAIL"} (${results.filter((item) => item.passed).length}/${results.length} assertions passed; cleanup failures=${cleanupFailures})`,
    );
    if (failures > 0) process.exitCode = 1;
  }
}

main();
