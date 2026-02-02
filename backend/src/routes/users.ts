import express from "express";
import * as InvitesController from "../controllers/invites";

const router = express.Router();

// Get my received invitations
router.get("/me/invites", InvitesController.getMyInvites);

export default router;
