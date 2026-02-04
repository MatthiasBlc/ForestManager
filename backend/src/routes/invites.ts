import express from "express";
import * as InvitesController from "../controllers/invites";

const router = express.Router();

// Accept an invitation
router.post("/:inviteId/accept", InvitesController.acceptInvite);

// Reject an invitation
router.post("/:inviteId/reject", InvitesController.rejectInvite);

export default router;
