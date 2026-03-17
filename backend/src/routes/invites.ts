import express from "express";
import * as InvitesController from "../controllers/invites";
import { validateUUID } from "../middleware/validateUUID";

const router = express.Router();

// Accept an invitation
router.post("/:inviteId/accept", validateUUID, InvitesController.acceptInvite);

// Reject an invitation
router.post("/:inviteId/reject", validateUUID, InvitesController.rejectInvite);

export default router;
