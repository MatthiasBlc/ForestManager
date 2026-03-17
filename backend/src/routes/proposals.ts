import express from "express";
import * as ProposalsController from "../controllers/proposals";
import { validateUUID } from "../middleware/validateUUID";

const router = express.Router();

// GET /api/proposals/:proposalId - Detail d'une proposition
router.get("/:proposalId", validateUUID, ProposalsController.getProposal);

// POST /api/proposals/:proposalId/accept - Accepter une proposition
router.post("/:proposalId/accept", validateUUID, ProposalsController.acceptProposal);

// POST /api/proposals/:proposalId/reject - Refuser une proposition
router.post("/:proposalId/reject", validateUUID, ProposalsController.rejectProposal);

export default router;
