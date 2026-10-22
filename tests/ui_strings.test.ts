import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { UIStrings, getErrorMessage } from "../apps/ui/i18n/strings.ts";
import { ErrorCodes } from "../contracts/errors/codes.ts";

describe("Frontend Presentation String Table Tests (R6)", () => {
  test("every typed ErrorCode has an associated user-facing message", () => {
    for (const code of Object.values(ErrorCodes)) {
      const msg = getErrorMessage(code);
      assert.ok(msg.length > 0);
      assert.notEqual(msg, "An unexpected error occurred.");
    }
  });

  test("chat UI strings are non-empty", () => {
    assert.ok(UIStrings.chat.composerPlaceholder.length > 0);
    assert.ok(UIStrings.chat.myDocuments.length > 0);
  });
});
