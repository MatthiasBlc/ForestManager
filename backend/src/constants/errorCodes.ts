// =====================================
// Auth
// =====================================
export const AUTH_001 = "AUTH_001: Not authenticated";
export const AUTH_002 = "AUTH_002: Missing required parameters";
export const AUTH_003 = "AUTH_003: Invalid email format";
export const AUTH_004_LENGTH = (min: number, max: number) =>
  `AUTH_004: Username must be between ${min} and ${max} characters`;
export const AUTH_004_FORMAT =
  "AUTH_004: Username can only contain letters, numbers, and underscores";
export const AUTH_005 = (min: number, max: number) =>
  `AUTH_005: Password must be between ${min} and ${max} characters`;
export const AUTH_006 = "AUTH_006: Username already taken";
export const AUTH_007 = "AUTH_007: Email already in use";
export const AUTH_008 = "AUTH_008: Invalid credentials";
export const AUTH_009 = "AUTH_009: Account deactivated";
export const AUTH_010 = "AUTH_010: Current password is required to change password";
export const AUTH_011 = "AUTH_011: Current password is incorrect";
export const AUTH_012 = "AUTH_012: Too many attempts, please try again later";

// =====================================
// User
// =====================================
export const USER_001 = "USER_001: User not found";

// =====================================
// Community
// =====================================
export const COMMUNITY_001 = "COMMUNITY_001: Not a member of this community";
export const COMMUNITY_002 = "COMMUNITY_002: Permission insufficient";
export const COMMUNITY_003 =
  "COMMUNITY_003: Last moderator cannot leave. Promote another member first";
export const COMMUNITY_004 = "COMMUNITY_004: User already member";
export const COMMUNITY_005 = "COMMUNITY_005: Invitation already pending";
export const COMMUNITY_006 = "COMMUNITY_006: Cannot remove a moderator";

// =====================================
// Recipe
// =====================================
export const RECIPE_001 = "RECIPE_001: Recipe not found";
export const RECIPE_002 = "RECIPE_002: Cannot access this recipe";
export const RECIPE_003 = "RECIPE_003: Title required";
export const RECIPE_005 = (msg: string) => `RECIPE_005: ${msg}`;
export const RECIPE_006 = "RECIPE_006: Servings must be an integer between 1 and 100";
export const RECIPE_007 =
  "RECIPE_007: At least one step required, each instruction non-empty (max 5000 chars)";
export const RECIPE_008 = "RECIPE_008: Invalid prep time (integer 0-10000)";
export const RECIPE_009 = (max: number) => `RECIPE_009: Too many tags (max ${max})`;

// =====================================
// Tag
// =====================================
export const TAG_001 = (msg: string) => `TAG_001: ${msg}`;
export const TAG_002 = "TAG_002: A global tag with this name already exists";
export const TAG_003 = "TAG_003: Maximum 10 tags per recipe";
export const TAG_004 = "TAG_004: Tag is not pending";
export const TAG_005 = "TAG_005: Cannot modify a tag that does not belong to this community";
export const TAG_006 = "TAG_006: You already suggested this tag on this recipe";
export const TAG_007 = "TAG_007: Cannot suggest tags on personal recipes";

// =====================================
// Invite
// =====================================
export const INVITE_001 = "INVITE_001: Invite not found";
export const INVITE_002 = "INVITE_002: Invite already processed";
export const INVITE_003 = "INVITE_003: User not found";
export const INVITE_004 = "INVITE_004: One of email, username, or userId is required";
export const INVITE_005 = "INVITE_005: Only one of email, username, or userId should be provided";
export const INVITE_006 = "INVITE_006: Not authorized to accept/reject this invitation";

// =====================================
// Member
// =====================================
export const MEMBER_001 = "MEMBER_001: Role is required";
export const MEMBER_002 = "MEMBER_002: Only promotion to MODERATOR is allowed";
export const MEMBER_003 = "MEMBER_003: Member not found";
export const MEMBER_004 = "MEMBER_004: User is already MODERATOR";

// =====================================
// Proposal
// =====================================
export const PROPOSAL_001 = "PROPOSAL_001: Cannot propose on personal recipe";
export const PROPOSAL_002 = "PROPOSAL_002: Proposal already decided";
export const PROPOSAL_003 = "PROPOSAL_003: Recipe has been modified since proposal was created";
export const PROPOSAL_004 = "PROPOSAL_004: Proposal not found";

// =====================================
// Share
// =====================================
export const SHARE_001 = "SHARE_001: Target community ID required";
export const SHARE_002 = "SHARE_002: Cannot share personal recipes";
export const SHARE_003 = "SHARE_003: Cannot share to same community";
export const SHARE_004 = "SHARE_004: Not a member of target community";
export const SHARE_005 = "SHARE_005: Must be recipe creator or moderator in one of the communities";
export const SHARE_006 = "SHARE_006: Recipe already shared with this community";

// =====================================
// Publish
// =====================================
export const PUBLISH_001 = "PUBLISH_001: At least one community ID required";
export const PUBLISH_002 = "PUBLISH_002: Can only publish personal recipes";
export const PUBLISH_003 = (communityId: string) =>
  `PUBLISH_003: Not a member of community ${communityId}`;

// =====================================
// Notification
// =====================================
export const NOTIF_001 = "NOTIF_001: Notification not found";
export const NOTIF_002 = "NOTIF_002: Notification belongs to another user";
export const NOTIF_003 = "NOTIF_003: Invalid notification category";
export const NOTIF_004 = "NOTIF_004: ids must be a non-empty array";
export const NOTIF_005 = "NOTIF_005: enabled must be a boolean";

// =====================================
// Ingredient
// =====================================
export const INGREDIENT_003 = "INGREDIENT_003: Too many ingredients (max 50)";

// =====================================
// Import
// =====================================
export const IMPORT_001 = "IMPORT_001: Invalid URL format";
export const IMPORT_002 = "IMPORT_002: Could not fetch URL";
export const IMPORT_003 = "IMPORT_003: No recipe data found";

// =====================================
// Validation
// =====================================
export const VALIDATION_001 = (msg: string) => `VALIDATION_001: ${msg}`;
export const VALIDATION_001_TYPE = "VALIDATION_001: must be a string";

// =====================================
// CSRF
// =====================================
export const CSRF_001 = "CSRF_001: Invalid or missing CSRF token";

// =====================================
// Admin Auth
// =====================================
export const ADMIN_001 = "ADMIN_001: Not authenticated";
export const ADMIN_002 = "ADMIN_002: TOTP not verified";
export const ADMIN_003 = "ADMIN_003: Email and password required";
export const ADMIN_004 = "ADMIN_004: Invalid credentials";
export const ADMIN_005 = "ADMIN_005: TOTP code required";
export const ADMIN_006 = "ADMIN_006: Too many failed attempts, please login again";
export const ADMIN_007 = "ADMIN_007: Invalid TOTP code";
export const ADMIN_008 = "ADMIN_008: Logout failed";
export const ADMIN_009 = "ADMIN_009: Admin not found";
export const ADMIN_010 = "ADMIN_010: Too many login attempts, please try again later";
export const ADMIN_011 = "ADMIN_011: Too many requests, please slow down";

// =====================================
// Admin Tags
// =====================================
export const ADMIN_TAG_001 = "ADMIN_TAG_001: Tag name is required";
export const ADMIN_TAG_001_LENGTH = "ADMIN_TAG_001: Tag name must be between 2 and 50 characters";
export const ADMIN_TAG_002 = "ADMIN_TAG_002: Tag already exists";
export const ADMIN_TAG_003 = "ADMIN_TAG_003: Tag not found";
export const ADMIN_TAG_004 = "ADMIN_TAG_004: Target tag ID required";
export const ADMIN_TAG_005 = "ADMIN_TAG_005: Cannot merge tag into itself";
export const ADMIN_TAG_006 = "ADMIN_TAG_006: Target tag not found";

// =====================================
// Admin Units
// =====================================
export const ADMIN_UNIT_001 = "ADMIN_UNIT_001: Name is required";
export const ADMIN_UNIT_002 = "ADMIN_UNIT_002: Abbreviation is required";
export const ADMIN_UNIT_003 =
  "ADMIN_UNIT_003: Valid category is required (WEIGHT, VOLUME, SPOON, COUNT, QUALITATIVE)";
export const ADMIN_UNIT_004 = "ADMIN_UNIT_004: Unit name already exists";
export const ADMIN_UNIT_005 = "ADMIN_UNIT_005: Abbreviation already exists";
export const ADMIN_UNIT_006 = "ADMIN_UNIT_006: Unit not found";
export const ADMIN_UNIT_007 =
  "ADMIN_UNIT_007: Cannot delete unit that is in use. Migrate recipes to another unit first.";

// =====================================
// Admin Recipes
// =====================================
export const ADMIN_REC_001 = "ADMIN_REC_001: Tag not found";
export const ADMIN_REC_002 = "ADMIN_REC_002: Recipe not found";
export const ADMIN_REC_003 = "ADMIN_REC_003: Recipe already deleted";

// =====================================
// Admin Ingredients
// =====================================
export const ADMIN_ING_001 = "ADMIN_ING_001: Name is required";
export const ADMIN_ING_002 = "ADMIN_ING_002: Ingredient already exists";
export const ADMIN_ING_003 = "ADMIN_ING_003: Ingredient not found";
export const ADMIN_ING_004 = "ADMIN_ING_004: Target ingredient ID required";
export const ADMIN_ING_005 = "ADMIN_ING_005: Cannot merge ingredient into itself";
export const ADMIN_ING_006 = "ADMIN_ING_006: Target ingredient not found";
export const ADMIN_ING_007 = "ADMIN_ING_007: Default unit not found";
export const ADMIN_ING_008 = "ADMIN_ING_008: Ingredient is not pending";
export const ADMIN_ING_009 = "ADMIN_ING_009: Reason is required";

// =====================================
// Admin Communities
// =====================================
export const ADMIN_COM_001 = "ADMIN_COM_001: Community not found";
export const ADMIN_COM_002 = "ADMIN_COM_002: Name is required";
export const ADMIN_COM_003 = "ADMIN_COM_003: Community already deleted";

// =====================================
// Admin Features
// =====================================
export const ADMIN_FEAT_001 = "ADMIN_FEAT_001: Code is required";
export const ADMIN_FEAT_002 = "ADMIN_FEAT_002: Name is required";
export const ADMIN_FEAT_003 = "ADMIN_FEAT_003: Feature code already exists";
export const ADMIN_FEAT_004 = "ADMIN_FEAT_004: Feature not found";
export const ADMIN_FEAT_005 = "ADMIN_FEAT_005: Feature already granted";
export const ADMIN_FEAT_006 = "ADMIN_FEAT_006: Feature not granted to this community";

// =====================================
// Admin Changelog
// =====================================
export const CHANGELOG_001 = "CHANGELOG_001: Changelog entry not found";
export const CHANGELOG_002 = "CHANGELOG_002: Version already exists";
export const CHANGELOG_003 = "CHANGELOG_003: Invalid content format";
export const CHANGELOG_004 = "CHANGELOG_004: Invalid version format (expected semver x.y.z)";
